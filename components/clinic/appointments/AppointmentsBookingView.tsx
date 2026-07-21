import React, { useState, useEffect, useCallback, useMemo } from 'react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { CalendarClock, Plus, Loader2, Trash2, Search, Clock, ArrowRight, BellRing, ExternalLink, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { appointmentsAPI, remindersAPI, Appointment } from '../../../services';
import type { AppointmentStatus } from '../../../services/modules/appointmentBookings.api';
import { formatDate } from '../../../services/utils/dateFormatter';
import ReasonModal from '../shared/ReasonModal';
import AppointmentCreateModal from './AppointmentCreateModal';
import LinkPickerModal, { LinkItem } from '../shared/LinkPickerModal';
import RescheduleModal from '../shared/RescheduleModal';
import RecordDetailModal from '../shared/RecordDetailModal';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';

interface Props {
  // Jump to a Visit once an appointment is started/converted.
  onOpenVisit?: (visitId: string) => void;
  // Start a visit from a booking — opens the new-visit form pre-filled with the
  // booking's patient + staged categories/services.
  onStartVisit?: (a: Appointment) => void;
  // Jump to the reminder this booking was created from.
  onOpenReminder?: (reminderId: string) => void;
  // When navigated from a linked card, auto-open this booking's details.
  focusId?: string;
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

const AppointmentsBookingView: React.FC<Props> = ({ onStartVisit, onOpenVisit, onOpenReminder, focusId }) => {
  const { pets, clients, appointments: visits } = useData() as any;
  const [records, setRecords] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Manual linking: attach an existing visit or reminder to a booking.
  const [attach, setAttach] = useState<{ booking: Appointment; kind: 'visit' | 'reminder' } | null>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Appointment | null>(null);
  // Auto-open details when navigated from a linked card (focusId), once loaded.
  useEffect(() => {
    if (!focusId || !records.length) return;
    const a = records.find(r => String(r.id) === String(focusId));
    if (a) setDetail(a);
  }, [focusId, records]);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await appointmentsAPI.list(status === 'all' ? {} : { status }); if (res.success && res.data) setRecords(res.data.appointments); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  // Live refresh: a portal booking request pings over SSE → refetch the list.
  useEffect(() => {
    const onStream = (ev: Event) => {
      const e = (ev as CustomEvent).detail;
      if (e?.type === 'booking.requested') load();
    };
    window.addEventListener('vethub:stream', onStream);
    return () => window.removeEventListener('vethub:stream', onStream);
  }, [load]);
  // Reminders (for the attach picker) — fetch once.
  useEffect(() => { remindersAPI.list({ scope: 'all' }).then(r => { if (r.success && r.data?.reminders) setReminders(r.data.reminders); }).catch(() => {}); }, []);

  // Candidate lists for manual linking (exclude already-linked records).
  const linkedVisitIds = useMemo(() => new Set(records.map(r => r.convertedVisitId).filter(Boolean).map(String)), [records]);
  const linkedReminderIds = useMemo(() => new Set(records.map(r => r.originReminderId).filter(Boolean).map(String)), [records]);
  const attachItems: LinkItem[] = useMemo(() => {
    if (!attach) return [];
    if (attach.kind === 'visit') {
      return (visits || [])
        .filter((v: any) => !linkedVisitIds.has(String(v.id)))
        .filter((v: any) => !attach.booking.petId || String(v.petId) === String(attach.booking.petId))
        .slice(0, 50)
        .map((v: any) => ({ id: String(v.id), label: `${pets.find((p: any) => String(p.id) === String(v.petId))?.name || 'Patient'} · Visit #${v.id}`, sublabel: `${formatDate(v.date)} · ${(v.encounterType || 'VET_VISIT').replace('_', ' ')}` }));
    }
    return reminders
      .filter((rm: any) => !linkedReminderIds.has(String(rm.id)) && rm.status !== 'DISMISSED')
      .filter((rm: any) => !attach.booking.petId || String(rm.petId) === String(attach.booking.petId))
      .slice(0, 50)
      .map((rm: any) => ({ id: String(rm.id), label: `${rm.pet?.name || 'Patient'} · ${rm.title || rm.serviceType}`, sublabel: rm.dueAt ? `Due ${formatDate(rm.dueAt)}` : undefined }));
  }, [attach, visits, reminders, linkedVisitIds, linkedReminderIds, pets]);

  const doAttach = async (targetId: string) => {
    if (!attach) return;
    setBusyId(attach.booking.id);
    try {
      const patch = attach.kind === 'visit' ? { convertedVisitId: targetId } : { originReminderId: targetId };
      const res = await appointmentsAPI.update(attach.booking.id, patch as any);
      if (res.success) { toast.success(attach.kind === 'visit' ? 'Visit attached' : 'Reminder attached'); setAttach(null); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to attach'); } finally { setBusyId(null); }
  };

  const petName = (a: Appointment) => pets.find((p: any) => String(p.id) === String(a.petId))?.name || 'Patient';
  const clientName = (a: Appointment) => clients.find((c: any) => String(c.id) === String(a.clientId))?.name || '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = records;
    // Date filter — by SCHEDULED date, so the list can answer "what's booked
    // for this window" (matches the dashboard tiles).
    if (dateRange?.start) list = list.filter(a => new Date(a.scheduledAt) >= new Date(dateRange.start));
    if (dateRange?.end) { const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999); list = list.filter(a => new Date(a.scheduledAt) <= end); }
    if (q) list = list.filter(a => `${petName(a)} ${clientName(a)} ${a.note ?? ''}`.toLowerCase().includes(q));
    // Actionable bookings first; CONVERTED sink below them; cancelled/no-show last.
    const rank = (a: Appointment) =>
      a.status === 'CONVERTED' ? 1 : (a.status === 'CANCELLED' || a.status === 'NO_SHOW') ? 2 : 0;
    return [...list].sort((a, b) => rank(a) - rank(b) || +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  }, [records, search, pets, clients, dateRange]);

  const setStatusOf = async (a: Appointment, next: AppointmentStatus) => {
    setBusyId(a.id);
    try { const res = await appointmentsAPI.update(a.id, { status: next }); if (res.success) { toast.success(`Marked ${next.toLowerCase()}`); await load(); } }
    catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusyId(null); }
  };

  // Reschedule = pick a new date/time, set status RESCHEDULED + the new scheduledAt.
  const doReschedule = async (iso: string) => {
    if (!rescheduleFor) return;
    setBusyId(rescheduleFor.id);
    try {
      const res = await appointmentsAPI.update(rescheduleFor.id, { status: 'RESCHEDULED', scheduledAt: iso } as any);
      if (res.success) { toast.success('Rescheduled'); setRescheduleFor(null); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusyId(null); }
  };

  // Start a visit from this booking: open the new-visit form pre-filled with the
  // patient + staged categories/services. The booking is only marked CONVERTED
  // AFTER the visit is actually created (App's onSave) — so cancelling the form
  // midway leaves the booking untouched.
  const startVisit = (a: Appointment) => { onStartVisit?.(a); };
  // A visit can only START on its scheduled date — earlier or later means
  // the booking should be rescheduled first (front-desk reality: the client
  // is here on a different day than booked).
  const isStartDay = (a: Appointment) => new Date(a.scheduledAt).toDateString() === new Date().toDateString();

  // Cancel / No-show with a captured reason (stored on the booking note so we
  // know why it didn't convert to a visit).
  const [reasonFor, setReasonFor] = useState<{ appt: Appointment; status: AppointmentStatus } | null>(null);
  const applyReason = async (reason: string) => {
    if (!reasonFor) return;
    const { appt, status } = reasonFor;
    setBusyId(appt.id);
    try {
      const note = `[${status.replace('_', ' ').toLowerCase()}] ${reason}${appt.note ? ` — ${appt.note}` : ''}`;
      const res = await appointmentsAPI.update(appt.id, { status, note } as any);
      if (res.success) { toast.success(`Marked ${status.toLowerCase().replace('_', ' ')}`); setReasonFor(null); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusyId(null); }
  };

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
        <button
          onClick={() => {
            const start = new Date(); start.setHours(0, 0, 0, 0);
            const end = new Date(); end.setHours(23, 59, 59, 999);
            const isToday = dateRange?.start && new Date(dateRange.start).toDateString() === start.toDateString()
              && dateRange?.end && new Date(dateRange.end).toDateString() === start.toDateString();
            setDateRange(isToday ? null : ({ start, end } as any));
          }}
          className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
            dateRange?.start && new Date(dateRange.start).toDateString() === new Date().toDateString()
              ? 'bg-pine text-white border-pine'
              : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-pine/50'
          }`}
        >
          Today
        </button>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, client, note" className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" /></div>
      </div>

      {loading ? <div className="flex items-center justify-center py-16"><LoadingSpinner size="md" /></div>
      : filtered.length === 0 ? <div className="flex flex-col items-center justify-center text-center py-16"><CalendarClock size={28} className="text-slate-300 dark:text-zinc-700 mb-3" /><p className="text-sm font-bold text-slate-400">No appointments</p><p className="text-[11px] text-slate-400">Bookings made from reminders, front desk, or your website appear here.</p></div>
      : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(a => {
            // Terminal bookings are read-only: no edit (status/reschedule/attach) or delete.
            const locked = a.status === 'CONVERTED' || a.status === 'CANCELLED' || a.status === 'NO_SHOW';
            // Time-bucket accent (open bookings only): overdue = orange,
            // due today = blue, upcoming = green. Terminal cards stay neutral.
            const when = new Date(a.scheduledAt);
            const now = new Date();
            const sameDay = when.toDateString() === now.toDateString();
            const tone = locked
              ? 'border-slate-200 dark:border-zinc-800'
              : when < now
                ? 'border-orange-300 dark:border-orange-700/60 border-l-4 border-l-orange-400 bg-orange-50/40 dark:bg-orange-950/10'
                : sameDay
                  ? 'border-sky-300 dark:border-sky-700/60 border-l-4 border-l-sky-400 bg-sky-50/40 dark:bg-sky-950/10'
                  : 'border-emerald-300 dark:border-emerald-800/60 border-l-4 border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10';
            return (
            <div key={a.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-sm flex flex-col gap-2.5 ${tone}`}>
              {/* Header: patient/owner + meta · delete */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button onClick={() => setDetail(a)} className="block text-sm font-black text-pine dark:text-zinc-100 truncate hover:text-seafoam transition-colors text-left">{petName(a)} <span className="text-slate-400 font-medium">· {clientName(a)}</span></button>
                  <p className="text-[10px] text-slate-400 flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="inline-flex items-center gap-1"><Clock size={11} /> {formatDate(a.scheduledAt)} {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${STATUS_TONE[a.status]}`}>{a.status.toLowerCase().replace('_', ' ')}</span>
                    <span className="text-slate-300 dark:text-zinc-600">{a.source.toLowerCase().replace('_', ' ')}</span>
                    {a.originReminderId && (onOpenReminder
                      ? <button onClick={() => onOpenReminder(a.originReminderId!)} className="inline-flex items-center gap-0.5 text-violet-500 hover:underline"><BellRing size={9} /> from reminder</button>
                      : <span className="inline-flex items-center gap-0.5 text-violet-500"><BellRing size={9} /> from reminder</span>)}
                    {a.convertedVisitId && <button onClick={() => onOpenVisit?.(a.convertedVisitId!)} className="inline-flex items-center gap-0.5 text-seafoam hover:underline"><ExternalLink size={9} /> visit created</button>}
                  </p>
                  {a.note && <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">{a.note}</p>}
                </div>
                <button disabled={busyId === a.id || locked} onClick={() => remove(a)} title={locked ? 'A converted/cancelled/no-show appointment cannot be deleted' : 'Delete'} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400 shrink-0"><Trash2 size={13} /></button>
              </div>
              {/* Actions — own row so they wrap without overlapping the meta */}
              <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-slate-100 dark:border-zinc-800">
                {(() => { const active = !locked; return (<>
                {active && a.status !== 'CONFIRMED' && <button disabled={busyId === a.id} onClick={() => setStatusOf(a, 'CONFIRMED')} className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 disabled:opacity-50">Confirm</button>}
                {active && isStartDay(a) && <button disabled={busyId === a.id} onClick={() => startVisit(a)} title="Start the visit" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-50">Start visit <ArrowRight size={11} /></button>}
                {active && !isStartDay(a) && <span title="Visits start on the scheduled date — reschedule to today if the client is here now" className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-400">Starts {new Date(a.scheduledAt).toLocaleDateString()}</span>}
                {active && <>
                  <button disabled={busyId === a.id} onClick={() => setRescheduleFor(a)} className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 disabled:opacity-50">Reschedule</button>
                  <button disabled={busyId === a.id} onClick={() => setReasonFor({ appt: a, status: 'CANCELLED' })} className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 disabled:opacity-50">Cancel</button>
                  {/* No-show only offered once the scheduled time has passed —
                      you can't fail to show up for a future appointment. */}
                  {new Date(a.scheduledAt).getTime() <= Date.now() && (
                    <button disabled={busyId === a.id} onClick={() => setReasonFor({ appt: a, status: 'NO_SHOW' })} className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-500/10 text-slate-500 hover:bg-slate-500/20 disabled:opacity-50">No-show</button>
                  )}
                </>}
                </>); })()}
                {/* Manual linking — attach an existing reminder / visit (not on terminal bookings). */}
                {!locked && !a.originReminderId && <button disabled={busyId === a.id} onClick={() => setAttach({ booking: a, kind: 'reminder' })} title="Attach an existing reminder" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 disabled:opacity-50"><Link2 size={11} /> Reminder</button>}
                {!locked && !a.convertedVisitId && <button disabled={busyId === a.id} onClick={() => setAttach({ booking: a, kind: 'visit' })} title="Attach an existing visit" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam/10 text-seafoam hover:bg-seafoam/20 disabled:opacity-50"><Link2 size={11} /> Visit</button>}
              </div>
            </div>
          ); })}
        </div>
      )}

      {attach && (
        <LinkPickerModal
          title={attach.kind === 'visit' ? 'Attach a visit' : 'Attach a reminder'}
          subtitle={attach.kind === 'visit' ? 'Visits not yet linked to an appointment' : 'Reminders not yet linked to an appointment'}
          items={attachItems}
          busyId={busyId === attach.booking.id ? '__busy__' : null}
          onSelect={doAttach}
          onClose={() => setAttach(null)}
          emptyText={attach.kind === 'visit' ? 'No unlinked visits for this patient.' : 'No unlinked reminders for this patient.'}
        />
      )}

      {rescheduleFor && (
        <RescheduleModal initialIso={rescheduleFor.scheduledAt} submitting={busyId === rescheduleFor.id} onCancel={() => setRescheduleFor(null)} onConfirm={doReschedule} />
      )}

      {detail && (
        <RecordDetailModal
          title={petName(detail)}
          subtitle={`${clientName(detail)} · ${detail.status.toLowerCase().replace('_', ' ')}`}
          icon={<div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center shrink-0"><CalendarClock size={18} className="text-indigo-600 dark:text-indigo-400" /></div>}
          fields={[
            { label: 'When', value: `${formatDate(detail.scheduledAt)} · ${new Date(detail.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` },
            { label: 'Type', value: (detail.encounterType || '').replace('_', ' ') },
            { label: 'Source', value: detail.source.toLowerCase().replace('_', ' ') },
            { label: 'Came from', value: detail.sourceDetail || undefined },
            { label: 'Status', value: detail.status.toLowerCase().replace('_', ' ') },
            { label: 'Note', value: detail.note },
            { label: 'Staged services', value: (detail.stagedItems || []).map((s: any) => s.name).join(', ') || undefined },
            { label: 'Linked reminder', value: detail.originReminderId ? (onOpenReminder ? <button onClick={() => { onOpenReminder(detail.originReminderId!); setDetail(null); }} className="text-violet-500 hover:underline">View reminder</button> : 'Yes') : undefined },
            { label: 'Linked visit', value: detail.convertedVisitId ? <button onClick={() => { onOpenVisit?.(detail.convertedVisitId!); setDetail(null); }} className="text-seafoam hover:underline">View visit</button> : undefined },
          ]}
          onClose={() => setDetail(null)}
        >
          {detail.status !== 'CONVERTED' && detail.status !== 'CANCELLED' && (
            <>
              {isStartDay(detail) && (
                <button onClick={() => { startVisit(detail); setDetail(null); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-seafoam text-white text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/90">Start visit <ArrowRight size={12} /></button>
              )}
              <button onClick={() => { setRescheduleFor(detail); setDetail(null); }} className="px-3 py-2 rounded-lg bg-violet-500/10 text-violet-600 text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/20">Reschedule</button>
            </>
          )}
        </RecordDetailModal>
      )}

      {creating && <AppointmentCreateModal pets={pets} clients={clients} source="FRONT_DESK" onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} onStarted={(visitId) => { setCreating(false); onOpenVisit?.(visitId); }} />}
      {reasonFor && (
        <ReasonModal
          title={reasonFor.status === 'NO_SHOW' ? 'Mark no-show' : 'Cancel appointment'}
          subtitle="Why isn't this becoming a visit? (helps track conversion)"
          confirmLabel={reasonFor.status === 'NO_SHOW' ? 'Mark no-show' : 'Cancel appointment'}
          submitting={busyId === reasonFor.appt.id}
          chips={reasonFor.status === 'NO_SHOW'
            ? ['Client no-show', 'Arrived too late', 'Wrong day', 'Other']
            : ['Client cancelled', 'Client unreachable', 'Rescheduled elsewhere', 'Duplicate', 'Price', 'Other']}
          onCancel={() => setReasonFor(null)}
          onConfirm={applyReason}
        />
      )}
    </div>
  );
};

export default AppointmentsBookingView;
