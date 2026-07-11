import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Home, Plus, Dog, CalendarClock, BedDouble, Loader2, ShieldAlert } from 'lucide-react';
import { boardingAPI, BoardingStay, BoardingOccupancy } from '../../../services';
import { useData } from '../../../contexts/DataContext';
import { useClinic } from '../../../contexts/ClinicContext';
import { formatDate } from '../../../services/utils/dateFormatter';
import { DateRange } from '../../shared/common/DateRangePicker';
import ListFilterBar, { inRange } from '../shared/ListFilterBar';
import DefaultRateEditor from '../shared/DefaultRateEditor';
import AdmitBoardingModal from './AdmitBoardingModal';

const daysIn = (dropOffAt: string) => Math.max(0, Math.floor((Date.now() - new Date(dropOffAt).getTime()) / 86400000)) + 1;
const vaccinesOk = (vc: Record<string, boolean>) => Object.keys(vc || {}).length > 0 && Object.values(vc).every(Boolean);

interface BoardingViewProps { onOpenAppointment?: (appointmentId: string, settle?: boolean) => void; onOpenStay?: (stayId: string) => void; initialOpenStayId?: string; openForAppointmentId?: string; openForPetId?: string }

const STATUSES = [
  { value: 'ADMITTED', label: 'In care' },
  { value: 'CHECKED_OUT', label: 'Checked out' },
  { value: 'all', label: 'All' },
];

const BoardingView: React.FC<BoardingViewProps> = ({ onOpenAppointment, onOpenStay, initialOpenStayId, openForAppointmentId, openForPetId }) => {
  const { pets } = useData();
  const { selectedClinics } = useClinic();
  const defaultRate = selectedClinics[0]?.boardingDayRate ?? null;
  const [stays, setStays] = useState<BoardingStay[]>([]);
  const [occupancy, setOccupancy] = useState<BoardingOccupancy>({ activeStays: 0, pickupsDueToday: 0 });
  const [loading, setLoading] = useState(true);
  const [admitOpen, setAdmitOpen] = useState(false);
  // Prefill context when Admit is opened from a visit's Boarding chip (no stay
  // exists yet) — pet + appointment carry through so the stay links to the visit.
  const [admitCtx, setAdmitCtx] = useState<{ petId?: string; appointmentId?: string } | null>(null);
  // The stay is a full page now — legacy deep links with an initial stay id
  // forward straight to it.
  const initialForwardRef = useRef(false);
  useEffect(() => {
    if (initialOpenStayId && !initialForwardRef.current) {
      initialForwardRef.current = true;
      onOpenStay?.(initialOpenStayId);
    }
  }, [initialOpenStayId, onOpenStay]);
  // Filters
  const [status, setStatus] = useState('ADMITTED');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stayRes, occRes] = await Promise.all([boardingAPI.list('all'), boardingAPI.occupancy()]);
      if (stayRes.success && stayRes.data?.stays) setStays(stayRes.data.stays);
      if (occRes.success && occRes.data) setOccupancy(occRes.data);
    } catch (e) { console.error('Failed to load boarding', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Deep-link from a visit's Boarding chip / SERVICES header. Once stays are
  // loaded: open the matching stay if one exists, otherwise (a Boarding service
  // was added to the visit but not yet admitted) open the Admit modal prefilled
  // with the visit's pet + appointment so the new stay links back to the visit.
  const deepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openForAppointmentId || loading || deepLinkRef.current === openForAppointmentId) return;
    deepLinkRef.current = openForAppointmentId;
    const stay = stays.find(s => String((s as any).appointmentId) === String(openForAppointmentId));
    if (stay) {
      onOpenStay?.(String(stay.id));
    } else {
      setAdmitCtx({ petId: openForPetId, appointmentId: openForAppointmentId });
      setAdmitOpen(true);
    }
  }, [openForAppointmentId, openForPetId, stays, loading]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stays.filter(s => {
      if (status !== 'all' && s.status !== status) return false;
      if (!inRange(s.dropOffAt, dateRange)) return false;
      if (q && !(`${s.pet?.name ?? ''} ${s.client?.name ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [stays, status, search, dateRange]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center"><Home size={22} className="text-amber-600 dark:text-amber-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Boarding</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{filtered.length} shown</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DefaultRateEditor field="boardingDayRate" />
          <button onClick={() => { setAdmitCtx(null); setAdmitOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95">
            <Plus size={14} /> Admit
          </button>
        </div>
      </div>

      {/* Occupancy cards */}
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400"><BedDouble size={15} /><span className="text-[9px] font-black uppercase tracking-widest">Active stays</span></div>
          <p className="text-3xl font-black text-pine dark:text-zinc-100 mt-1">{occupancy.activeStays}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400"><CalendarClock size={15} /><span className="text-[9px] font-black uppercase tracking-widest">Pickups today</span></div>
          <p className="text-3xl font-black text-pine dark:text-zinc-100 mt-1">{occupancy.pickupsDueToday}</p>
        </div>
      </div>

      <ListFilterBar search={search} onSearch={setSearch} dateRange={dateRange} onDateRange={setDateRange} statuses={STATUSES} status={status} onStatus={setStatus} />

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <Home size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-slate-400">No boarding stays match</p>
          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Adjust the filters, or use “Admit”.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => (
            <button key={s.id} onClick={() => onOpenStay?.(s.id)} className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm hover:border-seafoam transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">{s.pet?.species === 'Cat' ? '🐱' : '🐶'}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{s.pet?.name}</span>
                    <span className="block text-[10px] text-slate-400 truncate">{s.client?.name}</span>
                  </span>
                </span>
                {s.status === 'ADMITTED'
                  ? <span className="shrink-0 px-2 py-0.5 rounded-full bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest">Day {daysIn(s.dropOffAt)}</span>
                  : <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 text-[9px] font-black uppercase tracking-widest">{s.status === 'CHECKED_OUT' ? 'Out' : s.status}</span>}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                <span>{s.kennel ? `Kennel ${s.kennel}` : 'No kennel'} · {formatDate(s.dropOffAt)}</span>
                <span>{s.status === 'CHECKED_OUT' && s.actualPickupAt ? `Out ${formatDate(s.actualPickupAt)}` : s.expectedPickupAt ? `Pickup ${formatDate(s.expectedPickupAt)}` : '—'}</span>
              </div>
              {s.status === 'ADMITTED' && !vaccinesOk(s.vaccineChecklist) && (
                <p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400"><ShieldAlert size={11} /> Vaccine check incomplete</p>
              )}
            </button>
          ))}
        </div>
      )}

      <AdmitBoardingModal isOpen={admitOpen} onClose={() => { setAdmitOpen(false); setAdmitCtx(null); }} pets={pets} onCreated={() => { load(); const back = admitCtx?.appointmentId; if (back) onOpenAppointment?.(back); }} defaultRate={defaultRate} initialPetId={admitCtx?.petId ? Number(admitCtx.petId) : undefined} appointmentId={admitCtx?.appointmentId} />
    </div>
  );
};

export default BoardingView;
