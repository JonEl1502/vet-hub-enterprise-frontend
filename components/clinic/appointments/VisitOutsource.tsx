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

/**
 * Provider-side partner bill for a CLINICAL_TRANSFER visit (user, 2026-08-01):
 * an invoice-style document where the CLIENT is the REQUESTING CLINIC — billed
 * for their patient / their client's work at the agreed job price. The receipt
 * is the escrow payout transaction; nothing here charges the pet owner.
 */
export const TransferBillPanel: React.FC<{
  visitId: string | number;
  providerName: string;
  currency?: string;
  petName?: string | null;
  ownerName?: string | null;
}> = ({ visitId, providerName, currency = 'KES', petName, ownerName }) => {
  const [jobs, setJobs] = useState<VisitJob[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    visitJobsAPI.listForVisit(visitId)
      .then(r => { if (alive && r.success && r.data?.jobs) setJobs(r.data.jobs.filter(j => String(j.providerVisitId ?? '') === String(visitId))); })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [visitId]);

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-seafoam" /></div>;
  if (jobs.length === 0) return <p className="text-[11px] text-slate-400 text-center py-8">No partner jobs on this visit.</p>;

  const requester = jobs[0].requesterClinic;
  const total = jobs.reduce((n, j) => n + Number(j.agreedPrice), 0);
  const allPaid = jobs.every(j => j.paidOut);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden max-w-2xl">
      <div className="px-5 py-4 bg-gradient-to-br from-pine to-seafoam text-white flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/60">Partner invoice</p>
          <h3 className="text-lg font-black tracking-tight uppercase">{providerName}</h3>
          <p className="text-[10px] text-white/80 font-medium">Inter-clinic service — escrow settled</p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${allPaid ? 'bg-emerald-400/20 text-emerald-100' : 'bg-amber-400/20 text-amber-100'}`}>
          {allPaid ? 'Paid' : 'Awaiting settlement'}
        </span>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Bill to — client</p>
            <p className="text-sm font-black text-pine dark:text-zinc-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md overflow-hidden inline-flex items-center justify-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700"><ClinicLogo logo={requester?.logo} fallback="🏥" /></span>
              {requester?.name || 'Requesting clinic'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">The requesting clinic is the client on this bill — not the pet owner.</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">For — their patient</p>
            <p className="text-sm font-black text-pine dark:text-zinc-100">🐾 {petName || jobs[0].patientName || 'Patient'}</p>
            {ownerName && <p className="text-[10px] text-slate-400 mt-0.5">Owner (their client): {ownerName}</p>}
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-zinc-800 border-y border-slate-100 dark:border-zinc-800">
          {jobs.map(j => (
            <div key={j.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{j.serviceName || j.category}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{j.category} · {j.status}{j.paidOut && j.payoutTransactionId ? ` · receipt TX-${j.payoutTransactionId}` : ''}</p>
              </div>
              <span className="text-sm font-black font-mono text-pine dark:text-zinc-100 shrink-0">{j.currency} {j.agreedPrice.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total</span>
          <span className={`text-xl font-black font-mono ${allPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-pine dark:text-zinc-100'}`}>{currency} {total.toLocaleString()}</span>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-zinc-500">
          {allPaid
            ? `Settled — ${requester?.name || 'the requesting clinic'} paid via the escrow payout (references above). This is your receipt.`
            : `Payment arrives automatically when ${requester?.name || 'the requesting clinic'} settles their client's bill (or in the partnership's bundled sweep). The pet owner is never billed here.`}
        </p>
      </div>
    </div>
  );
};

/**
 * Chip + dialog for a request ALREADY sent to a partner (user, 2026-08-01).
 * The chip shows who it went to and where it stands; the dialog carries the
 * whole cross-clinic story: negotiation (accept/counter while REQUESTED), the
 * escrow-style movement timeline (received patient/sample → in progress →
 * result sent → returned) and the payout state.
 */
export const OutsourcedJobChip: React.FC<{ job: VisitJob; onChanged: () => void }> = ({ job, onChanged }) => {
  const [open, setOpen] = useState(false);
  const partner = job.providerClinic;
  const proposedByMe = job.priceProposedBy != null ? job.priceProposedBy === job.requesterClinicId : true;
  const stageLabel = job.movementStage ? job.movementStage.replace(/_/g, ' ').toLowerCase() : null;
  const chipLabel = job.status === 'REQUESTED' ? 'negotiating'
    : job.status === 'ACCEPTED' ? (stageLabel || 'accepted')
    : job.status.toLowerCase();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        title={`Sent to ${partner?.name || 'partner clinic'} — open for progress & tracking`}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${STATUS_TONE[job.status] || 'bg-slate-100 text-slate-500'} border-transparent hover:brightness-95`}>
        <Send size={10} /> {partner?.name || 'Partner'} · {chipLabel}
      </button>
      {open && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-5 bg-gradient-to-br from-pine to-seafoam text-white">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center overflow-hidden text-xl shrink-0"><ClinicLogo logo={partner?.logo} fallback="🏥" /></span>
                <div className="min-w-0">
                  <h3 className="text-base font-black tracking-tight uppercase truncate">Sent to {partner?.name || 'partner clinic'}</h3>
                  <p className="text-[11px] text-white/80 font-medium truncate">{job.serviceName || job.category} · {job.currency} {job.agreedPrice.toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${STATUS_TONE[job.status] || ''}`}>
                  {job.status === 'COMPLETED' ? <CheckCircle2 size={11} /> : job.status === 'DECLINED' || job.status === 'CANCELLED' ? <XCircle size={11} /> : <Clock size={11} />} {job.status}
                </span>
                {job.movementStage && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-[9px] font-black uppercase tracking-widest"><MapPin size={11} /> {job.movementStage.replace(/_/g, ' ')}</span>
                )}
                {job.paidOut && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest">Partner paid</span>
                )}
              </div>
              {job.status === 'REQUESTED' && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Price negotiation</p>
                  <JobNegotiationRow job={job} proposedByMe={proposedByMe} onChanged={() => { onChanged(); setOpen(false); }} />
                </div>
              )}
              {(job.status === 'ACCEPTED' || job.status === 'COMPLETED') && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Movement tracking — patient / sample / results</p>
                  <VisitJobTracker jobId={job.id} role="requester" stage={job.movementStage} onChanged={onChanged} />
                </div>
              )}
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                {job.paidOut
                  ? 'Settled — the partner was credited the agreed amount when this visit\'s bill was paid.'
                  : 'Escrow: the partner is credited the agreed amount automatically when this visit\'s bill is settled (or in the partnership\'s bundled sweep).'}
              </p>
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
