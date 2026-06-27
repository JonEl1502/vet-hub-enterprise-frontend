import React, { useState, useEffect } from 'react';
import { Send, X, Loader2, Building2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { visitJobsAPI, toast } from '../../../services';
import type { VisitJob, EligiblePartner } from '../../../services';
import ClinicLogo from '../clinic-mgmt/ClinicLogo';

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
}> = ({ visitId, taskId, category, serviceName, currency = 'KES', onCreated }) => {
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

  const send = async (p: EligiblePartner) => {
    setBusy(p.clinicId);
    try {
      const res = await visitJobsAPI.create({ visitId, providerClinicId: p.clinicId, category, taskId, serviceName });
      if (res.success && res.data?.job) {
        toast.success(`Sent "${serviceName}" to ${p.name} · ${p.currency} ${p.price.toLocaleString()}`);
        onCreated?.(res.data.job);
        setOpen(false);
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to outsource'); } finally { setBusy(null); }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Outsource to partner clinic"
        className="p-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-seafoam rounded-lg transition-all"><Send size={12} /></button>
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
                  <p className="text-sm font-bold text-pine dark:text-zinc-100">No partner with an agreed price for {category}.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Open the partnership → Services → Negotiated pricing and agree a {category} price first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Send to a partner clinic</p>
                  {partners.map(p => (
                    <button key={p.clinicId} onClick={() => send(p)} disabled={!!busy}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700 hover:border-seafoam transition-all disabled:opacity-50">
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden text-lg shrink-0"><ClinicLogo logo={p.logo} fallback="🏥" /></span>
                        <span className="min-w-0 text-left">
                          <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{p.name}</span>
                          <span className="block text-[10px] font-bold text-seafoam uppercase tracking-widest">{p.currency} {p.price.toLocaleString()}</span>
                        </span>
                      </span>
                      {busy === p.clinicId ? <Loader2 size={14} className="animate-spin text-seafoam shrink-0" /> : <Send size={14} className="text-slate-400 shrink-0" />}
                    </button>
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

/** Compact list of outsourced services on a visit (status + partner + price). */
export const VisitJobsPanel: React.FC<{ visitId: string | number; refreshKey?: number }> = ({ visitId, refreshKey }) => {
  const [jobs, setJobs] = useState<VisitJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    visitJobsAPI.listForVisit(visitId)
      .then(r => { if (alive && r.success && r.data?.jobs) setJobs(r.data.jobs); })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [visitId, refreshKey]);

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
        return (
          <div key={j.id} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 dark:bg-zinc-950/40 rounded-lg">
            <span className="w-7 h-7 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden text-sm shrink-0"><ClinicLogo logo={j.providerClinic?.logo} fallback="🏥" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{j.serviceName || j.category} <span className="text-slate-400 font-medium">→ {j.providerClinic?.name || 'partner'}</span></span>
              <span className="block text-[9px] text-slate-400">{j.currency} {j.agreedPrice.toLocaleString()}</span>
            </span>
            <span className={`flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${STATUS_TONE[j.status] || ''}`}><Icon size={10} /> {j.status}</span>
          </div>
        );
      })}
    </div>
  );
};
