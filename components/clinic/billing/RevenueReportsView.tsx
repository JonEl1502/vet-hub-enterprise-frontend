import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import PageHeader from '../../shared/common/PageHeader';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { summariesAPI, RevenueReportRow, ReportBucket } from '../../../services/modules/summaries.api';

/**
 * Revenue Reports — by species and by client, bucketed by day/week/month/year
 * (2026-09-27). Modeled on ReportsAnalyticsView's date-range/scope pattern;
 * data comes from the new `/summaries/revenue-by-species` and
 * `/summaries/revenue-by-client` endpoints (`summaryService.revenueBySpecies`/
 * `revenueByClient` on the backend) — no new aggregation logic here, this
 * page is presentation over what those endpoints already bucket.
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

const RevenueReportsView: React.FC<Props> = ({ clinicId }) => {
  const [dimension, setDimension] = useState<'species' | 'client'>('species');
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
    const req = dimension === 'species' ? summariesAPI.revenueBySpecies(opts) : summariesAPI.revenueByClient(opts);
    req
      .then((r) => { if (r.success && r.data) setRows(r.data); })
      .finally(() => setLoading(false));
  }, [clinicId, dimension, bucket, from, to]);

  useEffect(() => { load(); }, [load]);

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
        subtitle="Revenue by species or by client, over any period"
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
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-zinc-700 p-1">
            {(['species', 'client'] as const).map((d) => (
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
    </div>
  );
};

export default RevenueReportsView;
