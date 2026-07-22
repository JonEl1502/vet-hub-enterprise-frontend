import React, { useMemo, useState } from 'react';
import { Plus, Loader2, X, Search, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import { appointmentsAPI, visitsAPI, Appointment } from '../../../services';
import { VISIT_TYPES } from '../../../types';
import UpcomingForPet from '../shared/UpcomingForPet';
import type { AppointmentSource } from '../../../services/modules/appointmentBookings.api';
import { loadVisitFees, entryFeeFor } from '../shared/visitFees';
import { GateCheckForm } from './wizard/steps/EntrySteps';
import { localYMD } from '../../../services/utils/dateFormatter';

const nowTime = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };

// Exactly THREE top-level encounter types (077 restructure) — same as
// Register Visit. Vaccination is a Vet Visit visit-type; House Call is a
// visit-level toggle; Hospitalization escalates within the vet-visit workflow.
export const ENCOUNTERS: { value: string; label: string }[] = [
  { value: 'VET_VISIT', label: 'Vet Visit' },
  { value: 'GROOMING', label: 'Grooming' },
  { value: 'BOARDING', label: 'Boarding' },
];

// Marketing attribution — where the appointment came from. Persisted to the
// booking's sourceDetail column (feeds the clinic's attribution reporting).
const ATTRIBUTION_CHIPS = ['Facebook', 'Word of mouth', 'Walk-in', 'Phone call', 'Website', 'TikTok', 'Other'] as const;

// The Vet Visit "Visit Type" list (077) — mirrors Register Visit.
// Single source of truth: the same trimmed Visit Type list the visit-creation
// flow uses (types.ts VISIT_TYPES — 077 restructure; ROUTINE/ROUTINE_CHECK
// retired from pickers 2026-07-18).
const BOOKING_VISIT_TYPES: { value: string; label: string }[] =
  VISIT_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }));

// Which service categories are relevant to each appointment type — the
// "Services to prepare" list is filtered to these (matched on category name).
// A type with no match (or RETAIL) falls back to showing all categories.
const TYPE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  VET_VISIT: ['consult', 'dental', 'medical', 'surg', 'imag', 'radiolog', 'x-ray', 'xray', 'ultrasound', 'scan', 'lab', 'diagnost', 'patholog', 'emergency', 'treatment', 'exam', 'vaccin', 'deworm'],
  VACCINATION: ['vaccin', 'deworm', 'consult'],
  GROOMING: ['groom'],
  BOARDING: ['boarding', 'food', 'feed', 'groom', 'medical'],
  HOUSE_CALL: ['consult', 'medical', 'vaccin', 'deworm', 'treatment', 'exam', 'lab'],
  HOSPITALIZATION: ['inpatient', 'hospital', 'medical', 'consult', 'lab', 'imag', 'surg', 'emergency', 'treatment'],
  RETAIL: ['retail', 'product', 'pharmac', 'shop'],
};

// Vet-visit sub-type refinements: the "Services to prepare" list narrows to
// what that visit type actually needs (a vaccination booking shouldn't lead
// with Consultation). Types not listed fall back to the broad VET_VISIT set.
const VET_VISIT_TYPE_KEYWORDS: Record<string, string[]> = {
  VACCINATION: ['vaccin', 'deworm'],
  ROUTINE_CHECK: ['consult', 'exam', 'check'],
  EMERGENCY: ['emergency', 'consult', 'treatment', 'lab', 'imag', 'surg'],
};

export interface AppointmentPrefill {
  petId?: string;
  petLabel?: string;
  note?: string;
  encounterType?: string;
  date?: string; // yyyy-mm-dd
  time?: string; // HH:mm
}

interface Props {
  pets: any[];
  clients: any[];
  onClose: () => void;
  onSaved: (appt?: Appointment) => void;
  // Pre-fill the form (e.g. when booking from a reminder). When petId is given,
  // the patient is locked in but still changeable.
  prefill?: AppointmentPrefill;
  // Attribution: where this booking came from (front desk, reminder, website…).
  source?: AppointmentSource;
  // Links the booking back to its origin reminder for the Reminder→Appointment loop.
  originReminderId?: string;
  // Follow-up chain: the visit whose follow-up plan is booking this
  // appointment — carried on the booking and threaded into the visit
  // created at Start Visit (parentAppointmentId).
  parentAppointmentId?: string | number;
  // When given, a "Book & Start" action books AND creates the visit right
  // away (staged services or the seeded entry fee), marks the booking
  // CONVERTED, and hands the visit id back so the caller can open its flow.
  onStarted?: (visitId: string) => void;
}

/**
 * Reusable "New appointment" modal. Stages categories/services (copied to the
 * visit on Start), captures date/time/type/note, and resolves the client from
 * the chosen patient. Used by the Appointments page and by Reminders ("Book").
 */
const AppointmentCreateModal: React.FC<Props> = ({ pets, clients, onClose, onSaved, prefill, source, originReminderId, parentAppointmentId, onStarted }) => {
  const [petSearch, setPetSearch] = useState('');
  const [petId, setPetId] = useState<string | null>(prefill?.petId ?? null);
  const [petLabel, setPetLabel] = useState(prefill?.petLabel ?? '');
  const [date, setDate] = useState(prefill?.date ?? localYMD(new Date()));
  const [time, setTime] = useState(prefill?.time ?? nowTime());
  // Legacy prefills may still pass retired encounter values — remap them.
  const rawPrefillEncounter = prefill?.encounterType ?? 'VET_VISIT';
  const prefillEncounter = rawPrefillEncounter === 'GROOMING' || rawPrefillEncounter === 'BOARDING' ? rawPrefillEncounter : 'VET_VISIT';
  const [encounterType, setEncounterType] = useState(prefillEncounter);
  const [visitType, setVisitType] = useState(rawPrefillEncounter === 'VACCINATION' ? 'VACCINATION' : 'CONSULTATION');
  const [isHouseCall, setIsHouseCall] = useState(rawPrefillEncounter === 'HOUSE_CALL');
  const [note, setNote] = useState(prefill?.note ?? '');
  // Attribution chips → sourceDetail ("Other" opens a free-text input).
  const [attribution, setAttribution] = useState<string>('');
  const [attributionOther, setAttributionOther] = useState('');
  const [saving, setSaving] = useState(false);
  // Optional gate check at booking (collapsed by default — mandatory as the
  // wizard's entry step at visit start regardless).
  const [gateOpen, setGateOpen] = useState(false);
  const [gateData, setGateData] = useState<any>({});
  const gateFormKey =
    encounterType === 'GROOMING' ? 'groomingAssessment'
    : encounterType === 'BOARDING' ? 'boardingAssessment'
    : null;
  const gateCheck = gateFormKey && Object.keys(gateData).length > 0 ? { form: gateFormKey, data: gateData } : null;
  const { categories, getServicesByCategory } = useReferenceData();
  // Filter the categories to the ones relevant to the chosen appointment type.
  // For vet visits the VISIT TYPE refines the list further (vaccination →
  // vaccines/deworming, routine check → consult/exam, emergency → emergency…).
  const visibleCategories = useMemo(() => {
    const kws = encounterType === 'VET_VISIT'
      ? (VET_VISIT_TYPE_KEYWORDS[visitType] ?? TYPE_CATEGORY_KEYWORDS.VET_VISIT)
      : (TYPE_CATEGORY_KEYWORDS[encounterType] || []);
    if (!kws.length) return categories;
    const filtered = categories.filter(c => kws.some(k => c.name.toLowerCase().includes(k)));
    return filtered.length ? filtered : categories;
  }, [categories, encounterType, visitType]);
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

  // Seed the entry-point service (same rule as Register Visit) when starting
  // a visit with nothing staged — the backend requires ≥1 task.
  const seedTask = () => {
    const want = encounterType === 'GROOMING' ? 'groom'
      : encounterType === 'BOARDING' ? 'board'
      : visitType === 'VACCINATION' ? 'vaccin'
      : 'consult';
    const cat = categories.find(c => c.name.toLowerCase().includes(want))
      || categories.find(c => c.name.toLowerCase().includes('consult'));
    const svcs = cat ? getServicesByCategory(cat.id) : [];
    const svc = svcs.find((s: any) => s.name.toLowerCase().includes(want)) || svcs[0];
    // Clinic-configured entry fee wins; else catalog price; else 0.
    const configured = entryFeeFor(loadVisitFees(), encounterType,
      encounterType === 'VET_VISIT' ? visitType : null);
    return { name: svc?.name || 'Consultation', category: cat?.name || 'Consultation', price: configured ?? svc?.defaultPrice ?? 0 };
  };

  const submit = async (startNow = false) => {
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
        encounterType,
        ...(encounterType === 'VET_VISIT' ? { visitType } : {}),
        ...(isHouseCall ? { isHouseCall: true } : {}),
        note: note || undefined, stagedItems,
        ...(attribution ? { sourceDetail: attribution === 'Other' ? (attributionOther.trim() || 'Other') : attribution } : {}),
        ...(gateCheck ? { gateCheck } : {}),
        ...(source ? { source } : {}),
        ...(originReminderId ? { originReminderId } : {}),
        ...(parentAppointmentId ? { parentVisitId: String(parentAppointmentId) } : {}),
      } as any);
      if (!res.success) return;
      const booking = (res.data as any)?.appointment ?? res.data;

      if (startNow && onStarted) {
        // Book & Start: materialize the visit now — staged services become
        // its tasks (or the entry fee is seeded) — and open its flow.
        let tasks = stagedItems.map(s => ({
          id: Math.floor(Math.random() * 1e6),
          // serviceId → backend keeps the catalog FK + auto-applies any
          // procedure recipe whose trigger service matches.
          serviceId: s.serviceId as string | undefined,
          name: s.name,
          category: categories.find(c => String(c.id) === String(s.categoryId))?.name || 'General',
          status: 'PENDING', price: s.price || 0, notes: '',
        }));
        if (tasks.length === 0) {
          const seed = seedTask();
          tasks = [{ id: Math.floor(Math.random() * 1e6), serviceId: undefined as string | undefined, name: seed.name, category: seed.category, status: 'PENDING', price: seed.price, notes: '' }];
        }
        const visitRes = await visitsAPI.create({
          clientId, petId,
          apptDate: date, apptTime: time,
          encounterType,
          visitType: encounterType === 'VET_VISIT' ? visitType : null,
          isHouseCall,
          tasks, totalCost: tasks.reduce((s, t) => s + (t.price || 0), 0),
          // Follow-up chain: link the new visit to its originating visit.
          ...(parentAppointmentId ? { parentAppointmentId: Number(parentAppointmentId) } : {}),
        } as any);
        const visitId = (visitRes.data as any)?.appointment?.id;
        if (visitRes.success && visitId) {
          // Gate check filled at booking prefills the wizard's entry step
          // (same seam App uses for Register Visit — shared field keys).
          if (gateCheck) {
            try {
              const stepId = gateCheck.form;
              const entryKey = stepId === 'groomingAssessment' ? 'grooming' : stepId === 'boardingAssessment' ? 'boarding' : 'admission';
              const key = `vethub.visitWizard.v1.${visitId}`;
              const now = new Date().toISOString();
              const rid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
              const raw = localStorage.getItem(key);
              const draft = raw ? JSON.parse(raw) : {
                entryKey, startedAt: now, currentStep: stepId, completed: {}, data: {},
                events: [{ id: rid(), at: now, label: 'Visit created', kind: 'milestone', auto: true }],
              };
              draft.data = { ...(draft.data || {}), [stepId]: { ...(draft.data?.[stepId] || {}), ...gateCheck.data } };
              draft.events = [...(draft.events || []), { id: rid(), at: now, label: 'Gate check captured at booking', kind: 'info', auto: true }];
              localStorage.setItem(key, JSON.stringify(draft));
            } catch { /* non-fatal */ }
          }
          // Link the booking to its visit so the Appointments page shows it started.
          await appointmentsAPI.update(booking?.id, { status: 'CONVERTED', convertedVisitId: String(visitId) } as any).catch(() => {});
          toast.success('Visit started');
          onSaved(res.data as any);
          onStarted(String(visitId));
          return;
        }
        toast.error('Booked, but the visit could not be started — use Start on the booking');
      }
      toast.success('Appointment created');
      onSaved(res.data as any);
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
        {/* Double-entry guard: what's already booked/pending for this patient */}
        {petId && <UpcomingForPet petId={petId} />}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Date</label><input type="date" className={fieldCls} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div>
            <label className={labelCls}>Time</label>
            <div className="flex gap-1.5">
              <input type="time" className={fieldCls} value={time} onChange={e => setTime(e.target.value)} />
              <button type="button" onClick={() => { setDate(localYMD(new Date())); setTime(nowTime()); }}
                title="Set to today, right now" className="shrink-0 px-2.5 rounded-xl border border-seafoam/40 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">
                Now
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Encounter</label><select className={fieldCls} value={encounterType} onChange={e => { setEncounterType(e.target.value); setGateData({}); setGateOpen(false); }}>{ENCOUNTERS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
          {encounterType === 'VET_VISIT' ? (
            <div><label className={labelCls}>Visit type</label><select className={fieldCls} value={visitType} onChange={e => setVisitType(e.target.value)}>{BOOKING_VISIT_TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
          ) : <div />}
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={isHouseCall} onChange={e => setIsHouseCall(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-seafoam" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400">🚗 House Call — the clinic travels out to the client</span>
        </label>
        {gateFormKey && (
          <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setGateOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
              <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">🛂 Gate check <span className="text-slate-400 normal-case tracking-normal font-bold">— optional here, mandatory at visit start</span></span>
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-seafoam">{gateOpen ? 'Skip / collapse' : 'Do it now'}</span>
            </button>
            {gateOpen && (
              <div className="p-3">
                <GateCheckForm formKey={gateFormKey} data={gateData} setData={p => setGateData((d: any) => ({ ...d, ...p }))} petId={petId} />
              </div>
            )}
          </div>
        )}
        {/* Stage the categories/services this visit will need — copied to the visit on Start. */}
        <div>
          <label className={labelCls}>Services to prepare (optional)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {visibleCategories.map(c => <button key={c.id} type="button" onClick={() => toggleCat(c.id)} className={chip(openCats.includes(c.id))}>{c.name}</button>)}
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
        {/* Attribution — where did this appointment come from? */}
        <div>
          <label className={labelCls}>Came from (optional)</label>
          <div className="flex flex-wrap gap-1.5">
            {ATTRIBUTION_CHIPS.map(a => (
              <button key={a} type="button" onClick={() => setAttribution(prev => prev === a ? '' : a)} className={chip(attribution === a)}>{a}</button>
            ))}
          </div>
          {attribution === 'Other' && (
            <input className={`${fieldCls} mt-2`} placeholder="Where did they hear about you?" value={attributionOther} onChange={e => setAttributionOther(e.target.value)} />
          )}
        </div>
        <div><label className={labelCls}>Note</label><textarea rows={2} className={fieldCls} value={note} onChange={e => setNote(e.target.value)} placeholder="What is this appointment for?" /></div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button>
          <button onClick={() => submit(false)} disabled={saving || !petId} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-seafoam/40 text-seafoam font-black text-[10px] uppercase tracking-widest hover:bg-seafoam/10 disabled:opacity-50 transition-all">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Book
          </button>
          {onStarted && (
            <button onClick={() => submit(true)} disabled={saving || !petId}
              title="Books the appointment AND starts the visit now — opens its clinical flow"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pine disabled:opacity-50 transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Book &amp; Start
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentCreateModal;
