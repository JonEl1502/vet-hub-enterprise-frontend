import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, X, ScanLine, LayoutGrid, TrendingUp, AlertTriangle, CircleSlash, Moon, Plus, PackageOpen,
} from 'lucide-react';
import PosScanner from './PosScanner';
import type { PosController } from './usePos';
import type { PosProduct } from '../../../services';
import { categoryTheme } from './categoryTheme';
import { priceShort, unitFor, qtyText } from './format';

/**
 * The catalogue half of the till: scan bar, chips, product grid.
 *
 * On a phone this is the whole screen (the cart lives in a sheet below); on a
 * desktop it is the left pane with the cart rail beside it. Same component,
 * same markup — only the parent's layout changes.
 */

/** The cross-cutting filters, on top of the shop's own categories. */
const SMART_TABS = [
  { id: 'best', label: 'Best sellers', Icon: TrendingUp },
  { id: 'low', label: 'Low stock', Icon: AlertTriangle },
  { id: 'out', label: 'Sold out', Icon: CircleSlash },
  { id: 'never', label: 'Never sold', Icon: Moon },
] as const;

interface Props {
  pos: PosController;
}

const PosSellView: React.FC<Props> = ({ pos }) => {
  const { products, catalogLoaded, stats, categories, currency, addProduct, inCart } = pos;
  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [flash, setFlash] = useState<{ text: string; bad?: boolean } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  /**
   * A barcode scanner fires wherever focus happens to be. Pull stray digits
   * back into the scan box so a scan works without anyone tapping the field
   * first — copied from the Shower to Shower till, where it is what makes
   * scanning feel instant.
   *
   * ⚠️ Only when the cashier is not deliberately typing somewhere else, or
   * entering a phone number would jump the cursor mid-word.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typingElsewhere =
        el && ['INPUT', 'TEXTAREA', 'SELECT'].includes((el as HTMLElement).tagName);
      if (!typingElsewhere && /^[0-9]$/.test(e.key)) scanRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const say = (text: string, bad?: boolean) => {
    setFlash({ text, bad });
    window.setTimeout(() => setFlash((f) => (f?.text === text ? null : f)), 2500);
  };

  /**
   * A camera read goes through the SAME `pos.scan` as a typed code or a laser
   * scanner's keystrokes. One path means the cart, the stock check and the
   * "out of stock" message can never disagree by input method.
   */
  const onCameraDetected = async (code: string) => {
    const res = await pos.scan(code);
    say(res.ok ? `Added ${res.message}` : res.message || 'Not found', !res.ok);
    return res.ok;
  };

  const onScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = query.trim();
    if (!code) return;
    const res = await pos.scan(code);
    if (res.ok) {
      say(`Added ${res.message}`);
      setQuery('');
    } else if (/^\d{6,}$/.test(code)) {
      // Long digit strings are scans, so a miss is worth saying out loud.
      // Anything shorter is someone typing a search and should stay put.
      say(res.message || 'Not found', true);
    }
    scanRef.current?.focus();
  };

  const matchesQuery = (p: PosProduct, q: string) =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q) ||
    (p.barcode ?? '').includes(q) ||
    (p.manufacturer ?? '').toLowerCase().includes(q);

  const inTab = (p: PosProduct, t: string) => {
    const s = stats[p.id];
    switch (t) {
      case 'all':
        return true;
      case 'best':
        return !!s?.bestSeller;
      case 'low':
        return !!s?.lowStock || (p.isLowStock && p.stock > 0);
      case 'out':
        return p.stock <= 0;
      case 'never':
        return !!s?.neverSold;
      default:
        return p.category === t;
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => matchesQuery(p, q) && inTab(p, tab));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, query, tab, stats]);

  /**
   * Counts on every chip. A filter that says "Low stock 4" is a report in its
   * own right — the owner learns the shelf is thinning without opening a page —
   * and a zero tells the cashier not to bother tapping it.
   */
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: products.length };
    for (const t of SMART_TABS) c[t.id] = products.filter((p) => inTab(p, t.id)).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, stats]);

  /**
   * The shop's categories from the products themselves when the categories
   * endpoint has nothing (a brand-new shop, or offline), so the row is never
   * just "All".
   */
  const catList = useMemo(() => {
    if (categories.length) return categories;
    const m = new Map<string, number>();
    products.forEach((p) => p.category && m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return [...m.entries()].map(([name, count]) => ({ id: name, name, count }));
  }, [categories, products]);

  const loading = !catalogLoaded && products.length === 0;
  const emptyShop = catalogLoaded && products.length === 0;

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {/* Scan + search. One field: a scanner is a keyboard, so the thing the
          cashier types into and the thing the scanner types into are the same. */}
      <div className="px-3 lg:px-5 pt-3 lg:pt-4 pb-2 shrink-0">
        <form onSubmit={onScanSubmit} className="relative">
          <Search
            size={19}
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--sp-muted)' }}
          />
          <input
            ref={scanRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
            className="sp-input sp-input-scan sp-search pl-12 pr-14"
            placeholder="Scan a barcode, or type a product name"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Scan a barcode or search products"
          />
          {query ? (
            <button
              type="button"
              onClick={() => { setQuery(''); scanRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center"
              aria-label="Clear"
            >
              <X size={18} style={{ color: 'var(--sp-muted)' }} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="sp-scan-btn absolute right-2 top-1/2 -translate-y-1/2"
              aria-label="Scan with the camera"
              title="Scan with the camera"
            >
              <ScanLine size={18} />
            </button>
          )}
        </form>
        {flash && (
          <p className={`sp-flash ${flash.bad ? 'sp-flash-bad' : 'sp-flash-good'}`} role="status">
            {flash.text}
          </p>
        )}
      </div>

      {!emptyShop && (
        <>
          {/* Categories as CARDS, each in its shelf colour with its count — the
              same colour the products below carry, so the eye learns "amber is
              feed" once and uses it everywhere. */}
          <div className="sp-rail-wrap px-3 lg:px-5 pb-2 shrink-0">
            <div className="sp-rail">
              <CatCard
                on={tab === 'all'}
                onClick={() => setTab('all')}
                label="All items"
                count={counts.all}
                bg="var(--sp-surface-2)"
                fg="var(--sp-ink-2)"
                Icon={LayoutGrid}
              />
              {catList.map((c) => {
                const th = categoryTheme(c.name);
                return (
                  <CatCard
                    key={c.id}
                    on={tab === c.id}
                    onClick={() => setTab(c.id)}
                    label={c.name}
                    count={c.count}
                    bg={th.bg}
                    fg={th.fg}
                    Icon={th.Icon}
                  />
                );
              })}
            </div>
          </div>

          {/* The smart filters: smaller, quieter, and counted. */}
          <div className="sp-rail-wrap px-3 lg:px-5 pb-3 shrink-0">
            <div className="sp-rail items-center">
              {SMART_TABS.map((t) => {
                const on = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(on ? 'all' : t.id)}
                    className={`sp-chip sp-chip-sm ${on ? 'sp-chip-on' : ''}`}
                    aria-pressed={on}
                  >
                    <t.Icon size={13} strokeWidth={2.4} />
                    {t.label}
                    <span className="sp-chip-count sp-num">{counts[t.id] ?? 0}</span>
                  </button>
                );
              })}
              <span className="ml-auto pl-3 text-[11px] font-bold sp-muted whitespace-nowrap hidden lg:inline">
                {visible.length} of {products.length} shown
              </span>
            </div>
          </div>
        </>
      )}

      {/* The grid. 2 columns on a phone, as many as fit on a desk. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 lg:px-5 pb-3 sp-grid-scroll">
        {loading ? (
          <div className="sp-grid gap-3 content-start" aria-label="Loading the catalogue">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="sp-ptile sp-skel" aria-hidden="true">
                <div className="sp-ptile-art" />
                <div className="p-3 space-y-2">
                  <div className="sp-skel-bar w-4/5" />
                  <div className="sp-skel-bar w-2/5" />
                </div>
              </div>
            ))}
          </div>
        ) : emptyShop ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <span className="sp-empty-icon">
              <PackageOpen size={34} strokeWidth={1.8} />
            </span>
            <p className="text-[17px] font-black mt-4">Your shelf is empty</p>
            <p className="text-[13px] sp-muted mt-1.5 max-w-xs">
              Add the products you sell in the supplier portal, under Products. They show up here
              ready to scan and sell.
            </p>
            <a href="/app/supplier-products" className="sp-btn mt-5 px-5">Add products</a>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16">
            <Search size={28} style={{ color: 'var(--sp-muted)' }} />
            <p className="text-[15px] font-black mt-3">Nothing matches</p>
            <p className="text-[12px] sp-muted mt-1">
              {query ? `No product called “${query.trim()}”` : 'Nothing in this filter right now'}
            </p>
            <button
              onClick={() => { setQuery(''); setTab('all'); scanRef.current?.focus(); }}
              className="sp-btn sp-btn-ghost mt-4 px-4"
            >
              Show everything
            </button>
          </div>
        ) : (
          // ⚠️ The column rule lives in `.sp-grid`, not an inline auto-fill —
          // a floor wider than half a 390px phone collapsed mobile to ONE column.
          <div className="sp-grid gap-3 content-start">
            {visible.map((p) => (
              <Tile
                key={p.id}
                product={p}
                currency={currency}
                qtyInCart={inCart(p.id)}
                stat={stats[p.id]}
                onAdd={() => addProduct(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Scan FAB ────────────────────────────────────────────────────────
          Bottom-right is the thumb's home on a phone, and scanning is the most
          repeated action at a counter. Hidden on a desk by CSS (see .sp-fab). */}
      {!emptyShop && (
        <button
          onClick={() => setScannerOpen(true)}
          className="sp-fab"
          aria-label="Scan a barcode with the camera"
        >
          <ScanLine size={23} strokeWidth={2.3} />
        </button>
      )}

      <PosScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={onCameraDetected}
        onTypeInstead={() => scanRef.current?.focus()}
      />
    </div>
  );
};

const CatCard: React.FC<{
  on: boolean;
  onClick: () => void;
  label: string;
  count: number;
  bg: string;
  fg: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}> = ({ on, onClick, label, count, bg, fg, Icon }) => (
  <button
    onClick={onClick}
    className={`sp-cat ${on ? 'sp-cat-on' : ''}`}
    aria-pressed={on}
  >
    <span className="sp-cat-icon" style={{ background: bg, color: fg }}>
      <Icon size={17} strokeWidth={2.2} />
    </span>
    <span className="min-w-0 text-left">
      <span className="block text-[13px] font-extrabold leading-tight truncate max-w-[9rem]">{label}</span>
      <span className="block text-[11px] font-semibold sp-muted sp-num leading-tight mt-0.5">
        {count} item{count === 1 ? '' : 's'}
      </span>
    </span>
  </button>
);

const Tile: React.FC<{
  product: PosProduct;
  currency: string;
  qtyInCart: number;
  stat?: { bestSeller: boolean; starved: boolean; sold: number };
  onAdd: () => void;
}> = ({ product: p, currency, qtyInCart, stat, onAdd }) => {
  const soldOut = !p.sellable || p.stock <= 0;
  // What is LEFT after what is already in the basket — the number that decides
  // whether the next tap is allowed.
  const remaining = p.stock - qtyInCart;
  const theme = categoryTheme(p.category);
  const full = soldOut || remaining <= 0;

  const badge = stat?.starved
    ? { text: 'Restock', cls: 'sp-flag-bad' }
    : stat?.bestSeller
      ? { text: 'Top seller', cls: 'sp-flag-top' }
      : null;

  /* Colour is a SECOND signal, never the only one — the words are always here. */
  const stockLabel = soldOut
    ? 'Sold out'
    : remaining <= 0
      ? 'All in cart'
      : `${qtyText(remaining)} ${unitFor(remaining, p.unit)} left`;
  const stockCls = soldOut ? 'sp-stock-bad' : p.isLowStock || remaining <= 0 ? 'sp-stock-warn' : 'sp-stock-ok';

  return (
    <button
      onClick={onAdd}
      disabled={full}
      className={`sp-ptile ${qtyInCart > 0 ? 'sp-ptile-in' : ''} ${soldOut ? 'sp-ptile-out' : ''}`}
      aria-label={`${p.name}, ${priceShort(p.price, currency)}, ${stockLabel}${qtyInCart ? `, ${qtyInCart} in sale` : ''}`}
    >
      {/* The art block: the shop's photo, or the category's colour and icon —
          which for an agrovet that will never photograph 200 bags of feed is
          almost always. It is what makes the grid recognisable at a glance. */}
      <span
        className="sp-ptile-art"
        style={p.imageUrl ? undefined : { background: theme.bg, color: theme.fg }}
      >
        {p.imageUrl ? (
          <img src={p.imageUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <theme.Icon size={30} strokeWidth={1.8} />
        )}
        {badge && <span className={`sp-flag ${badge.cls}`}>{badge.text}</span>}
        {qtyInCart > 0 && <span className="sp-qty sp-qty-lg sp-num">{qtyInCart}</span>}
        <span className={`sp-stock ${stockCls} sp-num`}>{stockLabel}</span>
      </span>

      <span className="flex flex-col flex-1 p-2.5 lg:p-3 text-left w-full">
        {/* Two lines RESERVED so every tile is the same height and the price —
            the number the eye hunts for — sits in the same place on every card. */}
        <span className="sp-tile-name line-clamp-2">{p.name}</span>
        <span className="block text-[11px] sp-muted truncate mt-0.5 min-h-[1rem]">
          {p.manufacturer || p.category || ' '}
        </span>
        <span className="flex items-end justify-between gap-2 mt-auto pt-2">
          <span className="min-w-0">
            <span className="sp-price sp-num">{priceShort(p.price, currency)}</span>
            <span className="block text-[10px] font-semibold sp-muted leading-none mt-1">
              per {unitFor(1, p.unit) || 'item'}
            </span>
          </span>
          {!full && (
            <span className="sp-add" aria-hidden="true">
              <Plus size={16} strokeWidth={2.8} />
            </span>
          )}
        </span>
      </span>
    </button>
  );
};

export default PosSellView;
