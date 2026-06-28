import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarClock, BellRing, Stethoscope, UserPlus, PawPrint, BedDouble, Home, Scissors,
  Receipt, CircleDollarSign, Loader2, SlidersHorizontal, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import {
  startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, subDays,
} from 'date-fns';
import DateRangePicker from '../../shared/common/DateRangePicker';
import { summariesAPI } from '../../../services/modules/summaries.api';
import type { ClinicStats } from '../../../services/modules/summaries.api';

type Range = { start: Date | null; end: Date | null };
const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
const dayStart = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

type MetricKey = keyof Pick<ClinicStats, 'appointments' | 'reminders' | 'visits' | 'newClients' | 'newPatients' | 'inpatient' | 'boarding' | 'surgeries' | 'transactions' | 'revenue'>;
interface MetricDef { key: MetricKey; label: string; icon: React.ElementType; money?: boolean; group: 'primary' | 'patient' | 'finance' }
const METRICS: MetricDef[] = [
  { key: 'appointments', label: 'Appointments', icon: CalendarClock, group: 'primary' },
  { key: 'reminders', label: 'Reminders', icon: BellRing, group: 'primary' },
  { key: 'visits', label: 'Visits', icon: Stethoscope, group: 'primary' },
  { key: 'newClients', label: 'New clients', icon: UserPlus, group: 'primary' },
  { key: 'newPatients', label: 'New patients', icon: PawPrint, group: 'primary' },
  { key: 'inpatient', label: 'Onboarding', icon: BedDouble, group: 'patient' },
  { key: 'boarding', label: 'Boarding', icon: Home, group: 'patient' },
  { key: 'surgeries', label: 'Surgery', icon: Scissors, group: 'patient' },
  { key: 'transactions', label: 'Transactions', icon: Receipt, group: 'finance' },
  { key: 'revenue', label: 'Revenue', icon: CircleDollarSign, money: true, group: 'finance' },
];
const DEFAULT_HIGHLIGHT: MetricKey[] = ['appointments', 'reminders', 'visits', 'newClients', 'newPatients', 'inpatient', 'boarding', 'surgeries'];

const ClinicStatistics: React.FC<{ clinicId?: string | number; currency?: string; scopes?: { id: string | number; name?: string }[] }> = ({ clinicId, currency = 'KES', scopes }) => {
  // When several clinics are in scope (multi-select), aggregate the stats
  // across all of them so the numbers reflect the full selection, not just
  // the active clinic. Falls back to the single `clinicId` when no scope list
  // is supplied.
  const scopeList = (scopes && scopes.length ? scopes : (clinicId != null ? [{ id: clinicId }] : []));
  const scopeIdsKey = scopeList.map(s => String(s.id)).join(',');
  const multiScope = scopeList.length > 1;
  // The page opens on today (the standard date-picker default); user can change.
  const [range, setRange] = useState<Range>({ start: dayStart(), end: dayEnd() });
  const [compareRange, setCompareRange] = useState<Range | null>(null);
  const [preset, setPreset] = useState<'none' | 'day' | 'week' | 'month' | 'custom'>('none');
  const [stats, setStats] = useState<ClinicStats | null>(null);
  const [compareStats, setCompareStats] = useState<ClinicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const [highlight, setHighlight] = useState<MetricKey[]>(() => {
    try { const s = localStorage.getItem(`clinicStats.highlight.${clinicId}`); if (s) return JSON.parse(s); } catch { /* */ }
    return DEFAULT_HIGHLIGHT;
  });
  const toggleHighlight = (k: MetricKey) => setHighlight(prev => {
    const next = prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k];
    try { localStorage.setItem(`clinicStats.highlight.${clinicId}`, JSON.stringify(next)); } catch { /* */ }
    return next;
  });

  const fetchStats = useCallback(async (r: Range): Promise<ClinicStats | null> => {
    if (!scopeList.length) return null;
    // Fetch every in-scope clinic in parallel, then sum the numeric fields.
    const results = await Promise.all(
      scopeList.map(s =>
        summariesAPI.clinicStats({ scopeId: s.id, from: iso(r.start), to: iso(r.end) })
          .then(res => (res.success ? (res.data as ClinicStats) : null))
          .catch(() => null)
      )
    );
    const valid = results.filter(Boolean) as ClinicStats[];
    if (!valid.length) return null;
    return valid.reduce((acc, s) => {
      const out = { ...acc } as Record<string, number>;
      (Object.keys(s) as (keyof ClinicStats)[]).forEach(k => {
        out[k as string] = (Number((acc as any)[k]) || 0) + (Number(s[k]) || 0);
      });
      return out as unknown as ClinicStats;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeIdsKey]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchStats(range), compareRange ? fetchStats(compareRange) : Promise.resolve(null)])
      .then(([cur, cmp]) => { if (alive) { setStats(cur); setCompareStats(cmp); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fetchStats, range.start, range.end, compareRange?.start, compareRange?.end]);

  // Preset comparisons set BOTH the current range and the range to compare to.
  const applyPreset = (p: typeof preset) => {
    setPreset(p);
    const now = new Date();
    if (p === 'none') { setCompareRange(null); return; }
    if (p === 'day') {
      setRange({ start: dayStart(now), end: dayEnd(now) });
      setCompareRange({ start: dayStart(subDays(now, 7)), end: dayEnd(subDays(now, 7)) });
    } else if (p === 'week') {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      setRange({ start: dayStart(ws), end: dayEnd(endOfWeek(now, { weekStartsOn: 1 })) });
      setCompareRange({ start: dayStart(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })), end: dayEnd(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })) });
    } else if (p === 'month') {
      setRange({ start: dayStart(startOfMonth(now)), end: dayEnd(endOfMonth(now)) });
      setCompareRange({ start: dayStart(startOfMonth(subMonths(now, 1))), end: dayEnd(endOfMonth(subMonths(now, 1))) });
    } else if (p === 'custom') {
      // keep the current range; default the compare window to the immediately
      // preceding period of the same length.
      const len = range.start && range.end ? range.end.getTime() - range.start.getTime() : 0;
      if (range.start && range.end) setCompareRange({ start: new Date(range.start.getTime() - len - 1), end: new Date(range.start.getTime() - 1) });
    }
  };

  const fmt = (m: MetricDef, v: number) => (m.money ? `${currency} ${v.toLocaleString()}` : v.toLocaleString());
  const delta = (k: MetricKey) => {
    if (!stats || !compareStats) return null;
    const cur = stats[k] as number, prev = compareStats[k] as number;
    const diff = cur - prev;
    const pct = prev === 0 ? (cur > 0 ? 100 : 0) : Math.round((diff / prev) * 100);
    return { diff, pct };
  };

  const highlighted = METRICS.filter(m => highlight.includes(m.key));
  const rest = METRICS.filter(m => !highlight.includes(m.key));

  const chartData = useMemo(() => {
    if (!stats) return [];
    return highlighted.filter(m => !m.money).map(m => ({
      name: m.label,
      current: stats[m.key] as number,
      ...(compareStats ? { previous: compareStats[m.key] as number } : {}),
    }));
  }, [stats, compareStats, highlight]);

  const Card: React.FC<{ m: MetricDef; small?: boolean }> = ({ m, small }) => {
    const d = delta(m.key);
    const v = stats ? (stats[m.key] as number) : 0;
    return (
      <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm ${small ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`flex items-center justify-center rounded-xl bg-seafoam/10 text-seafoam ${small ? 'w-7 h-7' : 'w-9 h-9'}`}><m.icon size={small ? 14 : 18} /></span>
          {d && (
            <span className={`flex items-center gap-0.5 text-[9px] font-black ${d.diff > 0 ? 'text-emerald-500' : d.diff < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
              {d.diff > 0 ? <ArrowUp size={10} /> : d.diff < 0 ? <ArrowDown size={10} /> : <Minus size={10} />} {Math.abs(d.pct)}%
            </span>
          )}
        </div>
        <p className={`font-black text-pine dark:text-zinc-100 mt-2 ${small ? 'text-lg' : 'text-2xl'}`}>{fmt(m, v)}</p>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{m.label}</p>
        {d && <p className="text-[8px] text-slate-400 mt-0.5">{d.diff >= 0 ? '+' : ''}{m.money ? `${currency} ${d.diff.toLocaleString()}` : d.diff.toLocaleString()} vs compare</p>}
      </div>
    );
  };

  const presets: { id: typeof preset; label: string }[] = [
    { id: 'none', label: 'No compare' },
    { id: 'day', label: 'Today vs last wk' },
    { id: 'week', label: 'Week vs last' },
    { id: 'month', label: 'Month vs last' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={range} onChange={(r) => { setRange(r); if (preset !== 'custom') setPreset('none'); }} />
          <button onClick={() => setShowPicker(s => !s)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-pine dark:text-zinc-200 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all">
            <SlidersHorizontal size={13} /> Highlight
          </button>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          {presets.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${preset === p.id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-500 hover:text-pine'}`}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Scope strip — only shown when more than one clinic is in scope, so a
          single-clinic view stays clean (name hidden). Makes clear the cards
          below are a combined total across the named clinics. */}
      {multiScope && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-seafoam">Combined · {scopeList.length} clinics</span>
          {scopeList.filter(s => s.name).map(s => (
            <span key={String(s.id)} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[9px] font-bold text-slate-500 dark:text-zinc-400">{s.name}</span>
          ))}
        </div>
      )}

      {preset === 'custom' && (
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <span>Compare to</span>
          <DateRangePicker value={compareRange || { start: null, end: null }} onChange={setCompareRange} />
        </div>
      )}

      {/* Highlight picker */}
      {showPicker && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Choose which stats to highlight</p>
          <div className="flex flex-wrap gap-2">
            {METRICS.map(m => (
              <button key={m.key} onClick={() => toggleHighlight(m.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${highlight.includes(m.key) ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>
                <m.icon size={12} /> {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : (
        <>
          {/* Highlighted cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {highlighted.map(m => <Card key={m.key} m={m} />)}
            {highlighted.length === 0 && <p className="col-span-full text-[11px] text-slate-400 py-6 text-center">No stats highlighted — use “Highlight” to pick some.</p>}
          </div>

          {/* The rest — collapsed so they don't overshadow the main ones */}
          {rest.length > 0 && (
            <div>
              <button onClick={() => setShowMore(s => !s)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-seafoam">
                {showMore ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {showMore ? 'Hide' : 'More'} stats · {rest.length}
              </button>
              {showMore && (
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 mt-2">
                  {rest.map(m => <Card key={m.key} m={m} small />)}
                </div>
              )}
            </div>
          )}

          {/* Comparison graph */}
          {chartData.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-200 mb-3">{compareStats ? 'Comparison' : 'Highlighted stats'}</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} stroke="#cbd5e1" interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} stroke="#cbd5e1" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }} />
                  <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  <Bar dataKey="current" name="Current" fill="#1C7A5B" radius={[6, 6, 0, 0]} />
                  {compareStats && <Bar dataKey="previous" name="Compare" fill="#94a3b8" radius={[6, 6, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClinicStatistics;
