import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Siren, AlertTriangle, Loader2, RefreshCw, HeartPulse, ChevronRight, Clock } from 'lucide-react';
import { triageAPI, EmergencyTriageRecord, TriageCategory } from '../../../services';
import { formatTime } from '../../../services/utils/dateFormatter';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

interface Props {
  onOpenVisit?: (appointmentId: number) => void;
}

const CATEGORY_META: Record<TriageCategory, { label: string; tone: string; rank: number }> = {
  CRITICAL: { label: '🔴 Critical', tone: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800', rank: 0 },
  URGENT: { label: '🟠 Urgent', tone: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800', rank: 1 },
  STABLE_URGENT: { label: '🟡 Stable-urgent', tone: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800', rank: 2 },
  NON_EMERGENCY: { label: '🟢 Non-emergency', tone: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', rank: 3 },
};

const FILTERS: { value: 'active' | 'all'; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
];

const EmergencyBoardView: React.FC<Props> = ({ onOpenVisit }) => {
  const [records, setRecords] = useState<EmergencyTriageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await triageAPI.list(filter === 'active' ? { scope: 'board' } : {});
      if (res.success && res.data?.records) setRecords(res.data.records);
    } catch { /* surfaced by API layer */ }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(
    () => [...records].sort((a, b) => (CATEGORY_META[a.triageCategory as TriageCategory]?.rank ?? 9) - (CATEGORY_META[b.triageCategory as TriageCategory]?.rank ?? 9)),
    [records],
  );
  const activeCount = records.filter(r => r.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500"><Siren size={22} /></div>
          <div>
            <h1 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">Emergency</h1>
            <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest mt-1">{activeCount} active in triage</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
            {FILTERS.map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === f.value ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{f.label}</button>
            ))}
          </div>
          <button onClick={load} className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-400 hover:text-seafoam transition-all"><RefreshCw size={15} /></button>
        </div>
      </header>

      {loading ? (
        <div className="py-24"><LoadingSpinner size="lg" message="Loading emergencies..." /></div>
      ) : sorted.length === 0 ? (
        <div className="py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-30 uppercase font-black text-[10px] tracking-[0.3em]">No emergency cases</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(r => {
            const cat = r.triageCategory ? CATEGORY_META[r.triageCategory as TriageCategory] : null;
            const last = r.monitoring && r.monitoring.length ? r.monitoring[r.monitoring.length - 1] : null;
            return (
              <button
                key={r.id}
                onClick={() => r.appointmentId && onOpenVisit?.(Number(r.appointmentId))}
                className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm hover:border-seafoam transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-xl shrink-0">{r.pet?.species === 'Dog' ? '🐶' : r.pet?.species === 'Cat' ? '🐱' : '🐾'}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase truncate">{r.pet?.name || 'Patient'}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{r.pet?.breed || r.pet?.species || ''}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-seafoam shrink-0 mt-1" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {cat && <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${cat.tone}`}>{cat.label}</span>}
                  <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${r.status === 'STABILIZED' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700'}`}>{r.outcome || r.status.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1"><Clock size={10} /> {r.arrivalAt ? formatTime(r.arrivalAt) : '—'}</span>
                  {last && <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400"><HeartPulse size={10} /> HR {last.hr ?? '—'} · RR {last.rr ?? '—'} · T {last.temp ?? '—'}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmergencyBoardView;
