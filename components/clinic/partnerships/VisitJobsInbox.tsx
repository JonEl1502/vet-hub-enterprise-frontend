import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, CheckCircle2, Clock, XCircle, Send, RefreshCw } from 'lucide-react';
// Import straight from the modules (not the services barrel — it's reshuffled by
// other work streams and a transient state can drop the re-export).
import { visitJobsAPI } from '../../../services/modules/visitJobs.api';
import type { VisitJob, VisitJobStatus } from '../../../services/modules/visitJobs.api';
import { toast } from '../../../services/utils/toast';
import ClinicLogo from '../clinic-mgmt/ClinicLogo';
import VisitJobTracker from './VisitJobTracker';
import { MapPin, ExternalLink } from 'lucide-react';
import { resolveCategoryMenuId } from '../../../services/modules/staffScope.api';

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
 *
 * GROUPED BY SOURCE VISIT (user, 2026-08-02: "this is from one visit, I don't
 * know why it's treated as separate") — one card per requester visit, its
 * services as rows inside, one Start/Continue-visit action for the shared
 * transfer visit.
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

  // Per-request negotiation (169): counter the price on an open request.
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterAmt, setCounterAmt] = useState('');
  const sendCounter = async (job: VisitJob) => {
    const amount = Number(counterAmt);
    if (!(amount >= 0) || counterAmt === '') { toast.error('Enter an amount'); return; }
    setBusyId(job.id);
    try {
      const res = await visitJobsAPI.counterPrice(job.id, amount);
      if (res.success) { toast.success(`Countered · ${job.currency} ${amount.toLocaleString()}`); setCounterFor(null); setCounterAmt(''); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusyId(null); }
  };

  /** One SERVICE row inside a visit group. */
  const JobRow: React.FC<{ job: VisitJob; mode: 'incoming' | 'outgoing' }> = ({ job, mode }) => {
    const partner = mode === 'incoming' ? job.requesterClinic : job.providerClinic;
    const b = busyId === job.id;
    const myId = mode === 'incoming' ? job.providerClinicId : job.requesterClinicId;
    const proposedByMe = job.priceProposedBy != null ? job.priceProposedBy === myId : mode === 'outgoing';
    const negotiating = job.status === 'REQUESTED';
    return (
      <div className="rounded-lg border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/40 px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="text-xs font-black text-pine dark:text-zinc-100 truncate flex-1">{job.serviceName || job.category}
            <span className="text-slate-400 font-bold"> · {job.currency} {job.agreedPrice.toLocaleString()}</span>
          </p>
          {job.paidOut && <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{mode === 'incoming' ? 'Paid' : 'Paid B'}</span>}
          <span className={`flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${TONE[job.status] || ''}`}><StatusIcon s={job.status} size={10} /> {job.status}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          {/* No per-service Track. One patient making one trip had a Track
              button per service, each with its own stage — two answers to
              "where is this animal?". The group carries one, below. */}
          <span />
          <div className="flex flex-wrap items-center gap-1.5">
            {negotiating && !proposedByMe && (
              <button onClick={() => act(job, 'ACCEPTED', `Accepted · ${job.currency} ${job.agreedPrice.toLocaleString()}`)} disabled={b} className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow disabled:opacity-50">Accept {job.currency} {job.agreedPrice.toLocaleString()}</button>
            )}
            {negotiating && (
              <button onClick={() => { setCounterFor(counterFor === job.id ? null : job.id); setCounterAmt(String(job.agreedPrice)); }} disabled={b}
                className="px-3 py-1 bg-white dark:bg-zinc-900 text-violet-600 dark:text-violet-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700 hover:border-violet-400 transition-all disabled:opacity-50">Counter</button>
            )}
            {mode === 'incoming' && negotiating && (
              <button onClick={() => act(job, 'DECLINED', 'Job declined')} disabled={b} className="px-3 py-1 bg-white dark:bg-zinc-900 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700 hover:text-rose-500 transition-all disabled:opacity-50">Decline</button>
            )}
            {/* Module-page shortcut only once the visit has actually STARTED —
                a SCHEDULED provider visit still says "Start visit" (user, 2026-08-02). */}
            {mode === 'incoming' && (job.status === 'ACCEPTED' || job.status === 'COMPLETED') && job.providerVisitId
              && (job.status === 'COMPLETED' || (job.providerVisitStatus && job.providerVisitStatus !== 'SCHEDULED')) && (() => {
              const menuId = resolveCategoryMenuId(job.category);
              if (!menuId) return null;
              return (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('vethub:navigate', { detail: { view: menuId, params: { openForAppointmentId: String(job.providerVisitId) } } }))}
                  className="flex items-center gap-1 px-3 py-1 bg-violet-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all">
                  <ExternalLink size={11} /> {job.category} page
                </button>
              );
            })()}
            {mode === 'incoming' && job.status === 'ACCEPTED' && (
              <button onClick={() => act(job, 'COMPLETED', 'Job completed')} disabled={b} className="flex items-center gap-1 px-3 py-1 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-[9px] font-black uppercase tracking-widest disabled:opacity-50">{b ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Complete</button>
            )}
            {mode === 'outgoing' && (job.status === 'REQUESTED' || job.status === 'ACCEPTED') && (
              <button onClick={() => act(job, 'CANCELLED', 'Job cancelled')} disabled={b} className="px-3 py-1 bg-white dark:bg-zinc-900 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700 hover:text-rose-500 transition-all disabled:opacity-50">{b ? <Loader2 size={11} className="animate-spin" /> : 'Cancel'}</button>
            )}
          </div>
        </div>
        {negotiating && proposedByMe && (
          <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400">Your proposal of {job.currency} {job.agreedPrice.toLocaleString()} is with {partner?.name || 'the partner'} — they accept or counter.</p>
        )}
        {counterFor === job.id && negotiating && (
          <div className="flex items-center gap-1.5">
            <input type="number" min={0} value={counterAmt} onChange={e => setCounterAmt(e.target.value)} autoFocus
              className="w-28 px-2 py-1.5 rounded-lg border border-violet-300 dark:border-violet-800 bg-white dark:bg-zinc-950 text-sm font-bold text-pine dark:text-zinc-100 text-right" />
            <button onClick={() => sendCounter(job)} disabled={b}
              className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest disabled:opacity-50">{b ? <Loader2 size={11} className="animate-spin" /> : 'Send counter'}</button>
            <button onClick={() => setCounterFor(null)} className="px-2 py-1.5 text-slate-400 text-[9px] font-black uppercase tracking-widest">Cancel</button>
          </div>
        )}

      </div>
    );
  };

  /** One card per SOURCE VISIT — its outsourced services as rows. */
  const GroupCard: React.FC<{ jobs: VisitJob[]; mode: 'incoming' | 'outgoing' }> = ({ jobs, mode }) => {
    const first = jobs[0];
    const partner = mode === 'incoming' ? first.requesterClinic : first.providerClinic;
    const total = jobs.reduce((n, j) => n + Number(j.agreedPrice), 0);
    // The shared transfer visit for this group (post-shared-visit accepts all
    // point at one; legacy pairs may differ — take the first available).
    const withVisit = jobs.find(j => j.providerVisitId);
    const anyAccepted = jobs.find(j => j.status === 'ACCEPTED' || j.status === 'COMPLETED');
    const ongoing = !!withVisit && (withVisit.providerVisitStatus !== 'SCHEDULED' || jobs.filter(j => j.providerVisitId).length > 1);
    const busy = jobs.some(j => busyId === j.id);
    // The trip is one thing: track off the first accepted/completed job, and
    // key the open state by the VISIT so both services share one panel.
    const trackJob = jobs.find(j => j.status === 'ACCEPTED' || j.status === 'COMPLETED') || null;
    const trackKey = `visit-${first.visitId ?? jobs[0].id}`;
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-2.5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center overflow-hidden text-lg shrink-0"><ClinicLogo logo={partner?.logo} fallback="🏥" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-pine dark:text-zinc-100 truncate flex items-center gap-1.5">
              {mode === 'incoming' ? <ArrowDownLeft size={12} className="text-seafoam shrink-0" /> : <ArrowUpRight size={12} className="text-indigo-500 shrink-0" />}
              {partner?.name || 'clinic'}
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {jobs.length} service{jobs.length === 1 ? '' : 's'} · one visit · {first.currency} {total.toLocaleString()}
            </p>
            {first.patientName && (
              <p className="text-[9px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mt-0.5">
                🐾 {first.patientName}{first.patientSpecies ? ` · ${first.patientSpecies}` : ''}{mode === 'incoming' ? ' · shared' : ''}
              </p>
            )}
          </div>
          {/* One visit action for the whole group. */}
          {mode === 'incoming' && anyAccepted && (
            <button
              disabled={busy}
              onClick={async () => {
                let visitId = withVisit?.providerVisitId ?? null;
                if (!visitId && anyAccepted) {
                  setBusyId(anyAccepted.id);
                  try {
                    const res = await visitJobsAPI.ensureProviderVisit(anyAccepted.id);
                    visitId = res.data?.job?.providerVisitId ?? null;
                    if (visitId) await load();
                  } catch (e: any) { toast.error(e?.message || 'Failed to create the visit'); }
                  finally { setBusyId(null); }
                }
                if (visitId) window.dispatchEvent(new CustomEvent('vethub:navigate', { detail: { view: 'appointment-detail', params: { appointmentId: Number(visitId) } } }));
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-seafoam text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-pine transition-all disabled:opacity-50 shrink-0">
              {busy ? <Loader2 size={11} className="animate-spin" /> : <ArrowUpRight size={11} />} {ongoing ? 'Continue visit' : 'Start visit'}
            </button>
          )}
        </div>
        {/* ONE track for the visit. The animal travels once, so its movement
            stage belongs to the group, not to each service. Driven by the
            first accepted job — the stage is a property of the trip. */}
        {trackJob && (
          <div className="space-y-1.5">
            <button onClick={() => setOpenTrack(o => ({ ...o, [trackKey]: !o[trackKey] }))}
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-zinc-900 text-seafoam rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-zinc-700">
              <MapPin size={11} /> {openTrack[trackKey] ? 'Hide tracking' : 'Track'}
              {trackJob.movementStage ? ` · ${trackJob.movementStage.replace('_', ' ').toLowerCase()}` : ''}
            </button>
            {openTrack[trackKey] && (
              <VisitJobTracker jobId={trackJob.id} role={mode === 'incoming' ? 'provider' : 'requester'} stage={trackJob.movementStage} onChanged={load} />
            )}
          </div>
        )}
        <div className="space-y-1.5">
          {jobs.map(j => <JobRow key={j.id} job={j} mode={mode} />)}
        </div>
      </div>
    );
  };

  const Section: React.FC<{ title: string; icon: React.ReactNode; jobs: VisitJob[]; mode: 'incoming' | 'outgoing' }> = ({ title, icon, jobs, mode }) => {
    // Group by source visit + partner — services requested together stay together.
    const groups = useMemo(() => {
      const map = new Map<string, VisitJob[]>();
      for (const j of jobs) {
        const partnerId = mode === 'incoming' ? j.requesterClinicId : j.providerClinicId;
        const k = `${j.visitId}|${partnerId}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(j);
      }
      return Array.from(map.values());
    }, [jobs, mode]);
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 flex items-center gap-2">{icon} {title} <span className="text-slate-300">· {jobs.length}</span></p>
        {jobs.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-3 px-1">No {mode} jobs.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{groups.map((g, i) => <GroupCard key={`${g[0].visitId}-${i}`} jobs={g} mode={mode} />)}</div>
        )}
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-seafoam" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Services other clinics asked you to do, and services you sent out for completion — grouped by the visit they came from.</p>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-seafoam text-[10px] font-black uppercase tracking-widest hover:border-seafoam/40 transition-all"><RefreshCw size={12} /> Refresh</button>
      </div>
      <Section title="Incoming — for you to complete" icon={<ArrowDownLeft size={12} className="text-seafoam" />} jobs={incoming} mode="incoming" />
      <Section title="Sent out" icon={<Send size={12} className="text-indigo-500" />} jobs={outgoing} mode="outgoing" />
    </div>
  );
};

export default VisitJobsInbox;
