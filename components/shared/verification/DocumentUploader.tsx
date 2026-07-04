import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { Upload, Loader2, Check, X, FileText, RefreshCw, Trash2, ZoomIn, CalendarClock, AlertTriangle } from 'lucide-react';
import { uploadsAPI, UploadScope, toast } from '../../../services';
import type { BusinessDocType, DocumentSide, BusinessDocument } from '../../../services';
import { getCroppedBlob, fileToDataUrl, PixelCrop } from '../../../services/utils/cropImage';

interface Props {
  label: string;
  hint?: string;
  docType: BusinessDocType;
  side?: DocumentSide;
  scope: UploadScope; // 'clinic-doc' | 'supplier-doc'
  existing?: BusinessDocument | null;
  aspect?: number; // crop aspect ratio for images
  disabled?: boolean;
  // Time-bound docs (e.g. licence) expose an expiry date + an expired flag.
  expirable?: boolean;
  onSubmit: (payload: { docType: BusinessDocType; side?: DocumentSide; fileUrl: string; fileKey?: string; contentType?: string; expiresAt?: string | null }) => Promise<void>;
  // Update only the expiry on an already-uploaded doc (no re-upload).
  onUpdateExpiry?: (expiresAt: string | null) => Promise<void>;
  onRemove?: (docId: string) => Promise<void>;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const DocumentUploader: React.FC<Props> = ({ label, hint, docType, side, scope, existing, aspect = 1.586, disabled, expirable, onSubmit, onUpdateExpiry, onRemove }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<PixelCrop | null>(null);
  const [busy, setBusy] = useState(false);
  // Expiry (yyyy-mm-dd) — seeded from the stored doc; applied to the next
  // upload, or saved standalone via onUpdateExpiry.
  const [expiryDraft, setExpiryDraft] = useState<string>(existing?.expiresAt ? existing.expiresAt.slice(0, 10) : '');
  const [savingExpiry, setSavingExpiry] = useState(false);
  const isExpired = !!existing?.expiresAt && new Date(existing.expiresAt).getTime() < Date.now();
  const expiryChanged = expirable && !!existing && (existing.expiresAt ? existing.expiresAt.slice(0, 10) : '') !== expiryDraft;

  const onCropComplete = useCallback((_a: any, areaPx: PixelCrop) => setAreaPixels(areaPx), []);

  const pickFile = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (file.type === 'application/pdf') {
      // No crop for PDFs — upload as-is.
      await doUpload(file, 'application/pdf', file.name);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image or PDF.');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setCropSrc(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const doUpload = async (blob: Blob, contentType: string, filename: string) => {
    setBusy(true);
    try {
      const res = await uploadsAPI.uploadBlob(blob, { scope, filename, contentType });
      await onSubmit({ docType, side, fileUrl: res.publicUrl, fileKey: res.key, contentType, expiresAt: expiryDraft ? new Date(expiryDraft).toISOString() : null });
      toast.success(`${label} uploaded`);
      setCropSrc(null);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const saveExpiry = async () => {
    if (!onUpdateExpiry) return;
    setSavingExpiry(true);
    try {
      await onUpdateExpiry(expiryDraft ? new Date(expiryDraft).toISOString() : null);
      toast.success('Expiry updated');
    } catch (err: any) {
      toast.error(err?.message || 'Could not update expiry');
    } finally {
      setSavingExpiry(false);
    }
  };

  const confirmCrop = async () => {
    if (!cropSrc || !areaPixels) return;
    const blob = await getCroppedBlob(cropSrc, areaPixels, 'image/jpeg', 0.9);
    await doUpload(blob, 'image/jpeg', `${docType.toLowerCase()}${side ? '-' + side.toLowerCase() : ''}.jpg`);
  };

  const isPdf = existing?.contentType === 'application/pdf';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-black text-pine dark:text-zinc-100">{label}</p>
          {hint && <p className="text-[11px] text-slate-400 dark:text-zinc-500">{hint}</p>}
        </div>
        {existing && (
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${isExpired ? STATUS_STYLES.REJECTED : STATUS_STYLES[existing.status] || ''}`}>
            {isExpired ? 'Expired' : existing.status}
          </span>
        )}
      </div>

      {existing ? (
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 flex items-center justify-center" style={{ minHeight: 120 }}>
            {isPdf ? (
              <a href={existing.fileUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 py-6 text-seafoam">
                <FileText className="w-8 h-8" /> <span className="text-xs font-bold">View PDF</span>
              </a>
            ) : (
              <a href={existing.fileUrl} target="_blank" rel="noreferrer">
                <img src={existing.fileUrl} alt={label} className="max-h-40 object-contain" />
              </a>
            )}
          </div>
          {existing.status === 'REJECTED' && existing.reviewNotes && (
            <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">Reason: {existing.reviewNotes}</p>
          )}
          {isExpired && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Expired — please upload a current copy.
            </div>
          )}
          {expirable && (
            <div className="flex items-end gap-2">
              <label className="flex-1">
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-0.5"><CalendarClock className="w-3 h-3" /> Expiry date</span>
                <input type="date" className="field-input !h-8 text-[12px] w-full" value={expiryDraft} disabled={disabled} onChange={(e) => setExpiryDraft(e.target.value)} />
              </label>
              {!disabled && expiryChanged && onUpdateExpiry && (
                <button type="button" onClick={saveExpiry} disabled={savingExpiry} className="h-8 px-3 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all shrink-0">
                  {savingExpiry ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </button>
              )}
            </div>
          )}
          {!disabled && (
            <div className="flex gap-2">
              <button type="button" onClick={pickFile} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-200 hover:border-seafoam transition-all">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Replace
              </button>
              {onRemove && (
                <button type="button" onClick={() => onRemove(existing.id)} disabled={busy} className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {expirable && (
            <label className="block">
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-0.5"><CalendarClock className="w-3 h-3" /> Expiry date (optional)</span>
              <input type="date" className="field-input !h-8 text-[12px] w-full" value={expiryDraft} disabled={disabled} onChange={(e) => setExpiryDraft(e.target.value)} />
            </label>
          )}
          <button type="button" onClick={pickFile} disabled={busy || disabled}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:border-seafoam hover:text-seafoam transition-all disabled:opacity-50">
            {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
            <span className="text-xs font-bold">Upload image or PDF</span>
          </button>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />

      {/* Crop modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !busy && setCropSrc(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <h4 className="font-black text-pine dark:text-zinc-100">Crop {label}</h4>
              <button type="button" onClick={() => !busy && setCropSrc(null)} className="text-slate-400 hover:text-pine"><X className="w-5 h-5" /></button>
            </div>
            <div className="relative bg-zinc-950 flex-1 h-[68vh] max-h-[680px] min-h-[380px]">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="px-5 py-3 flex items-center gap-3 border-t border-slate-200 dark:border-zinc-800 shrink-0">
              <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-seafoam" />
              <button type="button" onClick={confirmCrop} disabled={busy} className="flex items-center gap-1.5 bg-seafoam hover:bg-pine text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all disabled:opacity-60">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Use photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;
