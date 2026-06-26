import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FlaskConical, Plus, Loader2, Trash2, X, Search, ExternalLink, Building2, Share2, FileText, Upload } from 'lucide-react';
import ShareWithClinics from '../shared/ShareWithClinics';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { labAPI, LabRecord, LabMarker, DiagSource } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props { onOpenAppointment?: (appointmentId: string) => void }

const SOURCES = [{ value: 'all', label: 'All' }, { value: 'INTERNAL', label: 'Internal' }, { value: 'EXTERNAL', label: 'External' }];
const FLAGS = ['', 'LOW', 'NORMAL', 'HIGH'];
const flagTone: Record<string, string> = { LOW: 'text-amber-600', HIGH: 'text-rose-600', NORMAL: 'text-emerald-600', '': 'text-slate-400' };

const LaboratoryView: React.FC<Props> = ({ onOpenAppointment }) => {
  const { pets } = useData();
  const [records, setRecords] = useState<LabRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [sharing, setSharing] = useState<LabRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [petSearch, setPetSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await labAPI.list({ source: source === 'all' ? undefined : source }); if (res.success && res.data) setRecords(res.data.records); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [source]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r => `${r.pet?.name ?? ''} ${r.panelName} ${r.externalSource ?? ''}`.toLowerCase().includes(q));
  }, [records, search]);

  const petMatches = useMemo(() => {
    const q = petSearch.trim().toLowerCase();
    if (!q) return [] as any[];
    return pets.filter((p: any) => p.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [pets, petSearch]);

  const startNew = () => { setEditing({ petId: null, petName: '', source: 'INTERNAL' as DiagSource, externalSource: '', panelName: '', testType: '', specimen: '', attachments: [] as any[], resultDate: new Date().toISOString().slice(0, 10), notes: '', markers: [{ name: '', value: '', unit: '', refRange: '', flag: '' }] }); setPetSearch(''); };

  const addAttachment = async (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditing((d: any) => ({ ...d, attachments: [...(d.attachments || []), { url: reader.result as string, name: file.name, kind: file.type.startsWith('image/') ? 'IMAGE' : 'DOC' }] }));
    reader.readAsDataURL(file);
  };
  const setMarker = (i: number, patch: Partial<LabMarker>) => setEditing((d: any) => ({ ...d, markers: d.markers.map((m: any, j: number) => j === i ? { ...m, ...patch } : m) }));

  const save = async () => {
    if (!editing.petId) { toast.error('Select a patient'); return; }
    if (!editing.panelName.trim()) { toast.error('Panel name is required'); return; }
    setSaving(true);
    try {
      const res = await labAPI.create({
        petId: editing.petId, source: editing.source, externalSource: editing.externalSource || undefined,
        panelName: editing.panelName.trim(), testType: editing.testType || undefined, specimen: editing.specimen || undefined,
        attachments: editing.attachments || [], resultDate: editing.resultDate || undefined, notes: editing.notes || undefined,
        markers: editing.markers.filter((m: LabMarker) => m.name.trim()),
      } as any);
      if (res.success) { toast.success('Lab record saved'); setEditing(null); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const remove = async (r: LabRecord) => { if (!confirm('Delete this lab record?')) return; try { const res = await labAPI.remove(r.id); if (res.success) { toast.success('Deleted'); await load(); } } catch (e: any) { toast.error(e?.message || 'Failed'); } };

  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
  const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-100 dark:bg-cyan-900/20 flex items-center justify-center"><FlaskConical size={22} className="text-cyan-600 dark:text-cyan-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Laboratory</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{filtered.length} record{filtered.length === 1 ? '' : 's'} · internal & partner labs</p>
          </div>
        </div>
        {!editing && <button onClick={startNew} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> New result</button>}
      </div>

      {editing ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 max-w-2xl">
          <div className="flex items-center justify-between"><h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">New lab result</h2><button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"><X size={18} /></button></div>
          <div>
            <label className={labelCls}>Patient *</label>
            {editing.petId ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl"><span className="text-sm font-bold text-pine dark:text-zinc-100">{editing.petName}</span><button onClick={() => setEditing({ ...editing, petId: null, petName: '' })} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500">Change</button></div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${fieldCls} pl-9`} placeholder="Search patient…" value={petSearch} onChange={e => setPetSearch(e.target.value)} />
                {petMatches.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">{petMatches.map((p: any) => <button key={p.id} onClick={() => { setEditing({ ...editing, petId: p.id, petName: p.name }); setPetSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-pine dark:text-zinc-100">{p.name} <span className="text-slate-400 text-xs">{p.species}</span></button>)}</div>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Panel / test *</label><input className={fieldCls} value={editing.panelName} onChange={e => setEditing({ ...editing, panelName: e.target.value })} placeholder="CBC, Chemistry…" /></div>
            <div><label className={labelCls}>Result date</label><input type="date" className={fieldCls} value={editing.resultDate} onChange={e => setEditing({ ...editing, resultDate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Test type</label><input className={fieldCls} value={editing.testType} onChange={e => setEditing({ ...editing, testType: e.target.value })} placeholder="Haematology, Serology, Cytology…" /></div>
            <div><label className={labelCls}>Specimen required</label><input className={fieldCls} value={editing.specimen} onChange={e => setEditing({ ...editing, specimen: e.target.value })} placeholder="EDTA blood, Serum, Urine, Swab…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Source</label>
              <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-max">
                {(['INTERNAL', 'EXTERNAL'] as DiagSource[]).map(s => <button key={s} onClick={() => setEditing({ ...editing, source: s })} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${editing.source === s ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>{s}</button>)}
              </div>
            </div>
            {editing.source === 'EXTERNAL' && <div><label className={labelCls}>External lab / clinic</label><input className={fieldCls} value={editing.externalSource} onChange={e => setEditing({ ...editing, externalSource: e.target.value })} placeholder="Partner clinic name" /></div>}
          </div>
          <div>
            <label className={labelCls}>Markers</label>
            <div className="space-y-1.5">
              {editing.markers.map((m: LabMarker, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-1.5">
                  <input className={`${fieldCls} col-span-4`} placeholder="Marker" value={m.name} onChange={e => setMarker(i, { name: e.target.value })} />
                  <input className={`${fieldCls} col-span-2`} placeholder="Value" value={m.value} onChange={e => setMarker(i, { value: e.target.value })} />
                  <input className={`${fieldCls} col-span-2`} placeholder="Unit" value={m.unit} onChange={e => setMarker(i, { unit: e.target.value })} />
                  <input className={`${fieldCls} col-span-2`} placeholder="Ref" value={m.refRange} onChange={e => setMarker(i, { refRange: e.target.value })} />
                  <select className={`${fieldCls} col-span-2`} value={m.flag} onChange={e => setMarker(i, { flag: e.target.value as any })}>{FLAGS.map(f => <option key={f} value={f}>{f || '—'}</option>)}</select>
                </div>
              ))}
            </div>
            <button onClick={() => setEditing({ ...editing, markers: [...editing.markers, { name: '', value: '', unit: '', refRange: '', flag: '' }] })} className="mt-2 text-[10px] font-black uppercase tracking-widest text-seafoam">+ Add marker</button>
          </div>
          <div>
            <label className={labelCls}>Attachments (report doc / image)</label>
            <div className="flex flex-wrap gap-2">
              {(editing.attachments || []).map((a: any, i: number) => (
                <div key={i} className="relative flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg">
                  {a.kind === 'IMAGE' ? <img src={a.url} className="w-8 h-8 rounded object-cover" /> : <FileText size={16} className="text-slate-400" />}
                  <span className="text-[11px] font-bold text-pine dark:text-zinc-100 max-w-[120px] truncate">{a.name || 'file'}</span>
                  <button onClick={() => setEditing({ ...editing, attachments: editing.attachments.filter((_: any, j: number) => j !== i) })} className="text-slate-400 hover:text-rose-500"><X size={12} /></button>
                </div>
              ))}
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-slate-200 dark:border-zinc-700 cursor-pointer hover:border-seafoam text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Upload size={14} /> Add file
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => addAttachment(e.target.files?.[0])} />
              </label>
            </div>
          </div>
          <div><label className={labelCls}>Observations / notes</label><textarea rows={2} className={fieldCls} value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} placeholder="Result observations, interpretation…" /></div>
          <div className="flex gap-2"><button onClick={() => setEditing(null)} disabled={saving} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button><button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save result</button></div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">{SOURCES.map(s => <button key={s.value} onClick={() => setSource(s.value)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${source === s.value ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>{s.label}</button>)}</div>
            <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, panel, lab" className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" /></div>
          </div>
          {loading ? <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
          : filtered.length === 0 ? <div className="flex flex-col items-center justify-center text-center py-16"><FlaskConical size={28} className="text-slate-300 dark:text-zinc-700 mb-3" /><p className="text-sm font-bold text-slate-400">No lab records</p></div>
          : (
            <div className="space-y-2">
              {filtered.map(r => (
                <div key={r.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{r.panelName} <span className="text-slate-400 font-medium">· {r.pet?.name}</span></p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-2">{r.resultDate ? formatDate(r.resultDate) : formatDate(r.createdAt)}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${r.source === 'EXTERNAL' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>{r.source === 'EXTERNAL' ? <span className="inline-flex items-center gap-0.5"><Building2 size={9} /> {r.externalSource || 'External'}</span> : 'Internal'}</span>
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {r.appointmentId && <button onClick={() => onOpenAppointment?.(r.appointmentId!)} title="Open visit" className="p-1.5 rounded-lg text-slate-400 hover:text-seafoam hover:bg-slate-100 dark:hover:bg-zinc-800"><ExternalLink size={13} /></button>}
                      <button onClick={() => setSharing(r)} title="Share with partner clinics" className={`p-1.5 rounded-lg hover:text-seafoam hover:bg-slate-100 dark:hover:bg-zinc-800 ${r.allowedClinicIds && r.allowedClinicIds.length > 0 ? 'text-seafoam' : 'text-slate-400'}`}><Share2 size={13} /></button>
                      <button onClick={() => remove(r)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {r.markers.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      {r.markers.map((m, i) => <span key={i} className="text-slate-500 dark:text-zinc-400"><b className="text-pine dark:text-zinc-200">{m.name}</b> {m.value}{m.unit ? ` ${m.unit}` : ''}{m.flag ? <b className={`ml-0.5 ${flagTone[m.flag] ?? ''}`}>{m.flag === 'HIGH' ? '↑' : m.flag === 'LOW' ? '↓' : ''}</b> : ''}{m.refRange ? <span className="text-slate-300"> ({m.refRange})</span> : ''}</span>)}
                    </div>
                  )}
                  {r.notes && <p className="text-[11px] text-slate-400 mt-1.5">{r.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {sharing && (
        <ShareWithClinics recordType="lab" recordId={sharing.id} allowedClinicIds={sharing.allowedClinicIds}
          onClose={() => setSharing(null)} onSaved={(ids) => { setRecords(rs => rs.map(x => x.id === sharing.id ? { ...x, allowedClinicIds: ids } : x)); }} />
      )}
    </div>
  );
};

export default LaboratoryView;
