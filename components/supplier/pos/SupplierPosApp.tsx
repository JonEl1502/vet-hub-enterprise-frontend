import React, { useState } from 'react';
import { ShoppingBag, Receipt, Wallet, LogOut, ChevronDown, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import BottomSheet from '../../shared/common/mobile/BottomSheet';
import { usePos } from './usePos';
import PosSellView from './PosSellView';
import PosCart from './PosCart';
import PosTender from './PosTender';
import PosReceipt from './PosReceipt';
import PosSales from './PosSales';
import PosShiftView from './PosShift';

/**
 * The till, whole.
 *
 * ── Two layouts, one component tree ────────────────────────────────────────
 * Under `md` this is a MOBILE APP: fixed viewport, no page scroll, a bottom tab
 * bar, and the cart in a drag-dismissable sheet. At `md` and up it becomes the
 * familiar two-pane counter POS — catalogue left, cart rail right. Neither is a
 * shrunken version of the other; the same pieces are simply arranged for the
 * hand or for the desk.
 *
 * ── Why this is a route and not a view in App.tsx ──────────────────────────
 * The supplier portal switches views by string inside App.tsx. The till does
 * not belong there: it is full-bleed with no portal chrome, a cashier signs in
 * and never sees the portal at all, and it has to survive a mid-shift refresh
 * on its own URL.
 */

type Tab = 'sell' | 'sales' | 'shift';
type Step = 'shopping' | 'tender' | 'receipt';

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const initialsOf = (name?: string | null) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

const SupplierPosApp: React.FC = () => {
  const pos = usePos();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('sell');
  const [step, setStep] = useState<Step>('shopping');
  const [cartOpen, setCartOpen] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [changeDue, setChangeDue] = useState<number | undefined>(undefined);

  if (pos.phase === 'loading') {
    return (
      <div className="supplier-pos sp-root flex items-center justify-center" style={{ height: '100dvh' }}>
        <p className="text-sm font-bold sp-muted">Opening the till…</p>
      </div>
    );
  }

  if (pos.phase === 'error') {
    return (
      <div className="supplier-pos sp-root flex flex-col items-center justify-center gap-3 px-6 text-center"
           style={{ height: '100dvh' }}>
        <p className="text-sm font-bold sp-bad">{pos.error}</p>
        <button onClick={() => window.location.reload()} className="sp-btn">Try again</button>
      </div>
    );
  }

  const goTender = () => { setStep('tender'); setCartOpen(false); };

  const onSaleDone = (sale: any) => {
    const cash = (sale.payments ?? []).find((p: any) => p.method === 'CASH');
    setChangeDue(cash?.tendered ? Number(cash.tendered) - Number(sale.total) : undefined);
    setLastSale(sale);
    setStep('receipt');
  };

  const newSale = () => { setLastSale(null); setChangeDue(undefined); setStep('shopping'); };

  // Tender and receipt take the whole screen on every size: at that moment the
  // cashier is doing one thing, and the grid behind is noise.
  if (step === 'tender') {
    return (
      <div className="supplier-pos sp-root" style={{ height: '100dvh' }}>
        <PosTender pos={pos} onDone={onSaleDone} onBack={() => setStep('shopping')} />
      </div>
    );
  }
  if (step === 'receipt' && lastSale) {
    return (
      <div className="supplier-pos sp-root" style={{ height: '100dvh' }}>
        <PosReceipt sale={lastSale} currency={pos.currency} changeDue={changeDue} onNewSale={newSale} />
      </div>
    );
  }

  return (
    <div className="supplier-pos sp-root flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      {/* ── Chrome ─────────────────────────────────────────────────────── */}
      <header
        className="sp-chrome shrink-0 flex items-center gap-2.5 px-3"
        style={{ paddingTop: 'calc(0.6rem + var(--sp-safe-top))', paddingBottom: '0.6rem' }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black leading-tight truncate">
            {pos.shop?.name ?? 'Till'}
          </p>
          <div className="flex items-center gap-1.5">
            {pos.canSwitchBranch && pos.branches.length > 1 ? (
              <div className="relative">
                <select
                  value={pos.branchId}
                  onChange={(e) => pos.switchBranch(e.target.value)}
                  className="appearance-none bg-transparent text-[11px] font-bold pr-4 outline-none cursor-pointer"
                  style={{ color: 'rgba(242,245,249,0.65)' }}
                  aria-label="Branch"
                >
                  {pos.branches.map((b) => (
                    <option key={b.id} value={b.id} style={{ color: '#10151c' }}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={11}
                  className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'rgba(242,245,249,0.65)' }}
                />
              </div>
            ) : (
              <p className="text-[11px] font-bold" style={{ color: 'rgba(242,245,249,0.65)' }}>
                {pos.branch?.name ?? '—'}
              </p>
            )}
            {/* Green when the catalogue last refreshed cleanly, amber when the
                grid on screen is cached and possibly stale. */}
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: pos.online ? 'var(--sp-good)' : 'var(--sp-warn)' }}
              title={pos.online ? 'Online' : 'Offline — showing the last catalogue'}
            />
          </div>
        </div>

        {/* Who is on the till. */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
          style={{ background: 'var(--sp-accent)', color: 'var(--sp-accent-ink)' }}
          title={`${user?.name || user?.email} — ${pos.till?.supplierRole ?? ''}`}
        >
          {initialsOf(user?.name || user?.email)}
        </div>
        <button
          onClick={() => logout()}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ color: 'rgba(242,245,249,0.55)' }}
          aria-label="Sign out"
        >
          <LogOut size={16} />
        </button>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 flex flex-col">
          {tab === 'sell' && <PosSellView pos={pos} />}
          {tab === 'sales' && <PosSales pos={pos} />}
          {tab === 'shift' && <PosShiftView pos={pos} />}
        </main>

        {/* Desktop cart rail. Hidden on mobile, where the sheet takes over. */}
        {tab === 'sell' && (
          <aside
            className="hidden md:flex w-96 shrink-0 flex-col border-l"
            style={{ borderColor: 'var(--sp-border)', background: 'var(--sp-surface)' }}
          >
            <div
              className="px-4 py-3 border-b flex items-center justify-between shrink-0"
              style={{ borderColor: 'var(--sp-border)' }}
            >
              <h2 className="text-[13px] font-black uppercase tracking-wide">Current sale</h2>
              {pos.cart.length > 0 && (
                <button onClick={pos.clearCart} className="text-[12px] font-bold sp-muted">
                  Clear
                </button>
              )}
            </div>
            <PosCart pos={pos} onTender={goTender} />
          </aside>
        )}
      </div>

      {/* ── Mobile: the cart bar ───────────────────────────────────────────
          A persistent summary that opens the sheet. This is the mobile answer
          to the desktop rail: the running total stays visible without spending
          a third of a phone screen on a list nobody reads until the end. */}
      {tab === 'sell' && pos.itemCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="md:hidden shrink-0 flex items-center gap-3 px-4 py-3"
          style={{
            background: 'var(--sp-accent)',
            color: 'var(--sp-accent-ink)',
            paddingBottom: '0.75rem',
          }}
        >
          <span className="relative">
            <ShoppingCart size={20} />
            <span
              className="absolute -top-1.5 -right-2 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full text-[10px] font-black flex items-center justify-center sp-num"
              style={{ background: 'var(--sp-chrome)', color: 'var(--sp-chrome-ink)' }}
            >
              {pos.itemCount}
            </span>
          </span>
          <span className="text-[13px] font-bold">
            {pos.itemCount} item{pos.itemCount === 1 ? '' : 's'}
          </span>
          <span className="ml-auto text-[18px] font-black sp-num">
            {pos.pricing && !pos.preview ? '…' : money(pos.preview?.total ?? 0, pos.currency)}
          </span>
        </button>
      )}

      {/* ── Bottom tabs ────────────────────────────────────────────────── */}
      <nav
        className="shrink-0 flex border-t"
        style={{
          borderColor: 'var(--sp-border)',
          background: 'var(--sp-surface)',
          paddingBottom: 'var(--sp-safe-bottom)',
        }}
      >
        {([
          { id: 'sell', label: 'Sell', icon: ShoppingBag },
          { id: 'sales', label: 'Sales', icon: Receipt },
          { id: 'shift', label: 'Shift', icon: Wallet },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            /* 56px: a tab bar is hit with a thumb at arm's length, not a cursor. */
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
            style={{
              minHeight: '3.5rem',
              color: tab === t.id ? 'var(--sp-accent)' : 'var(--sp-muted)',
            }}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <t.icon size={19} strokeWidth={tab === t.id ? 2.6 : 2} />
            <span className="text-[10px] font-black uppercase tracking-wide">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Mobile cart sheet ──────────────────────────────────────────── */}
      <BottomSheet
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Current sale"
        snapPoints={[85]}
      >
        {/*
          ⚠️ h-100%, NOT a vh figure. BottomSheet's content area is
          `flex-1 overflow-y-auto`, so a child taller than it simply scrolls —
          which sent the totals and the pay button below the fold, exactly where
          they must never be. Filling the content box instead lets PosCart's own
          flex column do the work: the LIST scrolls, the footer stays pinned.
        */}
        <div className="supplier-pos flex flex-col" style={{ height: '100%' }}>
          {/*
            ⚠️ The wrapper, not PosCart, owns the height. PosCart's own root is
            `h-full`, so left as a bare child it claimed the WHOLE sheet and
            pushed the footer below it — the pay button rendered off-screen.
            `flex-1 min-h-0` gives it everything the footer does not need.
          */}
          <div className="flex-1 min-h-0">
            <PosCart pos={pos} compact />
          </div>
          <div
            className="shrink-0 flex gap-2 px-4 pt-3"
            style={{ paddingBottom: 'calc(0.5rem + var(--sp-safe-bottom))' }}
          >
            <button onClick={pos.clearCart} className="sp-btn sp-btn-ghost px-4">
              Clear
            </button>
            <button onClick={goTender} disabled={!pos.canTender} className="sp-btn flex-1">
              {pos.pricing ? 'Pricing…' : `Take ${money(pos.preview?.total ?? 0, pos.currency)}`}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

export default SupplierPosApp;
