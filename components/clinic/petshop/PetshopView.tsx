import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, X, Percent, Wallet, ChevronDown, ShoppingBasket, ArrowRight } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import PosSellView from '../../supplier/pos/PosSellView';
import PosCart from '../../supplier/pos/PosCart';
import PosTender from '../../supplier/pos/PosTender';
import { useIsDesktop } from '../../supplier/pos/useIsDesktop';
import { money } from '../../supplier/pos/format';
import { useClinicPos, AUTO_WALLET, ClinicBuyer, ClinicDiscount } from './useClinicPos';
import ClinicSaleDone from './ClinicSaleDone';

/**
 * PET SHOP — the clinic's till.
 *
 * Opens straight onto a point of sale (user, 2026-11-21: *"pet shop should open
 * as a POS … update the UI to be the POS itself. Let's not open a new page"*).
 * It is the supplier till's own screens — tile grid, scanner-first search,
 * smart tabs, cash keypad with change, invoice and receipt — fed by the clinic
 * through `useClinicPos`. Choosing what the public shop shows stays on the
 * Shop page.
 *
 * Desk: catalogue left, the sale on a rail right; the rail turns into the
 * payment keypad, then into the invoice/receipt, while the grid stays put.
 * Phone: the grid fills the screen, the sale opens as a sheet, and payment and
 * the receipt each take the whole screen.
 */

interface Props {
  activeClinic?: {
    id: number | string; name?: string; currency?: string; logo?: string | null;
    colors?: { primary?: string } | null; address?: string | null; phone?: string | null; city?: string | null;
  };
}

type Step = 'shopping' | 'tender' | 'done';

const initialsOf = (s?: string | null) =>
  (s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

const PetshopView: React.FC<Props> = ({ activeClinic }) => {
  const { user } = useAuth() as any;
  const clinicId = activeClinic?.id != null ? String(activeClinic.id) : null;
  const currency = activeClinic?.currency || 'KES';
  const isDesktop = useIsDesktop();
  const { pos, buyer, setBuyer, discount, setDiscount, walletId, setWalletId, wallets } = useClinicPos(clinicId, currency);

  const [step, setStep] = useState<Step>('shopping');
  const [lastSale, setLastSale] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(t); }, []);

  // The clinic's own colour on the till, as a supplier's brand paints theirs.
  const accent = activeClinic?.colors?.primary && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(activeClinic.colors.primary)
    ? activeClinic.colors.primary : undefined;

  const shop = { name: activeClinic?.name || 'Pet shop', logoUrl: activeClinic?.logo || null, primaryColor: accent ?? null };
  const branch = {
    name: null,
    address: [activeClinic?.address, activeClinic?.city].filter(Boolean).join(', ') || null,
    phone: activeClinic?.phone || null,
  };
  const cashierName: string | null = user?.name || null;

  const goTender = () => { setSheetOpen(false); setStep('tender'); };
  const onDone = (sale: any) => { setLastSale(sale); setStep('done'); };
  const newSale = () => { setLastSale(null); setStep('shopping'); };

  const rootStyle = accent ? ({ ['--sp-accent' as any]: accent } as React.CSSProperties) : undefined;

  const saleSetup = (
    <SaleSetup
      buyer={buyer} setBuyer={setBuyer}
      discount={discount} setDiscount={setDiscount}
      walletId={walletId} setWalletId={setWalletId} wallets={wallets}
      hasItems={pos.cart.length > 0}
    />
  );

  const cartHeader = (
    <div className="px-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--sp-border)', height: '3.75rem' }}>
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-black">Current sale</h2>
        {pos.itemCount > 0 && <span className="sp-qty sp-num">{pos.itemCount}</span>}
      </div>
      {pos.cart.length > 0 && (
        <button onClick={pos.clearCart} className="sp-btn sp-btn-quiet px-3 text-[12px]">Clear sale</button>
      )}
    </div>
  );

  const header = (
    <header className="shrink-0 flex items-center gap-3 px-4 lg:px-5 border-b" style={{ borderColor: 'var(--sp-border)', background: 'var(--sp-surface)', height: '3.75rem' }}>
      <div className="sp-logo shrink-0" title={shop.name}>
        {shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : initialsOf(shop.name)}
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-black leading-tight truncate">Pet shop</p>
        <p className="text-[11px] font-semibold sp-muted truncate">{shop.name} · point of sale</p>
      </div>
      <div className="ml-auto hidden sm:flex items-center gap-2 text-[12px] font-semibold sp-muted">
        <span className="sp-num">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="hidden lg:inline">· {now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        {cashierName && <span className="hidden md:inline">· {cashierName.split(' ')[0]} on the till</span>}
      </div>
    </header>
  );

  // ═══ DESK ═══════════════════════════════════════════════════════════════
  if (isDesktop) {
    return (
      <div
        className="supplier-pos flex overflow-hidden rounded-2xl border shadow-sm"
        style={{ ...rootStyle, height: 'calc(100dvh - 8rem)', minHeight: 560, borderColor: 'var(--sp-border)' }}
      >
        <main className="flex-1 min-w-0 flex flex-col">
          {header}
          <PosSellView pos={pos} />
        </main>
        <aside className="w-[24rem] xl:w-[26rem] shrink-0 flex flex-col border-l" style={{ borderColor: 'var(--sp-border)', background: 'var(--sp-surface)' }}>
          {step === 'done' && lastSale ? (
            <ClinicSaleDone sale={lastSale} currency={currency} shop={shop} branch={branch} cashierName={cashierName} onNewSale={newSale} />
          ) : step === 'tender' ? (
            <PosTender pos={pos} onDone={onDone} onBack={() => setStep('shopping')} />
          ) : (
            <>
              {cartHeader}
              {saleSetup}
              <div className="flex-1 min-h-0 flex flex-col"><PosCart pos={pos} onTender={goTender} /></div>
            </>
          )}
        </aside>
      </div>
    );
  }

  // ═══ HAND ═══════════════════════════════════════════════════════════════
  if (step === 'tender' || (step === 'done' && lastSale)) {
    return (
      <div className="supplier-pos sp-root fixed inset-0 z-[150] flex flex-col" style={{ ...rootStyle, height: '100dvh' }}>
        {step === 'tender'
          ? <PosTender pos={pos} onDone={onDone} onBack={() => setStep('shopping')} />
          : <ClinicSaleDone sale={lastSale} currency={currency} shop={shop} branch={branch} cashierName={cashierName} onNewSale={newSale} />}
      </div>
    );
  }

  return (
    <div className="supplier-pos flex flex-col overflow-hidden rounded-2xl border relative" style={{ ...rootStyle, height: 'calc(100dvh - 9rem)', minHeight: 480, borderColor: 'var(--sp-border)' }}>
      {header}
      <div className="flex-1 min-h-0 flex flex-col"><PosSellView pos={pos} /></div>

      {/* The sale, docked: what is in it and what it costs, one tap from paying. */}
      {pos.cart.length > 0 && (
        <div className="shrink-0 p-2.5 border-t" style={{ borderColor: 'var(--sp-border)', background: 'var(--sp-surface)' }}>
          <button onClick={() => setSheetOpen(true)} className="sp-btn sp-charge w-full">
            <span className="flex items-center gap-2"><ShoppingBasket size={18} /> {pos.itemCount} item{pos.itemCount === 1 ? '' : 's'}</span>
            <span className="flex items-center gap-2 sp-num">{money(pos.preview?.total ?? 0, currency)} <ArrowRight size={18} /></span>
          </button>
        </div>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-[150] flex items-end" onClick={() => setSheetOpen(false)} style={{ background: 'rgba(15,23,42,0.45)' }}>
          <div
            className="supplier-pos w-full rounded-t-3xl flex flex-col overflow-hidden"
            style={{ ...rootStyle, maxHeight: '88dvh', height: '88dvh', background: 'var(--sp-surface)', overscrollBehavior: 'contain', paddingBottom: 'var(--sp-safe-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2"><span className="w-10 h-1 rounded-full" style={{ background: 'var(--sp-border)' }} /></div>
            {cartHeader}
            {saleSetup}
            <div className="flex-1 min-h-0 flex flex-col"><PosCart pos={pos} onTender={goTender} /></div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Who is buying, any discount, and where the money lands — the three things a
 * clinic till has that a supplier's does not. Folded to one line until opened,
 * so the cart keeps the room.
 */
const SaleSetup: React.FC<{
  buyer: ClinicBuyer; setBuyer: (b: ClinicBuyer) => void;
  discount: ClinicDiscount; setDiscount: (d: ClinicDiscount) => void;
  walletId: string; setWalletId: (id: string) => void; wallets: any[];
  hasItems: boolean;
}> = ({ buyer, setBuyer, discount, setDiscount, walletId, setWalletId, wallets, hasItems }) => {
  const { clients, ensureClients } = useData() as any;
  useEffect(() => { ensureClients?.(); }, [ensureClients]);
  const [q, setQ] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [more, setMore] = useState(false);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = (clients || []) as any[];
    return (s ? all.filter((c) => (c.name || '').toLowerCase().includes(s) || (c.phone || '').toLowerCase().includes(s)) : all).slice(0, 8);
  }, [clients, q]);

  const extrasOn = discount.type !== 'NONE' || walletId !== AUTO_WALLET;
  const walletName = (id: string) => wallets.find((w) => String(w.id) === id)?.name ?? 'Wallet';

  return (
    <div className="shrink-0 px-4 py-3 border-b space-y-2" style={{ borderColor: 'var(--sp-border)' }}>
      {buyer.kind === 'client' ? (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'var(--sp-accent-soft)' }}>
          <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{ background: 'var(--sp-accent)', color: 'var(--sp-accent-ink)' }}>
            {initialsOf(buyer.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black truncate">{buyer.name}</p>
            <p className="text-[11px] font-semibold sp-muted truncate">{buyer.phone || 'Client'} · on their record</p>
          </div>
          <button onClick={() => setBuyer({ kind: 'none' })} className="w-8 h-8 rounded-lg flex items-center justify-center sp-btn-ghost" aria-label="Remove customer"><X size={15} /></button>
        </div>
      ) : buyer.kind === 'walkin' ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wide sp-muted">New walk-in customer</span>
            <button onClick={() => setBuyer({ kind: 'none' })} className="sp-btn-ghost rounded-lg p-1" aria-label="Cancel walk-in"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <input className="sp-input sp-input-compact" placeholder="Name" value={buyer.name} autoComplete="off"
              onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} />
            <input className="sp-input sp-input-compact" placeholder="Phone" value={buyer.phone} inputMode="tel" autoComplete="off"
              onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--sp-muted)' }} />
            <input
              className="sp-input sp-input-compact sp-input-icon"
              placeholder="Customer — search, or leave for a counter sale"
              value={q}
              autoComplete="off"
              onChange={(e) => { setQ(e.target.value); setListOpen(true); }}
              onFocus={() => setListOpen(true)}
              onBlur={() => setTimeout(() => setListOpen(false), 150)}
            />
            {listOpen && matches.length > 0 && (
              <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-lg" style={{ background: 'var(--sp-surface)', borderColor: 'var(--sp-border)' }}>
                {matches.map((c: any) => (
                  <button
                    key={c.id}
                    onMouseDown={() => { setBuyer({ kind: 'client', id: String(c.id), name: c.name, phone: c.phone }); setQ(''); setListOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[13px] font-bold hover:opacity-80"
                  >
                    {c.name} {c.phone && <span className="sp-muted font-semibold text-[12px]">· {c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setBuyer({ kind: 'walkin', name: '', phone: '' })} title="New walk-in customer" aria-label="New walk-in customer"
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 sp-btn-ghost border" style={{ borderColor: 'var(--sp-border)' }}>
            <UserPlus size={16} />
          </button>
        </div>
      )}

      {hasItems && (
        <>
          <button onClick={() => setMore((m) => !m)} className="w-full flex items-center justify-between text-[12px] font-bold sp-muted">
            <span className="flex items-center gap-1.5">
              <Percent size={12} /> Discount &amp; money goes to
              {extrasOn && (
                <span className="sp-chip-count">
                  {[discount.type !== 'NONE' ? 'discount' : null, walletId !== AUTO_WALLET ? walletName(walletId) : null].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            <ChevronDown size={14} style={{ transform: more ? 'rotate(180deg)' : undefined, transition: 'transform 120ms' }} />
          </button>
          {more && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <select className="sp-input sp-input-compact" value={discount.type} onChange={(e) => setDiscount({ ...discount, type: e.target.value as any })}>
                  <option value="NONE">No discount</option>
                  <option value="PERCENTAGE">% off</option>
                  <option value="FIXED">Amount off</option>
                </select>
                <input className="sp-input sp-input-compact" type="number" inputMode="decimal" placeholder={discount.type === 'PERCENTAGE' ? '%' : 'Amount'}
                  disabled={discount.type === 'NONE'} value={discount.value} onChange={(e) => setDiscount({ ...discount, value: e.target.value })} />
              </div>
              <label className="flex items-center gap-1.5">
                <Wallet size={13} className="shrink-0" style={{ color: 'var(--sp-muted)' }} />
                <select className="sp-input sp-input-compact" value={walletId} onChange={(e) => setWalletId(e.target.value)} aria-label="Money goes to">
                  <option value={AUTO_WALLET}>Match the payment (cash, M-Pesa, card)</option>
                  {wallets.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                </select>
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PetshopView;
