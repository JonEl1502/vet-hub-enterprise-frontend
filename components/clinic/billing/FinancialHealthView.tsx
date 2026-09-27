import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HeartPulse, TrendingUp, TrendingDown, Wallet as WalletIcon, Receipt } from 'lucide-react';
import PageHeader from '../../shared/common/PageHeader';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { summariesAPI, ProfitAndLoss, CashFlow } from '../../../services/modules/summaries.api';
import { receivablesAPI, ArAgeing } from '../../../services/modules/receivables.api';
import { walletAPI, Wallet as WalletT } from '../../../services/modules/wallet.api';

/**
 * Financial Health — composition, not new data (2026-09-27). Every number
 * here already exists behind `/summaries/pnl`, `/summaries/cashflow` and
 * `/transactions/ar-ageing` (the same calls `ReportsAnalyticsView`'s "Quick
 * Reports" pills and `FinancialStatementModal` already make) — this page
 * just reframes them as liquidity / profitability / receivables-health
 * instead of a plain statement-in-a-modal.
 */

interface Props {
  clinicId?: number | string | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const rangeForLast = (days: number) => {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  from.setUTCHours(0, 0, 0, 0);
  return { from, to };
};

const StatCard: React.FC<{ label: string; value: string; tone: string; icon: React.ElementType; sub?: string }> =
  ({ label, value, tone, icon: Icon, sub }) => (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={tone} />
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <p className={`text-xl font-black ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );

const FinancialHealthView: React.FC<Props> = ({ clinicId }) => {
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const { from, to } = useMemo(() => {
    if (customRange?.start && customRange?.end) return { from: customRange.start, to: customRange.end };
    return rangeForLast(29);
  }, [customRange]);

  const [pnl, setPnl] = useState<ProfitAndLoss | null>(null);
  const [cf, setCf] = useState<CashFlow | null>(null);
  const [ar, setAr] = useState<ArAgeing | null>(null);
  const [wallets, setWallets] = useState<WalletT[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);
    const opts = { scopeId: clinicId, from: iso(from), to: iso(to) };
    Promise.all([
      summariesAPI.pnl(opts).catch(() => null),
      summariesAPI.cashFlow(opts).catch(() => null),
      receivablesAPI.arAgeing().catch(() => null),
      walletAPI.getByEntity('CLINIC', String(clinicId), { silent: true } as any).catch(() => null),
    ]).then(([pnlRes, cfRes, arRes, wRes]) => {
      if (pnlRes?.success && pnlRes.data) setPnl(pnlRes.data);
      if (cfRes?.success && cfRes.data) setCf(cfRes.data);
      if (arRes?.success && arRes.data) setAr(arRes.data);
      if (wRes?.success && wRes.data?.wallets) setWallets(wRes.data.wallets);
    }).finally(() => setLoading(false));
  }, [clinicId, from, to]);

  useEffect(() => { load(); }, [load]);

  const money = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const cashBalance = wallets.reduce((s, w) => s + Number(w.balance || 0), 0);
  const revenue = pnl?.revenue ?? 0;
  const expenses = pnl?.expenses ?? 0;
  const netIncome = pnl?.netIncome ?? 0;
  const grossMarginPct = revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 1000) / 10 : null;
  const arTotal = ar?.total ?? 0;
  // Liquidity's roughest-but-honest read: cash on hand vs. what's still owed
  // to the clinic. Not a textbook current ratio (no formal current-liabilities
  // figure exists yet) — labeled plainly rather than dressed up as one.
  const cashToArRatio = arTotal > 0 ? Math.round((cashBalance / arTotal) * 100) / 100 : null;

  if (!clinicId) {
    return <p className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Select a clinic first</p>;
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Financial Health"
        subtitle="Profitability, liquidity and receivables at a glance"
        icon={HeartPulse}
        onBack
        actions={<DateRangePicker value={customRange} onChange={(r) => setCustomRange(r && r.start && r.end ? r : null)} />}
      />

      {loading ? (
        <div className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Loading…</div>
      ) : (
        <>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-8 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Profitability</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Revenue" value={money(revenue)} tone="text-pine dark:text-zinc-100" icon={TrendingUp} />
              <StatCard label="Expenses" value={money(expenses)} tone="text-rose-500" icon={TrendingDown} />
              <StatCard
                label="Net income"
                value={money(netIncome)}
                tone={netIncome >= 0 ? 'text-emerald-600' : 'text-rose-500'}
                icon={netIncome >= 0 ? TrendingUp : TrendingDown}
              />
              <StatCard
                label="Margin"
                value={grossMarginPct === null ? '—' : `${grossMarginPct}%`}
                tone={grossMarginPct !== null && grossMarginPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}
                icon={HeartPulse}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-8 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Liquidity</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Cash on hand" value={money(cashBalance)} tone="text-pine dark:text-zinc-100" icon={WalletIcon} />
              <StatCard label="Cash in (range)" value={money(cf?.totals.cashIn ?? 0)} tone="text-emerald-600" icon={TrendingUp} />
              <StatCard label="Cash out (range)" value={money(cf?.totals.cashOut ?? 0)} tone="text-rose-500" icon={TrendingDown} />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-8 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Receivables health</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard label="Total outstanding" value={money(arTotal)} tone="text-amber-500" icon={Receipt} />
              <StatCard
                label="Cash vs. AR"
                value={cashToArRatio === null ? '—' : `${cashToArRatio}×`}
                tone="text-pine dark:text-zinc-100"
                icon={WalletIcon}
                sub="Cash on hand per KES owed"
              />
            </div>
            {ar && ar.buckets.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ar.buckets.map((b) => (
                  <div key={b.key} className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{b.label}</p>
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{money(b.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-8 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Expense breakdown</p>
            {!pnl || pnl.expensesByCategory.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-4">No expenses recorded in this range.</p>
            ) : (
              <div className="space-y-1.5">
                {pnl.expensesByCategory.map((e) => {
                  const pct = revenue > 0 ? Math.round((e.amount / revenue) * 1000) / 10 : null;
                  return (
                    <div key={e.category} className="flex items-center justify-between text-[12px]">
                      <span className="font-bold text-pine dark:text-zinc-100">{e.category}</span>
                      <span className="font-mono text-slate-500 dark:text-zinc-400">
                        {money(e.amount)}{pct !== null && <span className="text-slate-400"> · {pct}% of revenue</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FinancialHealthView;
