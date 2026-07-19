import React, { useEffect, useState } from 'react';
import { ArrowLeft, ScanLine, Dog, Building2, Loader2, Save, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { imagingAPI, visitsAPI, ImagingRecord, ImagingImage } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import StandardRecordControls from '../shared/StandardRecordControls';
import NotesFormatToggle, { FormattedNotes } from '../shared/NotesFormatToggle';
import ShareWithClinics from '../shared/ShareWithClinics';

interface Props {
  record: ImagingRecord;
  onBack: () => void;
  onChanged: () => void;
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
}

const imgMeta = (im: ImagingImage | string): ImagingImage => (typeof im === 'string' ? { url: im } : im);

const tabStatusTone: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  IN_PROGRESS: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const downscale = (file: File, max = 1100, quality = 0.72): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('read failed'));
  reader.onload = () => { const img = new Image(); img.onload = () => { let { width, height } = img; if (width > max || height > max) { const s = Math.min(max / width, max / height); width = Math.round(width * s); height = Math.round(height * s); } const c = document.createElement('canvas'); c.width = width; c.height = height; c.getContext('2d')?.drawImage(img, 0, 0, width, height); resolve(c.toDataURL('image/jpeg', quality)); }; img.src = reader.result as string; };
  reader.readAsDataURL(file);
});

/**
 * Full-page imaging study — replaces the slide-over drawer. The big win:
 * images can be UPLOADED here after the study was requested (each requested
 * service gets its record at request time; the radiographer attaches images
 * + per-image descriptions when the study is done), with findings editable
 * in place. A visit with SEVERAL studies shows one TAB per record (like the
 * lab page). A COMPLETED study locks to view-only — "Edit study" reopens it
 * while the visit is still open; once billed it's frozen for good.
 */
const ImagingRecordPage: React.FC<Props> = ({ record, onBack, onChanged, onOpenAppointment }) => {
  // Sibling records: every imaging study on the SAME visit, tabbed. The prop
  // record stays the fallback; switching tabs only changes `currentId`.
  const [siblings, setSiblings] = useState<ImagingRecord[]>([record]);
  const [currentId, setCurrentId] = useState<string | number>(record.id);
  const current = siblings.find(r => String(r.id) === String(currentId)) || record;

  const loadSiblings = React.useCallback(async () => {
    if (!record.appointmentId) { setSiblings([record]); return; }
    try {
      const res = await imagingAPI.list({ appointmentId: record.appointmentId });
      // Belt & braces: THIS visit's studies only.
      const scoped = (res.success ? (res.data?.records || []) : []).filter(r => String(r.appointmentId ?? '') === String(record.appointmentId));
      if (scoped.length) setSiblings(scoped);
    } catch { /* keep what we have */ }
  }, [record.appointmentId, record.id, record.updatedAt]);
  useEffect(() => { setCurrentId(record.id); }, [record.id]);
  useEffect(() => { loadSiblings(); }, [loadSiblings]);

  // Lock states: a COMPLETED study is view-only (reopen with "Edit study"
  // while the visit is open); a BILLED visit freezes the record for good
  // (server enforces too).
  const currentAppt: any = (current as any).appointment || {};
  const billLocked = !!(currentAppt.isPaid || currentAppt.status === 'PENDING_PAYMENT' || currentAppt.status === 'COMPLETED');
  const doneLocked = current.status === 'COMPLETED';
  const locked = doneLocked || billLocked;

  const [sharing, setSharing] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [images, setImages] = useState<ImagingImage[]>((current.images || []).map(imgMeta));
  const [findings, setFindings] = useState(current.findings || '');
  const [studyDate, setStudyDate] = useState(current.studyDate ? current.studyDate.slice(0, 10) : '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Re-sync the editable fields when the ACTIVE record changes (tab switch
  // or refresh).
  useEffect(() => {
    setImages((current.images || []).map(imgMeta));
    setFindings(current.findings || '');
    setStudyDate(current.studyDate ? current.studyDate.slice(0, 10) : '');
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [String(current.id), current.updatedAt]);

  const refresh = async () => { await loadSiblings(); onChanged(); };

  const patch = async (data: Partial<ImagingRecord>) => {
    // Fold unsaved local edits (uploaded images, findings) into the patch —
    // a format/status toggle refetches the record and would wipe them.
    const payload = dirty
      ? { images, findings: findings || null, studyDate: studyDate || null, ...data }
      : data;
    try {
      const res = await imagingAPI.update(current.id, payload as any);
      if (res.success) { if (dirty) setDirty(false); await refresh(); }
    }
    catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  // A COMPLETED study reopens for editing: back to In progress + a journey
  // event on the visit so the change is on the record's timeline.
  const reopenForEdit = async () => {
    await patch({ status: 'IN_PROGRESS' as any });
    if (current.appointmentId) {
      visitsAPI.addEvent(current.appointmentId, {
        label: `${current.modality || 'Imaging study'}${current.bodyPart ? ` (${current.bodyPart})` : ''} reopened for editing (Completed → In progress)`,
        kind: 'action',
      }).catch(() => { /* non-fatal */ });
    }
    toast('Study reopened — status set to In progress', { icon: '✏️' });
  };

  // The study date auto-fills with TODAY the moment work lands (image
  // upload, per-image notes, findings) — staff only touch it to backdate.
  const touchStudyDate = () => setStudyDate(d => d || new Date().toISOString().slice(0, 10));

  const addImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await downscale(file);
      setImages(imgs => [...imgs, { url, description: '', notes: '', diagnosis: '' }]);
      setDirty(true);
      touchStudyDate();
    } catch { toast.error('Image failed to load'); }
    finally { setUploading(false); }
  };
  const setImg = (i: number, p: Partial<ImagingImage>) => { setImages(imgs => imgs.map((im, j) => j === i ? { ...im, ...p } : im)); setDirty(true); touchStudyDate(); };
  const removeImg = (i: number) => { setImages(imgs => imgs.filter((_, j) => j !== i)); setDirty(true); };

  const saveStudy = async () => {
    setSaving(true);
    try {
      // Saving without a date stamps TODAY automatically.
      const res = await imagingAPI.update(current.id, { images, findings: findings || null, studyDate: studyDate || new Date().toISOString().slice(0, 10) } as any);
      if (res.success) { toast.success('Study saved'); setDirty(false); await refresh(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const fieldCls = 'w-full px-2.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Imaging
      </button>
      <div className="bg-gradient-to-br from-sky-700 to-cyan-600 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="p-3 bg-white/15 rounded-2xl"><ScanLine size={24} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Imaging study</p>
          <h1 className="text-xl font-black tracking-tight truncate flex items-center gap-2"><Dog size={18} /> {current.pet?.name ?? 'Patient'}{(current.pet as any)?.species ? <span className="text-white/60 text-sm font-bold">· {(current.pet as any).species}</span> : null}</h1>
          <p className="text-[11px] text-white/70 truncate">
            {current.modality}{current.bodyPart ? ` · ${current.bodyPart}` : ''} · {current.studyDate ? formatDate(current.studyDate) : formatDate(current.createdAt)}
            {current.source === 'EXTERNAL' && <span className="inline-flex items-center gap-1 ml-2"><Building2 size={10} /> {current.externalSource || 'External'}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${current.status === 'COMPLETED' ? 'bg-emerald-400/20 text-emerald-100' : 'bg-amber-400/20 text-amber-100'}`}>{(current.status || 'PENDING').replace('_', ' ').toLowerCase()}</span>
          {billLocked && (
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-white/85 text-[9px] font-black uppercase tracking-widest">
              {currentAppt.isPaid ? '🔒 Bill settled — locked' : '💰 Billed — awaiting payment'}
            </span>
          )}
        </div>
      </div>

      {/* Sibling tabs — every imaging study on the SAME visit */}
      {siblings.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {siblings.map(r => {
            const active = String(r.id) === String(currentId);
            return (
              <button key={r.id} onClick={() => { if (!active) setCurrentId(r.id); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-sky-700 text-white border-sky-700 shadow-md' : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-sky-400'}`}>
                {r.modality || 'Study'}{r.bodyPart ? ` · ${r.bodyPart}` : ''}
                <span className={`px-1.5 py-0.5 rounded text-[7px] ${active ? 'bg-white/20 text-white' : tabStatusTone[r.status || 'PENDING'] || tabStatusTone.PENDING}`}>
                  {(r.status || 'PENDING').replace('_', ' ').toLowerCase()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          {/* Images — upload lives HERE: the study is requested first, the
              radiographer attaches images when it's done. */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Images · {images.length}</p>
              <div className="flex items-center gap-2">
                {doneLocked && !billLocked && (
                  <button onClick={reopenForEdit}
                    title="Reopen this study for editing — status goes back to In progress and the change is logged on the visit's journey"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all">
                    ✏️ Edit study
                  </button>
                )}
                {!locked && <input type="date" className={`${fieldCls} !w-36`} value={studyDate} onChange={e => { setStudyDate(e.target.value); setDirty(true); }} title="Study date" />}
                {dirty && !locked && (
                  <button onClick={saveStudy} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-seafoam text-white rounded-lg text-[9px] font-black uppercase tracking-widest disabled:opacity-50">
                    {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save study
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {images.map((im, i) => (
                <div key={i} className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden space-y-1.5 pb-2">
                  <div className="relative group">
                    <img src={im.url} onClick={() => setViewer(im.url)} className="w-full h-40 object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                    {!locked && <button onClick={() => removeImg(i)} className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"><X size={12} /></button>}
                  </div>
                  <div className="px-2 space-y-1">
                    <input className={fieldCls} placeholder="Description (e.g. Lateral view)" value={im.description ?? ''} disabled={locked} onChange={e => setImg(i, { description: e.target.value })} />
                    <input className={fieldCls} placeholder="Diagnosis / note for this image" value={im.diagnosis ?? ''} disabled={locked} onChange={e => setImg(i, { diagnosis: e.target.value })} />
                  </div>
                </div>
              ))}
              {!locked && <label className={`flex flex-col items-center justify-center gap-2 min-h-40 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 cursor-pointer hover:border-seafoam text-slate-400 hover:text-seafoam transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                <span className="text-[9px] font-black uppercase tracking-widest">Upload image</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => { addImage(e.target.files?.[0]); e.target.value = ''; }} />
              </label>}
            </div>
          </div>

          {/* Findings */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Overall Findings</p>
              <NotesFormatToggle value={current.displayFormat || 'PARAGRAPH'} onChange={(v) => patch({ displayFormat: v })} />
            </div>
            <textarea rows={4} className="field-textarea" placeholder="Findings across the study…" value={findings} disabled={locked} onChange={e => { setFindings(e.target.value); setDirty(true); touchStudyDate(); }} />
            {!dirty && current.findings && <FormattedNotes text={current.findings} format={current.displayFormat} />}
          </div>
        </div>

        {/* Side rail */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-sm sticky top-4">
            <StandardRecordControls
              appointmentId={current.appointmentId}
              onOpenAppointment={onOpenAppointment}
              onShare={() => setSharing(true)}
              shareCount={current.allowedClinicIds?.length}
              status={{ value: current.status || 'COMPLETED', options: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], onChange: (v) => patch({ status: v }), disabled: billLocked }}
            />
            {!current.appointmentId && <p className="text-[11px] text-slate-400 dark:text-zinc-500">No linked visit — create a walk-in visit on the study to bill it.</p>}
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 space-y-2">
              {[
                ['Modality', current.modality],
                ['Body part', current.bodyPart],
                ['Source', current.source === 'EXTERNAL' ? (current.externalSource || 'External') : 'Internal'],
                ['Requested', formatDate(current.createdAt)],
                ['Updated', formatDate(current.updatedAt)],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex items-baseline justify-between gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{k}</span>
                  <span className="text-[11px] font-bold text-pine dark:text-zinc-100 text-right truncate">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {viewer && <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6" onClick={() => setViewer(null)}><img src={viewer} className="max-w-full max-h-full rounded-xl" /></div>}
      {sharing && (
        <ShareWithClinics recordType="imaging" recordId={current.id} allowedClinicIds={current.allowedClinicIds}
          onClose={() => setSharing(false)} onSaved={() => { setSharing(false); refresh(); }} />
      )}
    </div>
  );
};

export default ImagingRecordPage;
