
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Appointment, ApptStatus, Pet, User, Clinic } from '../../../types';
import { CreditCard, MoreVertical, Eye, Workflow, Edit, Trash2, Calendar as CalendarIcon, List, RefreshCw, Home, Building2, RotateCcw, ClipboardList, Layers, Stethoscope, X } from 'lucide-react';
import { formatDate, formatTime } from '../../../services/utils/dateFormatter';
import { useData } from '../../../contexts/DataContext';
import { appointmentsAPI } from '../../../services';
import { PaginationMeta } from '../../../services/types/pagination';
import Pagination from '../../shared/common/Pagination';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import CalendarView from './CalendarView';
import AdvancedFilters from '../../shared/common/AdvancedFilters';
import FilterChips from '../../shared/common/FilterChips';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { startOfToday } from 'date-fns';
import ConfirmDialog from '../../shared/common/ConfirmDialog';

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
}

const AppointmentsListView: React.FC<Props> = ({
  pets,
  clinics,
  allStaff,
  onManageWorkflow,
  onUpdateApptStatus,
  onOpenBooking,
  onProcessPayment,
  onViewDetails,
  onEditAppointment,
  onDeleteAppointment
}) => {
  const { appointments, isLoadingAppointments, refreshAppointments, updateAppointmentOptimistically, ensureAppointments } = useData();
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
  const [itemsPerPage, setItemsPerPage] = useState(20);

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
  const [dateRange, setDateRange] = useState<DateRange>(() => {
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

  // Client-side filtering
  const filtered = useMemo(() => {
    const startStr = dateRange.start ? toClinicDateStr(new Date(dateRange.start)) : null;
    const endStr = dateRange.end ? toClinicDateStr(new Date(dateRange.end)) : null;
    return appointments
      .filter(appt => {
        const s = toClinicDateStr(new Date(appt.date));
        if (startStr && s < startStr) return false;
        if (endStr && s > endStr) return false;
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
  }, [appointments, dateRange, activeTab, searchQuery]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, activeTab, dateRange]);

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
  const getVisitNumber = (appointment: Appointment): number => {
    // For server-side pagination, we can't calculate the exact visit number
    // without fetching all appointments for the pet
    // Return a placeholder or fetch from backend if needed
    return appointment.id; // Simplified - ideally this should come from backend
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header - Moved ABOVE filters */}
      {/* <div>
            <h1 className="page-header">Appointments</h1>
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

        {/* ROW 2 — Date Picker */}
        <div className="flex items-center gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            className="flex-1 sm:flex-none"
            buttonClassName="w-full sm:w-auto justify-between"
          />
        </div>

        {/* ROW 3 — Status filter + actions.
            Mobile: status select gets its own full-width row so it isn't
            squeezed by "+ New Visit"; sm+: single row as before. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="w-full sm:flex-1 sm:min-w-0 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20 cursor-pointer"
          >
            {['ALL', ...Object.values(ApptStatus)].map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* Action buttons — grouped so on mobile they share one row. */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              data-tour="appointments-new"
              onClick={onOpenBooking}
              className="shrink-0 px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-pine to-seafoam text-white shadow hover:scale-[1.02] transition whitespace-nowrap"
            >
              + New Visit
            </button>
            <button
              onClick={() => refreshAppointments()}
              disabled={isLoadingAppointments}
              className="shrink-0 ml-auto sm:ml-0 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-seafoam disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={isLoadingAppointments ? 'animate-spin' : ''}
              />
            </button>
          </div>
        </div>

        {/* ROW 4 — View Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 ml-auto">
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
      {isLoadingAppointments ? (
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
                const response = await appointmentsAPI.update(apptId, { scheduledAt: newDate.toISOString() });
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
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm ${isDog ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30' : 'bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/30'}`}>
                                  {isDog ? '🐶' : '🐱'}
                                </div>
                                <p className="text-slate-400 dark:text-zinc-600 text-[9px] font-bold font-mono leading-none">#{appt.petId || pet?.id}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-pine dark:text-zinc-100 font-black text-sm leading-tight">{appt.pet?.name || pet?.name}</p>
                                <p className="text-seafoam dark:text-zinc-500 text-[9px] font-bold mt-0.5 truncate max-w-[130px]">{appt.client?.name || 'Unknown'}</p>
                                {clinic?.name && (
                                  <p className="text-slate-400 dark:text-zinc-600 text-[9px] font-bold mt-0.5 truncate max-w-[130px] uppercase tracking-wider">{clinic.name}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Visit Type */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
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
                              {appt.isPaid ? `${appt.paymentMethod}` : 'Unpaid'}
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
                                      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500">Appointment #{appt.id}</p>
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
                                    {onEditAppointment && appt.status !== ApptStatus.COMPLETED && (
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
                                          <p className="font-black text-[10px] uppercase tracking-widest">Edit Appointment</p>
                                          <p className="text-[8px] text-slate-400 dark:text-zinc-500 mt-0.5">Modify appointment details</p>
                                        </div>
                                      </button>
                                    )}
                                    {onDeleteAppointment && appt.status !== ApptStatus.COMPLETED && (
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
                                          <p className="font-black text-[10px] uppercase tracking-widest text-red-500">Delete Appointment</p>
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
                              <p className="text-pine dark:text-zinc-100 font-black text-base uppercase tracking-wider">No Appointments</p>
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
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm ${isDog ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30' : 'bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/30'}`}>
                            {isDog ? '🐶' : '🐱'}
                          </div>
                          <p className="text-slate-400 dark:text-zinc-600 text-[9px] font-bold font-mono leading-none">#{appt.petId || pet?.id}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-pine dark:text-zinc-100 font-black text-base leading-tight">{appt.pet?.name || pet?.name}</p>
                          <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black mt-0.5 uppercase tracking-tighter">
                            {appt.client?.name || 'Unknown'}
                          </p>
                          {clinic?.name && (
                            <p className="text-slate-400 dark:text-zinc-600 text-[9px] font-bold mt-0.5 uppercase tracking-wider truncate">{clinic.name}</p>
                          )}
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
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${isFollowUp ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'}`}>
                            {isFollowUp ? <RotateCcw size={10} strokeWidth={2.5} /> : <ClipboardList size={10} strokeWidth={2.5} />}
                            {isFollowUp ? 'Follow-up' : 'Normal'}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${appt.isHouseCall ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'}`}>
                            {appt.isHouseCall ? <Home size={10} strokeWidth={2.5} /> : <Building2 size={10} strokeWidth={2.5} />}
                            {appt.isHouseCall ? 'House Call' : 'In-Clinic'}
                          </span>
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
                            {appt.isPaid ? appt.paymentMethod : 'Unpaid'}
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
                          {onEditAppointment && appt.status !== ApptStatus.COMPLETED && (
                            <button onClick={() => onEditAppointment(appt.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-pine dark:text-zinc-100 border-t border-slate-100 dark:border-zinc-800">
                              <Edit size={14} className="text-blue-500" />
                              <p className="font-black text-[10px] uppercase tracking-widest">Edit</p>
                            </button>
                          )}
                          {onDeleteAppointment && appt.status !== ApptStatus.COMPLETED && (
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
                  <p className="text-pine dark:text-zinc-100 font-black text-lg uppercase tracking-tighter">No Appointments</p>
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
        title="Delete Appointment?"
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

export default AppointmentsListView;
