import React, { useEffect, useState } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, subYears } from 'date-fns';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { summariesAPI } from '../../../services/modules/summaries.api';
import type { VisitSummary } from '../../../services/modules/summaries.api';

/**
 * PERIOD COMPARISON for Visits (user, 2026-11-23: "add the periods comparison,
 * but let it be a thing that you click … so that you're not mixing up so much
 * from the current"). It opens as its own panel: the period on the page
 * against a second one picked here — last week, last month, the same month
 * last year, or any dates — with the change per figure. Same idea as the
 * Clinic Statistics compare.
 */
const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const fmt = (d: Date | null) => (d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const ROWS: Array<{ key: keyof VisitSummary; label: string; money?: boolean; goodUp?: boolean }> = [
  { key: 'total', label: 'Visits', goodUp: true },
  { key: 'completed', label: 'Completed', goodUp: true },
  { key: 'pendingPayment', label: 'Pending payment', goodUp: false },
  { key: 'cancelled', label: 'Cancelled', goodUp: false },
  { key: 'paid', label: 'Paid', goodUp: true },
  { key: 'partPaid', label: 'Part paid', goodUp: false },
  { key: 'unpaid', label: 'Unpaid', goodUp: false },
  { key: 'billed', label: 'Billed', money: true, goodUp: true },
  { key: 'collected', label: 'Collected', money: true, goodUp: true },
  { key: 'owed', label: 'Still owed', money: true, goodUp: false },
];

interface Props {
  clinicIds: Array<string | number>;
  current: DateRange;
  currency: string;
  onClose: () => void;
}

const VisitsCompare: React.FC<Props> = ({ clinicIds, current: rawCurrent, currency, onClose }) => {
  // An open-ended range ("from today on", ending 2099) has no meaningful
  // length to compare against — it made "previous period" reach back to 1953.
  // Anything ending more than a year out is compared up to today.
  const current: DateRange = React.useMemo(() => {
    const farOut = Date.now() + 366 * 86400000;
    if (rawCurrent.start && rawCurrent.end && new Date(rawCurrent.end).getTime() > farOut) {
      const today = dayEnd(new Date());
      return { start: rawCurrent.start, end: new Date(rawCurrent.start) > today ? dayEnd(new Date(rawCurrent.start)) : today };
    }
    return rawCurrent;
  }, [rawCurrent.start?.toString(), rawCurrent.end?.toString()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [other, setOther] = useState<DateRange | null>(null);
  const [a, setA] = useState<VisitSummary | null>(null);
  const [b, setB] = useState<VisitSummary | null>(null);

  // Presets work off the page's own period.
  const base = current.start ? new Date(current.start) : new Date();
  const presets: Array<[string, DateRange]> = [
    ['Previous period', (() => {
      if (!current.start || !current.end) return { start: dayStart(subWeeks(base, 1)), end: dayEnd(subWeeks(base, 1)) };
      const s = dayStart(new Date(current.start)), e = dayEnd(new Date(current.end));
      const len = e.getTime() - s.getTime();
      return { start: new Date(s.getTime() - len - 1), end: new Date(s.getTime() - 1) };
    })()],
    ['Last week', { start: dayStart(startOfWeek(subWeeks(base, 1), { weekStartsOn: 1 })), end: dayEnd(endOfWeek(subWeeks(base, 1), { weekStartsOn: 1 })) }],
    ['Last month', { start: dayStart(startOfMonth(subMonths(base, 1))), end: dayEnd(endOfMonth(subMonths(base, 1))) }],
    ['Same month last year', { start: dayStart(startOfMonth(subYears(base, 1))), end: dayEnd(endOfMonth(subYears(base, 1))) }],
  ];

  useEffect(() => { if (!other) setOther(presets[0][1]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const load = (r: DateRange | null, set: (x: VisitSummary | null) => void) => {
    if (!r?.start || !r?.end || !clinicIds.length) { set(null); return; }
    summariesAPI.visits({ clinicIds, start: dayStart(new Date(r.start)).toISOString(), end: dayEnd(new Date(r.end)).toISOString() }, { silent: true } as any)
      .then(res => set(res.success && res.data ? res.data : null)).catch(() => set(null));
  };
  useEffect(() => { load(current, setA); }, [current.start?.toString(), current.end?.toString(), clinicIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(other, setB); }, [other?.start?.toString(), other?.end?.toString(), clinicIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = (v: number, money?: boolean) => (money ? `${currency} ${Math.round(v).toLocaleString()}` : v.toLocaleString());

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800">
        <p className="text-[11px] font-black uppercase tracking-wider text-pine dark:text-zinc-100">Compare periods</p>
        <button onClick={onClose} aria-label="Close compare" className="p-1.5 rounded-lg text-slate-400 hover:text-pine active:scale-95"><X size={14} /></button>
      </div>
      <div className="p-4 space-y-3">
        {!current.start || !current.end ? (
          <p className="text-xs text-slate-500">Pick a date range above first — the compare runs against that period.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">This period: <b className="text-pine dark:text-zinc-100">{fmt(current.start)} – {fmt(current.end)}</b></span>
              <span className="text-[11px] font-bold text-slate-400">against</span>
              <div className="flex flex-wrap gap-1.5">
                {presets.map(([label, r]) => {
                  const on = other?.start?.getTime() === r.start?.getTime() && other?.end?.getTime() === r.end?.getTime();
                  return (
                    <button key={label} type="button" onClick={() => setOther(r)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border active:scale-95 ${on ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <DateRangePicker value={other} onChange={setOther} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-zinc-800">
                    <th className="py-2 pr-3 font-black"></th>
                    <th className="py-2 px-3 font-black text-right">This period</th>
                    <th className="py-2 px-3 font-black text-right">{other?.start ? `${fmt(other.start)} – ${fmt(other.end)}` : 'Compare'}</th>
                    <th className="py-2 pl-3 font-black text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(r => {
                    const x = a ? Number(a[r.key]) : null, y = b ? Number(b[r.key]) : null;
                    const diff = x != null && y != null ? x - y : null;
                    const pct = diff != null && y ? Math.round((diff / y) * 100) : null;
                    const good = diff == null || diff === 0 ? null : (diff > 0) === !!r.goodUp;
                    return (
                      <tr key={r.key} className="border-b border-slate-50 dark:border-zinc-800/60">
                        <td className="py-2 pr-3 font-bold text-slate-600 dark:text-zinc-300">{r.label}</td>
                        <td className="py-2 px-3 text-right font-black tabular-nums text-pine dark:text-zinc-100">{x == null ? '…' : show(x, r.money)}</td>
                        <td className="py-2 px-3 text-right font-bold tabular-nums text-slate-500">{y == null ? '…' : show(y, r.money)}</td>
                        <td className={`py-2 pl-3 text-right font-black tabular-nums ${good == null ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {diff == null ? '' : (
                            <span className="inline-flex items-center gap-0.5 justify-end">
                              {diff > 0 ? <ArrowUpRight size={12} /> : diff < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
                              {diff > 0 ? '+' : ''}{show(diff, r.money)}{pct != null && diff !== 0 ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VisitsCompare;
