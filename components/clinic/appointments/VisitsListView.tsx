
import { useRememberedRange } from '../../../hooks/useScrollMemory';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Visit, ApptStatus, Pet, User, Clinic } from '../../../types';
import { CreditCard, MoreVertical, Eye, Workflow, Edit, Trash2, Calendar as CalendarIcon, List, RefreshCw, Home, Building2, RotateCcw, ClipboardList, Layers, Stethoscope, X, Users } from 'lucide-react';
import { formatDate, formatTime } from '../../../services/utils/dateFormatter';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { userCan } from '../../../constants/permissions';
import { visitsAPI } from '../../../services';
import { PaginationMeta } from '../../../services/types/pagination';
import Pagination from '../../shared/common/Pagination';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import CalendarView from './CalendarView';
import AdvancedFilters from '../../shared/common/AdvancedFilters';
import FilterChips from '../../shared/common/FilterChips';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { startOfToday } from 'date-fns';
import ConfirmDialog from '../../shared/common/ConfirmDialog';
import ScopeClinicBadge from '../../shared/common/ScopeClinicBadge';
import PetAvatar from '../shared/PetAvatar';

interface Props {
  pets: Pet[];
  clinics: Clinic[];
  allStaff: User[];
  onManageWorkflow: (id: number) => void;
  onUpdateApptStatus: (id: number, status: ApptStatus) => void;
  onOpenBooking: () => void;
  onProcessPayment?: (apptId: number, method: string) => void;
  onViewDetails?: (id: number) => void;
  onEditAppointment?: (id: number) => void;
  onDeleteAppointment?: (id: number) => Promise<void>;
  /**
   * Land in open-visits mode — set when arriving from a dashboard
   * work-in-progress tile, whose counts include visits opened on earlier days.
   * Without it the tile said 5 and the list it opened said none.
   */
  initialOpenOnly?: boolean;
}

const VisitsListView: React.FC<Props> = ({
  pets,
  clinics,
  allStaff,
  onManageWorkflow,
  onUpdateApptStatus,
  onOpenBooking,
  onProcessPayment,
  onViewDetails,
  onEditAppointment,
  onDeleteAppointment,
  initialOpenOnly
}) => {
  const { user } = useAuth();
  /**
   * What the payment pill should say.
   *
   * It used to be `isPaid ? paymentMethod : 'Unpaid'`, which printed the literal
   * string **"NULL"** whenever a visit was paid but carried no method — true of
   * every migrated visit, and of any KES 0 visit where nobody ever took money.
   * A pill reading NULL is worse than no pill: it looks like a broken record.
   */
  const payLabel = (a: any): string => {
    if (!a?.isPaid) return 'Unpaid';
    if (!Number(a?.totalCost || 0)) return 'No charge';
    return a?.paymentMethod || 'Paid';
  };

  const canCreateVisit = userCan(user, 'create_appointments');
  const canEditVisit = userCan(user, 'edit_appointments');
  const canDeleteVisit = userCan(user, 'delete_appointments');
  const { appointments, isLoadingAppointments, refreshAppointments, updateAppointmentOptimistically, ensureAppointments, fetchVisitsRange } = useData();
  useEffect(() => { ensureAppointments(); }, [ensureAppointments]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; apptId: number | null; petName?: string }>({ open: false, apptId: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<ApptStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const dropdownButtonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  /**
   * 100 PER PAGE BY DEFAULT (user, 2026-08-24: "i want it to start here at 100").
   *
   * 10 was chosen when a clinic had tens of records. Westlands Paws has 4,171
   * patients — 418 pages of ten — so the default made the list unusable for
   * exactly the clinics with enough data to need it. Not persisted, so this
   * moves everyone at once rather than only new sessions.
   */
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // View mode and advanced filters state
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    dateRange: { start: null as Date | null, end: null as Date | null },
    staffIds: [] as number[],
    categoryIds: [] as string[],
    petIds: [] as number[],
    statuses: [] as ApptStatus[],
  });

  // Date range for client-side filtering — default today through far future
  // Survives opening a visit/client and pressing Back (user, 2026-08-22) —
  // otherwise the list snapped to today and the range had to be re-picked after
  // every record.
  const [dateRange, setDateRange] = useRememberedRange<DateRange>('visits:dateRange', () => {
    const today = startOfToday();
    const farFuture = new Date(2099, 11, 31);
    return { start: today, end: farFuture };
  });

  // wrapper used by the picker to enforce non-null range
  const handleDateRangeChange = (range: DateRange | null) => {
    if (range && range.start && range.end) {
      setDateRange(range);
    } else {
      const today = startOfToday();
      const farFuture = new Date(2099, 11, 31);
      setDateRange({ start: today, end: farFuture });
    }
  };

  // Compare calendar dates in the clinic TZ (Africa/Nairobi, same as the
  // dateFormatter util). setHours(23,59,59,999) on a browser-local Date
  // does NOT survive a browser/clinic TZ mismatch and silently drops
  // today's appointments out of "Last 7 Days".
  const toClinicDateStr = (d: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value || '';
    const m = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    return `${y}-${m}-${day}`;
  };

  /**
   * OPEN-VISITS MODE — every unfinished visit, at any date.
   *
   * A visit left IN_PROGRESS is still work whatever day it began on, and the
   * default window (today→2099) hides all of them: six open since 18 Jul – 18
   * Aug left the list reading "No visits" while the dashboard showed five.
   *
   * ⚠️ It is a MODE, not a quiet exception to the date filter. Merging those
   * rows into a normal date-filtered list was the first attempt, and a filter
   * reading "Aug 19 – Today" listing July visits reads as a broken date picker
   * (user, 2026-08-19: "filter is for today but visits are past"). So the date
   * filter is either obeyed exactly or openly ignored — never half-applied.
   * Entered by clicking a dashboard work-in-progress tile, or the chip here.
   */
  const [openOnly, setOpenOnly] = useState(!!initialOpenOnly);
  const OPEN_STATUSES: ApptStatus[] = [
    ApptStatus.IN_PROGRESS, ApptStatus.SCHEDULED, ApptStatus.PENDING_PAYMENT,
  ];
  const openCount = useMemo(
    () => appointments.filter(a => OPEN_STATUSES.includes(a.status)).length,
    [appointments],
  );

  /**
   * Range-scoped server fetch (2026-08-23).
   *
   * DataContext holds only the newest 500 visits — plenty for a clinic that
   * books a few a day, useless for one carrying imported history. Westlands
   * has 2,649 visits; the newest 500 reach back only to 29 Jun, so picking
   * "Jan 8 – May 8" filtered a window that simply did not contain those 1,379
   * visits and the list read "No visits" (user: "did u add data for jan to
   * july or is filter wrong"). The filter was right; the rows were never
   * loaded.
   *
   * So the date range is answered by the SERVER, which already supports
   * startDate/endDate. The context cache stays as the instant-paint default;
   * this takes over the moment a range is in play. `openOnly` is exempt — that
   * mode ignores dates by design and reads the full cache.
   */
  const [rangeRows, setRangeRows] = useState<Visit[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rangeLoading, setRangeLoading] = useState(false);
  // Set when the range holds more visits than we are willing to pull at once,
  // so the count under the table can say so instead of quietly under-reporting.
  const [rangeTruncated, setRangeTruncated] = useState(0);
  const startISO = dateRange.start ? new Date(dateRange.start).toISOString() : null;
  const endISO = dateRange.end ? new Date(dateRange.end).toISOString() : null;

  useEffect(() => {
    if (openOnly || !startISO || !endISO) { setRangeRows(null); setRangeTruncated(0); return; }
    let alive = true;
    setRangeLoading(true);
    // Paging + the 1000-row cap live in DataContext.fetchVisitsRange so every
    // range-reading view shares one rule.
    fetchVisitsRange(startISO, endISO)
      .then(({ rows, truncated }) => {
        if (!alive) return;
        setRangeRows(rows);
        setRangeTruncated(truncated);
      })
      .catch(() => { if (alive) { setRangeRows(null); setRangeTruncated(0); } })
      .finally(() => { if (alive) setRangeLoading(false); });
    return () => { alive = false; };
  }, [startISO, endISO, openOnly, refreshKey, fetchVisitsRange]);

  // Rows the list works from: the server's answer for the picked range, else cache.
  const sourceRows = rangeRows ?? appointments;

  // Client-side filtering
  const filtered = useMemo(() => {
    const startStr = dateRange.start ? toClinicDateStr(new Date(dateRange.start)) : null;
    const endStr = dateRange.end ? toClinicDateStr(new Date(dateRange.end)) : null;
    return sourceRows
      .filter(appt => {
        const s = toClinicDateStr(new Date(appt.date));
        if (openOnly) {
          // Date deliberately not consulted — that is the whole point of the mode.
          if (!OPEN_STATUSES.includes(appt.status)) return false;
        } else {
          if (startStr && s < startStr) return false;
          if (endStr && s > endStr) return false;
        }
        if (activeTab !== 'ALL' && appt.status !== activeTab) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchPet = (appt as any).pet?.name?.toLowerCase().includes(q);
          const matchClient = (appt as any).client?.name?.toLowerCase().includes(q);
          if (!matchPet && !matchClient) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const statusRank = (appt: typeof a) => {
          if (appt.status === 'PENDING_PAYMENT') return 0;
          if (appt.status === 'SCHEDULED') return 1;
          return 2; // IN_PROGRESS, COMPLETED, CANCELLED, others
        };
        const rankDiff = statusRank(a) - statusRank(b);
        if (rankDiff !== 0) return rankDiff;
        // Within same group: descending by date (future/latest first)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [sourceRows, dateRange, activeTab, searchQuery, openOnly]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, activeTab, dateRange, openOnly]);

  // Client-side pagination (list view only; calendar gets all filtered)
  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const paginationMeta: PaginationMeta = {
    currentPage,
    totalPages: Math.max(1, Math.ceil(filtered.length / itemsPerPage)),
    totalItems: filtered.length,
    itemsPerPage,
    hasNextPage: currentPage < Math.ceil(filtered.length / itemsPerPage),
    hasPreviousPage: currentPage > 1,
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLimitChange = (limit: number) => {
    setItemsPerPage(limit);
    setCurrentPage(1);
  };

  // Close dropdown on scroll or resize
  useEffect(() => {
    const handleCloseDropdown = () => {
      setOpenDropdownId(null);
      setDropdownPosition(null);
    };

    window.addEventListener('scroll', handleCloseDropdown, true);
    window.addEventListener('resize', handleCloseDropdown);

    return () => {
      window.removeEventListener('scroll', handleCloseDropdown, true);
      window.removeEventListener('resize', handleCloseDropdown);
    };
  }, []);

  const getStatusBadge = (status: ApptStatus) => {
    const base = "px-3 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-wider ";
    switch (status) {
      case ApptStatus.SCHEDULED: return base + "bg-cyan/10 text-cyan border-cyan/20";
      case ApptStatus.IN_PROGRESS: return base + "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case ApptStatus.COMPLETED: return base + "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case ApptStatus.PENDING_PAYMENT: return base + "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case ApptStatus.CANCELLED: return base + "bg-red-500/10 text-red-500 border-red-500/20";
      default: return base + "bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 border-slate-200 dark:border-zinc-700";
    }
  };

  // Calculate visit number per pet - simplified since we don't have all appointments
  const getVisitNumber = (appointment: Visit): number => {
    // For server-side pagination, we can't calculate the exact visit number
    // without fetching all appointments for the pet
    // Return a placeholder or fetch from backend if needed
    return appointment.id; // Simplified - ideally this should come from backend
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header - Moved ABOVE filters */}
      {/* <div>
            <h1 className="page-header">Visits</h1>
            <p className="page-subheader mt-1">Enterprise scheduling and visit orchestration</p>
          </div> */}


      {/* Filter Tabs */}
      <div className="bg-slate-100 dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">

        {/* ROW 1 — Search (full width) */}
        <div className="flex items-center gap-3">
          <div className="relative w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam">🔍</span>
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-9 py-1.5 text-sm font-bold focus:ring-2 focus:ring-seafoam/20 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ROW 2 — Date picker · status filter · actions on ONE line (sm+);
            mobile stacks them. The status select stays compact instead of
            stretching the row. */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          {/* Greyed while open-visits mode is on — the dates genuinely are not
              being applied, and leaving the control looking live is what made
              the list read as a broken picker. */}
          <div className={openOnly ? 'opacity-40 pointer-events-none flex-1 sm:flex-none' : 'flex-1 sm:flex-none'}
            title={openOnly ? 'Date range is ignored while showing open visits' : undefined}>
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              buttonClassName="w-full sm:w-auto justify-between"
            />
          </div>
          {/* Open visits, any date (user, 2026-08-19: "if click to show
              open/non-complete visits thats when you can show them and date
              filter must be ignored"). */}
          {/* ATTENTION when there is unfinished work (user, 2026-08-22:
              "blink or show alert for Open visits").

              An unfinished visit is money not yet billed, so the chip should
              not sit there looking like every other filter. When there are
              open visits and you are NOT already looking at them, a pulsing
              ring and a dot mark it.

              The RING pulses, not the label: blinking text is genuinely hard
              to read, and this sits next to numbers people need to trust.
              Once the filter is on, the pulse stops — you are already looking
              at them, and a nag that never ends stops being a signal. */}
          {(() => {
            const nagging = openCount > 0 && !openOnly;
            return (
              <div className="relative w-full sm:w-auto">
                {nagging && (
                  <span
                    aria-hidden
                    className="absolute -inset-0.5 rounded-xl ring-2 ring-amber-400/70 animate-pulse pointer-events-none"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setOpenOnly(v => !v)}
                  title={openOnly
                    ? 'Showing every unfinished visit, ignoring the date range'
                    : openCount > 0
                      ? `${openCount} visit${openCount === 1 ? '' : 's'} still unfinished — click to show them all, at any date`
                      : 'Show every unfinished visit, at any date'}
                  className={`relative w-full sm:w-auto px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-colors ${openOnly
                    ? 'bg-amber-500 text-white border-amber-500'
                    : nagging
                      ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-400'
                      : 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 border-slate-200 dark:border-zinc-700 hover:border-amber-400'}`}
                >
                  Open visits{openCount > 0 ? ` · ${openCount}` : ''}
                  {nagging && (
                    <span aria-hidden className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                    </span>
                  )}
                </button>
              </div>
            );
          })()}
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="w-full sm:w-44 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20 cursor-pointer"
          >
            {['ALL', ...Object.values(ApptStatus)].map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* Action buttons — grouped so on mobile they share one row. */}
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-700 text-pine shadow'
                  : 'text-seafoam hover:text-pine'
                  }`}
              >
                <List size={14} />
                List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'calendar'
                  ? 'bg-white dark:bg-zinc-700 text-pine shadow'
                  : 'text-seafoam hover:text-pine'
                  }`}
              >
                <CalendarIcon size={14} />
                Calendar
              </button>
            </div>
            {canCreateVisit && (
              <button
                data-tour="appointments-new"
                onClick={onOpenBooking}
                className="shrink-0 px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-pine to-seafoam text-white shadow hover:scale-[1.02] transition whitespace-nowrap"
              >
                + New Visit
              </button>
            )}
            <button
              onClick={() => { refreshAppointments(); setRefreshKey(k => k + 1); }}
              disabled={isLoadingAppointments || rangeLoading}
              className="shrink-0 ml-auto sm:ml-0 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-seafoam disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={isLoadingAppointments || rangeLoading ? 'animate-spin' : ''}
              />
            </button>
          </div>
        </div>

      </div>


      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <AdvancedFilters
          filters={advancedFilters}
          onFiltersChange={setAdvancedFilters}
          availablePets={pets}
          availableStaff={allStaff}
          availableStatuses={Object.values(ApptStatus)}
          availableCategories={Array.from(new Set(paginatedAppointments.map(a => a.tasks.map(t => t.category)).flat()))}
          onClose={() => setShowAdvancedFilters(false)}
        />
      )}

      {/* Filter Chips */}
      <FilterChips
        filters={advancedFilters}
        onRemoveFilter={(filterType, value) => {
          if (filterType === 'dateRange') {
            setAdvancedFilters({ ...advancedFilters, dateRange: { start: null, end: null } });
          } else if (filterType === 'staffIds') {
            setAdvancedFilters({ ...advancedFilters, staffIds: advancedFilters.staffIds.filter(id => id !== value) });
          } else if (filterType === 'categoryIds') {
            setAdvancedFilters({ ...advancedFilters, categoryIds: advancedFilters.categoryIds.filter(id => id !== value) });
          } else if (filterType === 'petIds') {
            setAdvancedFilters({ ...advancedFilters, petIds: advancedFilters.petIds.filter(id => id !== value) });
          } else if (filterType === 'statuses') {
            setAdvancedFilters({ ...advancedFilters, statuses: advancedFilters.statuses.filter(s => s !== value) });
          }
        }}
        onClearAll={() => {
          setAdvancedFilters({
            dateRange: { start: null, end: null },
            staffIds: [],
            categoryIds: [],
            petIds: [],
            statuses: [],
          });
        }}
        pets={pets}
        staff={allStaff}
      />

      {/* Loading State */}
      {(isLoadingAppointments && !rangeRows) || rangeLoading ? (
        <div className="py-32">
          <LoadingSpinner size="lg" message="Loading appointments..." />
        </div>
      ) : (
        <>
          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <CalendarView
              appointments={filtered}
              pets={pets}
              onSelectAppointment={(apptId) => {
                if (onViewDetails) {
                  onViewDetails(apptId);
                }
              }}
              onReschedule={async (apptId, newDate) => {
                const response = await visitsAPI.update(apptId, { scheduledAt: newDate.toISOString() });
                if (response.success) {
                  updateAppointmentOptimistically(apptId, appt => ({ ...appt, scheduledAt: newDate.toISOString() }));
                }
              }}
              onNavigateToList={() => setViewMode('list')}
            />
          )}

          {/* Top pagination (quick access) when list is long */}
          {viewMode === 'list' && paginationMeta.totalItems > 12 && paginationMeta.totalPages > 1 && (
            <Pagination meta={paginationMeta} onPageChange={handlePageChange} compact />
          )}

          {/* Say it out loud when the range holds more than we pulled. A count
              that is quietly short reads as fact, and that is the exact bug
              this change was made to kill. */}
          {rangeTruncated > 0 && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-700 dark:text-amber-400">
              Showing the most recent 6,000 visits in this range — {rangeTruncated.toLocaleString()} older ones are not listed. Narrow the dates to see them.
            </div>
          )}

          {/* List - Desktop Table (hidden on mobile + tablet) */}
          {viewMode === 'list' && (
            <div className="hidden lg:block bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100/60 dark:from-zinc-800/80 dark:to-zinc-800/40 border-b border-slate-200 dark:border-zinc-700/60">
                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500 whitespace-nowrap">Patient</th>
                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500 whitespace-nowrap">Visit Type</th>
                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500 whitespace-nowrap">Services</th>
                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500 whitespace-nowrap">Payment</th>
                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500 whitespace-nowrap text-center">Status</th>
                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500 whitespace-nowrap">Scheduled</th>
                      <th className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500 whitespace-nowrap text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 dark:divide-zinc-800/60">
                    {paginatedAppointments.length > 0 ? paginatedAppointments.map((appt) => {
                      const pet = pets.find(p => p.id === appt.petId);
                      const clinic = clinics.find(c => c.id === appt.clinicId);
                      const categoriesCount = new Set(appt.tasks.map(t => t.category)).size;
                      const servicesCount = appt.tasks.length;
                      const isReadyForPayment = appt.status === ApptStatus.PENDING_PAYMENT && !appt.isPaid;
                      const isDog = (appt.pet?.species || pet?.species) === 'Dog';
                      const isFollowUp = !!appt.parentAppointmentId;
                      const statusRowBg: Record<string, string> = {
                        [ApptStatus.SCHEDULED]: 'bg-cyan-500/[0.03] dark:bg-cyan-500/[0.04]',
                        [ApptStatus.IN_PROGRESS]: 'bg-amber-500/[0.04] dark:bg-amber-500/[0.05]',
                        [ApptStatus.COMPLETED]: 'bg-emerald-500/[0.03] dark:bg-emerald-500/[0.04]',
                        [ApptStatus.PENDING_PAYMENT]: 'bg-orange-500/[0.04] dark:bg-orange-500/[0.05]',
                        [ApptStatus.CANCELLED]: 'bg-red-500/[0.03] dark:bg-red-500/[0.04]',
                      };
                      const statusBorderR: Record<string, string> = {
                        [ApptStatus.SCHEDULED]: 'border-r-[3px] border-r-cyan-400',
                        [ApptStatus.IN_PROGRESS]: 'border-r-[3px] border-r-amber-500',
                        [ApptStatus.COMPLETED]: 'border-r-[3px] border-r-emerald-500',
                        [ApptStatus.PENDING_PAYMENT]: 'border-r-[3px] border-r-orange-500',
                        [ApptStatus.CANCELLED]: 'border-r-[3px] border-r-red-400',
                      };
                      return (
                        <tr
                          key={appt.id}
                          className={`group transition-colors duration-150 ${statusRowBg[appt.status] || ''} ${statusBorderR[appt.status] || ''} hover:bg-slate-50/60 dark:hover:bg-zinc-800/30`}
                        >
                          {/* Patient */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-center gap-1">
                                <div className="relative">
                                  {/* Real profile photo when one exists; the visit-embedded
                                      pet covers transfer visits (pet not in local store). */}
                                  <PetAvatar pet={pet} fallbackPet={appt.pet} size={40} />
                                  {/* Group-visit member — superscript badge on the avatar. */}
                                  {appt.groupVisitId && (
                                    <span title="Part of a group visit" className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-violet-600 text-white flex items-center justify-center ring-2 ring-white dark:ring-zinc-900">
                                      <Users size={9} strokeWidth={3} />
                                    </span>
                                  )}
                                  {/* Partner transfer — the patient is SHARED from the
                                      requesting clinic (user: "I can't differentiate"). */}
                                  {appt.visitType === 'CLINICAL_TRANSFER' && (
                                    <span title="Clinical transfer — shared patient from a partner clinic" className="absolute -bottom-1 -right-1 px-1 rounded-md bg-violet-600 text-white text-[8px] font-black ring-2 ring-white dark:ring-zinc-900">🔁</span>
                                  )}
                                </div>
                                <p className="text-slate-400 dark:text-zinc-600 text-[9px] font-bold font-mono leading-none">#{appt.petId || pet?.id}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-pine dark:text-zinc-100 font-black text-sm leading-tight">{appt.pet?.name || pet?.name}</p>
                                <p className="text-seafoam dark:text-zinc-500 text-[9px] font-bold mt-0.5 truncate max-w-[130px]">{appt.client?.name || 'Unknown'}</p>
                                {/* Owning clinic/branch — only when multiple clinics are in scope. */}
                                <ScopeClinicBadge clinicId={appt.clinicId} clinicName={clinic?.name} className="mt-0.5" />
                              </div>
                            </div>
                          </td>

                          {/* Visit Type — a partner transfer is unmistakably NOT one of
                              this clinic's own visits (user, 2026-08-01). */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              {appt.visitType === 'CLINICAL_TRANSFER' ? (
                                <>
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider w-fit bg-violet-600 text-white">
                                    🔁 Partner Transfer
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider w-fit bg-violet-500/10 text-violet-600 dark:text-violet-400">
                                    Shared patient
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider w-fit ${isFollowUp ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'}`}>
                                    {isFollowUp
                                      ? <RotateCcw size={11} strokeWidth={2.5} />
                                      : <ClipboardList size={11} strokeWidth={2.5} />
                                    }
                                    {isFollowUp ? 'Follow-up' : 'Normal Visit'}
                                  </span>
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider w-fit ${appt.isHouseCall ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'}`}>
                                    {appt.isHouseCall
                                      ? <Home size={11} strokeWidth={2.5} />
                                      : <Building2 size={11} strokeWidth={2.5} />
                                    }
                                    {appt.isHouseCall ? 'House Call' : 'In-Clinic'}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Services */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <Layers size={11} strokeWidth={2.5} className="text-seafoam shrink-0" />
                                <p className="text-pine dark:text-zinc-200 font-bold text-xs">{categoriesCount} {categoriesCount === 1 ? 'Category' : 'Categories'}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Stethoscope size={11} strokeWidth={2.5} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                                <p className="text-slate-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-wider">{servicesCount} {servicesCount === 1 ? 'service' : 'services'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Payment */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <p className="text-pine dark:text-zinc-100 font-black font-mono text-sm tabular-nums">{clinic?.currency || 'KES'} {appt.totalCost.toLocaleString()}</p>
                            <span className={`mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${appt.isPaid
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              }`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${appt.isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                              {payLabel(appt)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4 whitespace-nowrap text-center">
                            <span className={getStatusBadge(appt.status)}>
                              {appt.status.replace('_', ' ')}
                            </span>
                          </td>

                          {/* Scheduled */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <p className="text-pine dark:text-zinc-200 font-bold text-xs leading-tight">{formatDate(appt.date)}</p>
                            <p className="text-seafoam dark:text-zinc-500 text-[10px] font-black mt-1 tracking-wider">{formatTime(appt.date)}</p>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-center">
                            <div className="relative inline-block">
                              <button
                                ref={(el) => { dropdownButtonRefs.current[appt.id] = el; }}
                                onClick={(e) => {
                                  if (openDropdownId === appt.id) {
                                    setOpenDropdownId(null);
                                    setDropdownPosition(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setDropdownPosition({
                                      top: rect.bottom + 8,
                                      right: window.innerWidth - rect.right
                                    });
                                    setOpenDropdownId(appt.id);
                                  }
                                }}
                                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-seafoam hover:border-seafoam hover:text-white text-slate-400 dark:text-zinc-400 transition-all duration-150 active:scale-90 flex items-center justify-center mx-auto"
                                title="Actions"
                              >
                                <MoreVertical size={15} />
                              </button>
                              {openDropdownId === appt.id && dropdownPosition && (
                                <>
                                  <div
                                    className="fixed inset-0 z-[100]"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      setDropdownPosition(null);
                                    }}
                                  />
                                  <div
                                    className="fixed w-60 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/60 z-[101] overflow-hidden backdrop-blur-sm"
                                    style={{
                                      top: `${dropdownPosition.top}px`,
                                      right: `${dropdownPosition.right}px`
                                    }}
                                  >
                                    <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-zinc-800">
                                      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500">Visit #{appt.id}</p>
                                    </div>
                                    <div className="p-1.5 space-y-0.5">
                                    <button
                                      onClick={() => {
                                        onManageWorkflow(appt.id);
                                        setOpenDropdownId(null);
                                        setDropdownPosition(null);
                                      }}
                                      className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/80 rounded-xl transition-colors flex items-center gap-3 text-pine dark:text-zinc-100"
                                    >
                                      <div className="w-7 h-7 rounded-lg bg-seafoam/10 flex items-center justify-center shrink-0">
                                        <Workflow size={14} className="text-seafoam" />
                                      </div>
                                      <div>
                                        <p className="font-black text-[10px] uppercase tracking-widest">View Workflow</p>
                                        <p className="text-[8px] text-slate-400 dark:text-zinc-500 mt-0.5">Manage appointment tasks</p>
                                      </div>
                                    </button>
                                    {onViewDetails && (
                                      <button
                                        onClick={() => {
                                          onViewDetails(appt.id);
                                          setOpenDropdownId(null);
                                          setDropdownPosition(null);
                                        }}
                                        className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/80 rounded-xl transition-colors flex items-center gap-3 text-pine dark:text-zinc-100"
                                      >
                                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                          <Eye size={14} className="text-blue-500" />
                                        </div>
                                        <div>
                                          <p className="font-black text-[10px] uppercase tracking-widest">View Details</p>
                                          <p className="text-[8px] text-slate-400 dark:text-zinc-500 mt-0.5">Read-only appointment view</p>
                                        </div>
                                      </button>
                                    )}
                                    {onEditAppointment && canEditVisit && appt.status !== ApptStatus.COMPLETED && (
                                      <button
                                        onClick={() => {
                                          onEditAppointment(appt.id);
                                          setOpenDropdownId(null);
                                          setDropdownPosition(null);
                                        }}
                                        className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/80 rounded-xl transition-colors flex items-center gap-3 text-pine dark:text-zinc-100"
                                      >
                                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                                          <Edit size={14} className="text-indigo-500" />
                                        </div>
                                        <div>
                                          <p className="font-black text-[10px] uppercase tracking-widest">Edit Visit</p>
                                          <p className="text-[8px] text-slate-400 dark:text-zinc-500 mt-0.5">Modify appointment details</p>
                                        </div>
                                      </button>
                                    )}
                                    {onDeleteAppointment && canDeleteVisit && appt.status !== ApptStatus.COMPLETED && (
                                      <button
                                        onClick={() => {
                                          const pet = pets.find(p => p.id === appt.petId);
                                          setDeleteDialog({ open: true, apptId: appt.id, petName: pet?.name });
                                          setOpenDropdownId(null);
                                          setDropdownPosition(null);
                                        }}
                                        className="w-full px-3 py-2.5 text-left hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors flex items-center gap-3 text-pine dark:text-zinc-100"
                                      >
                                        <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                                          <Trash2 size={14} className="text-red-500" />
                                        </div>
                                        <div>
                                          <p className="font-black text-[10px] uppercase tracking-widest text-red-500">Delete Visit</p>
                                          <p className="text-[8px] text-slate-400 dark:text-zinc-500 mt-0.5">Remove appointment</p>
                                        </div>
                                      </button>
                                    )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={7} className="py-24 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-zinc-800 dark:to-zinc-800/50 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-slate-200 dark:border-zinc-700">
                              📅
                            </div>
                            <div>
                              <p className="text-pine dark:text-zinc-100 font-black text-base uppercase tracking-wider">No Visits</p>
                              <p className="text-slate-400 dark:text-zinc-500 text-xs font-medium mt-1">No scheduled activity in this date range.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mobile Card View (shown only on mobile) */}
          {viewMode === 'list' && (
            <div className="lg:hidden space-y-4">
              {paginatedAppointments.length > 0 ? paginatedAppointments.map((appt) => {
                const pet = pets.find(p => p.id === appt.petId);
                const clinic = clinics.find(c => c.id === appt.clinicId);
                const categoriesCount = new Set(appt.tasks.map(t => t.category)).size;
                const servicesCount = appt.tasks.length;
                const isDog = (appt.pet?.species || pet?.species) === 'Dog';
                const isFollowUp = !!appt.parentAppointmentId;
                const statusBorderL: Record<string, string> = {
                  [ApptStatus.SCHEDULED]: 'border-l-[3px] border-l-cyan-400',
                  [ApptStatus.IN_PROGRESS]: 'border-l-[3px] border-l-amber-500',
                  [ApptStatus.COMPLETED]: 'border-l-[3px] border-l-emerald-500',
                  [ApptStatus.PENDING_PAYMENT]: 'border-l-[3px] border-l-orange-500',
                  [ApptStatus.CANCELLED]: 'border-l-[3px] border-l-red-400',
                };
                return (
                  <div key={appt.id} className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-lg shadow-slate-200/30 dark:shadow-none overflow-visible ${statusBorderL[appt.status] || ''}`}>
                    {/* Card Header */}
                    <div className="bg-slate-50 dark:bg-zinc-800/50 px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div className="relative">
                            <PetAvatar pet={pet} fallbackPet={appt.pet} size={40} />
                            {appt.groupVisitId && (
                              <span title="Part of a group visit" className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-violet-600 text-white flex items-center justify-center ring-2 ring-white dark:ring-zinc-900">
                                <Users size={9} strokeWidth={3} />
                              </span>
                            )}
                            {appt.visitType === 'CLINICAL_TRANSFER' && (
                              <span title="Clinical transfer — shared patient from a partner clinic" className="absolute -bottom-1 -right-1 px-1 rounded-md bg-violet-600 text-white text-[8px] font-black ring-2 ring-white dark:ring-zinc-900">🔁</span>
                            )}
                          </div>
                          <p className="text-slate-400 dark:text-zinc-600 text-[9px] font-bold font-mono leading-none">#{appt.petId || pet?.id}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-pine dark:text-zinc-100 font-black text-base leading-tight">{appt.pet?.name || pet?.name}</p>
                          <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black mt-0.5 uppercase tracking-tighter">
                            {appt.client?.name || 'Unknown'}
                          </p>
                          {/* Owning clinic/branch — only when multiple clinics are in scope. */}
                          <ScopeClinicBadge clinicId={appt.clinicId} clinicName={clinic?.name} className="mt-0.5" />
                        </div>
                        <span className={getStatusBadge(appt.status)}>
                          {appt.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="px-4 py-3 space-y-3">
                      {/* Visit Type */}
                      <div className="flex justify-between items-center">
                        <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Visit Type</span>
                        <div className="flex items-center gap-1.5">
                          {appt.visitType === 'CLINICAL_TRANSFER' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-violet-600 text-white">
                              🔁 Partner Transfer
                            </span>
                          ) : (
                            <>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${isFollowUp ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'}`}>
                                {isFollowUp ? <RotateCcw size={10} strokeWidth={2.5} /> : <ClipboardList size={10} strokeWidth={2.5} />}
                                {isFollowUp ? 'Follow-up' : 'Normal'}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${appt.isHouseCall ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'}`}>
                                {appt.isHouseCall ? <Home size={10} strokeWidth={2.5} /> : <Building2 size={10} strokeWidth={2.5} />}
                                {appt.isHouseCall ? 'House Call' : 'In-Clinic'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Clinic */}
                      <div className="flex justify-between items-center">
                        <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Clinic</span>
                        <div className="flex items-center gap-2 text-right">
                          <span className="text-base">{clinic?.logo}</span>
                          <div>
                            <p className="text-pine dark:text-zinc-100 font-black text-xs">{clinic?.name}</p>
                            <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest">{clinic?.subdomain}</p>
                          </div>
                        </div>
                      </div>

                      {/* Date & Time */}
                      <div className="flex justify-between items-center">
                        <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Scheduled</span>
                        <div className="text-right">
                          <p className="text-pine dark:text-zinc-100 font-bold text-xs">{formatDate(appt.date)}</p>
                          <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black mt-0.5 uppercase tracking-widest">{formatTime(appt.date)}</p>
                        </div>
                      </div>

                      {/* Services */}
                      <div className="flex justify-between items-center">
                        <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Services</span>
                        <div className="flex items-center gap-3 text-right">
                          <div className="flex items-center gap-1">
                            <Layers size={10} strokeWidth={2.5} className="text-seafoam" />
                            <p className="text-pine dark:text-zinc-200 font-bold text-xs">{categoriesCount} {categoriesCount === 1 ? 'Category' : 'Categories'}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Stethoscope size={10} strokeWidth={2.5} className="text-slate-400 dark:text-zinc-500" />
                            <p className="text-slate-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-wider">{servicesCount} {servicesCount === 1 ? 'svc' : 'svcs'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Payment */}
                      <div className="flex justify-between items-center">
                        <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Payment</span>
                        <div className="flex items-center gap-2">
                          <p className="text-pine dark:text-zinc-100 font-black font-mono text-sm tabular-nums">{clinic?.currency || 'KES'} {appt.totalCost.toLocaleString()}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${appt.isPaid
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${appt.isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            {payLabel(appt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer - primary action + dropdown */}
                    <div className="bg-slate-50 dark:bg-zinc-800/50 px-4 py-3 border-t border-slate-200 dark:border-zinc-800 flex items-center gap-2">
                      <button
                        onClick={() => onManageWorkflow(appt.id)}
                        className="flex-1 bg-seafoam hover:bg-seafoam/90 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Workflow size={14} />
                        Workflow
                      </button>
                      {/* Actions dropdown (same pattern as desktop) */}
                      <div className="relative group/card">
                        <button
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                          aria-label="More actions"
                        >
                          <MoreVertical size={16} className="text-slate-500 dark:text-zinc-400" />
                        </button>
                        <div className="absolute bottom-full right-0 mb-1 w-52 rounded-xl shadow-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-hidden opacity-0 invisible group-hover/card:opacity-100 group-hover/card:visible transition-all duration-150 z-50">
                          {onViewDetails && (
                            <button onClick={() => onViewDetails(appt.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-pine dark:text-zinc-100">
                              <Eye size={14} className="text-seafoam" />
                              <p className="font-black text-[10px] uppercase tracking-widest">View Details</p>
                            </button>
                          )}
                          {onEditAppointment && canEditVisit && appt.status !== ApptStatus.COMPLETED && (
                            <button onClick={() => onEditAppointment(appt.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-pine dark:text-zinc-100 border-t border-slate-100 dark:border-zinc-800">
                              <Edit size={14} className="text-blue-500" />
                              <p className="font-black text-[10px] uppercase tracking-widest">Edit</p>
                            </button>
                          )}
                          {onDeleteAppointment && canDeleteVisit && appt.status !== ApptStatus.COMPLETED && (
                            <button
                              onClick={() => { const p = pets.find(p => p.id === appt.petId); setDeleteDialog({ open: true, apptId: appt.id, petName: p?.name }); }}
                              className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-red-500 border-t border-slate-100 dark:border-zinc-800"
                            >
                              <Trash2 size={14} className="text-red-400" />
                              <p className="font-black text-[10px] uppercase tracking-widest">Delete</p>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-20 text-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-6 opacity-40">📅</div>
                  <p className="text-pine dark:text-zinc-100 font-black text-lg uppercase tracking-tighter">No Visits</p>
                  <p className="text-seafoam dark:text-zinc-500 text-sm font-medium mt-1 uppercase tracking-widest">No scheduled activity in this context.</p>
                </div>
              )}
            </div>
          )}

          {/* Pagination - Only show in list view */}
          {viewMode === 'list' && (
            <Pagination
              meta={paginationMeta}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              showLimitSelector={true}
            />
          )}
        </>
      )}
      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Visit?"
        message={
          deleteDialog.petName
            ? `This will permanently delete the appointment for ${deleteDialog.petName}. This action cannot be undone.`
            : 'This will permanently delete the appointment. This action cannot be undone.'
        }
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={async () => {
          if (!deleteDialog.apptId || !onDeleteAppointment) return;
          setIsDeleting(true);
          await onDeleteAppointment(deleteDialog.apptId);
          setIsDeleting(false);
          setDeleteDialog({ open: false, apptId: null });
        }}
        onCancel={() => setDeleteDialog({ open: false, apptId: null })}
      />
    </div>
  );
};

export default VisitsListView;
