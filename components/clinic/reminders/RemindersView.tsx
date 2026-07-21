import React, { useState, useEffect, useCallback, useMemo } from 'react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { BellRing, Loader2, CalendarPlus, Check, X, Search, AlertCircle, CheckCircle2, PhoneCall, ExternalLink, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { remindersAPI, appointmentsAPI, Reminder, ReminderScope, ReminderServiceType, REMINDER_SERVICE_META } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import { useData } from '../../../contexts/DataContext';
import ReasonModal from '../shared/ReasonModal';
import AppointmentCreateModal from '../appointments/AppointmentCreateModal';
import LinkPickerModal, { LinkItem } from '../shared/LinkPickerModal';
import RecordDetailModal from '../shared/RecordDetailModal';

interface Props {
  onOpenAppointment?: (appointmentId: string) => void;
  // Jump to the Appointments (bookings) page; pass a booking id to open its details.
  onOpenBookings?: (bookingId?: string) => void;
  // When navigated from a linked card, auto-open this reminder's details.
  focusId?: string;
}

// A reminder's service type maps to the appointment's encounter type.
const REMINDER_TO_ENCOUNTER: Record<string, string> = { GROOMING: 'GROOMING', VACCINATION: 'VACCINATION' };

const SCOPES: { value: ReminderScope; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
];

const SERVICE_FILTER: (ReminderServiceType | 'all')[] = ['all', 'FOLLOW_UP', 'VACCINATION', 'DEWORMING', 'GROOMING', 'MEDICATION', 'CHECKUP', 'OTHER'];

const isOverdue = (r: Reminder) => r.status === 'PENDING' && new Date(r.dueAt).getTime() < Date.now();

const serviceTone: Record<string, string> = {
  VACCINATION: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  DEWORMING: 'bg-lime-50 text-lime-600 dark:bg-lime-950/40 dark:text-lime-400',
  GROOMING: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  FOLLOW_UP: 'bg-seafoam/10 text-seafoam',
  MEDICATION: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
  FEEDING: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  CHECKUP: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400',
  OTHER: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const RemindersView: React.FC<Props> = ({ onOpenAppointment, onOpenBookings, focusId }) => {
  const { pets, clients } = useData();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<ReminderScope>('upcoming');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [service, setService] = useState<ReminderServiceType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissFor, setDismissFor] = useState<Reminder | null>(null);
  const [detail, setDetail] = useState<Reminder | null>(null);
  // The reminder being booked → opens the pre-filled New Appointment modal.
  const [bookFor, setBookFor] = useState<Reminder | null>(null);
  // originReminderId -> the booking created from that reminder (chain link).
  const [bookingByReminder, setBookingByReminder] = useState<Record<string, string>>({});
  // All bookings (for the manual "attach existing appointment" picker).
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [attachFor, setAttachFor] = useState<Reminder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await remindersAPI.list({ scope, serviceType: service === 'all' ? undefined : service });
      if (res.success && res.data?.reminders) setReminders(res.data.reminders);
      // Map appointments (bookings) back to their origin reminder so the card can
      // show "appointment from reminder" (no backend change needed).
      const appts = await appointmentsAPI.list().catch(() => null);
      if (appts?.success && appts.data?.appointments) {
        setAllBookings(appts.data.appointments);
        const map: Record<string, string> = {};
        appts.data.appointments.forEach(a => { if (a.originReminderId) map[String(a.originReminderId)] = a.id; });
        setBookingByReminder(map);
      }
    } catch (e) { console.error('Failed to load reminders', e); }
    finally { setLoading(false); }
  }, [scope, service]);

  useEffect(() => { load(); }, [load]);
  // Open the broadest scope when arriving with a focus target so it's findable.
  useEffect(() => { if (focusId) setScope('all'); }, [focusId]);
  useEffect(() => {
    if (!focusId || !reminders.length) return;
    const r = reminders.find(x => String(x.id) === String(focusId));
    if (r) setDetail(r);
  }, [focusId, reminders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? reminders.filter(r => `${r.pet?.name ?? ''} ${r.client?.name ?? ''} ${r.title ?? ''}`.toLowerCase().includes(q))
      : reminders;
    // Uncompleted always on top, nearest due date first (today up top);
    // handled ones follow in the same date order.
    const rank = (r: Reminder) => (r.status === 'PENDING' ? 0 : 1);
    return [...base].sort((a, b) => rank(a) - rank(b) || +new Date(a.dueAt) - +new Date(b.dueAt));
  }, [reminders, search]);

  // Booking from a reminder opens the pre-filled New Appointment modal (patient,
  // type, date, note staged from the reminder) so staff can confirm time/services
  // before it's created — NOT a visit. The visit is created later via "Start visit"
  // on the appointment. source=REMINDER + originReminderId keep the loop connected.
  const book = (r: Reminder) => setBookFor(r);

  // Build modal pre-fill from a reminder.
  const prefillFor = (r: Reminder) => {
    const d = new Date(r.dueAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      petId: String(r.petId),
      petLabel: r.pet?.name ?? 'Patient',
      note: r.title ?? undefined,
      encounterType: REMINDER_TO_ENCOUNTER[r.serviceType] ?? 'VET_VISIT',
      date: isNaN(d.getTime()) ? undefined : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      // Reminder due dates are usually DATE-only (00:00 UTC) — booking at the
      // literal timestamp lands at 03:00 EAT. Default those to a sane 09:00.
      time: isNaN(d.getTime())
        ? undefined
        : (d.getUTCHours() === 0 && d.getUTCMinutes() === 0)
        ? '09:00'
        : `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  };

  // Manually attach an existing appointment (booking) that has no reminder yet.
  const attachItems: LinkItem[] = useMemo(() => {
    if (!attachFor) return [];
    return allBookings
      .filter(b => !b.originReminderId)
      .filter(b => !attachFor.petId || String(b.petId) === String(attachFor.petId))
      .slice(0, 50)
      .map(b => ({ id: String(b.id), label: `${pets.find((p: any) => String(p.id) === String(b.petId))?.name || 'Patient'} · ${b.note || (b.encounterType || '').replace('_', ' ')}`, sublabel: b.scheduledAt ? formatDate(b.scheduledAt) : undefined }));
  }, [attachFor, allBookings, pets]);
  const doAttachAppt = async (bookingId: string) => {
    if (!attachFor) return;
    setBusyId(attachFor.id);
    try {
      const res = await appointmentsAPI.update(bookingId, { originReminderId: attachFor.id } as any);
      if (res.success) { toast.success('Appointment attached'); setAttachFor(null); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to attach'); } finally { setBusyId(null); }
  };

  // Dismiss with a captured reason (stored on the reminder notes) so we know why
  // it never became an appointment.
  const doDismiss = async (reason: string) => {
    if (!dismissFor) return;
    const r = dismissFor;
    setBusyId(r.id);
    try {
      if (reason) await remindersAPI.update(r.id, { notes: r.notes ? `${r.notes} · [dismissed: ${reason}]` : `[dismissed: ${reason}]` });
      await remindersAPI.dismiss(r.id);
      toast.success('Reminder dismissed'); setDismissFor(null); await load();
    } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusyId(null); }
  };

  const setStatus = async (r: Reminder, status: 'DONE' | 'DISMISSED') => {
    setBusyId(r.id);
    try {
      const res = status === 'DONE' ? await remindersAPI.markDone(r.id) : await remindersAPI.dismiss(r.id);
      if (res.success) { toast.success(status === 'DONE' ? 'Marked done' : 'Dismissed'); load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to update reminder'); }
    finally { setBusyId(null); }
  };

  const toggleContacted = async (r: Reminder) => {
    setBusyId(r.id);
    try {
      const res = await remindersAPI.setContacted(r.id, !r.contactedAt);
      if (res.success) { toast.success(r.contactedAt ? 'Marked not contacted' : 'Client marked contacted'); load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
    finally { setBusyId(null); }
  };

  const pendingCount = reminders.filter(r => r.status === 'PENDING').length;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-seafoam/10 flex items-center justify-center"><BellRing size={22} className="text-seafoam" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Reminders</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{filtered.length} shown · {pendingCount} pending</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          {SCOPES.map(s => (
            <button key={s.value} onClick={() => setScope(s.value)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scope === s.value ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <select value={service} onChange={e => setService(e.target.value as any)}
          className="px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam">
          {SERVICE_FILTER.map(s => <option key={s} value={s}>{s === 'all' ? 'All services' : REMINDER_SERVICE_META[s].label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pet, client or title"
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size="md" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <BellRing size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-slate-400">No reminders match</p>
          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">They're created automatically when a visit is finalized.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(r => {
            const overdue = isOverdue(r);
            const done = r.status === 'DONE';
            const dismissed = r.status === 'DISMISSED';
            // Time-bucket accent (pending only): overdue = orange, due today =
            // blue, upcoming = green. Done/dismissed cards stay neutral+dim.
            const dueToday = !overdue && new Date(r.dueAt).toDateString() === new Date().toDateString();
            const tone = (done || dismissed)
              ? 'border-slate-200 dark:border-zinc-800'
              : overdue
                ? 'border-orange-300 dark:border-orange-700/60 border-l-4 border-l-orange-400 bg-orange-50/40 dark:bg-orange-950/10'
                : dueToday
                  ? 'border-sky-300 dark:border-sky-700/60 border-l-4 border-l-sky-400 bg-sky-50/40 dark:bg-sky-950/10'
                  : 'border-emerald-300 dark:border-emerald-800/60 border-l-4 border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10';
            return (
              <div key={r.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-sm flex flex-col ${tone} ${(done || dismissed) ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <button onClick={() => setDetail(r)} className="flex items-center gap-2 min-w-0 text-left">
                    <span className="text-xl shrink-0">{r.pet?.species === 'Cat' ? '🐱' : '🐶'}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate hover:text-seafoam transition-colors">{r.pet?.name}</span>
                      <span className="block text-[10px] text-slate-400 truncate">{r.client?.name}</span>
                    </span>
                  </button>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${serviceTone[r.serviceType] ?? serviceTone.OTHER}`}>{REMINDER_SERVICE_META[r.serviceType]?.label ?? r.serviceType}</span>
                </div>

                {r.title && <p className="text-xs font-bold text-pine dark:text-zinc-200 mb-0.5 truncate">{r.title}</p>}
                {r.notes && <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 mb-2">{r.notes}</p>}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold mb-2">
                  <span className={`flex items-center gap-1 ${overdue ? 'text-rose-500' : 'text-slate-400'}`}>
                    {overdue ? <AlertCircle size={12} /> : <CalendarPlus size={12} />}
                    {done ? `Done ${r.completedAt ? formatDate(r.completedAt) : ''}` : dismissed ? 'Dismissed' : `Due ${formatDate(r.dueAt)}`}
                    {overdue ? ' · overdue' : ''}
                  </span>
                  {r.contactedAt && <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400"><PhoneCall size={11} /> Contacted {formatDate(r.contactedAt)}</span>}
                  {r.originAppointmentId && (
                    <button onClick={() => onOpenAppointment?.(r.originAppointmentId!)} className="flex items-center gap-1 text-slate-400 hover:text-seafoam underline-offset-2 hover:underline">
                      <ExternalLink size={11} /> Originating visit
                    </button>
                  )}
                  {/* Chain: appointment (booking) from reminder, and the visit it became. */}
                  {bookingByReminder[r.id] && (
                    <button onClick={() => onOpenBookings?.(bookingByReminder[r.id])} className="flex items-center gap-1 text-violet-500 underline-offset-2 hover:underline">
                      <CalendarPlus size={11} /> Appointment from reminder
                    </button>
                  )}
                  {r.bookedAppointmentId && (
                    <button onClick={() => onOpenAppointment?.(r.bookedAppointmentId!)} className="flex items-center gap-1 text-seafoam underline-offset-2 hover:underline">
                      <ExternalLink size={11} /> Visit from reminder
                    </button>
                  )}
                  {/* Booking actions only make sense while the reminder is open —
                      done/dismissed cards keep just their history links. */}
                  {r.status === 'PENDING' && !r.bookedAppointmentId && !bookingByReminder[r.id] && (
                    <button onClick={() => book(r)} disabled={busyId === r.id} className="flex items-center gap-1 text-pine dark:text-zinc-200 hover:text-seafoam underline-offset-2 hover:underline disabled:opacity-50">
                      {busyId === r.id ? <Loader2 size={11} className="animate-spin" /> : <CalendarPlus size={11} />} Create appointment
                    </button>
                  )}
                  {r.status === 'PENDING' && !r.bookedAppointmentId && !bookingByReminder[r.id] && (
                    <button onClick={() => setAttachFor(r)} disabled={busyId === r.id} className="flex items-center gap-1 text-slate-400 hover:text-seafoam underline-offset-2 hover:underline disabled:opacity-50">
                      <ExternalLink size={11} /> Attach existing
                    </button>
                  )}
                </div>

                {r.status === 'PENDING' && (
                  /* mt-auto pins the action row to the card bottom so a grid
                     row's Book buttons line up regardless of content height. */
                  <div className="flex items-center gap-1.5 mt-auto pt-2">
                    {r.bookedAppointmentId ? (
                      <button onClick={() => onOpenAppointment?.(r.bookedAppointmentId!)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-seafoam/10 text-seafoam rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/20">
                        <ExternalLink size={12} /> View appointment
                      </button>
                    ) : (
                      <button onClick={() => book(r)} disabled={busyId === r.id} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-pine text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-pine/90 active:scale-95 disabled:opacity-50">
                        {busyId === r.id ? <Loader2 size={12} className="animate-spin" /> : <CalendarPlus size={12} />} Book
                      </button>
                    )}
                    <button onClick={() => toggleContacted(r)} disabled={busyId === r.id} title={r.contactedAt ? 'Mark not contacted' : 'Mark client contacted'} className={`p-2 rounded-lg disabled:opacity-50 ${r.contactedAt ? 'bg-cyan-100 dark:bg-cyan-950/40 text-cyan-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:bg-slate-200'}`}><PhoneCall size={13} /></button>
                    <div className="relative">
                      <button onClick={() => setMenuFor(menuFor === r.id ? null : r.id)} disabled={busyId === r.id} title="More"
                              className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:bg-slate-200 disabled:opacity-50">
                        <MoreVertical size={13} />
                      </button>
                      {menuFor === r.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                          <div className="absolute right-0 bottom-full mb-1 z-20 w-40 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden">
                            {/* Mark done only once the due date has arrived —
                                before that: reschedule (edit) / dismiss. */}
                            {new Date(new Date(r.dueAt).setHours(0, 0, 0, 0)).getTime() <= Date.now() && (
                              <button onClick={() => { setMenuFor(null); setStatus(r, 'DONE'); }}
                                      className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                                <Check size={13} /> Mark done
                              </button>
                            )}
                            <button onClick={() => { setMenuFor(null); setDismissFor(r); }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800">
                              <X size={13} /> Dismiss
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {done && <p className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-auto pt-2"><CheckCircle2 size={12} /> Completed</p>}
              </div>
            );
          })}
        </div>
      )}

      {bookFor && (
        <AppointmentCreateModal
          pets={pets}
          clients={clients}
          source="REMINDER"
          originReminderId={bookFor.id}
          prefill={prefillFor(bookFor)}
          onClose={() => setBookFor(null)}
          onSaved={() => { setBookFor(null); load(); onOpenBookings?.(); }}
        />
      )}

      {dismissFor && (
        <ReasonModal
          title="Dismiss reminder"
          subtitle="Why isn't this becoming an appointment? (helps track conversion)"
          confirmLabel="Dismiss"
          submitting={busyId === dismissFor.id}
          chips={['Client unreachable', 'Client declined', 'Already booked elsewhere', 'No longer needed', 'Duplicate', 'Other']}
          onCancel={() => setDismissFor(null)}
          onConfirm={doDismiss}
        />
      )}

      {detail && (
        <RecordDetailModal
          title={detail.pet?.name || 'Patient'}
          subtitle={`${detail.client?.name || ''} · ${REMINDER_SERVICE_META[detail.serviceType]?.label ?? detail.serviceType}`}
          icon={<div className="w-9 h-9 rounded-xl bg-seafoam/10 flex items-center justify-center shrink-0"><BellRing size={18} className="text-seafoam" /></div>}
          fields={[
            { label: 'Service', value: REMINDER_SERVICE_META[detail.serviceType]?.label ?? detail.serviceType },
            { label: 'Due', value: detail.dueAt ? formatDate(detail.dueAt) : undefined },
            { label: 'Status', value: detail.status.toLowerCase() },
            { label: 'Contacted', value: detail.contactedAt ? formatDate(detail.contactedAt) : 'Not yet' },
            { label: 'Title', value: detail.title },
            { label: 'Notes', value: detail.notes },
            // Always show the appointment state so there's no guessing: either
            // an explicit "Booked" link, or "None yet" + the create flow below.
            { label: 'Appointment', value: (bookingByReminder[detail.id] || detail.bookedAppointmentId) ? (
                <button
                  onClick={() => {
                    if (bookingByReminder[detail.id]) onOpenBookings?.(bookingByReminder[detail.id]);
                    else if (detail.bookedAppointmentId) onOpenAppointment?.(detail.bookedAppointmentId);
                    setDetail(null);
                  }}
                  className="inline-flex items-center gap-1 text-violet-500 hover:underline"
                >
                  <ExternalLink size={11} /> Booked — view appointment
                </button>
              ) : (
                <span className="text-slate-400">None yet — call the client, then create one below</span>
              ) },
            { label: 'Originating visit', value: detail.originAppointmentId ? <button onClick={() => { onOpenAppointment?.(detail.originAppointmentId!); setDetail(null); }} className="text-seafoam hover:underline">View visit</button> : undefined },
          ]}
          onClose={() => setDetail(null)}
        >
          {detail.status === 'PENDING' && (
            <>
              {/* The intended flow: call the client, mark contacted, then book. */}
              <button
                onClick={async () => {
                  try {
                    const res = await remindersAPI.setContacted(detail.id, !detail.contactedAt);
                    if (res.success) {
                      toast.success(detail.contactedAt ? 'Marked not contacted' : 'Client marked contacted');
                      setDetail({ ...detail, contactedAt: detail.contactedAt ? null : new Date().toISOString() } as any);
                      load();
                    }
                  } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${detail.contactedAt ? 'bg-cyan-100 dark:bg-cyan-950/40 text-cyan-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
              >
                <PhoneCall size={12} /> {detail.contactedAt ? 'Contacted ✓' : 'Mark client contacted'}
              </button>
              {!bookingByReminder[detail.id] && !detail.bookedAppointmentId && (
                <button onClick={() => { setBookFor(detail); setDetail(null); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest hover:bg-pine/90"><CalendarPlus size={12} /> Create appointment</button>
              )}
            </>
          )}
        </RecordDetailModal>
      )}

      {attachFor && (
        <LinkPickerModal
          title="Attach an appointment"
          subtitle="Appointments not yet linked to a reminder"
          items={attachItems}
          busyId={busyId === attachFor.id ? '__busy__' : null}
          onSelect={doAttachAppt}
          onClose={() => setAttachFor(null)}
          emptyText="No unlinked appointments for this patient."
        />
      )}
    </div>
  );
};

export default RemindersView;
