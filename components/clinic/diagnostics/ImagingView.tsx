import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScanLine, Plus, Loader2, Trash2, X, Search, ExternalLink, Building2, ImagePlus, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { imagingAPI, ImagingRecord, ImagingImage, ImagingModality, DiagSource } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import ShareWithClinics from '../shared/ShareWithClinics';
import PartnerPicker from '../shared/PartnerPicker';
import { recordSharingAPI } from '../../../services';

interface Props { onOpenAppointment?: (appointmentId: string) => void }

const MODALITIES: { value: ImagingModality | 'all'; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'XRAY', label: 'X-ray' }, { value: 'ULTRASOUND', label: 'Ultrasound' },
  { value: 'CT', label: 'CT' }, { value: 'MRI', label: 'MRI' }, { value: 'ENDOSCOPY', label: 'Endoscopy' }, { value: 'OTHER', label: 'Other' },
];

// Body-part dropdown options; "Other" reveals a required free-text field.
const BODY_PARTS = ['Thorax / Chest', 'Abdomen', 'Skull / Head', 'Spine', 'Pelvis', 'Forelimb', 'Hindlimb', 'Dental', 'Whole body', 'Other'];

// Normalise an image entry (legacy records may be plain URL strings).
const imgUrl = (im: ImagingImage | string): string => (typeof im === 'string' ? im : im?.url);
const imgMeta = (im: ImagingImage | string): ImagingImage => (typeof im === 'string' ? { url: im } : im);

const downscale = (file: File, max = 1100, quality = 0.72): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('read failed'));
  reader.onload = () => { const img = new Image(); img.onload = () => { let { width, height } = img; if (width > max || height > max) { const s = Math.min(max / width, max / height); width = Math.round(width * s); height = Math.round(height * s); } const c = document.createElement('canvas'); c.width = width; c.height = height; c.getContext('2d')?.drawImage(img, 0, 0, width, height); resolve(c.toDataURL('image/jpeg', quality)); }; img.src = reader.result as string; };
  reader.readAsDataURL(file);
});

const ImagingView: React.FC<Props> = ({ onOpenAppointment }) => {
  const { pets } = useData();
  const [records, setRecords] = useState<ImagingRecord[]>([]);
  const [sharing, setSharing] = useState<ImagingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [modality, setModality] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [petSearch, setPetSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await imagingAPI.list({ modality: modality === 'all' ? undefined : modality }); if (res.success && res.data) setRecords(res.data.records); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [modality]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r => `${r.pet?.name ?? ''} ${r.bodyPart ?? ''} ${r.findings ?? ''}`.toLowerCase().includes(q));
  }, [records, search]);

  const petMatches = useMemo(() => { const q = petSearch.trim().toLowerCase(); if (!q) return [] as any[]; return pets.filter((p: any) => p.name?.toLowerCase().includes(q)).slice(0, 8); }, [pets, petSearch]);

  const startNew = () => { setEditing({ petId: null, petName: '', source: 'INTERNAL' as DiagSource, externalSource: '', partnerClinicId: null, modality: 'XRAY' as ImagingModality, bodyPartSel: '', bodyPart: '', findings: '', studyDate: new Date().toISOString().slice(0, 10), images: [] as ImagingImage[] }); setPetSearch(''); };

  // Each uploaded image is its own record with description/notes/diagnosis.
  const addImage = async (file?: File) => { if (!file) return; setUploading(true); try { const url = await downscale(file); setEditing((d: any) => ({ ...d, images: [...d.images, { url, description: '', notes: '', diagnosis: '' }] })); } catch { toast.error('Image failed'); } finally { setUploading(false); } };
  const setImg = (i: number, patch: Partial<ImagingImage>) => setEditing((d: any) => ({ ...d, images: d.images.map((im: any, j: number) => j === i ? { ...imgMeta(im), ...patch } : im) }));
  const removeImg = (i: number) => setEditing((d: any) => ({ ...d, images: d.images.filter((_: any, j: number) => j !== i) }));

  const save = async () => {
    if (!editing.petId) { toast.error('Select a patient'); return; }
    if (!editing.bodyPart?.trim()) { toast.error('Body part is required'); return; }
    setSaving(true);
    try {
      const res = await imagingAPI.create({ petId: editing.petId, source: editing.source, externalSource: editing.externalSource || undefined, modality: editing.modality, bodyPart: editing.bodyPart.trim(), findings: editing.findings || undefined, studyDate: editing.studyDate || undefined, images: editing.images } as any);
      if (res.success) {
        const newId = (res.data as any)?.record?.id;
        if (newId && editing.partnerClinicId) { await recordSharingAPI.setShares('imaging', newId, [editing.partnerClinicId]).catch(() => {}); }
        toast.success('Imaging saved'); setEditing(null); await load();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const remove = async (r: ImagingRecord) => { if (!confirm('Delete this imaging record?')) return; try { const res = await imagingAPI.remove(r.id); if (res.success) { toast.success('Deleted'); await load(); } } catch (e: any) { toast.error(e?.message || 'Failed'); } };

  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
  const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-900/20 flex items-center justify-center"><ScanLine size={22} className="text-sky-600 dark:text-sky-400" /></div>
          <div><h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Imaging</h1><p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{filtered.length} stud{filtered.length === 1 ? 'y' : 'ies'} · internal & partner</p></div>
        </div>
        {!editing && <button onClick={startNew} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> New study</button>}
      </div>

      {editing ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 max-w-2xl">
          <div className="flex items-center justify-between"><h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">New imaging study</h2><button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"><X size={18} /></button></div>
          <div>
            <label className={labelCls}>Patient *</label>
            {editing.petId ? <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl"><span className="text-sm font-bold text-pine dark:text-zinc-100">{editing.petName}</span><button onClick={() => setEditing({ ...editing, petId: null, petName: '' })} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500">Change</button></div>
            : <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${fieldCls} pl-9`} placeholder="Search patient…" value={petSearch} onChange={e => setPetSearch(e.target.value)} />{petMatches.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">{petMatches.map((p: any) => <button key={p.id} onClick={() => { setEditing({ ...editing, petId: p.id, petName: p.name }); setPetSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-pine dark:text-zinc-100">{p.name} <span className="text-slate-400 text-xs">{p.species}</span></button>)}</div>}</div>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>Modality</label><select className={fieldCls} value={editing.modality} onChange={e => setEditing({ ...editing, modality: e.target.value })}>{MODALITIES.filter(m => m.value !== 'all').map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            <div>
              <label className={labelCls}>Body part *</label>
              <select className={fieldCls} value={editing.bodyPartSel} onChange={e => { const v = e.target.value; setEditing({ ...editing, bodyPartSel: v, bodyPart: v === 'Other' ? '' : v }); }}>
                <option value="">Select…</option>
                {BODY_PARTS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Study date</label><input type="date" className={fieldCls} value={editing.studyDate} onChange={e => setEditing({ ...editing, studyDate: e.target.value })} /></div>
          </div>
          {editing.bodyPartSel === 'Other' && (
            <div><label className={labelCls}>Specify body part *</label><input className={fieldCls} value={editing.bodyPart} onChange={e => setEditing({ ...editing, bodyPart: e.target.value })} placeholder="e.g. Left tarsus" required /></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Source</label><div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-max">{(['INTERNAL', 'EXTERNAL'] as DiagSource[]).map(s => <button key={s} onClick={() => setEditing({ ...editing, source: s })} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${editing.source === s ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>{s}</button>)}</div></div>
            {editing.source === 'EXTERNAL' && <div><label className={labelCls}>External clinic / partner</label><PartnerPicker serviceLabel="Imaging" value={{ clinicId: editing.partnerClinicId ?? null, name: editing.externalSource || '' }} onChange={v => setEditing({ ...editing, partnerClinicId: v.clinicId, externalSource: v.name })} /></div>}
          </div>

          {/* Images — multiple per study, each with its own description / notes / diagnosis */}
          <div>
            <label className={labelCls}>Images</label>
            <div className="space-y-3">
              {editing.images.map((im: any, i: number) => {
                const m = imgMeta(im);
                return (
                  <div key={i} className="flex gap-3 p-3 bg-slate-50/60 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-800 rounded-xl">
                    <div className="relative shrink-0">
                      <img src={m.url} onClick={() => setViewer(m.url)} className="w-24 h-24 rounded-lg object-cover border border-slate-200 dark:border-zinc-800 cursor-pointer hover:ring-2 hover:ring-seafoam" />
                      <button onClick={() => removeImg(i)} className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5"><X size={11} /></button>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <input className={fieldCls} value={m.description ?? ''} onChange={e => setImg(i, { description: e.target.value })} placeholder="Image description (e.g. Right lateral view)" />
                      <input className={fieldCls} value={m.diagnosis ?? ''} onChange={e => setImg(i, { diagnosis: e.target.value })} placeholder="Diagnosis / impression" />
                      <textarea rows={2} className={fieldCls} value={m.notes ?? ''} onChange={e => setImg(i, { notes: e.target.value })} placeholder="Notes" />
                    </div>
                  </div>
                );
              })}
              <label className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 cursor-pointer hover:border-seafoam text-[10px] font-black uppercase tracking-widest text-slate-400">
                {uploading ? <Loader2 size={16} className="animate-spin text-seafoam" /> : <ImagePlus size={16} />} Add image
                <input type="file" accept="image/*" className="hidden" onChange={e => addImage(e.target.files?.[0])} />
              </label>
            </div>
          </div>

          <div><label className={labelCls}>Overall findings</label><textarea rows={3} className={fieldCls} value={editing.findings} onChange={e => setEditing({ ...editing, findings: e.target.value })} placeholder="Study-level interpretation / summary…" /></div>
          <div className="flex gap-2"><button onClick={() => setEditing(null)} disabled={saving} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button><button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save study</button></div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">{MODALITIES.map(m => <button key={m.value} onClick={() => setModality(m.value)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${modality === m.value ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>{m.label}</button>)}</div>
            <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, body part, findings" className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" /></div>
          </div>
          {loading ? <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
          : filtered.length === 0 ? <div className="flex flex-col items-center justify-center text-center py-16"><ScanLine size={28} className="text-slate-300 dark:text-zinc-700 mb-3" /><p className="text-sm font-bold text-slate-400">No imaging records</p></div>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(r => (
                <div key={r.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0"><p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{MODALITIES.find(m => m.value === r.modality)?.label ?? r.modality}{r.bodyPart ? ` · ${r.bodyPart}` : ''}</p><p className="text-[10px] text-slate-400 flex items-center gap-1">{r.pet?.name} · {r.studyDate ? formatDate(r.studyDate) : formatDate(r.createdAt)}{r.source === 'EXTERNAL' && <span className="inline-flex items-center gap-0.5 text-indigo-500"><Building2 size={9} /> {r.externalSource || 'External'}</span>}</p></div>
                    <div className="flex gap-1 shrink-0">{r.appointmentId && <button onClick={() => onOpenAppointment?.(r.appointmentId!)} className="p-1.5 rounded-lg text-slate-400 hover:text-seafoam"><ExternalLink size={13} /></button>}<button onClick={() => setSharing(r)} title="Share with partner clinics" className={`p-1.5 rounded-lg hover:text-seafoam ${r.allowedClinicIds && r.allowedClinicIds.length > 0 ? 'text-seafoam' : 'text-slate-400'}`}><Share2 size={13} /></button><button onClick={() => remove(r)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={13} /></button></div>
                  </div>
                  {r.images.length > 0 && <div className="flex gap-1.5 mb-2 flex-wrap">{r.images.slice(0, 4).map((im, i) => <img key={i} src={imgUrl(im)} onClick={() => setViewer(imgUrl(im))} className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-zinc-800 cursor-pointer hover:ring-2 hover:ring-seafoam" />)}{r.images.length > 4 && <span className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black text-slate-400">+{r.images.length - 4}</span>}</div>}
                  {r.findings && <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2">{r.findings}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {viewer && <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6" onClick={() => setViewer(null)}><img src={viewer} className="max-w-full max-h-full rounded-xl" /></div>}

      {sharing && (
        <ShareWithClinics recordType="imaging" recordId={sharing.id} allowedClinicIds={sharing.allowedClinicIds}
          onClose={() => setSharing(null)} onSaved={(ids) => { setRecords(rs => rs.map(x => x.id === sharing.id ? { ...x, allowedClinicIds: ids } : x)); }} />
      )}
    </div>
  );
};

export default ImagingView;
