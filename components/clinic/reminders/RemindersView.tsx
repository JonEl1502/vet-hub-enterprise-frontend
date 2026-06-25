import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BellRing, Loader2, CalendarPlus, Check, X, Search, AlertCircle, CheckCircle2, PhoneCall, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { remindersAPI, Reminder, ReminderScope, ReminderServiceType, REMINDER_SERVICE_META } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  onOpenAppointment?: (appointmentId: string) => void;
}

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

const RemindersView: React.FC<Props> = ({ onOpenAppointment }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<ReminderScope>('upcoming');
  const [service, setService] = useState<ReminderServiceType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await remindersAPI.list({ scope, serviceType: service === 'all' ? undefined : service });
      if (res.success && res.data?.reminders) setReminders(res.data.reminders);
    } catch (e) { console.error('Failed to load reminders', e); }
    finally { setLoading(false); }
  }, [scope, service]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reminders;
    return reminders.filter(r => `${r.pet?.name ?? ''} ${r.client?.name ?? ''} ${r.title ?? ''}`.toLowerCase().includes(q));
  }, [reminders, search]);

  const book = async (r: Reminder) => {
    setBusyId(r.id);
    try {
      const res = await remindersAPI.createAppointment(r.id);
      if (res.success && res.data?.appointmentId) {
        toast.success('Appointment booked from reminder');
        onOpenAppointment?.(res.data.appointmentId);
        load();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to book appointment'); }
    finally { setBusyId(null); }
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
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
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
            return (
              <div key={r.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-sm ${overdue ? 'border-rose-300 dark:border-rose-900/60' : 'border-slate-200 dark:border-zinc-800'} ${(done || dismissed) ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xl shrink-0">{r.pet?.species === 'Cat' ? '🐱' : '🐶'}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{r.pet?.name}</span>
                      <span className="block text-[10px] text-slate-400 truncate">{r.client?.name}</span>
                    </span>
                  </span>
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
                  {/* Booked appointment is reachable regardless of status; if none, allow create. */}
                  {r.bookedAppointmentId ? (
                    <button onClick={() => onOpenAppointment?.(r.bookedAppointmentId!)} className="flex items-center gap-1 text-seafoam underline-offset-2 hover:underline">
                      <ExternalLink size={11} /> Visit from reminder
                    </button>
                  ) : (
                    <button onClick={() => book(r)} disabled={busyId === r.id} className="flex items-center gap-1 text-pine dark:text-zinc-200 hover:text-seafoam underline-offset-2 hover:underline disabled:opacity-50">
                      {busyId === r.id ? <Loader2 size={11} className="animate-spin" /> : <CalendarPlus size={11} />} Create appointment
                    </button>
                  )}
                </div>

                {r.status === 'PENDING' && (
                  <div className="flex items-center gap-1.5">
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
                    <button onClick={() => setStatus(r, 'DONE')} disabled={busyId === r.id} title="Mark done" className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"><Check size={13} /></button>
                    <button onClick={() => setStatus(r, 'DISMISSED')} disabled={busyId === r.id} title="Dismiss" className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:bg-slate-200 disabled:opacity-50"><X size={13} /></button>
                  </div>
                )}
                {done && <p className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest"><CheckCircle2 size={12} /> Completed</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RemindersView;
