import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Stethoscope, Plus, BedDouble, Loader2, Pill, ClipboardCheck, Search, X, ChevronRight } from 'lucide-react';
import { inpatientAPI, Hospitalization } from '../../../services';
import { useData } from '../../../contexts/DataContext';
import { useClinic } from '../../../contexts/ClinicContext';
import { formatDate, calendarDaysBetween } from '../../../services/utils/dateFormatter';
import { DateRange } from '../../shared/common/DateRangePicker';
import ListFilterBar, { inRange } from '../shared/ListFilterBar';
import DefaultRateEditor from '../shared/DefaultRateEditor';
import AdmitInpatientModal from './AdmitInpatientModal';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import OwnerContact from '../shared/OwnerContact';

const daysIn = (admittedAt: string) => Math.max(0, calendarDaysBetween(admittedAt)) + 1;

interface InpatientViewProps { onOpenAppointment?: (appointmentId: string, settle?: boolean) => void; onOpenChart?: (hospId: string, opts?: { replace?: boolean }) => void; initialOpenHospId?: string; openForAppointmentId?: string; openForPetId?: string }

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
      onOpenChart?.(initialOpenHospId, { replace: true });
    }
  }, [initialOpenHospId, onOpenChart]);
  // Filters
  const [status, setStatus] = useState('ADMITTED');
  const [search, setSearch] = useState('');
  /**
   * WHICH ward card is drilled into, if any (user, 2026-08-24: "can i click
   * here and show me a hover list i can search and on click it takes me to that
   * visit").
   *
   * The counts answered "how much work is waiting" and stopped there — the
   * animal it is waiting on was a scroll and a guess away. Opening a card lists
   * exactly the patients behind that number.
   */
  const [drill, setDrill] = useState<'tasks' | 'meds' | null>(null);
  const [drillSearch, setDrillSearch] = useState('');
  const drillRef = useRef<HTMLDivElement>(null);
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

  // The panel floats over the list, so it must close the way every other
  // floating thing in the app does — Escape, or a click outside it.
  useEffect(() => {
    if (!drill) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrill(null); };
    const onDown = (e: MouseEvent) => {
      if (drillRef.current && !drillRef.current.contains(e.target as Node)) setDrill(null);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [drill]);

  useEffect(() => { setDrillSearch(''); }, [drill]);

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
      // Replace the transient list hop so Back skips it (else it re-forwards).
      onOpenChart?.(String(row.id), { replace: true });
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

  /**
   * Ward counts come from ALL rows, never the filtered list — "how many animals
   * are in tonight" must not change because someone typed in the search box.
   */
  const wardCounts = useMemo(() => {
    const admittedRows = rows.filter(h => h.status === 'ADMITTED');
    return {
      admitted: admittedRows.length,
      tasksDue: admittedRows.reduce((n, h) => n + (due[h.id]?.tasksDue ?? 0), 0),
      medsDue: admittedRows.reduce((n, h) => n + (due[h.id]?.medsDue ?? 0), 0),
    };
  }, [rows, due]);

  // Admission is a full in-app page now — render it in place of the list so
  // the sidebar/breadcrumb stay visible (it used to be a full-screen modal).
  if (admitOpen) {
    return (
      <AdmitInpatientModal
        isOpen={admitOpen}
        onClose={() => { setAdmitOpen(false); setAdmitCtx(null); }}
        pets={pets}
        onAdmitted={() => { load(); const back = admitCtx?.appointmentId; if (back) onOpenAppointment?.(back); }}
        defaultRate={defaultRate}
        initialPetId={admitCtx?.petId ? Number(admitCtx.petId) : undefined}
        appointmentId={admitCtx?.appointmentId}
      />
    );
  }

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
          {/* Default daily rate is set in Clinic Management → Billables, not here. */}
          <button onClick={() => { setAdmitCtx(null); setAdmitOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> Admit</button>
        </div>
      </div>

      {/* Ward-at-a-glance cards, matching Boarding's occupancy pair (user,
          2026-08-22). "124 shown" answers how big the LIST is, which is a
          filter fact — it says nothing about how many animals are actually in
          the ward right now, or how much work is waiting on them. After the
          migration that gap was stark: 124 shown, all of them historical. */}
      <div ref={drillRef} className="relative grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-w-2xl">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400"><Stethoscope size={15} /><span className="text-[9px] font-black uppercase tracking-widest">In the ward</span></div>
          <p className="text-2xl sm:text-3xl font-black text-pine dark:text-zinc-100 mt-1">{wardCounts.admitted}</p>
        </div>
        {([
          { key: 'tasks' as const, label: 'Tasks due', icon: ClipboardCheck, total: wardCounts.tasksDue, tone: 'text-amber-600 dark:text-amber-400', ring: 'border-amber-400' },
          { key: 'meds' as const, label: 'Meds due', icon: Pill, total: wardCounts.medsDue, tone: 'text-rose-600 dark:text-rose-400', ring: 'border-rose-400' },
        ]).map(card => {
          const open = drill === card.key;
          // ⚠️ Only a card with work behind it opens. A drill-down onto an
          // empty list teaches people the control is broken.
          const clickable = card.total > 0;
          return (
            <button
              key={card.key}
              type="button"
              disabled={!clickable}
              onClick={() => setDrill(open ? null : card.key)}
              title={clickable ? `Show the ${card.total} patient${card.total === 1 ? '' : 's'} behind this number` : 'Nothing due'}
              className={`text-left bg-white dark:bg-zinc-900 border rounded-2xl p-3 sm:p-4 shadow-sm transition-all ${
                open ? card.ring : 'border-slate-200 dark:border-zinc-800'
              } ${clickable ? 'hover:border-seafoam cursor-pointer active:scale-[0.98]' : 'cursor-default'}`}
            >
              <div className="flex items-center gap-2 text-slate-400">
                <card.icon size={15} />
                <span className="text-[9px] font-black uppercase tracking-widest flex-1">{card.label}</span>
                {clickable && <ChevronRight size={13} className={`transition-transform ${open ? 'rotate-90' : ''}`} />}
              </div>
              <p className={`text-2xl sm:text-3xl font-black mt-1 ${card.total > 0 ? card.tone : 'text-pine dark:text-zinc-100'}`}>{card.total}</p>
            </button>
          );
        })}

        {drill && (() => {
          /**
           * The patients behind the number. Built from the SAME `due` map the
           * counts are summed from, so the list can never disagree with the
           * figure that opened it.
           */
          const q = drillSearch.trim().toLowerCase();
          const items = rows
            .filter(h => h.status === 'ADMITTED')
            .map(h => ({ h, n: (drill === 'tasks' ? due[h.id]?.tasksDue : due[h.id]?.medsDue) ?? 0 }))
            .filter(x => x.n > 0)
            .filter(x => !q || `${x.h.pet?.name ?? ''} ${x.h.client?.name ?? ''}`.toLowerCase().includes(q))
            .sort((a, b) => b.n - a.n);
          return (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-zinc-800">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  autoFocus
                  value={drillSearch}
                  onChange={(e) => setDrillSearch(e.target.value)}
                  placeholder={drill === 'tasks' ? 'Search patients with tasks due…' : 'Search patients with meds due…'}
                  className="flex-1 min-w-0 bg-transparent text-sm font-bold text-pine dark:text-zinc-100 outline-none placeholder:text-slate-400 placeholder:font-bold"
                />
                <button type="button" onClick={() => setDrill(null)} className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-pine dark:hover:text-zinc-100" aria-label="Close">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto p-1.5">
                {items.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs font-bold text-slate-400">
                    {q ? `Nothing matches “${drillSearch.trim()}”.` : 'Nothing due.'}
                  </p>
                ) : items.map(({ h, n }) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => { setDrill(null); onOpenChart?.(String(h.id)); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors group"
                  >
                    <span className={`grid place-items-center w-8 h-8 rounded-xl shrink-0 text-[11px] font-black ${
                      drill === 'tasks'
                        ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                    }`}>{n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{h.pet?.name || 'Patient'}</span>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 truncate">
                        {h.client?.name || 'Owner unknown'} · {n} {drill === 'tasks' ? 'task' : 'med'}{n === 1 ? '' : 's'} due
                      </span>
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-slate-300 dark:text-zinc-600 group-hover:text-seafoam transition-colors" />
                  </button>
                ))}
              </div>
              <p className="px-3 py-2 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/40 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                Opens the patient's chart · Esc to close
              </p>
            </div>
          );
        })()}
      </div>

      <ListFilterBar search={search} onSearch={setSearch} dateRange={dateRange} onDateRange={setDateRange} statuses={STATUSES} status={status} onStatus={setStatus} />

      {loading ? (
        <div className="py-16"><LoadingSpinner size="lg" message="Loading admissions..." /></div>
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
                      {/* The ward list is worked by people who need to reach the
                          owner; it named the animal and nobody else. */}
                      <OwnerContact owner={h.client} className="mt-1" />
                    </span>
                  </span>
                  {isActive
                    ? <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-widest">Day {daysIn(h.admittedAt)}</span>
                    : <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 text-[9px] font-black uppercase tracking-widest">Out</span>}
                </div>
                {/* Wraps rather than overflowing — on a phone the admitted date
                    and the due-counts do not fit on one line, and the counts
                    were being pushed off the card. */}
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                  {/* BOTH dates (user, 2026-08-22). It used to show one or the
                      other, so a discharged stay lost its admission date — and a
                      migrated record, whose discharge date was never captured,
                      rendered the bare word "Discharged" with nothing after it.
                      Admitted always shows; the discharge half says plainly when
                      the date is not on record rather than trailing off. */}
                  <span className="truncate max-w-full">
                    {`Admitted ${formatDate(h.admittedAt)}`}
                    {!isActive && ` · Discharged ${h.dischargedAt ? formatDate(h.dischargedAt) : '(date not recorded)'}`}
                    {h.cage ? ` · ${h.cage}` : ''}
                  </span>
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

    </div>
  );
};

export default InpatientView;
