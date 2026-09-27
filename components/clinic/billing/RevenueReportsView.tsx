import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Wallet, Info } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Line, ComposedChart,
} from 'recharts';
import PageHeader from '../../shared/common/PageHeader';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { summariesAPI, RevenueReportRow, PaymentMethodRow, DiscountRow, ReportBucket } from '../../../services/modules/summaries.api';

/**
 * Revenue Reports — by species/client/vet/service, bucketed by day/week/
 * month/year (2026-09-27, extended for the vet/service/payment-method/
 * discounts deep dive). Modeled on ReportsAnalyticsView's date-range/scope
 * pattern; data comes from `/summaries/revenue-by-*` — no new aggregation
 * logic here, this page is presentation over what those endpoints bucket.
 *
 * ⚠️ Two DIFFERENT totals live on this page, deliberately kept in separate
 * cards: species/client/vet/service all sum to the same BILLED total
 * (`VisitTask.price`). The "Payments Collected" card below is settled CASH
 * (`Transaction.amount`) — it will NOT match the billed total (net of
 * discounts, partial payments, timing), and is labeled as such so nobody
 * reads a mismatch as a bug.
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

const BUCKETS: { id: ReportBucket; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

const PALETTE = ['#1C7A5B', '#F2A41C', '#6366f1', '#ef4444', '#0ea5e9', '#8b5cf6', '#f97316', '#14b8a6'];

const DIMENSIONS = ['species', 'client', 'vet', 'service'] as const;
type Dimension = (typeof DIMENSIONS)[number];

const RevenueReportsView: React.FC<Props> = ({ clinicId }) => {
  const [dimension, setDimension] = useState<Dimension>('species');
  const [bucket, setBucket] = useState<ReportBucket>('month');
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const { from, to } = useMemo(() => {
    if (customRange?.start && customRange?.end) return { from: customRange.start, to: customRange.end };
    return rangeForLast(364);
  }, [customRange]);

  const [rows, setRows] = useState<RevenueReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);
    const opts = { scopeId: clinicId, from: iso(from), to: iso(to), bucket };
    const req = dimension === 'species' ? summariesAPI.revenueBySpecies(opts)
      : dimension === 'client' ? summariesAPI.revenueByClient(opts)
      : dimension === 'vet' ? summariesAPI.revenueByVet(opts)
      : summariesAPI.revenueByService(opts);
    req
      .then((r) => { if (r.success && r.data) setRows(r.data); })
      .finally(() => setLoading(false));
  }, [clinicId, dimension, bucket, from, to]);

  useEffect(() => { load(); }, [load]);

  // ── Payments Collected — a separate query family (Transaction, not VisitTask) ──
  const [methodRows, setMethodRows] = useState<PaymentMethodRow[]>([]);
  const [discountRows, setDiscountRows] = useState<DiscountRow[]>([]);
  const [collectedLoading, setCollectedLoading] = useState(true);

  const loadCollected = useCallback(() => {
    if (!clinicId) { setCollectedLoading(false); return; }
    setCollectedLoading(true);
    const opts = { scopeId: clinicId, from: iso(from), to: iso(to), bucket };
    Promise.all([
      summariesAPI.revenueByPaymentMethod(opts),
      summariesAPI.discountsOverTime(opts),
    ]).then(([m, d]) => {
      if (m.success && m.data) setMethodRows(m.data);
      if (d.success && d.data) setDiscountRows(d.data);
    }).finally(() => setCollectedLoading(false));
  }, [clinicId, bucket, from, to]);

  useEffect(() => { loadCollected(); }, [loadCollected]);

  const methodGroups = useMemo(() => [...new Set(methodRows.map(r => r.group))], [methodRows]);
  const collectedChartData = useMemo(() => {
    const byPeriod = new Map<string, any>();
    for (const r of methodRows) {
      const row = byPeriod.get(r.period) ?? { period: r.period };
      row[r.group] = (row[r.group] || 0) + r.total;
      byPeriod.set(r.period, row);
    }
    for (const r of discountRows) {
      const row = byPeriod.get(r.period) ?? { period: r.period };
      row.discounts = (row.discounts || 0) + r.total;
      byPeriod.set(r.period, row);
    }
    return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
  }, [methodRows, discountRows]);
  const totalCollected = useMemo(() => methodRows.reduce((s, r) => s + r.total, 0), [methodRows]);
  const totalDiscounts = useMemo(() => discountRows.reduce((s, r) => s + r.total, 0), [discountRows]);

  // Pivot rows (period, group, total) into one chart row per period with a
  // key per group — same shape recharts' <Bar> series expect.
  const groups = useMemo(() => [...new Set(rows.map(r => r.group))].slice(0, 8), [rows]);
  const chartData = useMemo(() => {
    const byPeriod = new Map<string, any>();
    for (const r of rows) {
      if (!groups.includes(r.group)) continue;
      const row = byPeriod.get(r.period) ?? { period: r.period };
      row[r.group] = (row[r.group] || 0) + r.total;
      byPeriod.set(r.period, row);
    }
    return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
  }, [rows, groups]);

  const money = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (!clinicId) {
    return <p className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Select a clinic first</p>;
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Revenue Reports"
        subtitle="Billed revenue by species, client, vet or service, over any period"
        icon={BarChart3}
        onBack
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker value={customRange} onChange={(r) => setCustomRange(r && r.start && r.end ? r : null)} />
          </div>
        )}
      />

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="inline-flex flex-wrap rounded-xl border border-slate-200 dark:border-zinc-700 p-1">
            {DIMENSIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  dimension === d ? 'bg-seafoam text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                By {d}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-zinc-700 p-1">
            {BUCKETS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBucket(b.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  bucket === b.id ? 'bg-pine text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="py-16 text-center text-[11px] text-slate-400 flex flex-col items-center gap-2">
            <TrendingUp size={20} className="opacity-40" />
            No billed revenue in this range yet.
          </div>
        ) : (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => money(v)} width={80} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {groups.map((g, i) => (
                    <Bar key={g} dataKey={g} stackId="rev" fill={PALETTE[i % PALETTE.length]} radius={i === groups.length - 1 ? [6, 6, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="text-left px-3 py-1.5">Period</th>
                    <th className="text-left px-3 py-1.5 capitalize">{dimension}</th>
                    <th className="text-right px-3 py-1.5">Revenue</th>
                    <th className="text-right px-3 py-1.5">Line items</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.period}-${r.group}-${i}`} className="border-t border-slate-50 dark:border-zinc-800">
                      <td className="px-3 py-1.5 font-bold text-pine dark:text-zinc-100">{r.period}</td>
                      <td className="px-3 py-1.5 text-slate-600 dark:text-zinc-300">{r.group}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-black text-pine dark:text-zinc-100">{money(r.total)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-400">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Payments Collected — a DIFFERENT total, on purpose ─────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-8 shadow-sm">
        <div className="flex items-start gap-2 mb-6">
          <Wallet size={16} className="text-seafoam shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-black text-pine dark:text-zinc-100">Payments Collected</h3>
            <p className="text-[11px] text-slate-400 flex items-start gap-1 mt-0.5">
              <Info size={11} className="shrink-0 mt-0.5" />
              Settled cash by payment method, plus discounts given. This is NOT the same
              number as the billed revenue above — it's net of discounts and partial
              payments, and timed by when money actually moved, not when it was billed.
            </p>
          </div>
        </div>

        {collectedLoading ? (
          <div className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Loading…</div>
        ) : collectedChartData.length === 0 ? (
          <div className="py-16 text-center text-[11px] text-slate-400 flex flex-col items-center gap-2">
            <Wallet size={20} className="opacity-40" />
            No payments settled in this range yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total collected</p>
                <p className="text-sm font-black text-pine dark:text-zinc-100">{money(totalCollected)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total discounts given</p>
                <p className="text-sm font-black text-amber-500">{money(totalDiscounts)}</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={collectedChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => money(v)} width={80} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {methodGroups.map((g, i) => (
                    <Bar key={g} dataKey={g} stackId="collected" fill={PALETTE[i % PALETTE.length]} radius={i === methodGroups.length - 1 ? [6, 6, 0, 0] : undefined} />
                  ))}
                  <Line type="monotone" dataKey="discounts" stroke="#f59e0b" strokeWidth={2} dot={false} name="Discounts" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RevenueReportsView;
