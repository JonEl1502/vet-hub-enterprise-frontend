import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Slice, Loader2, X, Search, ExternalLink, ImagePlus, CheckCircle2, Clock, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { surgeryAPI, SurgeryRecord } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import ShareWithClinics from '../shared/ShareWithClinics';
import ConsumablePicker from '../shared/ConsumablePicker';

// Render free text as bullet points (one per line) or a paragraph, per the
// record's displayFormat. Shared shape with the client portal so both match.
export const renderFormatted = (text?: string | null, format?: string) => {
  const val = (text || '').trim();
  if (!val) return null;
  if (format === 'BULLET') {
    const lines = val.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    return <ul className="list-disc list-inside space-y-0.5">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
  }
  return <p className="whitespace-pre-wrap leading-relaxed">{val}</p>;
};

interface Props { onOpenAppointment?: (appointmentId: string, settle?: boolean) => void; openForAppointmentId?: string }

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
];
const STATUS_OPTS = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
const statusTone: Record<string, string> = {
  PENDING: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  IN_PROGRESS: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
};
const fieldCls = 'w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5';

const fileToDataUrl = (file: File, max = 1000, quality = 0.7): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) { const s = Math.min(max / width, max / height); width = Math.round(width * s); height = Math.round(height * s); }
        const c = document.createElement('canvas'); c.width = width; c.height = height;
        c.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('decode failed'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

const SurgeryView: React.FC<Props> = ({ onOpenAppointment, openForAppointmentId }) => {
  const { pets } = useData();
  const [records, setRecords] = useState<SurgeryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SurgeryRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await surgeryAPI.list(); if (res.success && res.data) setRecords(res.data.records); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Deep-link: when arrived from a visit's SERVICES category, auto-open this
  // visit's surgery record once records have loaded (consumed once).
  const deepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openForAppointmentId || deepLinkRef.current === openForAppointmentId) return;
    const rec = records.find(r => String(r.appointmentId) === String(openForAppointmentId));
    if (rec) { setEditing(rec); deepLinkRef.current = openForAppointmentId; }
  }, [openForAppointmentId, records]);

  const petName = (r: SurgeryRecord) => r.pet?.name || pets.find((p: any) => String(p.id) === String(r.petId))?.name || 'Patient';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter(r => status === 'all' || r.status === status)
      .filter(r => !q || `${petName(r)} ${r.serviceName}`.toLowerCase().includes(q));
  }, [records, status, search, pets]);

  // Group services by their visit so all surgery services for one appointment
  // sit together in a single card (each service keeps its own settings).
  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; appointmentId: string | null; pet: string; species?: string; date: string; records: SurgeryRecord[] }>();
    for (const r of filtered) {
      const key = r.appointmentId ? `appt:${r.appointmentId}` : `rec:${r.id}`;
      if (!map.has(key)) map.set(key, { key, appointmentId: r.appointmentId, pet: petName(r), species: r.pet?.species ?? undefined, date: r.createdAt, records: [] });
      map.get(key)!.records.push(r);
    }
    return Array.from(map.values());
  }, [filtered, pets]);

  const patch = (p: Partial<SurgeryRecord>) => setEditing(e => e ? { ...e, ...p } : e);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await surgeryAPI.update(editing.id, {
        status: editing.status, anesthesia: editing.anesthesia, procedureNotes: editing.procedureNotes,
        findings: editing.findings, complications: editing.complications, postOpInstructions: editing.postOpInstructions,
        complexity: editing.complexity, displayFormat: editing.displayFormat,
        startedAt: editing.startedAt, endedAt: editing.endedAt, images: editing.images, notes: editing.notes,
      } as any);
      if (res.success && res.data) { toast.success('Surgery record saved'); setEditing(null); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const addImage = async (file: File | null) => {
    if (!file || !editing) return;
    try { const url = await fileToDataUrl(file); patch({ images: [...(editing.images || []), url] }); }
    catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center"><Slice size={22} className="text-rose-600 dark:text-rose-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Surgery</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Procedures performed across visits</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient / procedure" className={`${fieldCls} pl-9 w-56`} />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className={`${fieldCls} w-36`}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <Slice size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-bold">No surgery records.</p>
          <p className="text-xs mt-1">Add a surgery service to a visit and it appears here automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {grouped.map(g => (
            <div key={g.key} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{g.pet}{g.species ? ` · ${g.species}` : ''}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={10} /> {formatDate(g.date)}{g.records.length > 1 ? ` · ${g.records.length} services` : ''}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {g.records.map(r => (
                  <button key={r.id} onClick={() => setEditing(r)} className="w-full text-left bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800 rounded-xl px-3 py-2 hover:border-seafoam transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{r.serviceName}</span>
                        <span className="block text-[9px] text-slate-400">{r.complexity ? `Complexity ${r.complexity}` : 'No complexity set'}{r.images?.length > 0 ? ` · ${r.images.length} img` : ''}</span>
                      </span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${statusTone[r.status] || 'bg-slate-100 text-slate-500'}`}>{r.status.replace('_', ' ')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit drawer */}
      {editing && createPortal((
        <div className="fixed inset-0 z-[700] flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative bg-white dark:bg-zinc-900 w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-gradient-to-br from-rose-700 to-rose-800 text-white p-5 flex items-start justify-between z-10">
              <div className="min-w-0">
                <p className="text-white/60 text-[8px] font-black uppercase tracking-widest">Surgery record</p>
                <h2 className="text-lg font-black truncate flex items-center gap-2"><Slice size={16} /> {editing.serviceName}</h2>
                <p className="text-[10px] text-white/70">{petName(editing)}</p>
              </div>
              <button onClick={() => setEditing(null)} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {editing.appointmentId && onOpenAppointment && (
                  <button onClick={() => onOpenAppointment(editing.appointmentId!)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/20 transition-all">
                    <ExternalLink size={12} /> Linked appointment
                  </button>
                )}
                <button onClick={() => setShowShare(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all">
                  <Share2 size={12} /> Share{editing.allowedClinicIds && editing.allowedClinicIds.length > 0 ? ` · ${editing.allowedClinicIds.length}` : ''}
                </button>
              </div>

              <div>
                <label className={labelCls}>Status</label>
                <div className="flex gap-2">
                  {STATUS_OPTS.map(s => (
                    <button key={s} onClick={() => patch({ status: s })} className={`flex-1 px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${editing.status === s ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{s.replace('_', ' ')}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Started</label><input type="datetime-local" className={fieldCls} value={editing.startedAt ? String(editing.startedAt).slice(0, 16) : ''} onChange={e => patch({ startedAt: e.target.value || null })} /></div>
                <div><label className={labelCls}>Ended</label><input type="datetime-local" className={fieldCls} value={editing.endedAt ? String(editing.endedAt).slice(0, 16) : ''} onChange={e => patch({ endedAt: e.target.value || null })} /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Complexity</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => patch({ complexity: editing.complexity === n ? null : n })}
                        className={`flex-1 py-2 rounded-lg text-xs font-black border transition-all ${editing.complexity === n ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notes format</label>
                  <div className="flex gap-1.5">
                    {['PARAGRAPH', 'BULLET'].map(f => (
                      <button key={f} onClick={() => patch({ displayFormat: f })}
                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${(editing.displayFormat || 'PARAGRAPH') === f ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{f === 'BULLET' ? 'Bullets' : 'Paragraph'}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div><label className={labelCls}>Anesthesia</label><textarea className={fieldCls} rows={2} value={editing.anesthesia ?? ''} onChange={e => patch({ anesthesia: e.target.value })} placeholder="Agent, dose, monitoring" /></div>
              <div><label className={labelCls}>Procedure notes</label><textarea className={fieldCls} rows={3} value={editing.procedureNotes ?? ''} onChange={e => patch({ procedureNotes: e.target.value })} placeholder="Approach, technique, steps" /></div>
              <div><label className={labelCls}>Findings</label><textarea className={fieldCls} rows={2} value={editing.findings ?? ''} onChange={e => patch({ findings: e.target.value })} /></div>
              <div><label className={labelCls}>Complications</label><textarea className={fieldCls} rows={2} value={editing.complications ?? ''} onChange={e => patch({ complications: e.target.value })} placeholder="None" /></div>
              <div><label className={labelCls}>Post-op instructions</label><textarea className={fieldCls} rows={2} value={editing.postOpInstructions ?? ''} onChange={e => patch({ postOpInstructions: e.target.value })} placeholder="Rest, meds, recheck, suture removal" /></div>

              {/* Medications & consumables used — deduct stock (fractional ok) +
                  bill, scoped to this surgery service. */}
              {editing.appointmentId && (
                <ConsumablePicker appointmentId={editing.appointmentId} serviceTag={`surgery:${editing.id}`} title="Medications & consumables used" />
              )}

              <div>
                <label className={labelCls}>Images</label>
                <div className="flex flex-wrap gap-2">
                  {(editing.images || []).map((u, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 group">
                      <img src={u} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => patch({ images: editing.images.filter((_, idx) => idx !== i) })} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X size={10} className="text-white" /></button>
                    </div>
                  ))}
                  <label className="w-16 h-16 rounded-lg border border-dashed border-slate-300 dark:border-zinc-700 flex items-center justify-center cursor-pointer hover:border-seafoam bg-slate-50 dark:bg-zinc-800">
                    <input type="file" accept="image/*" className="hidden" onChange={e => addImage(e.target.files?.[0] ?? null)} />
                    <ImagePlus size={16} className="text-slate-400" />
                  </label>
                </div>
              </div>

              <button onClick={save} disabled={saving} className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Save record
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {showShare && editing && (
        <ShareWithClinics recordType="surgery" recordId={editing.id} allowedClinicIds={editing.allowedClinicIds}
          onClose={() => setShowShare(false)} onSaved={(ids) => setEditing(e => e ? { ...e, allowedClinicIds: ids } : e)} />
      )}
    </div>
  );
};

export default SurgeryView;
