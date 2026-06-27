import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarClock, Plus, Loader2, Trash2, X, Search, Clock, ArrowRight, BellRing, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import { appointmentsAPI, Appointment } from '../../../services';
import type { AppointmentStatus } from '../../../services/modules/appointmentBookings.api';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  // Jump to a Visit once an appointment is started/converted.
  onOpenVisit?: (visitId: string) => void;
  // Start a visit from a booking — opens the new-visit form pre-filled with the
  // booking's patient + staged categories/services.
  onStartVisit?: (a: Appointment) => void;
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'CONVERTED', label: 'Started' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_TONE: Record<AppointmentStatus, string> = {
  REQUESTED: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  CONFIRMED: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  CONVERTED: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  RESCHEDULED: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  CANCELLED: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  NO_SHOW: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const ENCOUNTERS = ['VET_VISIT', 'VACCINATION', 'GROOMING', 'BOARDING', 'RETAIL'];

const AppointmentsBookingView: React.FC<Props> = ({ onStartVisit, onOpenVisit }) => {
  const { pets, clients } = useData();
  const [records, setRecords] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await appointmentsAPI.list(status === 'all' ? {} : { status }); if (res.success && res.data) setRecords(res.data.appointments); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const petName = (a: Appointment) => pets.find((p: any) => String(p.id) === String(a.petId))?.name || 'Patient';
  const clientName = (a: Appointment) => clients.find((c: any) => String(c.id) === String(a.clientId))?.name || '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(a => `${petName(a)} ${clientName(a)} ${a.note ?? ''}`.toLowerCase().includes(q));
  }, [records, search, pets, clients]);

  const setStatusOf = async (a: Appointment, next: AppointmentStatus) => {
    setBusyId(a.id);
    try { const res = await appointmentsAPI.update(a.id, { status: next }); if (res.success) { toast.success(`Marked ${next.toLowerCase()}`); await load(); } }
    catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusyId(null); }
  };

  // Start a visit from this booking: open the new-visit form pre-filled with the
  // patient + staged categories/services. The booking is only marked CONVERTED
  // AFTER the visit is actually created (App's onSave) — so cancelling the form
  // midway leaves the booking untouched.
  const startVisit = (a: Appointment) => { onStartVisit?.(a); };

  const remove = async (a: Appointment) => {
    if (!confirm('Delete this appointment?')) return;
    setBusyId(a.id);
    try { const res = await appointmentsAPI.remove(a.id); if (res.success) { toast.success('Deleted'); await load(); } }
    catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center"><CalendarClock size={22} className="text-indigo-600 dark:text-indigo-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Appointments</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{filtered.length} booking{filtered.length === 1 ? '' : 's'} · start a visit when the client arrives</p>
          </div>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> New appointment</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">{STATUS_TABS.map(t => <button key={t.value} onClick={() => setStatus(t.value)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${status === t.value ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>{t.label}</button>)}</div>
        <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, client, note" className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" /></div>
      </div>

      {loading ? <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      : filtered.length === 0 ? <div className="flex flex-col items-center justify-center text-center py-16"><CalendarClock size={28} className="text-slate-300 dark:text-zinc-700 mb-3" /><p className="text-sm font-bold text-slate-400">No appointments</p><p className="text-[11px] text-slate-400">Bookings made from reminders, front desk, or your website appear here.</p></div>
      : (
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{petName(a)} <span className="text-slate-400 font-medium">· {clientName(a)}</span></p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <Clock size={11} /> {formatDate(a.scheduledAt)} {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${STATUS_TONE[a.status]}`}>{a.status.toLowerCase().replace('_', ' ')}</span>
                    <span className="text-slate-300 dark:text-zinc-600">{a.source.toLowerCase().replace('_', ' ')}</span>
                    {a.originReminderId && <span className="inline-flex items-center gap-0.5 text-violet-500"><BellRing size={9} /> from reminder</span>}
                    {a.convertedVisitId && <button onClick={() => onOpenVisit?.(a.convertedVisitId!)} className="inline-flex items-center gap-0.5 text-seafoam hover:underline"><ExternalLink size={9} /> visit created</button>}
                  </p>
                  {a.note && <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">{a.note}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {a.status === 'REQUESTED' && <button disabled={busyId === a.id} onClick={() => setStatusOf(a, 'CONFIRMED')} className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 disabled:opacity-50">Confirm</button>}
                  {(a.status === 'REQUESTED' || a.status === 'CONFIRMED') && <button disabled={busyId === a.id} onClick={() => startVisit(a)} title="Start the visit" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-50">Start visit <ArrowRight size={11} /></button>}
                  <button disabled={busyId === a.id} onClick={() => remove(a)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <CreateModal pets={pets} clients={clients} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
};

const CreateModal: React.FC<{ pets: any[]; clients: any[]; onClose: () => void; onSaved: () => void }> = ({ pets, clients, onClose, onSaved }) => {
  const [petSearch, setPetSearch] = useState('');
  const [petId, setPetId] = useState<string | null>(null);
  const [petLabel, setPetLabel] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');
  const [encounterType, setEncounterType] = useState('VET_VISIT');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { categories, getServicesByCategory } = useReferenceData();
  const [openCats, setOpenCats] = useState<number[]>([]);
  // Staged services keyed by categoryId (string) — copied to the visit on Start.
  const [staged, setStaged] = useState<Record<string, { id: string; name: string; price: number }[]>>({});

  const toggleCat = (id: number) => setOpenCats(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleSvc = (catId: number, svc: any) => setStaged(prev => {
    const key = String(catId);
    const list = prev[key] || [];
    const exists = list.some(s => s.id === String(svc.id));
    const next = exists ? list.filter(s => s.id !== String(svc.id)) : [...list, { id: String(svc.id), name: svc.name, price: svc.defaultPrice || 0 }];
    return { ...prev, [key]: next };
  });
  const chip = (active: boolean) => `px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${active ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`;

  const matches = useMemo(() => { const q = petSearch.trim().toLowerCase(); if (!q) return [] as any[]; return pets.filter((p: any) => p.name?.toLowerCase().includes(q)).slice(0, 8); }, [pets, petSearch]);
  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
  const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

  const submit = async () => {
    if (!petId) { toast.error('Select a patient'); return; }
    const pet = pets.find((p: any) => String(p.id) === String(petId));
    const clientId = pet?.ownerId;
    if (!clientId) { toast.error('This patient has no owner on file'); return; }
    setSaving(true);
    try {
      const stagedItems = Object.entries(staged).flatMap(([categoryId, svcs]) =>
        svcs.map(s => ({ categoryId, serviceId: s.id, name: s.name, price: s.price })));
      const res = await appointmentsAPI.create({
        clientId, petId, scheduledAt: new Date(`${date}T${time}`).toISOString(),
        encounterType, note: note || undefined, stagedItems,
      } as any);
      if (res.success) { toast.success('Appointment created'); onSaved(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to create'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between"><h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">New appointment</h3><button onClick={onClose} className="text-slate-400 hover:text-pine"><X size={18} /></button></div>
        <div>
          <label className={labelCls}>Patient *</label>
          {petId ? <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl"><span className="text-sm font-bold text-pine dark:text-zinc-100">{petLabel}</span><button onClick={() => { setPetId(null); setPetLabel(''); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500">Change</button></div>
          : <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${fieldCls} pl-9`} placeholder="Search patient…" value={petSearch} onChange={e => setPetSearch(e.target.value)} />{matches.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">{matches.map((p: any) => <button key={p.id} onClick={() => { setPetId(String(p.id)); setPetLabel(p.name); setPetSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-pine dark:text-zinc-100">{p.name} <span className="text-slate-400 text-xs">{p.species}</span></button>)}</div>}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Date</label><input type="date" className={fieldCls} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className={labelCls}>Time</label><input type="time" className={fieldCls} value={time} onChange={e => setTime(e.target.value)} /></div>
        </div>
        <div><label className={labelCls}>Type</label><select className={fieldCls} value={encounterType} onChange={e => setEncounterType(e.target.value)}>{ENCOUNTERS.map(x => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</select></div>
        {/* Stage the categories/services this visit will need — copied to the visit on Start. */}
        <div>
          <label className={labelCls}>Services to prepare (optional)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categories.map(c => <button key={c.id} type="button" onClick={() => toggleCat(c.id)} className={chip(openCats.includes(c.id))}>{c.name}</button>)}
          </div>
          {openCats.map(cid => {
            const cat = categories.find(c => c.id === cid);
            const svcs = getServicesByCategory(cid);
            return (
              <div key={cid} className="mb-2 pl-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{cat?.name}</p>
                {svcs.length === 0 ? <p className="text-[10px] text-slate-400">No services in this category.</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {svcs.map((s: any) => { const sel = (staged[String(cid)] || []).some(x => x.id === String(s.id)); return <button key={s.id} type="button" onClick={() => toggleSvc(cid, s)} className={chip(sel)}>{s.name}{s.defaultPrice ? ` · ${s.defaultPrice}` : ''}</button>; })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div><label className={labelCls}>Note</label><textarea rows={2} className={fieldCls} value={note} onChange={e => setNote(e.target.value)} placeholder="What is this appointment for?" /></div>
        <div className="flex gap-2 pt-1"><button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button><button onClick={submit} disabled={saving || !petId} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create</button></div>
      </div>
    </div>
  );
};

export default AppointmentsBookingView;
