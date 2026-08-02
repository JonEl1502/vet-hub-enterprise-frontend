import React, { useEffect, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { visitJobsAPI, VisitJob } from '../../../services/modules/visitJobs.api';

/**
 * Partner-REQUEST stats (user, 2026-08-02) — the new cross-clinic visit-job
 * system, surfaced beside the legacy referral numbers on the B2B Stats tab.
 * Incoming = services partners asked US to perform; outgoing = what we sent
 * out. Earned/paid use the agreed (negotiated) price of COMPLETED jobs.
 */
export const usePartnerJobs = () => {
  const [jobs, setJobs] = useState<VisitJob[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    visitJobsAPI.listForClinic('all', { silent: true } as any)
      .then(r => { if (alive && r.success && r.data?.jobs) setJobs(r.data.jobs); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return { jobs, loading };
};

interface Props {
  activeClinicIds: string[];
  /** yyyy-mm-dd inclusive bounds in clinic TZ; null = no bound. */
  startStr?: string | null;
  endStr?: string | null;
  currency?: string;
  onOpenPartners?: () => void;
}

const B2BJobsStats: React.FC<Props> = ({ activeClinicIds, startStr, endStr, currency = 'KES', onOpenPartners }) => {
  const { jobs, loading } = usePartnerJobs();
  const ids = activeClinicIds.map(String);
  const toStr = (d: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(d));
    return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
  };
  const inRange = (j: VisitJob) => {
    if (!startStr || !endStr) return true;
    const s = toStr(j.createdAt);
    return s >= startStr && s <= endStr;
  };
  const mine = jobs.filter(j => (ids.includes(String(j.providerClinicId)) || ids.includes(String(j.requesterClinicId))) && inRange(j));
  const incoming = mine.filter(j => ids.includes(String(j.providerClinicId)));
  const outgoing = mine.filter(j => ids.includes(String(j.requesterClinicId)));
  const awaiting = incoming.filter(j => j.status === 'REQUESTED');
  const earned = incoming.filter(j => j.status === 'COMPLETED').reduce((s, j) => s + Number(j.agreedPrice || 0), 0);
  const paid = outgoing.filter(j => j.status === 'COMPLETED').reduce((s, j) => s + Number(j.agreedPrice || 0), 0);

  if (loading) return <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-seafoam" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tighter flex items-center gap-2"><Send size={16} className="text-violet-500" /> Partner Requests</h3>
        {onOpenPartners && (
          <button onClick={onOpenPartners} className="text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400 hover:underline">Open partners →</button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="compact-card">
          <p className="card-subtitle mb-1">Total Requests</p>
          <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tighter">{mine.length}</h3>
        </div>
        <div className="compact-card">
          <p className="card-subtitle mb-1">Incoming</p>
          <h3 className="text-xl font-black text-emerald-600 tracking-tighter">{incoming.length}</h3>
        </div>
        <div className="compact-card">
          <p className="card-subtitle mb-1">Outgoing</p>
          <h3 className="text-xl font-black text-cyan tracking-tighter">{outgoing.length}</h3>
        </div>
        <div className="compact-card">
          <p className="card-subtitle mb-1">Awaiting Action</p>
          <h3 className="text-xl font-black text-amber-600 tracking-tighter">{awaiting.length}</h3>
          <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Price / accept pending</p>
        </div>
        <div className="compact-card">
          <p className="card-subtitle mb-1">Earned</p>
          <h3 className="text-xl font-black text-emerald-600 font-mono tracking-tighter">{currency} {earned.toLocaleString()}</h3>
          <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Completed incoming jobs</p>
        </div>
        <div className="compact-card">
          <p className="card-subtitle mb-1">Paid Out</p>
          <h3 className="text-xl font-black text-amber-600 font-mono tracking-tighter">{currency} {paid.toLocaleString()}</h3>
          <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Completed outgoing jobs</p>
        </div>
      </div>
    </div>
  );
};

export default B2BJobsStats;
