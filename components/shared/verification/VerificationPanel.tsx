import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, Clock, Loader2 } from 'lucide-react';
import { verificationAPI } from '../../../services';
import type { VerificationInfo, BusinessDocument, BusinessDocType, DocumentSide, UploadScope } from '../../../services';
import DocumentUploader from './DocumentUploader';

// Owner-facing verification panel. Drop into clinic or supplier settings.
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

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-seafoam" /></div>;
  }

  const banner = STATUS_BANNER[info?.status ?? 'TEMP_ACTIVE'];
  const BannerIcon = banner.icon;

  return (
    <div className="space-y-5">
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
