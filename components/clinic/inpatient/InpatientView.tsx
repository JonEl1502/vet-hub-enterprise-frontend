import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Stethoscope, Plus, BedDouble, Loader2, Pill, ClipboardCheck } from 'lucide-react';
import { inpatientAPI, Hospitalization } from '../../../services';
import { useData } from '../../../contexts/DataContext';
import { useClinic } from '../../../contexts/ClinicContext';
import { formatDate } from '../../../services/utils/dateFormatter';
import { DateRange } from '../../shared/common/DateRangePicker';
import ListFilterBar, { inRange } from '../shared/ListFilterBar';
import DefaultRateEditor from '../shared/DefaultRateEditor';
import AdmitInpatientModal from './AdmitInpatientModal';

const daysIn = (admittedAt: string) => Math.max(0, Math.floor((Date.now() - new Date(admittedAt).getTime()) / 86400000)) + 1;

interface InpatientViewProps { onOpenAppointment?: (appointmentId: string, settle?: boolean) => void; onOpenChart?: (hospId: string) => void; initialOpenHospId?: string; openForAppointmentId?: string; openForPetId?: string }

const STATUSES = [
  { value: 'ADMITTED', label: 'Admitted' },
  { value: 'DISCHARGED', label: 'Discharged' },
  { value: 'all', label: 'All' },
];

const InpatientView: React.FC<InpatientViewProps> = ({ onOpenAppointment, onOpenChart, initialOpenHospId, openForAppointmentId, openForPetId }) => {
  const { pets } = useData();
  const { selectedClinics } = useClinic();
  const defaultRate = selectedClinics[0]?.inpatientDayRate ?? null;
  const [rows, setRows] = useState<Hospitalization[]>([]);
  const [due, setDue] = useState<Record<string, { tasksDue: number; medsDue: number }>>({});
  const [loading, setLoading] = useState(true);
  const [admitOpen, setAdmitOpen] = useState(false);
  // Prefill context when Admit is opened from a visit's In-patient chip (no
  // hospitalization exists yet) — pet + appointment carry through.
  const [admitCtx, setAdmitCtx] = useState<{ petId?: string; appointmentId?: string } | null>(null);
  // The chart is a full page now — legacy deep links with an initial hosp id
  // forward straight to it.
  const initialForwardRef = useRef(false);
  useEffect(() => {
    if (initialOpenHospId && !initialForwardRef.current) {
      initialForwardRef.current = true;
      onOpenChart?.(initialOpenHospId);
    }
  }, [initialOpenHospId, onOpenChart]);
  // Filters
  const [status, setStatus] = useState('ADMITTED');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, boardRes] = await Promise.all([inpatientAPI.list('all'), inpatientAPI.board()]);
      if (listRes.success && listRes.data) setRows(listRes.data.hospitalizations);
      if (boardRes.success && boardRes.data) {
        const map: Record<string, { tasksDue: number; medsDue: number }> = {};
        boardRes.data.board.forEach(h => { map[h.id] = { tasksDue: h.tasksDue ?? 0, medsDue: h.medsDue ?? 0 }; });
        setDue(map);
      }
    } catch (e) { console.error('Failed to load inpatients', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Deep-link from a visit's In-patient chip / SERVICES header. Once rows are
  // loaded: open the matching hospitalization if one exists, otherwise (an
  // In-patient service was added to the visit but not yet admitted) open the
  // Admit modal prefilled with the visit's pet + appointment so it links back.
  const deepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openForAppointmentId || loading || deepLinkRef.current === openForAppointmentId) return;
    deepLinkRef.current = openForAppointmentId;
    const row = rows.find(r => String((r as any).appointmentId) === String(openForAppointmentId));
    if (row) {
      onOpenChart?.(String(row.id));
    } else {
      setAdmitCtx({ petId: openForPetId, appointmentId: openForAppointmentId });
      setAdmitOpen(true);
    }
  }, [openForAppointmentId, openForPetId, rows, loading]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(h => {
      if (status !== 'all' && h.status !== status) return false;
      if (!inRange(h.admittedAt, dateRange)) return false;
      if (q && !(`${h.pet?.name ?? ''} ${h.client?.name ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, status, search, dateRange]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center"><Stethoscope size={22} className="text-red-600 dark:text-red-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Inpatient</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{filtered.length} shown</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DefaultRateEditor field="inpatientDayRate" />
          <button onClick={() => { setAdmitCtx(null); setAdmitOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> Admit</button>
        </div>
      </div>

      <ListFilterBar search={search} onSearch={setSearch} dateRange={dateRange} onDateRange={setDateRange} statuses={STATUSES} status={status} onStatus={setStatus} />

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <BedDouble size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-slate-400">No inpatients match</p>
          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Adjust the filters, or use “Admit”.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(h => {
            const counts = due[h.id];
            const isActive = h.status === 'ADMITTED';
            return (
              <button key={h.id} onClick={() => onOpenChart?.(h.id)} className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm hover:border-seafoam transition-all">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xl shrink-0">{h.pet?.species === 'Cat' ? '🐱' : '🐶'}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{h.pet?.name}</span>
                      <span className="block text-[10px] text-slate-400 truncate">{h.diagnosis || 'No diagnosis'}</span>
                    </span>
                  </span>
                  {isActive
                    ? <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-widest">Day {daysIn(h.admittedAt)}</span>
                    : <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 text-[9px] font-black uppercase tracking-widest">Out</span>}
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                  <span>{isActive ? `Admitted ${formatDate(h.admittedAt)}` : `Discharged ${h.dischargedAt ? formatDate(h.dischargedAt) : ''}`}{h.cage ? ` · ${h.cage}` : ''}</span>
                  {isActive && counts && (
                    <span className="flex items-center gap-2 shrink-0">
                      {!!counts.tasksDue && <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><ClipboardCheck size={11} /> {counts.tasksDue}</span>}
                      {!!counts.medsDue && <span className="flex items-center gap-0.5 text-indigo-500"><Pill size={11} /> {counts.medsDue}</span>}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AdmitInpatientModal isOpen={admitOpen} onClose={() => { setAdmitOpen(false); setAdmitCtx(null); }} pets={pets} onAdmitted={() => { load(); const back = admitCtx?.appointmentId; if (back) onOpenAppointment?.(back); }} defaultRate={defaultRate} initialPetId={admitCtx?.petId ? Number(admitCtx.petId) : undefined} appointmentId={admitCtx?.appointmentId} />
    </div>
  );
};

export default InpatientView;
