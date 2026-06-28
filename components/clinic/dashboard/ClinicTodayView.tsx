import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, BellRing, CalendarClock, Stethoscope, Loader2, ArrowRight } from 'lucide-react';
import { remindersAPI, appointmentsAPI, Reminder } from '../../../services';
import { useData } from '../../../contexts/DataContext';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  onOpenVisit?: (visitId: string) => void;
  onOpenBookings?: () => void;
  onOpenReminders?: () => void;
}

type Row = {
  kind: 'reminder' | 'appointment' | 'visit';
  id: string;
  at: number;            // sort key (ms); reminders use due date (00:00) if no time
  timeLabel: string;
  pet: string;
  client?: string;
  title: string;
  status?: string;
};

const KIND_META: Record<Row['kind'], { icon: React.ElementType; tone: string; label: string }> = {
  reminder: { icon: BellRing, tone: 'text-violet-500 bg-violet-50 dark:bg-violet-950/40', label: 'Reminder' },
  appointment: { icon: CalendarClock, tone: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40', label: 'Appointment' },
  visit: { icon: Stethoscope, tone: 'text-seafoam bg-seafoam/10', label: 'Visit' },
};

/**
 * Clinic Today — reminders, appointments (bookings) and visits for a chosen date
 * (defaults to today), arranged chronologically by time. One operational glance.
 */
const ClinicTodayView: React.FC<Props> = ({ onOpenVisit, onOpenBookings, onOpenReminders }) => {
  const { appointments: visits, pets, clients } = useData() as any;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      remindersAPI.list({ scope: 'all' }).catch(() => null),
      appointmentsAPI.list().catch(() => null),
    ]).then(([rem, appt]) => {
      if (!alive) return;
      if (rem?.success && rem.data?.reminders) setReminders(rem.data.reminders);
      if (appt?.success && appt.data?.appointments) setBookings(appt.data.appointments);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const petName = (id: any) => pets.find((p: any) => String(p.id) === String(id))?.name || 'Patient';
  const clientName = (id: any) => clients.find((c: any) => String(c.id) === String(id))?.name || '';
  const hhmm = (d: Date) => isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    // Visits scheduled for the date.
    (visits || []).filter((v: any) => (v.date || '').slice(0, 10) === date && v.status !== 'CANCELLED').forEach((v: any) => {
      const d = new Date(v.date);
      out.push({ kind: 'visit', id: String(v.id), at: d.getTime(), timeLabel: hhmm(d), pet: petName(v.petId), client: clientName(v.clientId), title: (v.encounterType || 'VET_VISIT').replace('_', ' '), status: v.status });
    });
    // Appointment bookings for the date (not yet converted/cancelled).
    bookings.filter((b: any) => (b.scheduledAt || '').slice(0, 10) === date && b.status !== 'CANCELLED' && b.status !== 'CONVERTED').forEach((b: any) => {
      const d = new Date(b.scheduledAt);
      out.push({ kind: 'appointment', id: String(b.id), at: d.getTime(), timeLabel: hhmm(d), pet: petName(b.petId), client: clientName(b.clientId), title: b.note || (b.encounterType || '').replace('_', ' '), status: b.status });
    });
    // Reminders due on the date (pending).
    reminders.filter((r: any) => (r.dueAt || '').slice(0, 10) === date && r.status === 'PENDING').forEach((r: any) => {
      const d = new Date(r.dueAt);
      out.push({ kind: 'reminder', id: String(r.id), at: d.getTime(), timeLabel: hhmm(d), pet: r.pet?.name || petName(r.petId), client: r.client?.name, title: r.title || r.serviceType, status: r.status });
    });
    return out.sort((a, b) => a.at - b.at);
  }, [visits, bookings, reminders, date, pets, clients]);

  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-seafoam/10 flex items-center justify-center"><CalendarDays size={22} className="text-seafoam" /></div>
          <div>
            <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Clinic {isToday ? 'Today' : 'Day'}</h2>
            <p className="text-[11px] text-slate-400">{rows.length} item{rows.length === 1 ? '' : 's'} · reminders · appointments · visits</p>
          </div>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <CalendarDays size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-slate-400">Nothing scheduled for {formatDate(date)}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const M = KIND_META[row.kind];
            const Icon = M.icon;
            const onClick = row.kind === 'visit' ? () => onOpenVisit?.(row.id) : row.kind === 'appointment' ? onOpenBookings : onOpenReminders;
            return (
              <button key={`${row.kind}:${row.id}`} onClick={onClick} className="w-full flex items-center gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 shadow-sm hover:border-seafoam transition-all text-left">
                <span className="w-14 shrink-0 text-[11px] font-black text-pine dark:text-zinc-100 tabular-nums">{row.timeLabel}</span>
                <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${M.tone}`}><Icon size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{row.pet} <span className="text-slate-400 font-medium">· {row.title}</span></span>
                  <span className="block text-[10px] text-slate-400 truncate">{M.label}{row.client ? ` · ${row.client}` : ''}{row.status ? ` · ${String(row.status).toLowerCase().replace('_', ' ')}` : ''}</span>
                </span>
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClinicTodayView;
