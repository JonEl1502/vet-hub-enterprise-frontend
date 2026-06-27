import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarClock, Plus, Loader2, Trash2, Search, Clock, ArrowRight, BellRing, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { appointmentsAPI, Appointment } from '../../../services';
import type { AppointmentStatus } from '../../../services/modules/appointmentBookings.api';
import { formatDate } from '../../../services/utils/dateFormatter';
import ReasonModal from '../shared/ReasonModal';
import AppointmentCreateModal from './AppointmentCreateModal';

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
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  {a.status === 'REQUESTED' && <button disabled={busyId === a.id} onClick={() => setStatusOf(a, 'CONFIRMED')} className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 disabled:opacity-50">Confirm</button>}
                  {(a.status === 'REQUESTED' || a.status === 'CONFIRMED') && <button disabled={busyId === a.id} onClick={() => startVisit(a)} title="Start the visit" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-50">Start visit <ArrowRight size={11} /></button>}
                  {(a.status === 'REQUESTED' || a.status === 'CONFIRMED') && <>
                    <button disabled={busyId === a.id} onClick={() => setStatusOf(a, 'RESCHEDULED')} className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 disabled:opacity-50">Reschedule</button>
                    <button disabled={busyId === a.id} onClick={() => setReasonFor({ appt: a, status: 'CANCELLED' })} className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 disabled:opacity-50">Cancel</button>
                    <button disabled={busyId === a.id} onClick={() => setReasonFor({ appt: a, status: 'NO_SHOW' })} className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-500/10 text-slate-500 hover:bg-slate-500/20 disabled:opacity-50">No-show</button>
                  </>}
                  <button disabled={busyId === a.id} onClick={() => remove(a)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <AppointmentCreateModal pets={pets} clients={clients} source="FRONT_DESK" onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
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
