import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, Clock, Loader2, Check } from 'lucide-react';
import { verificationAPI, toast } from '../../../services';
import type { VerificationInfo, BusinessDocument, BusinessDocType, DocumentSide, UploadScope } from '../../../services';
import { useAuth } from '../../../contexts/AuthContext';
import DocumentUploader from './DocumentUploader';
import LoadingSpinner from '../common/LoadingSpinner';

// Verification panel for clinic/supplier settings. Owners upload/replace docs.
// Platform admins (viewing via the management switcher) get the same upload
// controls PLUS Approve / Reject actions inline.
interface Props {
  entity: 'clinic' | 'supplier';
  entityId: string | number;
}

const STATUS_BANNER = {
  TEMP_ACTIVE: {
    icon: Clock,
    title: 'Pending verification',
    body: "Your account is active on a trial. Upload your documents below — once our team verifies them you'll be fully verified and visible to pet owners.",
    cls: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-900/40 dark:text-amber-200',
  },
  FULL: {
    icon: ShieldCheck,
    title: 'Verified',
    body: 'Your business is verified. The verified badge is shown to clients and your clinic appears in pet-owner search.',
    cls: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-900/40 dark:text-emerald-200',
  },
  REJECTED: {
    icon: ShieldAlert,
    title: 'Action needed',
    body: 'Some documents need attention. Please review the notes below and re-upload.',
    cls: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-200',
  },
};

const VerificationPanel: React.FC<Props> = ({ entity, entityId }) => {
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const scope: UploadScope = entity === 'clinic' ? 'clinic-doc' : 'supplier-doc';

  const load = useCallback(async () => {
    try {
      const res = entity === 'clinic'
        ? await verificationAPI.getClinic(entityId)
        : await verificationAPI.getSupplier(entityId);
      if (res.data) setInfo(res.data);
    } finally {
      setLoading(false);
    }
  }, [entity, entityId]);

  useEffect(() => { load(); }, [load]);

  const findDoc = (docType: BusinessDocType, side?: DocumentSide): BusinessDocument | null =>
    info?.documents.find((d) => d.docType === docType && (side ? d.side === side : !d.side)) ?? null;

  const submit = async (payload: any) => {
    if (entity === 'clinic') await verificationAPI.submitClinicDoc(entityId, payload);
    else await verificationAPI.submitSupplierDoc(entityId, payload);
    await load();
  };

  const remove = async (docId: string) => {
    if (entity === 'clinic') await verificationAPI.deleteClinicDoc(entityId, docId);
    else await verificationAPI.deleteSupplierDoc(entityId, docId);
    await load();
  };

  // Admin-only review actions (visible when a platform admin is viewing).
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'MERCHANT_ADMIN';
  const [acting, setActing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const approve = async () => {
    setActing(true);
    try {
      await verificationAPI.adminApprove(entity, entityId);
      toast.success('Verified');
      await load();
    } finally { setActing(false); }
  };

  const reject = async () => {
    if (!reason.trim()) { toast.error('Add a reason so the owner knows what to fix'); return; }
    setActing(true);
    try {
      await verificationAPI.adminReject(entity, entityId, reason.trim());
      toast.success('Marked rejected');
      setRejecting(false);
      setReason('');
      await load();
    } finally { setActing(false); }
  };

  if (loading) {
    return <div className="py-12"><LoadingSpinner message="Loading..." /></div>;
  }

  const banner = STATUS_BANNER[info?.status ?? 'TEMP_ACTIVE'];
  const BannerIcon = banner.icon;

  return (
    <div className="space-y-5">
      {isAdmin && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin review</p>
              <p className="text-sm font-bold text-pine dark:text-zinc-100">
                Current status: <span className="uppercase">{(info?.status ?? 'TEMP_ACTIVE').replace('_', ' ')}</span>
              </p>
            </div>
            {!rejecting ? (
              <div className="flex gap-2">
                <button onClick={() => setRejecting(true)} disabled={acting}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 transition-all">
                  <ShieldAlert className="w-4 h-4" /> Reject
                </button>
                <button onClick={approve} disabled={acting || info?.status === 'FULL'}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50">
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {info?.status === 'FULL' ? 'Verified' : 'Approve & verify'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input className="field-input flex-1 sm:w-64" placeholder="Reason for rejection…" value={reason} onChange={(e) => setReason(e.target.value)} />
                <button onClick={() => { setRejecting(false); setReason(''); }} disabled={acting}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-200">Cancel</button>
                <button onClick={reject} disabled={acting}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-60">
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className={`rounded-2xl border p-4 flex items-start gap-3 ${banner.cls}`}>
        <BannerIcon className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-black text-sm">{banner.title}</p>
          <p className="text-[13px] leading-relaxed">{banner.body}</p>
          {info?.status === 'REJECTED' && info.notes && (
            <p className="text-[12px] font-semibold mt-1">Reviewer note: {info.notes}</p>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <DocumentUploader
          label="Business / vet license"
          hint="Your practice or operating licence"
          docType="BUSINESS_LICENSE"
          scope={scope}
          aspect={0.77}
          existing={findDoc('BUSINESS_LICENSE')}
          onSubmit={submit}
          onRemove={remove}
        />
        <DocumentUploader
          label="Business registration"
          hint="Company / business registration certificate"
          docType="BUSINESS_REGISTRATION"
          scope={scope}
          aspect={0.77}
          existing={findDoc('BUSINESS_REGISTRATION')}
          onSubmit={submit}
          onRemove={remove}
        />
        <DocumentUploader
          label="Owner ID — front"
          hint="Front of the owner's government ID"
          docType="OWNER_ID"
          side="FRONT"
          scope={scope}
          aspect={1.586}
          existing={findDoc('OWNER_ID', 'FRONT')}
          onSubmit={submit}
          onRemove={remove}
        />
        <DocumentUploader
          label="Owner ID — back"
          hint="Back of the owner's government ID"
          docType="OWNER_ID"
          side="BACK"
          scope={scope}
          aspect={1.586}
          existing={findDoc('OWNER_ID', 'BACK')}
          onSubmit={submit}
          onRemove={remove}
        />
      </div>
    </div>
  );
};

export default VerificationPanel;
