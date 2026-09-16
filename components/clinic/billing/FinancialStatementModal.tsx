import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { X, Loader2, FileText, BarChart3 } from 'lucide-react';
import { summariesAPI, ProfitAndLoss, CashFlow } from '../../../services/modules/summaries.api';

/**
 * Profit & Loss / Cash Flow — the two "Quick Reports" pills that used to fall
 * through to the generic "coming soon" toast (user, 2026-09-16). Both read
 * the SAME cash-basis rollups the rest of this dashboard already uses
 * (computeClinicDay's revenue/expenses, plus Expense.category for the P&L
 * breakdown) — no new ledger, just a statement layout over existing numbers.
 *
 * Portalled to <body> for the same reason ReportIssueModal is: the nav this
 * page sits under is `backdrop-blur-xl`, which makes it a containing block
 * for `position: fixed` descendants rendered in place.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  kind: 'PNL' | 'CASHFLOW';
  clinicId: number | string | null | undefined;
  from: Date;
  to: Date;
  money: (n: number) => string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtWindow = (a: Date, b: Date) => {
  const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${a.toLocaleDateString(undefined, opt)} – ${b.toLocaleDateString(undefined, opt)}`;
};
const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const Row: React.FC<{ label: string; value: string; muted?: boolean; bold?: boolean; className?: string; valueClass?: string }> =
  ({ label, value, muted, bold, className = '', valueClass = '' }) => (
    <div className={`flex items-center justify-between py-1 ${className}`}>
      <span className={`${muted ? 'text-slate-500 dark:text-zinc-400' : 'text-pine dark:text-zinc-100'} ${bold ? 'font-black' : 'font-bold'} text-[12px]`}>
        {label}
      </span>
      <span className={`font-mono font-black text-[12px] ${valueClass || (bold ? 'text-pine dark:text-zinc-100' : 'text-slate-600 dark:text-zinc-300')}`}>
        {value}
      </span>
    </div>
  );

const Stat: React.FC<{ label: string; value: string; tone: string }> = ({ label, value, tone }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-3 py-2">
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className={`text-sm font-black ${tone}`}>{value}</p>
  </div>
);

const PnlBody: React.FC<{ data: ProfitAndLoss; money: (n: number) => string }> = ({ data, money }) => (
  <div className="space-y-4">
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Revenue</p>
      <Row label="Total revenue" value={money(data.revenue)} bold />
    </div>
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Expenses</p>
      {data.expensesByCategory.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2">No expenses recorded in this range.</p>
      ) : data.expensesByCategory.map(e => (
        <Row key={e.category} label={e.category} value={money(e.amount)} muted />
      ))}
      <Row
        label="Total expenses"
        value={money(data.expenses)}
        bold
        className="border-t border-slate-200 dark:border-zinc-800 mt-1.5 pt-1.5"
      />
    </div>
    <Row
      label="Net income"
      value={money(data.netIncome)}
      bold
      className={`border-t-2 pt-2 text-sm ${data.netIncome >= 0 ? 'border-emerald-200 dark:border-emerald-900' : 'border-rose-200 dark:border-rose-900'}`}
      valueClass={data.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-500'}
    />
  </div>
);

const CashFlowBody: React.FC<{ data: CashFlow; money: (n: number) => string }> = ({ data, money }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Cash in" value={money(data.totals.cashIn)} tone="text-emerald-500" />
      <Stat label="Cash out" value={money(data.totals.cashOut)} tone="text-rose-500" />
      <Stat label="Net" value={money(data.totals.net)} tone={data.totals.net >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
    </div>
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Daily movement</p>
      {data.series.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2">No daily figures recorded for this range yet.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-slate-50 dark:bg-zinc-800 text-[9px] font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th className="text-left px-3 py-1.5">Day</th>
                <th className="text-right px-3 py-1.5">In</th>
                <th className="text-right px-3 py-1.5">Out</th>
                <th className="text-right px-3 py-1.5">Net</th>
                <th className="text-right px-3 py-1.5">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.series.map(r => (
                <tr key={r.day} className="border-t border-slate-50 dark:border-zinc-800">
                  <td className="px-3 py-1.5 font-bold text-pine dark:text-zinc-100">{fmtDay(r.day)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-600">{money(r.cashIn)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-rose-500">{money(r.cashOut)}</td>
                  <td className={`px-3 py-1.5 text-right font-mono ${r.net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{money(r.net)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-black text-pine dark:text-zinc-100">{money(r.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
);

const FinancialStatementModal: React.FC<Props> = ({ isOpen, onClose, kind, clinicId, from, to, money }) => {
  const [loading, setLoading] = useState(false);
  const [pnl, setPnl] = useState<ProfitAndLoss | null>(null);
  const [cf, setCf] = useState<CashFlow | null>(null);

  useEffect(() => {
    if (!isOpen || !clinicId) return;
    setLoading(true);
    setPnl(null);
    setCf(null);
    const opts = { scopeId: clinicId, from: iso(from), to: iso(to) };
    const req = kind === 'PNL' ? summariesAPI.pnl(opts) : summariesAPI.cashFlow(opts);
    req
      .then(r => {
        if (!r.success || !r.data) { toast.error('Could not load the report'); return; }
        if (kind === 'PNL') setPnl(r.data as ProfitAndLoss);
        else setCf(r.data as CashFlow);
      })
      .catch(() => toast.error('Could not load the report'))
      .finally(() => setLoading(false));
  }, [isOpen, kind, clinicId, from, to]);

  if (!isOpen) return null;

  const title = kind === 'PNL' ? 'Profit & Loss Statement' : 'Cash Flow Statement';
  const Icon = kind === 'PNL' ? FileText : BarChart3;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg my-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-pine dark:text-zinc-100 flex items-center gap-2">
            <Icon size={18} className="text-seafoam" /> {title}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-[11px] font-bold text-slate-400 mb-4">{fmtWindow(from, to)}</p>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : kind === 'PNL' ? (
          pnl && <PnlBody data={pnl} money={money} />
        ) : (
          cf && <CashFlowBody data={cf} money={money} />
        )}

        <div className="flex justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-bold">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default FinancialStatementModal;
