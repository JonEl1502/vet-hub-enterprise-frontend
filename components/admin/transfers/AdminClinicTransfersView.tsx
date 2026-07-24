import React, { useEffect, useState, useCallback } from 'react';
import { ArrowRightLeft, FileText, CheckCircle2, XCircle, Loader2, Clock, Building2 } from 'lucide-react';
import { clinicTransfersAPI, ClinicTransfer, toast } from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

const STATUS_TABS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const;

const badge = (s: string) => {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
  };
  return map[s] || map.CANCELLED;
};

const AdminClinicTransfersView: React.FC = () => {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>('PENDING');
  const [rows, setRows] = useState<ClinicTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    clinicTransfersAPI.adminList(tab === 'ALL' ? undefined : tab, { showError: false })
      .then((r) => setRows(r.data?.transfers ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const approve = async (t: ClinicTransfer) => {
    if (!window.confirm(`Approve transfer of ${t.clinicName || 'this clinic'} to ${t.newOwnerEmail}? This changes ownership immediately.`)) return;
    setBusyId(t.id);
    try {
      const res = await clinicTransfersAPI.adminApprove(t.id);
      if (res.data?.transfer) { toast.success('Transfer approved — ownership updated'); load(); }
    } finally { setBusyId(null); }
  };
  const reject = async (t: ClinicTransfer) => {
    const reason = window.prompt('Reason for rejecting this transfer?') || undefined;
    setBusyId(t.id);
    try {
      const res = await clinicTransfersAPI.adminReject(t.id, reason);
      if (res.data?.transfer) { toast.success('Transfer rejected'); load(); }
    } finally { setBusyId(null); }
  };

  return (
    <div className="px-4 sm:px-6 py-5 max-w-5xl mx-auto space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center"><ArrowRightLeft size={20} className="text-rose-500" /></div>
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Clinic Transfers</h1>
          <p className="text-seafoam text-[10px] font-black uppercase tracking-widest">Review signed transfers + affidavits and approve ownership changes</p>
        </div>
      </header>

      <div className="flex gap-1.5">
        {STATUS_TABS.map((s) => (
          <button key={s} onClick={() => setTab(s)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tab === s ? 'bg-pine text-white' : 'bg-white dark:bg-zinc-900 text-slate-400 border border-slate-200 dark:border-zinc-800 hover:text-pine'}`}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div className="py-16"><LoadingSpinner message="Loading transfers…" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
          <Clock size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-black text-pine dark:text-zinc-100">No {tab.toLowerCase()} transfers</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <div key={t.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-seafoam shrink-0" />
                    <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{t.clinicName || `Clinic #${t.clinicId}`}</p>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${badge(t.status)}`}>{t.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Transfer to <span className="font-bold text-pine dark:text-zinc-100">{t.newOwnerEmail}</span></p>
                  {t.reason && <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic mt-1">"{t.reason}"</p>}
                  <div className="flex flex-wrap gap-3 mt-2">
                    {t.signedTransferUrl && <a href={t.signedTransferUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-seafoam hover:underline"><FileText size={12} /> Signed transfer</a>}
                    {t.affidavitUrl && <a href={t.affidavitUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-seafoam hover:underline"><FileText size={12} /> Affidavit</a>}
                    <span className="text-[10px] text-slate-400">Requested {new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                  {t.reviewNotes && <p className="text-[10px] text-slate-400 mt-1">Review note: "{t.reviewNotes}"</p>}
                </div>
                {t.status === 'PENDING' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => approve(t)} disabled={busyId === t.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                      {busyId === t.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Approve
                    </button>
                    <button onClick={() => reject(t)} disabled={busyId === t.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-900/40 text-rose-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 disabled:opacity-50">
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminClinicTransfersView;
