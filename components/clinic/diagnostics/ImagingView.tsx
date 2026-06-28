import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScanLine, Plus, Loader2, Trash2, X, Search, ExternalLink, Building2, ImagePlus, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { imagingAPI, ImagingRecord, ImagingImage, ImagingModality, DiagSource } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import ShareWithClinics from '../shared/ShareWithClinics';
import PartnerPicker from '../shared/PartnerPicker';
import { recordSharingAPI, visitsAPI, dialog } from '../../../services';
import { useStaff } from '../../../contexts/StaffContext';
import ImagingDrawer from './ImagingDrawer';

interface Props { onOpenAppointment?: (appointmentId: string, settle?: boolean) => void; openForAppointmentId?: string }

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

const ImagingView: React.FC<Props> = ({ onOpenAppointment, openForAppointmentId }) => {
  const { pets, appointments } = useData() as any;
  const { staff } = useStaff();
  const vets = useMemo(() => (staff || []).filter((s: any) => ['VET', 'STAFF', 'CLINIC_OWNER'].includes(s.role)), [staff]);
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
  const [drawerRec, setDrawerRec] = useState<ImagingRecord | null>(null);
  const [apptSearch, setApptSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await imagingAPI.list({ modality: modality === 'all' ? undefined : modality }); if (res.success && res.data) setRecords(res.data.records); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [modality]);
  useEffect(() => { load(); }, [load]);

  // Deep-link: auto-open this visit's imaging record when arrived from a visit's
  // SERVICES category header (consumed once after records load).
  const deepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openForAppointmentId || deepLinkRef.current === openForAppointmentId) return;
    const rec = records.find(r => String(r.appointmentId) === String(openForAppointmentId));
    if (rec) { setDrawerRec(rec); deepLinkRef.current = openForAppointmentId; }
  }, [openForAppointmentId, records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r => `${r.pet?.name ?? ''} ${r.bodyPart ?? ''} ${r.findings ?? ''}`.toLowerCase().includes(q));
  }, [records, search]);

  // Combine a single patient's studies into one card (mirrors the Lab/Surgery pages).
  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; pet: string; species?: string; records: ImagingRecord[] }>();
    for (const r of filtered) {
      const key = r.petId ? `pet:${r.petId}` : `rec:${r.id}`;
      if (!map.has(key)) map.set(key, { key, pet: r.pet?.name || 'Patient', species: (r.pet as any)?.species, records: [] });
      map.get(key)!.records.push(r);
    }
    return Array.from(map.values());
  }, [filtered]);

  const petMatches = useMemo(() => { const q = petSearch.trim().toLowerCase(); if (!q) return [] as any[]; return pets.filter((p: any) => p.name?.toLowerCase().includes(q)).slice(0, 8); }, [pets, petSearch]);

  // Prior visits for the selected patient — for follow-ups, the study links to an
  // existing appointment instead of spinning up a new walk-in visit.
  const priorVisits = useMemo(() => {
    if (!editing?.petId) return [] as any[];
    const q = apptSearch.trim().toLowerCase();
    return (appointments || [])
      .filter((a: any) => String(a.petId) === String(editing.petId))
      .filter((a: any) => !q || `${formatDate(a.date)} ${a.encounterType ?? ''} ${(a.tasks || []).map((t: any) => t.category).join(' ')}`.toLowerCase().includes(q))
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12);
  }, [appointments, editing?.petId, apptSearch]);

  // linkMode: 'new' = create a walk-in visit · 'existing' = link to a prior visit
  // (follow-up) · 'none' = standalone study with no visit.
  const startNew = () => { setEditing({ petId: null, petName: '', source: 'INTERNAL' as DiagSource, externalSource: '', partnerClinicId: null, modality: 'XRAY' as ImagingModality, bodyPartSel: '', bodyPart: '', findings: '', studyDate: new Date().toISOString().slice(0, 10), images: [] as ImagingImage[], linkMode: 'new', linkApptId: null, linkApptLabel: '', leadStaffId: null as number | null }); setPetSearch(''); setApptSearch(''); };

  // Each uploaded image is its own record with description/notes/diagnosis.
  const addImage = async (file?: File) => { if (!file) return; setUploading(true); try { const url = await downscale(file); setEditing((d: any) => ({ ...d, images: [...d.images, { url, description: '', notes: '', diagnosis: '' }] })); } catch { toast.error('Image failed'); } finally { setUploading(false); } };
  const setImg = (i: number, patch: Partial<ImagingImage>) => setEditing((d: any) => ({ ...d, images: d.images.map((im: any, j: number) => j === i ? { ...imgMeta(im), ...patch } : im) }));
  const removeImg = (i: number) => setEditing((d: any) => ({ ...d, images: d.images.filter((_: any, j: number) => j !== i) }));

  const save = async () => {
    if (!editing.petId) { toast.error('Select a patient'); return; }
    if (!editing.bodyPart?.trim()) { toast.error('Body part is required'); return; }
    if (editing.linkMode === 'existing' && !editing.linkApptId) { toast.error('Select a previous visit to link, or pick another option'); return; }
    setSaving(true);
    try {
      // Link the study to a visit per linkMode: reuse a prior visit (follow-up),
      // spin up a new walk-in visit, or leave it standalone.
      let appointmentId: string | undefined;
      if (editing.linkMode === 'existing' && editing.linkApptId) {
        appointmentId = String(editing.linkApptId);
      } else if (editing.linkMode === 'new') {
        const pet = pets.find((p: any) => String(p.id) === String(editing.petId));
        if (pet?.ownerId) {
          const now = new Date();
          const apptRes = await visitsAPI.create({
            clientId: pet.ownerId, petId: editing.petId,
            apptDate: now.toISOString().slice(0, 10), apptTime: now.toTimeString().slice(0, 5),
            encounterType: 'VET_VISIT', visitType: 'CONSULTATION', leadStaffId: editing.leadStaffId || undefined,
            totalCost: 0,
            tasks: [{ id: Math.floor(Math.random() * 1e6), name: `${editing.modality}${editing.bodyPart ? ' · ' + editing.bodyPart : ''}`, category: 'Imaging', status: 'PENDING', price: 0, assignedStaffId: editing.leadStaffId || undefined }],
          } as any);
          appointmentId = (apptRes.data as any)?.appointment?.id;
        }
      }
      const res = await imagingAPI.create({ petId: editing.petId, appointmentId, source: editing.source, externalSource: editing.externalSource || undefined, modality: editing.modality, bodyPart: editing.bodyPart.trim(), findings: editing.findings || undefined, studyDate: editing.studyDate || undefined, images: editing.images } as any);
      if (res.success) {
        const newId = (res.data as any)?.record?.id;
        if (newId && editing.partnerClinicId) { await recordSharingAPI.setShares('imaging', newId, [editing.partnerClinicId]).catch(() => {}); }
        toast.success('Imaging saved'); setEditing(null); await load();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const remove = async (r: ImagingRecord) => { const ok = await dialog.confirmDelete({ title: 'Delete imaging record', message: 'This permanently removes the study.', entityName: `${r.modality}${r.bodyPart ? ' · ' + r.bodyPart : ''}` }); if (!ok) return; try { const res = await imagingAPI.remove(r.id); if (res.success) { toast.success('Deleted'); await load(); } } catch (e: any) { toast.error(e?.message || 'Failed'); } };

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
            {editing.petId ? <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl"><span className="text-sm font-bold text-pine dark:text-zinc-100">{editing.petName}</span><button onClick={() => { setEditing({ ...editing, petId: null, petName: '', linkApptId: null, linkApptLabel: '' }); setApptSearch(''); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500">Change</button></div>
            : <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${fieldCls} pl-9`} placeholder="Search patient…" value={petSearch} onChange={e => setPetSearch(e.target.value)} />{petMatches.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">{petMatches.map((p: any) => <button key={p.id} onClick={() => { setEditing({ ...editing, petId: p.id, petName: p.name, linkApptId: null, linkApptLabel: '' }); setPetSearch(''); setApptSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-pine dark:text-zinc-100">{p.name} <span className="text-slate-400 text-xs">{p.species}</span></button>)}</div>}</div>}
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
          {/* Link this study to a visit: a new walk-in, a prior visit (follow-up), or none. */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/30 p-3 space-y-2.5">
            <label className={labelCls}>Link to visit</label>
            <div className="flex flex-wrap bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-max">
              {[{ v: 'new', l: 'New walk-in' }, { v: 'existing', l: 'Previous visit' }, { v: 'none', l: 'No visit' }].map(o => (
                <button key={o.v} type="button" onClick={() => setEditing({ ...editing, linkMode: o.v, ...(o.v !== 'existing' ? { linkApptId: null, linkApptLabel: '' } : {}) })}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${editing.linkMode === o.v ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>{o.l}</button>
              ))}
            </div>

            {editing.linkMode === 'new' && (
              <div>
                <label className={labelCls}>Assign staff (lead)</label>
                <select className={fieldCls} value={editing.leadStaffId ?? ''} onChange={e => setEditing({ ...editing, leadStaffId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Unassigned</option>
                  {vets.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.role ? ` · ${s.role}` : ''}</option>)}
                </select>
              </div>
            )}

            {editing.linkMode === 'existing' && (
              !editing.petId ? (
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">Select a patient above to see their previous visits.</p>
              ) : editing.linkApptId ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl">
                  <span className="text-sm font-bold text-pine dark:text-zinc-100 truncate">{editing.linkApptLabel}</span>
                  <button onClick={() => setEditing({ ...editing, linkApptId: null, linkApptLabel: '' })} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 shrink-0">Change</button>
                </div>
              ) : (
                <div>
                  <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${fieldCls} pl-9`} placeholder="Search previous visits (date, type)…" value={apptSearch} onChange={e => setApptSearch(e.target.value)} /></div>
                  <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
                    {priorVisits.length === 0 ? <p className="px-3 py-2.5 text-[11px] text-slate-400">No previous visits for this patient.</p>
                    : priorVisits.map((a: any) => {
                      const cats = Array.from(new Set((a.tasks || []).map((t: any) => t.category).filter(Boolean))).slice(0, 3).join(', ');
                      const label = `${formatDate(a.date)} · ${(a.encounterType || 'VET_VISIT').replace('_', ' ')}${cats ? ` · ${cats}` : ''}`;
                      return (
                        <button key={a.id} type="button" onClick={() => setEditing({ ...editing, linkApptId: a.id, linkApptLabel: label })}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800">
                          <span className="block font-bold text-pine dark:text-zinc-100">{formatDate(a.date)} <span className="text-slate-400 font-medium">· {(a.encounterType || 'VET_VISIT').replace('_', ' ')}</span></span>
                          {cats && <span className="block text-[10px] text-slate-400">{cats}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
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
              {grouped.map(g => (
                <div key={g.key} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{g.pet}{g.species ? ` · ${g.species}` : ''}</p>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">{g.records.length} stud{g.records.length === 1 ? 'y' : 'ies'}</span>
                  </div>
                  <div className="space-y-1.5">
                    {g.records.map(r => (
                      <button key={r.id} onClick={() => setDrawerRec(r)} className="w-full text-left bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800 rounded-xl px-3 py-2 hover:border-seafoam transition-all">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{MODALITIES.find(m => m.value === r.modality)?.label ?? r.modality}{r.bodyPart ? ` · ${r.bodyPart}` : ''}</span>
                            <span className="text-[9px] text-slate-400 flex items-center gap-1">{r.studyDate ? formatDate(r.studyDate) : formatDate(r.createdAt)}{r.images?.length > 0 ? ` · ${r.images.length} img` : ''}{r.source === 'EXTERNAL' && <span className="inline-flex items-center gap-0.5 text-indigo-500"><Building2 size={9} /> {r.externalSource || 'External'}</span>}</span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            {r.status && <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${r.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}>{r.status.toLowerCase().replace('_', ' ')}</span>}
                            {r.appointmentId && <span onClick={(e) => { e.stopPropagation(); onOpenAppointment?.(r.appointmentId!); }} title="Open visit" className="p-1 rounded text-slate-400 hover:text-seafoam cursor-pointer"><ExternalLink size={12} /></span>}
                            <span onClick={(e) => { e.stopPropagation(); setSharing(r); }} title="Share" className={`p-1 rounded hover:text-seafoam cursor-pointer ${r.allowedClinicIds && r.allowedClinicIds.length > 0 ? 'text-seafoam' : 'text-slate-400'}`}><Share2 size={12} /></span>
                            <span onClick={(e) => { e.stopPropagation(); remove(r); }} title="Delete" className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"><Trash2 size={12} /></span>
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {viewer && <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6" onClick={() => setViewer(null)}><img src={viewer} className="max-w-full max-h-full rounded-xl" /></div>}

      <ImagingDrawer record={drawerRec} onClose={() => setDrawerRec(null)} onChanged={load} onOpenAppointment={onOpenAppointment} />

      {sharing && (
        <ShareWithClinics recordType="imaging" recordId={sharing.id} allowedClinicIds={sharing.allowedClinicIds}
          onClose={() => setSharing(null)} onSaved={(ids) => { setRecords(rs => rs.map(x => x.id === sharing.id ? { ...x, allowedClinicIds: ids } : x)); }} />
      )}
    </div>
  );
};

export default ImagingView;
