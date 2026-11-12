import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ChevronRight, Search, Banknote, Smartphone, CreditCard, Landmark, HandCoins, Receipt } from 'lucide-react';
import { supplierPosAPI, toast, type PosSaleSummary, type PosPaymentMethod } from '../../../services';
import type { PosController } from './usePos';
import { useIsDesktop } from './useIsDesktop';

/**
 * Today's sales — a TABLE on a desk, cards in a hand.
 *
 * A desk has the width for the columns an owner actually reads across (time,
 * receipt, what, how paid, who rang it up, total) and a table is what makes a
 * day scannable; on a phone the same rows stack as cards. Totals across the top
 * are computed from COMPLETED sales only — a voided sale is shown, struck
 * through, but never counted.
 */

const money = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const METHOD: Record<PosPaymentMethod, { label: string; Icon: React.ComponentType<{ size?: number }> }> = {
  CASH: { label: 'Cash', Icon: Banknote },
  MPESA: { label: 'M-Pesa', Icon: Smartphone },
  CARD: { label: 'Card', Icon: CreditCard },
  BANK_TRANSFER: { label: 'Bank', Icon: Landmark },
  CREDIT: { label: 'Credit', Icon: HandCoins },
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const MethodPills: React.FC<{ methods: PosPaymentMethod[] }> = ({ methods }) => (
  <span className="inline-flex flex-wrap gap-1">
    {methods.map((m) => {
      const meta = METHOD[m] ?? { label: m, Icon: Receipt };
      return (
        <span key={m} className="sp-pay-pill">
          <meta.Icon size={12} />
          {meta.label}
        </span>
      );
    })}
  </span>
);

const PosSales: React.FC<{ pos: PosController; onOpenSale: (id: string) => void; reloadKey?: number; openSaleId?: string | null }> = ({
  pos,
  onOpenSale,
  reloadKey = 0,
  openSaleId = null,
}) => {
  const isDesktop = useIsDesktop();
  const [sales, setSales] = useState<PosSaleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  // A cashier only ever has their own; a manager gets the whole branch.
  const isManager = pos.till?.supplierRole === 'OWNER' || pos.till?.supplierRole === 'MANAGER';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierPosAPI.listSales({ date: 'today', mine: !isManager });
      setSales(res.data.sales);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load today’s sales');
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  // `reloadKey` belongs on the EFFECT, not on `load` — what changes after a
  // void is when we should re-read, not how.
  useEffect(() => { load(); }, [load, reloadKey]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return sales;
    return sales.filter(
      (s) =>
        s.saleNumber.toLowerCase().includes(t) ||
        (s.customerPhone ?? '').includes(t) ||
        (s.customerName ?? '').toLowerCase().includes(t) ||
        (s.cashier ?? '').toLowerCase().includes(t)
    );
  }, [sales, q]);

  const summary = useMemo(() => {
    const done = sales.filter((s) => s.status === 'COMPLETED');
    const total = done.reduce((n, s) => n + Number(s.total), 0);
    return {
      count: done.length,
      total,
      average: done.length ? total / done.length : 0,
      voided: sales.filter((s) => s.status === 'VOIDED').length,
      currency: sales[0]?.currency || pos.currency,
    };
  }, [sales, pos.currency]);

  const showCashier = isManager;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 lg:px-5 pt-4 pb-3 shrink-0">
        <div className="min-w-0">
          <h2 className="text-[17px] font-black leading-tight">Today’s sales</h2>
          <p className="text-[11px] font-semibold sp-muted">
            {isManager ? (pos.branch?.name ? `All tills · ${pos.branch.name}` : 'All tills') : 'Your sales'} · since midnight
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--sp-muted)' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="sp-input sp-input-sm"
              placeholder="Receipt no., phone, cashier"
              aria-label="Find a sale"
            />
          </div>
          <button onClick={load} className="sp-btn sp-btn-ghost w-11 px-0" aria-label="Refresh" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* The day at a glance. */}
      <div className="grid grid-cols-3 gap-2.5 px-4 lg:px-5 pb-3 shrink-0">
        <Stat label="Takings" value={money(summary.total, summary.currency)} strong />
        <Stat label="Sales" value={String(summary.count)} sub={summary.voided ? `${summary.voided} voided` : undefined} />
        <Stat label="Average sale" value={money(summary.average, summary.currency)} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-5 pb-4">
        {sales.length === 0 && !loading ? (
          <div className="flex flex-col items-center text-center py-16">
            <span className="sp-empty-icon"><Receipt size={28} strokeWidth={1.8} /></span>
            <p className="text-[15px] font-black mt-4">Nothing rung up yet today</p>
            <p className="text-[12px] sp-muted mt-1">Sales appear here the moment they are completed.</p>
          </div>
        ) : isDesktop ? (
          <div className="sp-card overflow-hidden">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Receipt</th>
                  <th className="text-right">Items</th>
                  <th>Paid by</th>
                  <th>Customer</th>
                  {showCashier && <th>Cashier</th>}
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const voided = s.status === 'VOIDED';
                  return (
                    <tr
                      key={s.id}
                      onClick={() => onOpenSale(s.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSale(s.id); } }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open sale ${s.saleNumber}`}
                      className={`${openSaleId === s.id ? 'sp-row-on' : ''} ${voided ? 'sp-row-void' : ''}`}
                    >
                      <td className="sp-num font-bold">{timeOf(s.createdAt)}</td>
                      <td className="font-mono text-[12px]">{s.saleNumber}</td>
                      <td className="text-right sp-num">{s.itemCount}</td>
                      <td><MethodPills methods={s.methods} /></td>
                      <td className="sp-muted">{s.customerName || s.customerPhone || '—'}</td>
                      {showCashier && <td>{s.cashier || '—'}</td>}
                      <td>
                        <span className={`sp-status ${voided ? 'sp-status-void' : s.status === 'COMPLETED' ? 'sp-status-ok' : 'sp-status-wait'}`}>
                          {voided ? 'Voided' : s.status === 'COMPLETED' ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td className={`text-right sp-num font-black text-[14px] ${voided ? 'line-through sp-muted' : ''}`}>
                        {money(s.total, s.currency)}
                      </td>
                      <td className="w-8"><ChevronRight size={16} style={{ color: 'var(--sp-muted)' }} /></td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr><td colSpan={showCashier ? 9 : 8} className="text-center sp-muted py-10">No sale matches “{q}”</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Every row opens. "What did I sell them?" is the question this tab is
                actually asked, and the total alone cannot answer it. */}
            {shown.map((s) => (
              <button
                key={s.id}
                onClick={() => onOpenSale(s.id)}
                className="sp-card p-3.5 w-full text-left flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black sp-num">
                    {timeOf(s.createdAt)} <span className="font-mono font-normal text-[11px] sp-muted">{s.saleNumber}</span>
                  </p>
                  <p className="text-[12px] sp-muted mt-1 flex items-center gap-1.5 flex-wrap">
                    {s.itemCount} item{s.itemCount === 1 ? '' : 's'} <MethodPills methods={s.methods} />
                  </p>
                  {s.status === 'VOIDED' && <p className="text-[11px] font-bold sp-bad mt-1">Voided</p>}
                </div>
                <p className={`text-[16px] font-black sp-num shrink-0 ${s.status === 'VOIDED' ? 'sp-muted line-through' : ''}`}>
                  {money(s.total, s.currency)}
                </p>
                <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--sp-muted)' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; sub?: string; strong?: boolean }> = ({ label, value, sub, strong }) => (
  <div className={`sp-card px-3.5 py-3 ${strong ? 'sp-stat-strong' : ''}`}>
    <p className="text-[10px] font-black uppercase tracking-wider sp-stat-label">{label}</p>
    <p className="text-[17px] lg:text-[20px] font-black sp-num leading-tight mt-1 truncate">{value}</p>
    {sub && <p className="text-[11px] font-bold sp-bad mt-0.5">{sub}</p>}
  </div>
);

export default PosSales;
