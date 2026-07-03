import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Scissors, Plus, CreditCard } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { Visit } from '../../../types';
import { formatDate } from '../../../services/utils/dateFormatter';
import { DateRange } from '../../shared/common/DateRangePicker';
import ListFilterBar, { inRange } from '../shared/ListFilterBar';
import GroomingRecordPage from './GroomingRecordPage';
import GroomingAdmitModal from './GroomingAdmitModal';
import { deriveVisitStatus, STATUS_LABEL, STATUS_STYLE as MODULE_STATUS_STYLE } from '../shared/visitStatus';

interface Props {
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
  onNew?: () => void;
  openForAppointmentId?: string;
}

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  PENDING_PAYMENT: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
  COMPLETED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  CANCELLED: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
};

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
];

const GroomingView: React.FC<Props> = ({ onOpenAppointment, onNew, openForAppointmentId }) => {
  const { appointments, pets, clients, refreshAppointments } = useData() as any;
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [admitOpen, setAdmitOpen] = useState(false);
  const openAppt = useMemo(() => appointments.find((a: Visit) => a.id === openId) ?? null, [appointments, openId]);

  // Deep-link: auto-open this visit's grooming drawer when arrived from a visit's
  // SERVICES category header (consumed once once the appointment is in context).
  const deepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openForAppointmentId || deepLinkRef.current === openForAppointmentId) return;
    const appt = appointments.find((a: Visit) => String(a.id) === String(openForAppointmentId));
    if (appt) { setOpenId(appt.id); deepLinkRef.current = openForAppointmentId; }
  }, [openForAppointmentId, appointments]);

  const petName = (id: number) => pets.find(p => p.id === id)?.name ?? 'Patient';
  const ownerName = (id: number) => clients.find(c => c.id === id)?.name ?? '';

  const grooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments
      // Grooming-encounter visits PLUS any visit (e.g. boarding/inpatient) that
      // has had a grooming service spawned onto it.
      .filter(a => a.encounterType === 'GROOMING' || (a.tasks || []).some((t: any) => String(t.category || '').toLowerCase().includes('groom')))
      .filter(a => {
        // Filter on the SAME derived grooming status the card shows.
        const ds = deriveVisitStatus(a, ['groom']);
        if (status === 'SCHEDULED' && ds === 'COMPLETED') return false;
        if (status === 'COMPLETED' && ds !== 'COMPLETED') return false;
        if (!inRange(a.date, dateRange)) return false;
        if (q && !(`${petName(a.petId)} ${ownerName(a.clientId)}`.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments, status, search, dateRange, pets, clients]);

  // Full-page record replaces the whole list while open (was a drawer).
  // NOTE: this early return must come AFTER every hook above — an early
  // return between hooks changes the hook count and crashes React (#300).
  if (openAppt) {
    return (
      <GroomingRecordPage
        appointment={openAppt}
        onBack={() => setOpenId(null)}
        onChanged={() => { refreshAppointments?.(); }}
        onOpenAppointment={onOpenAppointment}
      />
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-pink-100 dark:bg-pink-900/20 flex items-center justify-center"><Scissors size={22} className="text-pink-600 dark:text-pink-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Grooming</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{grooms.length} grooming visit{grooms.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <button onClick={() => setAdmitOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> New grooming</button>
      </div>

      <ListFilterBar search={search} onSearch={setSearch} dateRange={dateRange} onDateRange={setDateRange} statuses={STATUSES} status={status} onStatus={setStatus} />

      {grooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <Scissors size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-slate-400">No grooming visits yet</p>
          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Create an appointment and pick “Grooming”.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {grooms.map(a => (
            <button key={a.id} onClick={() => setOpenId(a.id)} className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm hover:border-seafoam transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">✂️</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{petName(a.petId)}</span>
                    <span className="block text-[10px] text-slate-400 truncate">{ownerName(a.clientId)}</span>
                  </span>
                </span>
                {(() => { const ds = deriveVisitStatus(a, ['groom']); return (
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${MODULE_STATUS_STYLE[ds]}`}>{STATUS_LABEL[ds]}</span>
                ); })()}
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                <span>{formatDate(a.date)} · {a.tasks?.length ?? 0} service{(a.tasks?.length ?? 0) === 1 ? '' : 's'}</span>
                <span className={`flex items-center gap-0.5 ${a.isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}><CreditCard size={11} /> {Number(a.totalCost).toLocaleString()}{a.isPaid ? '' : ' due'}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <GroomingAdmitModal
        isOpen={admitOpen}
        onClose={() => setAdmitOpen(false)}
        pets={pets}
        onCreated={(visitId) => { refreshAppointments?.(); if (visitId) onOpenAppointment?.(String(visitId)); }}
      />
    </div>
  );
};

export default GroomingView;
