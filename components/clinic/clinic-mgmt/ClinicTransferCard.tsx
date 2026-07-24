import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, Upload, Loader2, X, FileText, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { clinicTransfersAPI, ClinicTransfer, uploadsAPI, toast } from '../../../services';

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING: { label: 'Pending admin review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock size={12} /> },
  APPROVED: { label: 'Approved — ownership transferred', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <CheckCircle2 size={12} /> },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: <XCircle size={12} /> },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400', icon: <X size={12} /> },
};

const ClinicTransferCard: React.FC = () => {
  const [transfers, setTransfers] = useState<ClinicTransfer[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    clinicTransfersAPI.mine({ showError: false })
      .then((r) => setTransfers(r.data?.transfers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const pending = transfers.find((t) => t.status === 'PENDING');
  const latest = transfers[0];

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this transfer request?')) return;
    const res = await clinicTransfersAPI.cancel(id);
    if (res.success) { toast.success('Transfer request cancelled'); load(); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg"><ArrowRightLeft size={16} /></div>
        <div>
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Ownership transfer</h3>
          <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase mt-0.5 tracking-widest">Admin-reviewed · requires signed transfer + advocate affidavit</p>
        </div>
      </div>

      {loading ? (
        <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-seafoam" /></div>
      ) : pending ? (
        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${STATUS_META.PENDING.cls}`}>{STATUS_META.PENDING.icon} {STATUS_META.PENDING.label}</span>
              <button onClick={() => cancel(pending.id)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500">Cancel</button>
            </div>
            <p className="text-xs font-bold text-pine dark:text-zinc-100 mt-2">Transfer to: {pending.newOwnerEmail}</p>
            {pending.reason && <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic mt-1">"{pending.reason}"</p>}
            <div className="flex gap-2 mt-2">
              {pending.signedTransferUrl && <a href={pending.signedTransferUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-seafoam hover:underline"><FileText size={11} /> Signed transfer</a>}
              {pending.affidavitUrl && <a href={pending.affidavitUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-seafoam hover:underline"><FileText size={11} /> Affidavit</a>}
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-3">Ownership can only change through a documented transfer reviewed by a platform admin — clinics can't reassign the owner directly.</p>
          <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95">
            <ArrowRightLeft size={14} /> Request ownership transfer
          </button>
          {latest && latest.status !== 'PENDING' && (
            <p className="text-[10px] text-slate-400 mt-2 text-center">Last request: <span className="font-bold">{STATUS_META[latest.status]?.label}</span>{latest.reviewNotes ? ` — "${latest.reviewNotes}"` : ''}</p>
          )}
        </>
      )}

      {open && <TransferModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
};

const TransferModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [signedUrl, setSignedUrl] = useState('');
  const [affidavitUrl, setAffidavitUrl] = useState('');
  const [uploading, setUploading] = useState<'signed' | 'affidavit' | null>(null);
  const [busy, setBusy] = useState(false);

  const doUpload = async (which: 'signed' | 'affidavit', file: File) => {
    setUploading(which);
    try {
      const r = await uploadsAPI.upload(file, 'transfer-doc');
      if (which === 'signed') setSignedUrl(r.publicUrl); else setAffidavitUrl(r.publicUrl);
      toast.success(`${which === 'signed' ? 'Signed transfer' : 'Affidavit'} uploaded`);
    } catch (e: any) { toast.error(e?.message || 'Upload failed'); }
    finally { setUploading(null); }
  };

  const submit = async () => {
    if (!email.trim()) { toast.error('Enter the new owner\'s email'); return; }
    if (!signedUrl || !affidavitUrl) { toast.error('Upload both the signed transfer and the affidavit'); return; }
    setBusy(true);
    try {
      const res = await clinicTransfersAPI.create({ newOwnerEmail: email.trim(), reason: reason.trim() || undefined, signedTransferUrl: signedUrl, affidavitUrl });
      if (res.data?.transfer) { toast.success('Transfer request submitted for admin review'); onDone(); }
    } finally { setBusy(false); }
  };

  const FileRow: React.FC<{ label: string; url: string; which: 'signed' | 'affidavit' }> = ({ label, url, which }) => (
    <div>
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label} *</label>
      <label className={`mt-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition-all ${url ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-slate-300 dark:border-zinc-700 hover:border-seafoam'}`}>
        {uploading === which ? <Loader2 size={14} className="animate-spin text-seafoam" /> : url ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Upload size={14} className="text-slate-400" />}
        <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 truncate">{url ? 'Uploaded — replace' : 'Choose a PDF or image'}</span>
        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(which, f); }} />
      </label>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="font-black text-pine dark:text-zinc-100 text-sm uppercase tracking-widest">Request ownership transfer</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">A platform admin reviews the documents before ownership changes. The new owner must already have a VetHub account.</p>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">New owner's email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-input mt-1" placeholder="newowner@example.com" />
          </div>
          <FileRow label="Signed transfer document" url={signedUrl} which="signed" />
          <FileRow label="Lawyer / advocate affidavit" url={affidavitUrl} which="affidavit" />
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Reason (optional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="field-textarea mt-1" placeholder="Context for the transfer…" />
          </div>
          <button onClick={submit} disabled={busy || !!uploading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />} Submit for review
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicTransferCard;
