import React, { useEffect, useState } from 'react';
import { Star, Users, MessageSquare, TrendingUp, Stethoscope } from 'lucide-react';
import { ratingsAPI, RatingsDashboard } from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

const FACET_LABELS: Record<string, string> = {
  vet: 'Attending vet', staff: 'Staff & support', service: 'Service quality',
  clinic: 'The clinic', overall: 'Overall experience',
};

const Stars: React.FC<{ value: number; size?: number }> = ({ value, size = 13 }) => (
  <span className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} style={n <= Math.round(value) ? { fill: '#f5b301', color: '#f5b301' } : { color: '#d8dee0' }} />
    ))}
  </span>
);

const RatingsDashboardView: React.FC = () => {
  const [data, setData] = useState<RatingsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ratingsAPI.dashboard({ showError: false })
      .then((r) => setData(r.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-16"><LoadingSpinner message="Loading ratings…" /></div>;

  const overall = data?.overall ?? { avg: 0, ratings: 0, visits: 0 };
  const maxDist = Math.max(1, ...(data?.distribution ?? []).map((d) => d.count));

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {overall.ratings === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-10 text-center">
          <Star size={30} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-black text-pine dark:text-zinc-100">No ratings yet</p>
          <p className="text-xs text-slate-400 mt-1">Pet owners rate their visits from the client portal after a completed visit — their scores land here.</p>
        </div>
      ) : (
        <>
          {/* Overall */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-900/10 border border-amber-200/60 dark:border-amber-900/30 rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Overall rating</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-pine dark:text-zinc-100">{overall.avg.toFixed(1)}</span>
                <span className="mb-1"><Stars value={overall.avg} size={15} /></span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{overall.ratings} rating{overall.ratings === 1 ? '' : 's'} across {overall.visits} visit{overall.visits === 1 ? '' : 's'}</p>
            </div>
            {/* Distribution */}
            <div className="sm:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Star distribution</p>
              <div className="space-y-1.5">
                {[...(data?.distribution ?? [])].reverse().map((d) => (
                  <div key={d.star} className="flex items-center gap-2">
                    <span className="w-6 text-[11px] font-black text-slate-500 flex items-center gap-0.5">{d.star}<Star size={9} style={{ fill: '#f5b301', color: '#f5b301' }} /></span>
                    <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round((d.count / maxDist) * 100)}%` }} />
                    </div>
                    <span className="w-8 text-right text-[11px] font-bold text-slate-400 tabular-nums">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Per-facet */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
            <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2 mb-4"><TrendingUp size={15} className="text-seafoam" /> By category</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {['vet', 'staff', 'service', 'clinic', 'overall'].map((f) => {
                const v = data?.facets?.[f];
                return (
                  <div key={f} className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 truncate">{FACET_LABELS[f]}</p>
                    <p className="text-2xl font-black text-pine dark:text-zinc-100">{v ? v.avg.toFixed(1) : '—'}</p>
                    <div className="flex justify-center mt-1"><Stars value={v?.avg ?? 0} size={11} /></div>
                    <p className="text-[9px] text-slate-400 mt-1">{v?.count ?? 0} rating{(v?.count ?? 0) === 1 ? '' : 's'}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Per-vet leaderboard */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2 mb-4"><Stethoscope size={15} className="text-seafoam" /> Vet leaderboard</h3>
              {(data?.perVet ?? []).length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">No vet-specific ratings yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data!.perVet.map((v, i) => (
                    <li key={v.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-zinc-800/50 rounded-xl">
                      <span className="w-5 text-[11px] font-black text-slate-400">{i + 1}</span>
                      <span className="flex-1 text-xs font-bold text-pine dark:text-zinc-100 truncate">{v.name}</span>
                      <Stars value={v.avg} size={11} />
                      <span className="text-sm font-black text-pine dark:text-zinc-100 w-8 text-right">{v.avg.toFixed(1)}</span>
                      <span className="text-[9px] text-slate-400 w-10 text-right">{v.count}★</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recent comments */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2 mb-4"><MessageSquare size={15} className="text-seafoam" /> Recent feedback</h3>
              {(data?.comments ?? []).length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">No written feedback yet.</p>
              ) : (
                <ul className="space-y-2.5 max-h-80 overflow-y-auto">
                  {data!.comments.map((c, i) => (
                    <li key={i} className="border-l-2 border-amber-300 pl-3 py-0.5">
                      <div className="flex items-center gap-2 mb-0.5"><Stars value={c.stars} size={10} /><span className="text-[9px] text-slate-400">{new Date(c.at).toLocaleDateString()}</span></div>
                      <p className="text-xs text-slate-600 dark:text-zinc-300 italic">"{c.comment}"</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RatingsDashboardView;
