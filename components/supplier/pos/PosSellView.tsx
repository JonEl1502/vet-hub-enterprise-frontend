import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ScanLine } from 'lucide-react';
import PosScanner from './PosScanner';
import type { PosController } from './usePos';
import type { PosProduct } from '../../../services';
import { categoryTheme } from './categoryTheme';
import { money, unitFor } from './format';

/**
 * The catalogue half of the till: scan bar, chips, product grid.
 *
 * On a phone this is the whole screen (the cart lives in a sheet below); on a
 * desktop it is the left pane with the cart rail beside it. Same component,
 * same markup — only the parent's layout changes.
 */

/** The cross-cutting filters, on top of the shop's own categories. */
const SMART_TABS = [
  { id: 'best', label: 'Best sellers' },
  { id: 'low', label: 'Low stock' },
  { id: 'out', label: 'Sold out' },
  { id: 'never', label: 'Never sold' },
] as const;

interface Props {
  pos: PosController;
}

const PosSellView: React.FC<Props> = ({ pos }) => {
  const { products, stats, categories, currency, addProduct, inCart } = pos;
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (
        q &&
        !(
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? '').includes(q) ||
          (p.manufacturer ?? '').toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      const s = stats[p.id];
      switch (tab) {
        case 'all':
          return true;
        case 'best':
          return !!s?.bestSeller;
        case 'low':
          return !!s?.lowStock;
        case 'out':
          return p.stock <= 0;
        case 'never':
          return !!s?.neverSold;
        default:
          return p.category === tab;
      }
    });
  }, [products, query, tab, stats]);

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {/* Scan + search. One field: a scanner is a keyboard, so the thing the
          cashier types into and the thing the scanner types into are the same. */}
      <div className="px-3 lg:px-5 pt-3 pb-2 shrink-0">
        <form onSubmit={onScanSubmit} className="relative">
          <Search
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--sp-muted)' }}
          />
          <input
            ref={scanRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sp-input sp-input-scan pl-10 pr-12"
            placeholder="Scan a barcode, or search"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Scan a barcode or search products"
          />
          {query ? (
            <button
              type="button"
              onClick={() => { setQuery(''); scanRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg"
              aria-label="Clear"
            >
              <X size={16} style={{ color: 'var(--sp-muted)' }} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ color: 'var(--sp-muted)' }}
              aria-label="Scan with the camera"
            >
              <ScanLine size={17} />
            </button>
          )}
        </form>
        {flash && (
          <p
            className={`text-[12px] font-bold mt-1.5 px-1 ${flash.bad ? 'sp-bad' : 'sp-good'}`}
            role="status"
          >
            {flash.text}
          </p>
        )}
      </div>

      {/* Categories + the smart filters. Scroll-snapped so a thumb flick lands
          on a chip edge rather than halfway through one. */}
      <div className="sp-rail-wrap px-3 lg:px-5 pb-2.5 shrink-0">
        <div className="sp-rail lg:flex-wrap">
        <button
          onClick={() => setTab('all')}
          className={`sp-chip ${tab === 'all' ? 'sp-chip-on' : ''}`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setTab(c.id)}
            className={`sp-chip ${tab === c.id ? 'sp-chip-on' : ''}`}
          >
            {c.name}
          </button>
        ))}
        <span className="w-px shrink-0 my-1.5" style={{ background: 'var(--sp-border)' }} />
        {SMART_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`sp-chip ${tab === t.id ? 'sp-chip-on' : ''}`}
          >
            {t.label}
          </button>
        ))}
        </div>
      </div>

      {/* The grid. 2 columns on a phone, more as the screen allows. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 lg:px-5 pb-3 sp-grid-scroll">
        {visible.length === 0 ? (
          <p className="text-center text-sm sp-muted py-16">
            {products.length === 0 ? 'Loading the catalogue…' : 'Nothing matches'}
          </p>
        ) : (
          // Exactly two in a hand, as many as fit on a desk — see `.sp-grid`.
          // ⚠️ Not an inline `auto-fill, minmax(13.5rem, 1fr)`: that floor is
          // wider than half a 390px phone, so the whole grid collapsed to ONE
          // column on mobile. The column rule has to change at the breakpoint,
          // which means it belongs in CSS, not in a style attribute.
          <div className="sp-grid gap-2.5 content-start">
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
          The thumb's home position on a phone is the bottom-right corner, and
          scanning is the single most repeated action at a counter — so it gets
          the one spot the hand reaches without regripping. Touch only: a desk
          has a laser scanner pointed at the search field and no use for a
          camera button in the way of the grid. */}
      <button
        onClick={() => setScannerOpen(true)}
        className="sp-fab"
        aria-label="Scan a barcode with the camera"
      >
        <ScanLine size={23} strokeWidth={2.3} />
      </button>

      <PosScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={onCameraDetected}
        onTypeInstead={() => scanRef.current?.focus()}
      />
    </div>
  );
};

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

  const badge = stat?.starved
    ? { text: 'restock', bg: 'rgba(192,42,37,0.12)', fg: 'var(--sp-bad)' }
    : stat?.bestSeller
      ? { text: 'top', bg: 'rgba(242,164,28,0.18)', fg: 'var(--sp-warn)' }
      : null;

  /* Colour is a SECOND signal, never the only one — the words are always here. */
  const stockLabel = soldOut
    ? 'Sold out'
    : remaining <= 0
      ? 'All in cart'
      : `${remaining} ${unitFor(remaining, p.unit)}`;
  const stockTone = soldOut
    ? { bg: 'rgba(192,42,37,0.10)', fg: 'var(--sp-bad)' }
    : p.isLowStock
      ? { bg: 'rgba(180,99,12,0.12)', fg: 'var(--sp-warn)' }
      : { bg: 'var(--sp-surface-2)', fg: 'var(--sp-muted)' };

  return (
    <button
      onClick={onAdd}
      disabled={soldOut || remaining <= 0}
      className={`sp-tile ${qtyInCart > 0 ? 'sp-tile-in-cart' : ''}`}
    >
      {/* ⚠️ ABSOLUTE, not a flex sibling. In the flow it competed with the name
          for a 175px tile's width and left ~70px for it — "Albendazole 10% 1L"
          rendered as "Albendazo". Out of flow, the name gets the whole column
          and only pads right when there is actually something to clear. */}
      {qtyInCart > 0 ? (
        <span className="sp-qty sp-num sp-corner">{qtyInCart}</span>
      ) : (
        badge && (
          <span
            className="sp-badge-inline sp-corner"
            style={{ background: badge.bg, color: badge.fg }}
          >
            {badge.text}
          </span>
        )
      )}

      <div className="flex items-start gap-2">
        {/* The shop's own photo when it has one; the category swatch when it
            does not — which, for an agrovet that will never photograph 200 bags
            of feed, is almost always. */}
        {p.imageUrl ? (
          <img src={p.imageUrl} alt="" loading="lazy" className="sp-swatch object-cover" />
        ) : (
          <span
            className="sp-swatch"
            style={{ background: theme.bg, color: theme.fg }}
            aria-hidden="true"
            title={p.category}
          >
            <theme.Icon size={17} strokeWidth={2.1} />
          </span>
        )}

        <span className="min-w-0 flex-1 text-left">
          {/* Two lines are RESERVED whether the name needs them or not, so every
              tile in the grid is the same height. Ragged rows read as an
              unfinished layout, and worse, they move the price — the one number
              the eye is hunting for — to a different place on every card. */}
          <span
            className={`sp-tile-name line-clamp-2 ${qtyInCart > 0 || badge ? 'pr-6' : ''}`}
          >
            {p.name}
          </span>
          {p.manufacturer && (
            <span className="block text-[10px] sp-muted truncate mt-0.5">{p.manufacturer}</span>
          )}
        </span>
      </div>

      <div className="flex items-end justify-between gap-2 mt-auto pt-2">
        <span className="text-[15px] font-black sp-num leading-none">
          {money(p.price, currency)}
        </span>
        <span
          className="sp-stock-pill sp-num"
          style={{ background: stockTone.bg, color: stockTone.fg }}
        >
          {stockLabel}
        </span>
      </div>
    </button>
  );
};

export default PosSellView;
