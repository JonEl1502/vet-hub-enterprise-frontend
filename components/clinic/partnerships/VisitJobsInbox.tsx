import React, { useState, useEffect, useCallback } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, CheckCircle2, Clock, XCircle, Send, RefreshCw } from 'lucide-react';
// Import straight from the modules (not the services barrel — it's reshuffled by
// other work streams and a transient state can drop the re-export).
import { visitJobsAPI } from '../../../services/modules/visitJobs.api';
import type { VisitJob, VisitJobStatus } from '../../../services/modules/visitJobs.api';
import { toast } from '../../../services/utils/toast';
import ClinicLogo from '../clinic-mgmt/ClinicLogo';
import VisitJobTracker from './VisitJobTracker';
import { MapPin } from 'lucide-react';

const TONE: Record<string, string> = {
  REQUESTED: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  ACCEPTED: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  DECLINED: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  CANCELLED: 'bg-slate-100 dark:bg-zinc-800 text-slate-500',
};
const StatusIcon: React.FC<{ s: string; size?: number }> = ({ s, size = 11 }) =>
  s === 'COMPLETED' ? <CheckCircle2 size={size} /> : s === 'DECLINED' || s === 'CANCELLED' ? <XCircle size={size} /> : <Clock size={size} />;

/**
 * Outsourced-job queues for the active clinic: jobs sent TO us (we provide the
 * service → accept/decline/complete) and jobs WE sent out (cancel + track).
 */
const VisitJobsInbox: React.FC = () => {
  const [incoming, setIncoming] = useState<VisitJob[]>([]);
  const [outgoing, setOutgoing] = useState<VisitJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openTrack, setOpenTrack] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, out] = await Promise.all([
        visitJobsAPI.listForClinic('incoming'),
        visitJobsAPI.listForClinic('outgoing'),
      ]);
      if (inc.success && inc.data?.jobs) setIncoming(inc.data.jobs);
      if (out.success && out.data?.jobs) setOutgoing(out.data.jobs);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (job: VisitJob, status: VisitJobStatus, label: string) => {
    setBusyId(job.id);
    try {
      const res = await visitJobsAPI.updateStatus(job.id, status);
      if (res.success) { toast.success(label); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusyId(null); }
  };

  const Card: React.FC<{ job: VisitJob; mode: 'incoming' | 'outgoing' }> = ({ job, mode }) => {
    const partner = mode === 'incoming' ? job.requesterClinic : job.providerClinic;
    const b = busyId === job.id;
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center overflow-hidden text-lg shrink-0"><ClinicLogo logo={partner?.logo} fallback="🏥" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{job.serviceName || job.category}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
              {mode === 'incoming' ? <ArrowDownLeft size={10} className="text-seafoam" /> : <ArrowUpRight size={10} className="text-indigo-500" />}
              {mode === 'incoming' ? 'From' : 'To'} {partner?.name || 'clinic'} · {job.currency} {job.agreedPrice.toLocaleString()}
            </p>
          </div>
          {job.paidOut && <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{mode === 'incoming' ? 'Paid' : 'Paid B'}</span>}
          <span className={`flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${TONE[job.status] || ''}`}><StatusIcon s={job.status} size={10} /> {job.status}</span>
        </div>
        <div className="flex items-center justify-between gap-1.5">
          {/* Tracking toggle — available once the job is accepted/active. */}
          {(job.status === 'ACCEPTED' || job.status === 'COMPLETED') ? (
            <button onClick={() => setOpenTrack(o => ({ ...o, [job.id]: !o[job.id] }))}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 text-seafoam rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700">
              <MapPin size={11} /> {openTrack[job.id] ? 'Hide' : 'Track'}{job.movementStage ? ` · ${job.movementStage.replace('_', ' ').toLowerCase()}` : ''}
            </button>
          ) : <span />}
          <div className="flex items-center gap-1.5">
            {mode === 'incoming' && job.status === 'REQUESTED' && (
              <>
                <button onClick={() => act(job, 'DECLINED', 'Job declined')} disabled={b} className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700 hover:text-rose-500 transition-all disabled:opacity-50">Decline</button>
                <button onClick={() => act(job, 'ACCEPTED', 'Job accepted')} disabled={b} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow disabled:opacity-50">Accept</button>
              </>
            )}
            {mode === 'incoming' && job.status === 'ACCEPTED' && (
              <button onClick={() => act(job, 'COMPLETED', 'Job completed')} disabled={b} className="flex items-center gap-1 px-3 py-1.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-[9px] font-black uppercase tracking-widest disabled:opacity-50">{b ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Mark complete</button>
            )}
            {mode === 'outgoing' && (job.status === 'REQUESTED' || job.status === 'ACCEPTED') && (
              <button onClick={() => act(job, 'CANCELLED', 'Job cancelled')} disabled={b} className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700 hover:text-rose-500 transition-all disabled:opacity-50">{b ? <Loader2 size={11} className="animate-spin" /> : 'Cancel'}</button>
            )}
          </div>
        </div>
        {openTrack[job.id] && (
          <VisitJobTracker jobId={job.id} role={mode === 'incoming' ? 'provider' : 'requester'} stage={job.movementStage} onChanged={load} />
        )}
      </div>
    );
  };

  const Section: React.FC<{ title: string; icon: React.ReactNode; jobs: VisitJob[]; mode: 'incoming' | 'outgoing' }> = ({ title, icon, jobs, mode }) => (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 flex items-center gap-2">{icon} {title} <span className="text-slate-300">· {jobs.length}</span></p>
      {jobs.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-3 px-1">No {mode} jobs.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{jobs.map(j => <Card key={j.id} job={j} mode={mode} />)}</div>
      )}
    </div>
  );

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-seafoam" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Services other clinics asked you to do, and services you sent out for completion.</p>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-seafoam text-[10px] font-black uppercase tracking-widest hover:border-seafoam/40 transition-all"><RefreshCw size={12} /> Refresh</button>
      </div>
      <Section title="Incoming — for you to complete" icon={<ArrowDownLeft size={12} className="text-seafoam" />} jobs={incoming} mode="incoming" />
      <Section title="Sent out" icon={<Send size={12} className="text-indigo-500" />} jobs={outgoing} mode="outgoing" />
    </div>
  );
};

export default VisitJobsInbox;
