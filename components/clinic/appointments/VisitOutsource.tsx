import React, { useState, useEffect } from 'react';
import { Send, X, Loader2, Building2, CheckCircle2, Clock, XCircle, MapPin } from 'lucide-react';
// Import directly from the modules (not the shared services barrel, which is
// edited by other work streams) so this never breaks on a barrel reshuffle.
import { visitJobsAPI } from '../../../services/modules/visitJobs.api';
import type { VisitJob, EligiblePartner } from '../../../services/modules/visitJobs.api';
import { toast } from '../../../services/utils/toast';
import ClinicLogo from '../clinic-mgmt/ClinicLogo';
import VisitJobTracker from '../partnerships/VisitJobTracker';

const STATUS_TONE: Record<string, string> = {
  REQUESTED: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  ACCEPTED: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  DECLINED: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  CANCELLED: 'bg-slate-100 dark:bg-zinc-800 text-slate-500',
};

/**
 * Per-service button: outsource this visit service to a partner clinic that has
 * an agreed price for the service's category. Snapshots the agreed A↔B price.
 */
export const OutsourceServiceButton: React.FC<{
  visitId: string | number;
  taskId: string | number;
  category: string;
  serviceName: string;
  currency?: string;
  onCreated?: (job: VisitJob) => void;
  // 'menu' renders a labeled full-width row for use inside a dropdown menu.
  variant?: 'icon' | 'menu' | 'chip';
}> = ({ visitId, taskId, category, serviceName, currency = 'KES', onCreated, variant = 'icon' }) => {
  const [open, setOpen] = useState(false);
  const [partners, setPartners] = useState<EligiblePartner[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    visitJobsAPI.eligiblePartners(category)
      .then(r => { if (r.success && r.data?.partners) setPartners(r.data.partners); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, category]);

  // Per-request negotiation (169): each partner row carries an editable price
  // proposal, prefilled with the pre-agreed category rate when one exists.
  const [proposal, setProposal] = useState<Record<string, string>>({});
  const proposalFor = (p: EligiblePartner): string =>
    proposal[p.clinicId] ?? (p.price != null ? String(p.price) : '');

  const send = async (p: EligiblePartner) => {
    const amount = Number(proposalFor(p));
    if (!(amount >= 0) || proposalFor(p) === '') { toast.error('Enter a price to propose for this request'); return; }
    setBusy(p.clinicId);
    try {
      const res = await visitJobsAPI.create({ visitId, providerClinicId: p.clinicId, category, taskId, serviceName, price: amount });
      if (res.success && res.data?.job) {
        toast.success(`Sent "${serviceName}" to ${p.name} · proposed ${p.currency} ${amount.toLocaleString()}`);
        onCreated?.(res.data.job);
        setOpen(false);
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to outsource'); } finally { setBusy(null); }
  };

  return (
    <>
      {variant === 'menu' ? (
        <button type="button" onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
          <Send size={12} className="text-seafoam" /> Share to partner
        </button>
      ) : variant === 'chip' ? (
        // Labeled chip matching the visit row buttons (View result / Full page).
        <button type="button" onClick={() => setOpen(true)}
          title="Ask a partner clinic to handle this service — they see it as a clinical-transfer visit"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-violet-300 dark:border-violet-800 text-violet-600 dark:text-violet-400 text-[9px] font-black uppercase tracking-widest hover:bg-violet-600 hover:text-white transition-all">
          <Send size={10} /> To partner
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} title="Outsource to partner clinic"
          className="p-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-seafoam rounded-lg transition-all"><Send size={12} /></button>
      )}
      {open && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-5 bg-gradient-to-br from-pine to-seafoam text-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><Send size={18} /></div>
                <div className="min-w-0">
                  <h3 className="text-base font-black tracking-tight uppercase truncate">Outsource service</h3>
                  <p className="text-[11px] text-white/80 font-medium truncate">{serviceName} · {category}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} disabled={!!busy} className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50"><X size={18} /></button>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-seafoam" /></div>
              ) : partners.length === 0 ? (
                <div className="text-center py-6">
                  <Building2 size={28} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-bold text-pine dark:text-zinc-100">No partner clinic shares {category}.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Add a partnership (Partners page) that includes {category} in its shared services — the price is proposed per request.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Send to a partner clinic</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 -mt-1 mb-2">Propose a price for this request — the partner accepts it or counters. Pre-agreed rates prefill.</p>
                  {partners.map(p => (
                    <div key={p.clinicId}
                      className="w-full flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700">
                      <span className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden text-lg shrink-0"><ClinicLogo logo={p.logo} fallback="🏥" /></span>
                        <span className="min-w-0 text-left">
                          <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{p.name}</span>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {p.price != null ? `Agreed rate · ${p.currency} ${p.price.toLocaleString()}` : 'No pre-agreed rate — propose one'}
                          </span>
                        </span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input type="number" min={0} value={proposalFor(p)}
                          onChange={e => setProposal(prev => ({ ...prev, [p.clinicId]: e.target.value }))}
                          placeholder="Price"
                          className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-bold text-pine dark:text-zinc-100 text-right" />
                        <button onClick={() => send(p)} disabled={!!busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-seafoam text-white text-[10px] font-black uppercase tracking-widest hover:bg-pine transition-all disabled:opacity-50">
                          {busy === p.clinicId ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/** Accept / counter controls for an open request (169) — shared by both sides. */
const JobNegotiationRow: React.FC<{ job: VisitJob; proposedByMe: boolean; onChanged: () => void }> = ({ job, proposedByMe, onChanged }) => {
  const [countering, setCountering] = useState(false);
  const [amount, setAmount] = useState(String(job.agreedPrice));
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      const res = await visitJobsAPI.updateStatus(job.id, 'ACCEPTED');
      if (res.success) { toast.success(`Accepted · ${job.currency} ${job.agreedPrice.toLocaleString()}`); onChanged(); }
    } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusy(false); }
  };
  const counter = async () => {
    const n = Number(amount);
    if (!(n >= 0) || amount === '') { toast.error('Enter an amount'); return; }
    setBusy(true);
    try {
      const res = await visitJobsAPI.counterPrice(job.id, n);
      if (res.success) { toast.success(`Countered · ${job.currency} ${n.toLocaleString()}`); setCountering(false); onChanged(); }
    } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {!proposedByMe && (
        <button onClick={accept} disabled={busy}
          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-50">
          Accept {job.currency} {job.agreedPrice.toLocaleString()}
        </button>
      )}
      {!countering ? (
        <button onClick={() => setCountering(true)} disabled={busy}
          className="px-2.5 py-1 rounded-lg border border-violet-300 dark:border-violet-800 text-violet-600 dark:text-violet-400 text-[9px] font-black uppercase tracking-widest hover:bg-violet-600 hover:text-white transition-all disabled:opacity-50">
          Counter
        </button>
      ) : (
        <>
          <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} autoFocus
            className="w-24 px-2 py-1 rounded-lg border border-violet-300 dark:border-violet-800 bg-white dark:bg-zinc-900 text-xs font-bold text-pine dark:text-zinc-100 text-right" />
          <button onClick={counter} disabled={busy} className="px-2.5 py-1 rounded-lg bg-violet-600 text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-50">
            {busy ? <Loader2 size={10} className="animate-spin" /> : 'Send'}
          </button>
          <button onClick={() => setCountering(false)} className="px-1.5 py-1 text-slate-400 text-[9px] font-black uppercase tracking-widest">✕</button>
        </>
      )}
      {proposedByMe && <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">Awaiting the partner's reply</span>}
    </div>
  );
};

/** Compact list of outsourced services on a visit (status + partner + price). */
export const VisitJobsPanel: React.FC<{ visitId: string | number; refreshKey?: number }> = ({ visitId, refreshKey }) => {
  const [jobs, setJobs] = useState<VisitJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTrack, setOpenTrack] = useState<Record<string, boolean>>({});
  const [bump, setBump] = useState(0);
  const reload = () => setBump(b => b + 1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    visitJobsAPI.listForVisit(visitId)
      .then(r => { if (alive && r.success && r.data?.jobs) setJobs(r.data.jobs); })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [visitId, refreshKey, bump]);

  if (loading) return null;
  if (jobs.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Send size={14} className="text-seafoam" />
        <span className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-200">Outsourced services</span>
      </div>
      {jobs.map(j => {
        const Icon = j.status === 'COMPLETED' ? CheckCircle2 : j.status === 'DECLINED' || j.status === 'CANCELLED' ? XCircle : Clock;
        const canTrack = j.status === 'ACCEPTED' || j.status === 'COMPLETED';
        // Which side of the job is THIS visit? A's original visit → requester;
        // B's auto-created transfer visit → provider. Drives the negotiation
        // controls (169) with no extra context.
        const viewingAsProvider = String(j.providerVisitId ?? '') === String(visitId);
        const myId = viewingAsProvider ? j.providerClinicId : j.requesterClinicId;
        const partnerName = viewingAsProvider ? (j.requesterClinic?.name || 'partner') : (j.providerClinic?.name || 'partner');
        const proposedByMe = j.priceProposedBy != null ? j.priceProposedBy === myId : !viewingAsProvider;
        const negotiating = j.status === 'REQUESTED';
        return (
          <div key={j.id} className="bg-slate-50 dark:bg-zinc-950/40 rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden text-sm shrink-0"><ClinicLogo logo={j.providerClinic?.logo} fallback="🏥" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{j.serviceName || j.category} <span className="text-slate-400 font-medium">{viewingAsProvider ? `← ${j.requesterClinic?.name || 'partner'}` : `→ ${j.providerClinic?.name || 'partner'}`}</span></span>
                <span className="block text-[9px] text-slate-400">{j.currency} {j.agreedPrice.toLocaleString()}{negotiating ? (proposedByMe ? ' · your proposal' : ` · proposed by ${partnerName}`) : ''}{j.movementStage ? ` · ${j.movementStage.replace('_', ' ').toLowerCase()}` : ''}</span>
              </span>
              {canTrack && (
                <button onClick={() => setOpenTrack(o => ({ ...o, [j.id]: !o[j.id] }))} title="Track movement" className="p-1 text-seafoam hover:text-pine shrink-0"><MapPin size={13} /></button>
              )}
              {j.paidOut && <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">Paid B</span>}
              <span className={`flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${STATUS_TONE[j.status] || ''}`}><Icon size={10} /> {j.status}</span>
            </div>
            {negotiating && <JobNegotiationRow job={j} proposedByMe={proposedByMe} onChanged={reload} />}
            {openTrack[j.id] && canTrack && (
              <VisitJobTracker jobId={j.id} role={viewingAsProvider ? 'provider' : 'requester'} stage={j.movementStage} onChanged={reload} />
            )}
          </div>
        );
      })}
    </div>
  );
};
