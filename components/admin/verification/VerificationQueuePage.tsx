import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, Clock, Loader2, Building2, Truck, X, Check, FileText, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { verificationAPI, toast } from '../../../services';
import type { VerificationQueueItem, VerificationInfo } from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

const STATUS_BADGE: Record<string, { cls: string; icon: React.ElementType; label: string }> = {
  TEMP_ACTIVE: { cls: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending' },
  FULL: { cls: 'bg-emerald-100 text-emerald-700', icon: ShieldCheck, label: 'Verified' },
  REJECTED: { cls: 'bg-red-100 text-red-700', icon: ShieldAlert, label: 'Rejected' },
};

const VerificationQueuePage: React.FC = () => {
  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'clinic' | 'supplier'>('all');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'FULL' | 'REJECTED'>('pending');
  const [selected, setSelected] = useState<VerificationQueueItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { type?: 'clinic' | 'supplier'; status?: string } = {};
      if (filter !== 'all') params.type = filter;
      // 'pending' = the default review queue (not-verified or has pending docs);
      // FULL / REJECTED explicitly list verified / rejected entities so an admin
      // can find a verified clinic to revoke.
      if (statusFilter !== 'pending') params.status = statusFilter;
      const res = await verificationAPI.adminList(params);
      setItems(res.data?.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 pt-6 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Verification</h1>
          <p className="page-subheader">Review business documents and approve clinics & suppliers</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-200 hover:border-seafoam">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-fit">
          {(['all', 'clinic', 'supplier'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                filter === f ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine' : 'text-seafoam dark:text-zinc-500 hover:text-pine'
              }`}>
              {f === 'all' ? 'All' : f === 'clinic' ? 'Clinics' : 'Suppliers'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-fit">
          {([['pending', 'To review'], ['FULL', 'Verified'], ['REJECTED', 'Rejected']] as const).map(([s, lbl]) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                statusFilter === s ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine' : 'text-seafoam dark:text-zinc-500 hover:text-pine'
              }`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner contentArea message="Loading..." />
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-zinc-500">
          <ShieldCheck className="w-10 h-10 mx-auto mb-2" />
          <p className="font-bold">Nothing to review — all caught up.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it) => {
            const badge = STATUS_BADGE[it.status];
            const BadgeIcon = badge.icon;
            const TypeIcon = it.type === 'clinic' ? Building2 : Truck;
            return (
              <button key={`${it.type}-${it.id}`} onClick={() => setSelected(it)}
                className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 hover:border-seafoam transition-all shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <TypeIcon className="w-3.5 h-3.5" /> {it.type}
                  </span>
                  <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${badge.cls}`}>
                    <BadgeIcon className="w-3 h-3" /> {badge.label}
                  </span>
                </div>
                <p className="font-black text-pine dark:text-zinc-100 truncate">{it.name}</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{it.email || it.phone || '—'}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
                  {it.docCount} doc{it.docCount === 1 ? '' : 's'}
                  {it.pendingDocs > 0 && <span className="text-amber-600 font-bold"> · {it.pendingDocs} pending</span>}
                  {' · '}{formatDistanceToNow(new Date(it.createdAt), { addSuffix: true })}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {selected && <ReviewModal item={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); load(); }} />}
    </div>
  );
};

const DOC_LABEL: Record<string, string> = {
  BUSINESS_LICENSE: 'Business / vet license',
  BUSINESS_REGISTRATION: 'Business registration',
  OWNER_ID: 'Owner ID',
};

const ReviewModal: React.FC<{ item: VerificationQueueItem; onClose: () => void; onDone: () => void }> = ({ item, onClose, onDone }) => {
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    verificationAPI.adminGetEntity(item.type, item.id)
      .then((res) => setInfo(res.data ?? null))
      .finally(() => setLoading(false));
  }, [item]);

  const approve = async () => {
    setBusy(true);
    try {
      await verificationAPI.adminApprove(item.type, item.id);
      toast.success(`${item.name} verified`);
      onDone();
    } catch { setBusy(false); }
  };

  const reject = async () => {
    if (!reason.trim()) { toast.error('Add a reason so the owner knows what to fix'); return; }
    setBusy(true);
    try {
      await verificationAPI.adminReject(item.type, item.id, reason.trim());
      toast.success(`${item.name} marked rejected`);
      onDone();
    } catch { setBusy(false); }
  };

  const revokeAll = async () => {
    if (!window.confirm(`Revoke ${item.name}'s verification? All documents are marked rejected and the badge is removed — they must re-submit.`)) return;
    setBusy(true);
    try {
      await verificationAPI.adminRevoke(item.type, item.id, {});
      toast.success(`${item.name} verification revoked`);
      onDone();
    } catch { setBusy(false); }
  };

  // Revoke one document — marks it rejected and drops the entity to pending.
  // Reloads the modal in place (doesn't close) so the admin can revoke more.
  const revokeDoc = async (docId: string) => {
    if (!window.confirm('Revoke this document? It will be marked rejected and the entity returns to pending review.')) return;
    setBusy(true);
    try {
      await verificationAPI.adminRevoke(item.type, item.id, { docId });
      toast.success('Document revoked');
      const res = await verificationAPI.adminGetEntity(item.type, item.id);
      setInfo(res.data ?? null);
    } finally { setBusy(false); }
  };

  const isExpired = (d: { expiresAt: string | null }) => !!d.expiresAt && new Date(d.expiresAt).getTime() < Date.now();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h3 className="font-black text-lg text-pine dark:text-zinc-100">{item.name}</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.type} · {item.email || item.phone || ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-pine"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12"><LoadingSpinner message="Loading..." /></div>
          ) : !info || info.documents.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No documents submitted yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {info.documents.map((d) => (
                <div key={d.id} className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="block hover:opacity-90 transition-opacity">
                    <div className="bg-slate-50 dark:bg-zinc-800 flex items-center justify-center" style={{ height: 160 }}>
                      {d.contentType === 'application/pdf'
                        ? <div className="flex flex-col items-center gap-1 text-seafoam"><FileText className="w-8 h-8" /><span className="text-xs font-bold">View PDF</span></div>
                        : <img src={d.fileUrl} alt={d.docType} className="max-h-40 object-contain" />}
                    </div>
                  </a>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs font-black text-pine dark:text-zinc-100">{DOC_LABEL[d.docType] || d.docType}{d.side ? ` — ${d.side}` : ''}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${d.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : d.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{d.status}</span>
                      {d.expiresAt && (
                        <span className={`text-[9px] font-bold ${isExpired(d) ? 'text-red-600' : 'text-slate-400'}`}>
                          {isExpired(d) ? 'Expired' : 'Expires'} {new Date(d.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {d.status !== 'REJECTED' && (
                      <button onClick={() => revokeDoc(d.id)} disabled={busy}
                        className="w-full mt-1 flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-300 transition-all disabled:opacity-50">
                        <ShieldAlert className="w-3 h-3" /> Revoke this doc
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {rejecting && (
            <div className="mt-4">
              <label className="field-label">Rejection reason (shown to the owner)</label>
              <textarea className="field-textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. License image is blurry — please re-upload a clear photo." />
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-zinc-800 flex gap-2 justify-end">
          {!rejecting ? (
            <>
              {info?.status === 'FULL' && (
                <button onClick={revokeAll} disabled={busy}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-300 transition-all mr-auto">
                  <ShieldAlert className="w-4 h-4" /> Revoke all
                </button>
              )}
              <button onClick={() => setRejecting(true)} disabled={busy}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 transition-all">
                <ShieldAlert className="w-4 h-4" /> Reject
              </button>
              <button onClick={approve} disabled={busy}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve all & verify
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setRejecting(false)} disabled={busy}
                className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-200">
                Cancel
              </button>
              <button onClick={reject} disabled={busy}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} Confirm reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationQueuePage;
