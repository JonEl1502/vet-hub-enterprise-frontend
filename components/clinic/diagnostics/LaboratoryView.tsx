import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FlaskConical, Plus, Loader2, Trash2, X, Search, ExternalLink, Building2, Share2, FileText, Upload, Clock } from 'lucide-react';
import ShareWithClinics from '../shared/ShareWithClinics';
import PartnerPicker from '../shared/PartnerPicker';
import LabRecordPage from './LabRecordPage';
import { recordSharingAPI, visitsAPI, dialog } from '../../../services';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { useClinic } from '../../../contexts/ClinicContext';
import { useStaff } from '../../../contexts/StaffContext';
import { labAPI, LabRecord, LabMarker, DiagSource } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

interface Props { onOpenAppointment?: (appointmentId: string, settle?: boolean) => void; openForAppointmentId?: string }

const SOURCES = [{ value: 'all', label: 'All' }, { value: 'INTERNAL', label: 'Internal' }, { value: 'EXTERNAL', label: 'External' }, { value: 'INCOMING', label: '📥 Incoming' }];
const FLAGS = ['', 'LOW', 'NORMAL', 'HIGH'];
const flagTone: Record<string, string> = { LOW: 'text-amber-600', HIGH: 'text-rose-600', NORMAL: 'text-emerald-600', '': 'text-slate-400' };

const LaboratoryView: React.FC<Props> = ({ onOpenAppointment, openForAppointmentId }) => {
  const { pets } = useData();
  const { selectedClinicIds } = useClinic();
  // Shared TO us by another clinic (pet transfer / partner send-out) — the
  // receiving side works it right here, in its own workflow.
  const isIncoming = (r: LabRecord) => selectedClinicIds.length > 0 && !selectedClinicIds.includes(String(r.clinicId));
  const { staff } = useStaff();
  const vets = useMemo(() => (staff || []).filter((s: any) => ['VET', 'STAFF', 'CLINIC_OWNER'].includes(s.role)), [staff]);
  const [records, setRecords] = useState<LabRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [sharing, setSharing] = useState<LabRecord | null>(null);
  // Full-page record detail (was a right-side drawer) — better space for
  // markers, attachments and result entry.
  const [pageRecId, setPageRecId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [petSearch, setPetSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await labAPI.list({ source: source === 'all' || source === 'INCOMING' ? undefined : source }); if (res.success && res.data) setRecords(res.data.records); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [source]);
  useEffect(() => { load(); }, [load]);

  // Deep-link: auto-open this visit's lab record when arrived from a visit's
  // SERVICES category header (consumed once after records load).
  const deepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openForAppointmentId || deepLinkRef.current === openForAppointmentId) return;
    const rec = records.find(r => String(r.appointmentId) === String(openForAppointmentId));
    if (rec) { setPageRecId(rec.id); deepLinkRef.current = openForAppointmentId; }
  }, [openForAppointmentId, records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = source === 'INCOMING' ? records.filter(isIncoming) : records;
    if (!q) return list;
    return list.filter(r => `${r.pet?.name ?? ''} ${r.panelName} ${r.externalSource ?? ''}`.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, search, source, selectedClinicIds]);

  // Group panels/tests by their visit so all of a patient's lab work for one
  // visit sits in a single card (mirrors the Surgery page).
  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; pet: string; species?: string; date: string; records: LabRecord[] }>();
    for (const r of filtered) {
      const key = r.appointmentId ? `appt:${r.appointmentId}` : `rec:${r.id}`;
      if (!map.has(key)) map.set(key, { key, pet: r.pet?.name || 'Patient', species: (r.pet as any)?.species, date: r.resultDate || r.createdAt, records: [] });
      map.get(key)!.records.push(r);
    }
    return Array.from(map.values());
  }, [filtered]);

  const petMatches = useMemo(() => {
    const q = petSearch.trim().toLowerCase();
    if (!q) return [] as any[];
    return pets.filter((p: any) => p.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [pets, petSearch]);

  const startNew = () => { setEditing({ petId: null, petName: '', source: 'INTERNAL' as DiagSource, direction: 'RECEIVED' as 'RECEIVED' | 'SENT', externalSource: '', partnerClinicId: null, panelName: '', testType: '', specimen: '', attachments: [] as any[], createVisit: true, leadStaffId: null as number | null, resultDate: new Date().toISOString().slice(0, 10), notes: '', markers: [{ name: '', value: '', unit: '', refRange: '', flag: '' }] }); setPetSearch(''); };

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
      // Optionally spin up a walk-in visit + assign staff, and link this record to it.
      let appointmentId: string | undefined;
      if (editing.createVisit) {
        const pet = pets.find((p: any) => String(p.id) === String(editing.petId));
        if (pet?.ownerId) {
          const now = new Date();
          const apptRes = await visitsAPI.create({
            clientId: pet.ownerId, petId: editing.petId,
            apptDate: now.toISOString().slice(0, 10), apptTime: now.toTimeString().slice(0, 5),
            encounterType: 'VET_VISIT', visitType: 'CONSULTATION', leadStaffId: editing.leadStaffId || undefined,
            totalCost: 0,
            tasks: [{ id: Math.floor(Math.random() * 1e6), name: editing.panelName.trim(), category: 'Laboratory', status: 'PENDING', price: 0, assignedStaffId: editing.leadStaffId || undefined }],
          } as any);
          appointmentId = (apptRes.data as any)?.appointment?.id;
        }
      }
      const res = await labAPI.create({
        petId: editing.petId, appointmentId, source: editing.source, externalSource: editing.externalSource || undefined,
        // Sent OUT to a partner → starts ORDERED; their results flip it to
        // RESULTED on this same shared record. Received/internal → RESULTED.
        status: editing.source === 'EXTERNAL' && editing.direction === 'SENT' ? 'ORDERED' : undefined,
        panelName: editing.panelName.trim(), testType: editing.testType || undefined, specimen: editing.specimen || undefined,
        attachments: editing.attachments || [], resultDate: editing.resultDate || undefined, notes: editing.notes || undefined,
        markers: editing.markers.filter((m: LabMarker) => m.name.trim()),
      } as any);
      if (res.success) {
        // External partner chosen → share this record with them so they can fill results.
        const newId = (res.data as any)?.record?.id;
        if (newId && editing.partnerClinicId) {
          await recordSharingAPI.setShares('lab', newId, [editing.partnerClinicId]).catch(() => {});
        }
        toast.success('Lab record saved'); setEditing(null); await load();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const remove = async (r: LabRecord) => { const ok = await dialog.confirmDelete({ title: 'Delete lab record', message: 'This permanently removes the result.', entityName: r.panelName }); if (!ok) return; try { const res = await labAPI.remove(r.id); if (res.success) { toast.success('Deleted'); await load(); } } catch (e: any) { toast.error(e?.message || 'Failed'); } };

  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
  const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

  // Full-page record detail replaces the whole list while open.
  const pageRec = pageRecId ? records.find(r => r.id === pageRecId) : null;
  if (pageRec) {
    return (
      <LabRecordPage
        record={pageRec}
        onBack={() => setPageRecId(null)}
        onChanged={load}
        onOpenAppointment={onOpenAppointment}
      />
    );
  }

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
        {/* New result — hidden per request; results are created from the visit/module flow. */}
        {false && !editing && <button onClick={startNew} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> New result</button>}
      </div>

      {editing ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
            <X size={13} /> Laboratory
          </button>
          {/* Header banner — emerald/teal, matching the lab record page. */}
          <div className="bg-gradient-to-br from-emerald-700 to-teal-600 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
            <div className="p-3 bg-white/15 rounded-2xl"><FlaskConical size={24} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">New lab record</p>
              <h1 className="text-xl font-black tracking-tight truncate">{editing.petName || 'New Lab Work'}</h1>
              <p className="text-[11px] text-white/70 truncate">
                {editing.source === 'EXTERNAL'
                  ? (editing.direction === 'SENT' ? `Sending out${editing.externalSource ? ` to ${editing.externalSource}` : ' to a partner lab'}` : `Results received${editing.externalSource ? ` from ${editing.externalSource}` : ' from an external lab'}`)
                  : 'Performed in-house'}
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
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
            {editing.source === 'EXTERNAL' && (
              <div>
                <label className={labelCls}>Direction</label>
                <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-max">
                  {([
                    { v: 'SENT', l: '📤 Sending out' },
                    { v: 'RECEIVED', l: '📥 Results received' },
                  ] as const).map(d => (
                    <button key={d.v} onClick={() => setEditing({ ...editing, direction: d.v })}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${editing.direction === d.v ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {editing.source === 'EXTERNAL' && (
            <div>
              <label className={labelCls}>External lab / partner</label>
              <PartnerPicker serviceLabel="Laboratory" value={{ clinicId: editing.partnerClinicId ?? null, name: editing.externalSource || '' }} onChange={v => setEditing({ ...editing, partnerClinicId: v.clinicId, externalSource: v.name })} />
              {editing.direction === 'SENT' && (
                <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                  {editing.partnerClinicId
                    ? 'The record is shared with the partner — their results appear right here once they fill them in.'
                    : 'Pick a connected partner so they can fill the results into this record; free-text labs are tracked but can’t post results.'}
                </p>
              )}
            </div>
          )}
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
          {/* Walk-in: also create a visit and assign staff, linked to this record. */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/30 p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editing.createVisit} onChange={e => setEditing({ ...editing, createVisit: e.target.checked })} className="accent-seafoam" />
              <span className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">Create a walk-in visit for this</span>
            </label>
            {editing.createVisit && (
              <div>
                <label className={labelCls}>Assign staff (lead)</label>
                <select className={fieldCls} value={editing.leadStaffId ?? ''} onChange={e => setEditing({ ...editing, leadStaffId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Unassigned</option>
                  {vets.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.role ? ` · ${s.role}` : ''}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2"><button onClick={() => setEditing(null)} disabled={saving} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button><button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {editing.source === 'EXTERNAL' && editing.direction === 'SENT' ? 'Send to partner' : 'Save result'}</button></div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">{SOURCES.map(s => <button key={s.value} onClick={() => setSource(s.value)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${source === s.value ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>{s.label}</button>)}</div>
            <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, panel, lab" className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" /></div>
          </div>
          {loading ? <div className="py-16"><LoadingSpinner size="lg" message="Loading lab records..." /></div>
          : filtered.length === 0 ? <div className="flex flex-col items-center justify-center text-center py-16"><FlaskConical size={28} className="text-slate-300 dark:text-zinc-700 mb-3" /><p className="text-sm font-bold text-slate-400">No lab records</p></div>
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {grouped.map(g => (
                <div key={g.key} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{g.pet}{g.species ? ` · ${g.species}` : ''}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={10} /> {formatDate(g.date)}{g.records.length > 1 ? ` · ${g.records.length} tests` : ''}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {g.records.map(r => (
                      <div key={r.id} onClick={() => setPageRecId(r.id)} className="w-full text-left bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800 rounded-xl px-3 py-2 hover:border-seafoam transition-all cursor-pointer">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{r.panelName}</span>
                            <span className="flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${r.status === 'RESULTED' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}>{r.status?.toLowerCase()}</span>
                              {isIncoming(r) && (
                               <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 inline-flex items-center gap-0.5">
                                 📥 From {r.clinicName || 'partner clinic'}
                               </span>
                             )}
                             {/* Source badge: internal · sent-out-awaiting · external results in. */}
                             {r.source === 'EXTERNAL' ? (
                               r.status !== 'RESULTED' ? (
                                 <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 inline-flex items-center gap-0.5">
                                   <Building2 size={8} /> Sent to {r.externalSource || 'partner'} · awaiting
                                 </span>
                               ) : (
                                 <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 inline-flex items-center gap-0.5">
                                   <Building2 size={8} /> External · {r.externalSource || 'lab'} ✓
                                 </span>
                               )
                             ) : (
                               <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">Internal</span>
                             )}
                              {r.markers.length > 0 && <span className="text-[8px] text-slate-400">{r.markers.length} marker{r.markers.length === 1 ? '' : 's'}</span>}
                            </span>
                          </span>
                          <div className="flex gap-0.5 shrink-0">
                            {r.appointmentId && <button onClick={(e) => { e.stopPropagation(); onOpenAppointment?.(r.appointmentId!); }} title="Open visit" className="p-1 rounded-lg text-slate-400 hover:text-seafoam"><ExternalLink size={12} /></button>}
                            <button onClick={(e) => { e.stopPropagation(); setSharing(r); }} title="Share with partner clinics" className={`p-1 rounded-lg hover:text-seafoam ${r.allowedClinicIds && r.allowedClinicIds.length > 0 ? 'text-seafoam' : 'text-slate-400'}`}><Share2 size={12} /></button>
                            <button onClick={(e) => { e.stopPropagation(); remove(r); }} className="p-1 rounded-lg text-slate-400 hover:text-rose-500"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
