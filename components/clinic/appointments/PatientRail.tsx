import React, { useEffect, useState } from 'react';
import { ChevronRight, Receipt, User as UserIcon, Stethoscope, Smile, Calendar, Printer, Bell, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Visit, Pet, Client, Clinic, ApptStatus } from '../../../types';
import { petsAPI, remindersAPI, appointmentsAPI } from '../../../services';
import type { ReminderServiceType } from '../../../services/modules/reminders.api';
import { formatDate } from '../../../services/utils/dateFormatter';
import { dialog } from '../../../services/utils/dialog';

// Guess the reminder service type from a point's wording — reminders span
// the encounter types (vaccination, deworming, grooming, checkup, …).
const guessServiceType = (t: string): ReminderServiceType => {
  const s = t.toLowerCase();
  if (s.includes('deworm')) return 'DEWORMING';
  if (s.includes('vaccin')) return 'VACCINATION';
  if (s.includes('groom')) return 'GROOMING';
  if (s.includes('medicat') || s.includes('drug') || s.includes('dose')) return 'MEDICATION';
  if (s.includes('feed') || s.includes('diet') || s.includes('food')) return 'FEEDING';
  if (s.includes('check') || s.includes('review') || s.includes('exam')) return 'CHECKUP';
  if (s.includes('follow') || s.includes('house call') || s.includes('visit')) return 'FOLLOW_UP';
  return 'OTHER';
};
const SERVICE_TYPES: ReminderServiceType[] = ['FOLLOW_UP', 'CHECKUP', 'VACCINATION', 'DEWORMING', 'MEDICATION', 'FEEDING', 'GROOMING', 'OTHER'];

// ── Collapsible info card — one-line summary collapsed, full scrollable
//    record expanded. Shared by the wizard rail and Records & Billing. ──
export const InfoCard: React.FC<{
  icon: React.ElementType;
  title: string;
  summary: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ icon: Icon, title, summary, defaultOpen, children }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all">
        <span className="p-1.5 bg-seafoam/10 text-seafoam rounded-lg shrink-0"><Icon size={13} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{title}</span>
          {!open && <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 truncate">{summary}</span>}
        </span>
        <ChevronRight size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-slate-100 dark:border-zinc-800 max-h-80 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      )}
    </div>
  );
};

export const InfoRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
  value ? (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{label}</span>
      <span className="text-[11px] font-bold text-pine dark:text-zinc-100 text-right">{value}</span>
    </div>
  ) : null;

const BEHAVIOUR_TRAITS = ['Calm', 'Very happy', 'Likes petting', 'Well trained', 'Good with kids', 'Food motivated', 'Playful', 'Nervous', 'Anxious at vet', 'Aggressive', 'May bite', 'Hates nail trims', 'Vocal'];

interface Props {
  visit: Visit;
  pet: Pet;
  client?: Client;
  activeClinic: Clinic;
  allAppointments: Visit[];
  visitReminder?: any | null;
  onNavigateToVisit?: (visitId: number) => void;
  onNavigateToPet?: (petId: number) => void;
  onNavigateToClient?: (clientId: number) => void;
  onBookFollowUp?: () => void;
  onOpenInvoice?: () => void;
  // The doctor's staged Follow-up plan (wizard follow-up step data) —
  // reception turns it into real reminders / an appointment from here.
  followUpPlan?: { nextDate?: string; nextTime?: string; reminders?: { title: string; description?: string; dueDate: string; assignTo?: string; assignToName?: string }[]; carePlan?: string[] } | null;
  onBookFromPlan?: (prefill: { date?: string; time?: string; note?: string }) => void;
  onRemindersCreated?: (n: number) => void;
  // Visit closed & billed → rail is view-only: no behaviour edits, no
  // follow-up reminder creation / appointment booking from here.
  readOnly?: boolean;
}

/**
 * The patient context rail — Bill & Balance on top, then Patient & Owner,
 * Behaviour and Clinical Snapshot as collapsible cards. Fed by the pet's
 * Clinical Snapshot API + patient timeline.
 */
const PatientRail: React.FC<Props> = ({ visit, pet, client, activeClinic, allAppointments, visitReminder, onNavigateToVisit, onNavigateToPet, onNavigateToClient, onBookFollowUp, onOpenInvoice, followUpPlan, onBookFromPlan, onRemindersCreated, readOnly }) => {
  const [petSnapshot, setPetSnapshot] = useState<any | null>(null);
  const [vaccineHistory, setVaccineHistory] = useState<{ name: string; date: string }[]>([]);
  useEffect(() => {
    let alive = true;
    petsAPI.getSnapshot(pet.id).then((r: any) => { if (alive && r.success && r.data?.snapshot) setPetSnapshot(r.data.snapshot); }).catch(() => {});
    petsAPI.getTimeline(pet.id).then((r: any) => {
      if (!alive || !r.success) return;
      const tl: any = r.data?.timeline;
      const entries: any[] = Array.isArray(tl) ? tl : (tl?.entries || []);
      setVaccineHistory(entries.filter((e: any) => e.type === 'vaccination').map((e: any) => ({ name: e.vaccineName || 'Vaccine', date: e.date })));
    }).catch(() => {});
    return () => { alive = false; };
  }, [pet.id]);

  // Behavioural traits — persisted on the pet record (pets.behaviour_traits).
  // Seed from the pet; fall back to any legacy per-device value once.
  const behaviourKey = `vethub.petBehaviour.v1.${pet.id}`;
  const [behaviour, setBehaviour] = useState<string[]>(() => {
    const fromPet = (pet as any).behaviourTraits;
    if (Array.isArray(fromPet) && fromPet.length) return fromPet;
    try { return JSON.parse(localStorage.getItem(behaviourKey) || '[]'); } catch { return []; }
  });
  const [behaviourDraft, setBehaviourDraft] = useState('');
  const [savingBehaviour, setSavingBehaviour] = useState(false);
  const setBehaviourPersist = async (next: string[]) => {
    const prev = behaviour;
    setBehaviour(next); // optimistic
    setSavingBehaviour(true);
    try {
      const res = await petsAPI.update(Number(pet.id), { behaviourTraits: next } as any);
      if (!res.success) throw new Error('save failed');
      try { localStorage.removeItem(behaviourKey); } catch { /* noop */ }
    } catch {
      setBehaviour(prev); // rollback
      toast.error('Could not save behaviour traits');
    } finally {
      setSavingBehaviour(false);
    }
  };
  const toggleTrait = (t: string) => setBehaviourPersist(behaviour.includes(t) ? behaviour.filter(x => x !== t) : [...behaviour, t]);

  // ── Follow-up plan → super reminder + appointment ────────────────
  // Points seed from the doctor's staged reminders; reception can edit,
  // add more (e.g. "Call client on deworming"), pick service types, then
  // create them all as REAL reminders in one go and/or book the appointment.
  // Carry the doctor's description + assignee through so the created reminder
  // reuses the SAME title & description and flags the assignee (their bell).
  interface PlanPoint { title: string; description?: string; dueDate: string; serviceType: ReminderServiceType; assignTo?: string; assignToName?: string }
  const [planPoints, setPlanPoints] = useState<PlanPoint[]>(() =>
    (followUpPlan?.reminders || []).map(r => ({ title: r.title, description: r.description, dueDate: r.dueDate, serviceType: guessServiceType(r.title), assignTo: r.assignTo, assignToName: r.assignToName })));
  const [pointDraft, setPointDraft] = useState<PlanPoint>({ title: '', dueDate: '', serviceType: 'FOLLOW_UP' });
  const [creatingReminders, setCreatingReminders] = useState(false);
  // Resync when the VISIT changes or the plan arrives from the server —
  // the initializer above runs once, which left stale points showing when
  // navigating between visits/pets (plan is per-visit, saved in the wizard
  // record and fetched with it).
  useEffect(() => {
    setPlanPoints((followUpPlan?.reminders || []).map(r => ({ title: r.title, description: r.description, dueDate: r.dueDate, serviceType: guessServiceType(r.title), assignTo: r.assignTo, assignToName: r.assignToName })));
    setPointDraft({ title: '', dueDate: '', serviceType: 'FOLLOW_UP' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit.id, JSON.stringify(followUpPlan?.reminders || [])]);
  const patchPoint = (i: number, p: Partial<PlanPoint>) => setPlanPoints(pts => pts.map((x, j) => j === i ? { ...x, ...p } : x));
  const addPoint = () => {
    if (!pointDraft.title.trim() || !pointDraft.dueDate) { toast.error('Point needs a title and due date'); return; }
    setPlanPoints(pts => [...pts, { ...pointDraft, serviceType: guessServiceType(pointDraft.title) }]);
    setPointDraft({ title: '', dueDate: '', serviceType: 'FOLLOW_UP' });
  };
  // Created follow-ups: reminders LINKED to this visit + this patient's
  // upcoming appointment bookings — listed on the card, viewable in place.
  const [createdReminders, setCreatedReminders] = useState<any[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [viewItem, setViewItem] = useState<{ type: 'reminder' | 'booking'; data: any } | null>(null);
  // Edit/update a created reminder in place (reschedule instead of deleting).
  const [editReminder, setEditReminder] = useState<{ id: string; title: string; dueDate: string; serviceType: string } | null>(null);
  const [savingReminderEdit, setSavingReminderEdit] = useState(false);
  useEffect(() => { setEditReminder(null); }, [viewItem?.data?.id]);
  const saveReminderEdit = async () => {
    if (!editReminder) return;
    if (!editReminder.title.trim() || !editReminder.dueDate) { toast.error('Title and due date are required'); return; }
    setSavingReminderEdit(true);
    try {
      const res = await remindersAPI.update(editReminder.id, {
        title: editReminder.title.trim(),
        serviceType: editReminder.serviceType as any,
        dueAt: new Date(`${editReminder.dueDate}T09:00:00`).toISOString(),
      });
      if (res.success) { toast.success('Reminder updated'); setEditReminder(null); setViewItem(null); loadCreated(); }
    } catch { toast.error('Update failed'); }
    finally { setSavingReminderEdit(false); }
  };
  const loadCreated = React.useCallback(async () => {
    try {
      const [rRes, bRes] = await Promise.all([
        remindersAPI.list({ scope: 'all', petId: visit.petId }),
        appointmentsAPI.list({ petId: pet.id }),
      ]);
      if (rRes.success && rRes.data?.reminders) {
        setCreatedReminders(rRes.data.reminders.filter((r: any) => String(r.originAppointmentId) === String(visit.id) && r.status !== 'DISMISSED'));
      }
      const cutoff = Date.now() - 86400000;
      const appts: any[] = (bRes.success ? (bRes.data as any)?.appointments : null) || [];
      setUpcomingBookings(appts.filter((b: any) =>
        ['REQUESTED', 'CONFIRMED', 'RESCHEDULED'].includes(b.status) && new Date(b.scheduledAt).getTime() >= cutoff));
    } catch { /* non-fatal — the section just stays empty */ }
  }, [visit.id, visit.petId, pet.id]);
  useEffect(() => { loadCreated(); }, [loadCreated]);

  // Mistake/duplicate escape: a created reminder or booked appointment can be
  // deleted right here (until the visit is closed read-only).
  const deleteCreated = async (type: 'reminder' | 'booking', item: any) => {
    const label = type === 'reminder' ? (item.title || 'this reminder') : 'this appointment';
    if (!await dialog.confirmDelete({ title: `Delete ${type}?`, entityName: label })) return;
    try {
      const res = type === 'reminder'
        ? await remindersAPI.remove(item.id)
        : await appointmentsAPI.remove(item.id);
      if (res?.success !== false) {
        toast.success(`${type === 'reminder' ? 'Reminder' : 'Appointment'} deleted`);
        if (type === 'reminder') setCreatedReminders(list => list.filter((x: any) => x.id !== item.id));
        else setUpcomingBookings(list => list.filter((x: any) => x.id !== item.id));
      } else toast.error('Delete failed');
    } catch { toast.error('Delete failed'); }
  };

  const createReminders = async () => {
    const valid = planPoints.filter(p => p.title.trim() && p.dueDate);
    if (!valid.length) { toast.error('No reminder points to create'); return; }
    setCreatingReminders(true);
    try {
      let ok = 0;
      for (const p of valid) {
        const res = await remindersAPI.create({
          petId: visit.petId, clientId: visit.clientId,
          serviceType: p.serviceType, title: p.title,
          dueAt: new Date(`${p.dueDate}T09:00:00`).toISOString(),
          originAppointmentId: visit.id,
          // Reuse the doctor's exact description (fallback if they left it blank).
          notes: p.description?.trim() || 'From the doctor’s follow-up plan',
          // Assignee → drives the "set this reminder" notification in their bell.
          meta: p.assignTo ? { assignedToId: p.assignTo, assignedToName: p.assignToName || '', source: 'doctor-followup' } : { source: 'doctor-followup' },
        }).catch(() => null);
        if (res?.success) ok++;
      }
      if (ok > 0) { toast.success(`${ok} reminder${ok === 1 ? '' : 's'} created${valid.some(p => p.assignTo) ? ' — assignees notified' : ''}`); setPlanPoints([]); onRemindersCreated?.(ok); loadCreated(); }
      else toast.error('Failed to create reminders');
    } finally { setCreatingReminders(false); }
  };

  const unpaid = allAppointments
    .filter(a => a.clientId === visit.clientId && !a.isPaid && (a.status === ApptStatus.COMPLETED || a.status === ApptStatus.PENDING_PAYMENT))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const outstanding = petSnapshot?.finance?.outstandingBalance ?? unpaid.reduce((s, a) => s + (a.totalCost || 0), 0);
  const past = allAppointments
    .filter(a => a.petId === visit.petId && a.id !== visit.id && new Date(a.date) < new Date(visit.date))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastVisit = past[0];
  const dueVaccines = [...(petSnapshot?.vaccines?.dueSoon || []), ...(petSnapshot?.vaccines?.overdue || [])];
  const vaccinesGiven = vaccineHistory.length || petSnapshot?.counts?.vaccinations || 0;

  return (
    <div className="space-y-3">
      <InfoCard icon={Receipt} title="Bill & Balance" defaultOpen
        summary={outstanding > 0 ? `${activeClinic.currency} ${Number(outstanding).toLocaleString()} outstanding` : 'No outstanding balance'}>
        <div className="space-y-1.5">
          <InfoRow label="This visit" value={`${activeClinic.currency} ${visit.totalCost.toLocaleString()} · ${visit.isPaid ? 'paid' : 'unpaid'}`} />
          <InfoRow label="Client outstanding" value={outstanding > 0
            ? <span className="text-amber-600 dark:text-amber-400 font-black">{activeClinic.currency} {Number(outstanding).toLocaleString()}</span>
            : 'None'} />
          {unpaid.length > 0 && (
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-1.5 mt-1.5 space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Unpaid visits</p>
              {unpaid.slice(0, 5).map(a => (
                <button key={a.id} onClick={() => onNavigateToVisit?.(a.id)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 hover:border-amber-400 transition-all text-left">
                  <span className="text-[10px] font-bold text-pine dark:text-zinc-100">#{a.id} · {formatDate(a.date)}</span>
                  <span className="text-[10px] font-black font-mono text-amber-700 dark:text-amber-400">{(a.totalCost || 0).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
          {onOpenInvoice && (
            <button onClick={onOpenInvoice} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-seafoam text-white text-[9px] font-black uppercase tracking-widest hover:bg-pine transition-all flex items-center justify-center gap-1.5">
              <Printer size={11} /> Invoice &amp; receipts
            </button>
          )}
        </div>
      </InfoCard>

      {/* Doctor recommends in the workflow → reception schedules it HERE:
          a "super reminder" of several points + the follow-up appointment. */}
      <InfoCard icon={Bell} title="Follow-up Plan"
        defaultOpen={(followUpPlan?.reminders || []).length > 0}
        summary={(followUpPlan?.reminders || []).length > 0
          ? `Dr recommends: ${(followUpPlan!.reminders!).length} reminder point${(followUpPlan!.reminders!).length === 1 ? '' : 's'}`
          : 'No plan staged — start a reminder / appointment'}>
        <div className="space-y-2">
          {(followUpPlan?.carePlan || []).length > 0 && (
            <InfoRow label="Care plan" value={(followUpPlan!.carePlan!).join('; ')} />
          )}
          {planPoints.length > 0 && (
            <div className="space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Reminder points</p>
              {planPoints.map((p, i) => (
                <div key={i} className="px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{p.title}</span>
                    {p.assignToName && <span className="text-[8px] font-black uppercase tracking-wider text-seafoam shrink-0" title="Assignee is notified to set this reminder">→ {p.assignToName}</span>}
                    {!readOnly && <button type="button" onClick={() => setPlanPoints(pts => pts.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500"><X size={11} /></button>}
                  </div>
                  {p.description && <p className="text-[9px] text-slate-500 dark:text-zinc-400 leading-snug">{p.description}</p>}
                  {readOnly ? (
                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400">
                      <span>{p.dueDate ? formatDate(p.dueDate) : 'No date'}</span>
                      <span>· {p.serviceType.replace('_', ' ')}</span>
                    </div>
                  ) : (
                  <div className="flex items-center gap-1.5">
                    <input type="date" className="field-input !h-6 !px-1.5 text-[10px] w-28" value={p.dueDate} onChange={e => patchPoint(i, { dueDate: e.target.value })} />
                    <select className="field-select !h-6 !px-1.5 text-[9px] flex-1" value={p.serviceType} onChange={e => patchPoint(i, { serviceType: e.target.value as ReminderServiceType })}>
                      {SERVICE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Already created for this visit/patient — click to view here. */}
          {(createdReminders.length > 0 || upcomingBookings.length > 0) && (
            <div className="space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Created — reminders &amp; appointments</p>
              {createdReminders.map((r: any) => (
                <button key={`r-${r.id}`} type="button" onClick={() => setViewItem({ type: 'reminder', data: r })}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-left hover:border-amber-400 transition-all group">
                  <Bell size={10} className="text-amber-500 shrink-0" />
                  <span className="flex-1 text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{r.title}</span>
                  <span className="text-[8px] font-black uppercase text-amber-600 shrink-0">{formatDate(r.dueAt)} · {String(r.status || '').toLowerCase()}</span>
                  {!readOnly && (
                    <span role="button" title="Delete reminder"
                      onClick={(e) => { e.stopPropagation(); deleteCreated('reminder', r); }}
                      className="p-0.5 rounded text-amber-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 opacity-40 group-hover:opacity-100 transition-all">
                      <X size={10} />
                    </span>
                  )}
                </button>
              ))}
              {upcomingBookings.map((b: any) => (
                <button key={`b-${b.id}`} type="button" onClick={() => setViewItem({ type: 'booking', data: b })}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 text-left hover:border-indigo-400 transition-all group">
                  <Calendar size={10} className="text-indigo-500 shrink-0" />
                  <span className="flex-1 text-[10px] font-bold text-pine dark:text-zinc-100 truncate">Appointment · {(b.encounterType || 'VET_VISIT').replace('_', ' ')}</span>
                  <span className="text-[8px] font-black uppercase text-indigo-600 shrink-0">{formatDate(b.scheduledAt)} · {String(b.status || '').toLowerCase()}</span>
                  {!readOnly && (
                    <span role="button" title="Delete appointment"
                      onClick={(e) => { e.stopPropagation(); deleteCreated('booking', b); }}
                      className="p-0.5 rounded text-indigo-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 opacity-40 group-hover:opacity-100 transition-all">
                      <X size={10} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {readOnly ? (
            <p className="text-[8px] font-bold text-slate-400">Visit closed — reminders &amp; bookings are locked here. Manage them from the Reminders page.</p>
          ) : (
          <>
          {/* Once a reminder exists, don't offer "add again" — edit/remove the
              created one above instead (tap it). Same for the booked appointment. */}
          {createdReminders.length === 0 ? (
            <>
              {/* Add a new point (e.g. "Call client on deworming"). */}
              <div className="flex gap-1.5">
                <input className="field-input !h-7 text-[11px] flex-1" placeholder="Add point — e.g. Call client on deworming" value={pointDraft.title}
                  onChange={e => setPointDraft(d => ({ ...d, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addPoint()} />
                <input type="date" className="field-input !h-7 !px-1.5 text-[10px] w-28 shrink-0" value={pointDraft.dueDate} onChange={e => setPointDraft(d => ({ ...d, dueDate: e.target.value }))} />
                <button type="button" onClick={addPoint} className="px-2 h-7 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all shrink-0">Add</button>
              </div>
              {planPoints.length > 0 && (
                <button type="button" onClick={createReminders} disabled={creatingReminders}
                  className="w-full mt-1.5 px-2 py-1.5 rounded-lg bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {creatingReminders ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />} Create {planPoints.length} reminder{planPoints.length === 1 ? '' : 's'}
                </button>
              )}
            </>
          ) : (
            <p className="text-[8px] font-bold text-slate-400">Reminder created — tap it above to edit or remove.</p>
          )}
          {onBookFromPlan && upcomingBookings.length === 0 ? (
            <button type="button"
              onClick={() => onBookFromPlan({
                // Earliest point's due date seeds the appointment date.
                date: [...planPoints].filter(p => p.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate,
                note: planPoints.length ? `Follow-up plan: ${planPoints.map(p => p.title).join('; ')}` : `Follow-up for visit #${visit.id}`,
              })}
              className="w-full mt-1.5 px-2 py-1.5 rounded-lg bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-1.5">
              <Calendar size={11} /> Book appointment from plan
            </button>
          ) : upcomingBookings.length > 0 ? (
            <p className="text-[8px] font-bold text-slate-400 mt-1.5">Appointment booked — tap it above to view or remove.</p>
          ) : null}
          </>
          )}
        </div>
      </InfoCard>

      <InfoCard icon={UserIcon} title={`${pet.name} — Patient & Owner`}
        summary={`${pet.breed} ${pet.species}${client ? ` · ${client.name}` : ''}`}>
        <div className="space-y-1.5">
          <InfoRow label="Species / breed" value={`${pet.species} · ${pet.breed}`} />
          <InfoRow label="Gender" value={`${pet.gender}${pet.isNeutered ? ' · Neutered' : ''}`} />
          <InfoRow label="Age" value={pet.age ? `${pet.age} yrs` : undefined} />
          <InfoRow label="Weight" value={pet.weight} />
          <InfoRow label="Microchip" value={pet.rfidChipNumber} />
          <InfoRow label="Colour" value={pet.color || undefined} />
          {((petSnapshot?.pet?.allergies || []).length > 0 || (petSnapshot?.pet?.chronicConditions || []).length > 0) && (
            <div className="flex flex-wrap gap-1 pt-1">
              {(petSnapshot?.pet?.allergies || []).map((a: string) => (
                <span key={`al-${a}`} className="px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[8px] font-black uppercase tracking-wider">⚠ {a}</span>
              ))}
              {(petSnapshot?.pet?.chronicConditions || []).map((c: string) => (
                <span key={`cc-${c}`} className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase tracking-wider">{c}</span>
              ))}
            </div>
          )}
          {client && (
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-1.5 mt-1.5 space-y-1.5">
              <InfoRow label="Owner" value={client.name} />
              <InfoRow label="Phone" value={client.phone} />
              <InfoRow label="Email" value={client.email} />
            </div>
          )}
          <div className="flex gap-1.5 pt-1.5">
            {onNavigateToPet && (
              <button onClick={() => onNavigateToPet(pet.id)} className="flex-1 px-2 py-1.5 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">Pet profile</button>
            )}
            {onNavigateToClient && client && (
              <button onClick={() => onNavigateToClient(client.id)} className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:text-pine dark:hover:text-zinc-100 transition-all">Owner profile</button>
            )}
          </div>
        </div>
      </InfoCard>

      <InfoCard icon={Smile} title="Behaviour"
        summary={behaviour.length ? behaviour.slice(0, 3).join(', ') + (behaviour.length > 3 ? '…' : '') : 'No traits recorded'}>
        {readOnly ? (
          <div className="flex flex-wrap gap-1">
            {behaviour.map(t => {
              const risky = ['Aggressive', 'May bite'].includes(t);
              return (
                <span key={t} className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border ${risky
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  : 'bg-seafoam/10 text-seafoam border-seafoam/20'}`}>{t}</span>
              );
            })}
            {behaviour.length === 0 && <p className="text-[9px] text-slate-400">No traits recorded</p>}
          </div>
        ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {[...BEHAVIOUR_TRAITS, ...behaviour.filter(b => !BEHAVIOUR_TRAITS.includes(b))].map(t => {
              const on = behaviour.includes(t);
              const risky = ['Aggressive', 'May bite'].includes(t);
              return (
                <button key={t} type="button" onClick={() => toggleTrait(t)}
                  className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${on
                    ? (risky ? 'bg-rose-600 text-white border-rose-600' : 'bg-seafoam text-white border-seafoam')
                    : 'bg-slate-50 dark:bg-zinc-950 text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam/50'}`}>
                  {t}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <input className="field-input !h-7 text-[11px] flex-1" placeholder="Add a trait…" value={behaviourDraft}
              onChange={e => setBehaviourDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && behaviourDraft.trim()) { setBehaviourPersist([...behaviour, behaviourDraft.trim()]); setBehaviourDraft(''); } }} />
            <button type="button" onClick={() => { if (behaviourDraft.trim()) { setBehaviourPersist([...behaviour, behaviourDraft.trim()]); setBehaviourDraft(''); } }}
              className="px-2.5 h-7 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all shrink-0">Add</button>
          </div>
          <p className="text-[8px] font-bold text-slate-400">{savingBehaviour ? 'Saving…' : 'Saved to the pet record — shows on the patient profile.'}</p>
        </div>
        )}
      </InfoCard>

      <InfoCard icon={Stethoscope} title="Clinical Snapshot"
        summary={`${past.length} past visit${past.length === 1 ? '' : 's'} · ${vaccinesGiven} vaccine${vaccinesGiven === 1 ? '' : 's'} given`}>
        <div className="space-y-1.5">
          <InfoRow label="Past visits" value={String(past.length)} />
          {lastVisit && <InfoRow label="Last visit" value={`${formatDate(lastVisit.date)} — ${(lastVisit.tasks || []).slice(0, 2).map(t => t.name).join(', ') || lastVisit.visitType || ''}`} />}
          {(petSnapshot?.currentMedications || []).length > 0 && <InfoRow label="Current meds" value={(petSnapshot.currentMedications as string[]).join(', ')} />}
          {visitReminder && <InfoRow label="Reminder due" value={formatDate(visitReminder.dueAt)} />}
          {vaccineHistory.length > 0 && (
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-1.5 mt-1.5 space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Vaccines given</p>
              {vaccineHistory.slice(0, 6).map((v, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-bold text-pine dark:text-zinc-100">💉 {v.name}</span>
                  <span className="text-[9px] font-bold text-slate-400">{formatDate(v.date)}</span>
                </div>
              ))}
              {vaccineHistory.length > 6 && <p className="text-[8px] font-bold text-slate-400 text-center">+{vaccineHistory.length - 6} more</p>}
            </div>
          )}
          {dueVaccines.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {dueVaccines.map((v: any) => (
                <span key={v.id} className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase tracking-wider">Due: {v.name}</span>
              ))}
            </div>
          )}
          {lastVisit && onNavigateToVisit && (
            <button onClick={() => onNavigateToVisit(lastVisit.id)} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:text-pine dark:hover:text-zinc-100 transition-all">Open last visit</button>
          )}
          {/* Follow-up booking lives in the Follow-up Plan card — no duplicate here. */}
        </div>
      </InfoCard>

      {/* View a created reminder / appointment right here — no navigation. */}
      {viewItem && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setViewItem(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight flex items-center gap-2">
                {viewItem.type === 'reminder' ? <><Bell size={14} className="text-amber-500" /> Reminder</> : <><Calendar size={14} className="text-indigo-500" /> Appointment</>}
              </h3>
              <button onClick={() => setViewItem(null)} className="text-slate-400 hover:text-pine"><X size={16} /></button>
            </div>
            <div className="space-y-2">
              {(viewItem.type === 'reminder' ? [
                ['Title', viewItem.data.title],
                ['Due', formatDate(viewItem.data.dueAt)],
                ['Type', String(viewItem.data.serviceType || '').replace('_', ' ')],
                ['Status', String(viewItem.data.status || '').replace('_', ' ')],
                ['Assignee', viewItem.data.meta?.assignedToName],
                ['Notes', viewItem.data.notes],
              ] : [
                ['When', `${formatDate(viewItem.data.scheduledAt)} · ${new Date(viewItem.data.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`],
                ['Encounter', String(viewItem.data.encounterType || 'VET_VISIT').replace('_', ' ')],
                ['Status', String(viewItem.data.status || '').replace('_', ' ')],
                ['Came from', viewItem.data.sourceDetail],
                ['Staged services', (viewItem.data.stagedItems || []).map((s: any) => s.name).join(', ')],
                ['Note', viewItem.data.note],
              ]).filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex items-baseline justify-between gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{k}</span>
                  <span className="text-[11px] font-bold text-pine dark:text-zinc-100 text-right">{v}</span>
                </div>
              ))}
            </div>
            {/* Edit/reschedule a pending reminder in place */}
            {!readOnly && viewItem.type === 'reminder' && viewItem.data.status === 'PENDING' && (
              editReminder ? (
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                  <input className="field-input" value={editReminder.title} onChange={e => setEditReminder({ ...editReminder, title: e.target.value })} placeholder="Reminder title" />
                  <div className="flex gap-2">
                    <input type="date" className="field-input flex-1" value={editReminder.dueDate} onChange={e => setEditReminder({ ...editReminder, dueDate: e.target.value })} />
                    <select className="field-select flex-1" value={editReminder.serviceType} onChange={e => setEditReminder({ ...editReminder, serviceType: e.target.value })}>
                      {['VACCINATION', 'DEWORMING', 'GROOMING', 'FOLLOW_UP', 'MEDICATION', 'FEEDING', 'CHECKUP', 'OTHER'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveReminderEdit} disabled={savingReminderEdit} className="flex-1 py-2 rounded-xl bg-seafoam text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{savingReminderEdit ? 'Saving…' : 'Save changes'}</button>
                    <button onClick={() => setEditReminder(null)} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[10px] font-black uppercase tracking-widest">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditReminder({
                    id: String(viewItem.data.id),
                    title: viewItem.data.title || '',
                    dueDate: viewItem.data.dueAt ? new Date(viewItem.data.dueAt).toISOString().slice(0, 10) : '',
                    serviceType: viewItem.data.serviceType || 'OTHER',
                  })}
                  className="w-full py-2 rounded-xl bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all"
                >
                  ✏️ Edit / reschedule reminder
                </button>
              )
            )}
            <button onClick={() => setViewItem(null)} className="w-full py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientRail;
