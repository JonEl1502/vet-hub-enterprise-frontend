
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Appointment, ApptStatus, Pet, User, Clinic } from '../types';
import { CreditCard, MoreVertical, Eye, Workflow, Edit, Trash2, Calendar as CalendarIcon, List, RefreshCw } from 'lucide-react';
import { formatDate, formatTime } from '../services/utils/dateFormatter';
import { appointmentsAPI } from '../services';
import { PaginationMeta } from '../services/types/pagination';
import Pagination from './Pagination';
import CalendarView from './CalendarView';
import AdvancedFilters from './AdvancedFilters';
import FilterChips from './FilterChips';
import DateRangePicker, { DateRange } from './DateRangePicker';
import { startOfToday } from 'date-fns';

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
  onDeleteAppointment?: (id: number) => void;
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ApptStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const dropdownButtonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

  // Server-side pagination state
  const [paginatedAppointments, setPaginatedAppointments] = useState<Appointment[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

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

  // Date range picker state - default to "Today & Future"
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = startOfToday();
    const farFuture = new Date(2099, 11, 31);
    return { start: today, end: farFuture };
  });

  // Fetch appointments with server-side pagination
  const fetchAppointments = async () => {
    setIsLoadingAppointments(true);
    try {
      // Prepare date range parameters
      const startDate = dateRange.start ? dateRange.start.toISOString() : undefined;
      const endDate = dateRange.end ? dateRange.end.toISOString() : undefined;

      const response = await appointmentsAPI.getAll({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery,
        status: activeTab === 'ALL' ? undefined : activeTab,
        startDate,
        endDate,
        sortBy: 'date',
        sortOrder: 'desc',
      });

      if (response.success && response.data) {
        // Transform appointments to match the Appointment type
        const transformedAppointments = response.data.appointments.map((appt: any) => ({
          id: parseInt(appt.id),
          clinicId: parseInt(appt.clinicId),
          petId: parseInt(appt.petId),
          clientId: parseInt(appt.clientId),
          date: appt.scheduledAt || appt.date, // Backend returns scheduledAt
          status: appt.status,
          totalCost: appt.totalCost || 0,
          isPaid: appt.isPaid || false,
          paymentMethod: appt.paymentMethod,
          tasks: appt.tasks || [],
          parentAppointmentId: appt.parentAppointmentId ? parseInt(appt.parentAppointmentId) : undefined,
          isHouseCall: appt.isHouseCall || false,
          // Include client and pet information from backend response
          client: appt.client ? {
            id: parseInt(appt.client.id),
            name: appt.client.name,
            phone: appt.client.phone,
            email: appt.client.email,
          } : undefined,
          pet: appt.pet ? {
            id: parseInt(appt.pet.id),
            name: appt.pet.name,
            species: appt.pet.species,
            breed: appt.pet.breed,
          } : undefined,
        }));

        setPaginatedAppointments(transformedAppointments);
        setPaginationMeta(response.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  // Fetch appointments when pagination parameters change
  useEffect(() => {
    fetchAppointments();
  }, [currentPage, itemsPerPage, searchQuery, activeTab, dateRange]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle items per page change
  const handleLimitChange = (limit: number) => {
    setItemsPerPage(limit);
    setCurrentPage(1); // Reset to first page
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Appointments</h1>
          <p className="page-subheader mt-1">Enterprise scheduling and visit orchestration</p>
        </div>
        <div className="flex gap-3">
           {/* View Toggle */}
           <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
             <button
               onClick={() => setViewMode('list')}
               className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                 viewMode === 'list' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-md dark:shadow-none' : 'text-seafoam dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
               }`}
             >
               <List size={14} />
               List
             </button>
             <button
               onClick={() => setViewMode('calendar')}
               className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                 viewMode === 'calendar' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-md dark:shadow-none' : 'text-seafoam dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
               }`}
             >
               <CalendarIcon size={14} />
               Calendar
             </button>
           </div>

           {/* Date Range Picker */}
           <DateRangePicker
             value={dateRange}
             onChange={setDateRange}
           />

           {/* Advanced Filters Toggle */}
           <button
             onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
             className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
               showAdvancedFilters ? 'bg-seafoam text-white' : 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 border border-slate-200 dark:border-zinc-800'
             }`}
           >
             🔍 Filters
           </button>

           <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam">🔍</span>
              <input
                type="text"
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none w-64 transition-all font-bold"
              />
           </div>
           <button
             onClick={fetchAppointments}
             disabled={isLoadingAppointments}
             className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 shadow-sm transition-all active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed"
             title="Refresh appointments"
           >
             <RefreshCw size={14} className={isLoadingAppointments ? 'animate-spin' : ''} />
           </button>
           <button onClick={onOpenBooking} className="px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg shadow-pine/20 dark:shadow-none transition-all active:scale-95 hover:scale-105">
             + New Visit
           </button>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 self-start inline-flex">
        {['ALL', ...Object.values(ApptStatus)].map((status) => (
          <button
            key={status}
            onClick={() => setActiveTab(status as any)}
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              activeTab === status ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-md dark:shadow-none' : 'text-seafoam dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <AdvancedFilters
          filters={advancedFilters}
          onFiltersChange={setAdvancedFilters}
          pets={pets}
          staff={allStaff}
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
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20 animate-pulse">
              🐾
            </div>
            <p className="text-[#438883] dark:text-zinc-400 font-bold text-sm">Loading appointments...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <CalendarView
              appointments={paginatedAppointments}
              pets={pets}
              onSelectAppointment={(apptId) => {
                if (onViewDetails) {
                  onViewDetails(apptId);
                }
              }}
              onReschedule={async (apptId, newDate) => {
                // Handle rescheduling - you may want to add an API call here
                console.log('Reschedule appointment', apptId, 'to', newDate);
                // Refresh appointments after rescheduling
                await fetchAppointments();
              }}
              onNavigateToList={() => setViewMode('list')}
            />
          )}

          {/* List - Desktop Table (hidden on mobile) */}
          {viewMode === 'list' && (
        <div className="hidden md:block bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-none">
        <div className="overflow-x-auto rounded-2xl">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                <th className="compact-table-cell table-header whitespace-nowrap">Patient Identity</th>
                <th className="compact-table-cell table-header whitespace-nowrap">Schedule Details</th>
                <th className="compact-table-cell table-header whitespace-nowrap">Services</th>
                <th className="compact-table-cell table-header whitespace-nowrap">Payment</th>
                <th className="compact-table-cell table-header whitespace-nowrap text-center">Status</th>
                <th className="compact-table-cell table-header whitespace-nowrap">Schedule</th>
                <th className="compact-table-cell table-header whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {paginatedAppointments.length > 0 ? paginatedAppointments.map((appt) => {
                const pet = pets.find(p => p.id === appt.petId);
                const clinic = clinics.find(c => c.id === appt.clinicId);
                const categoriesCount = new Set(appt.tasks.map(t => t.category)).size;
                const servicesCount = appt.tasks.length;
                const isReadyForPayment = appt.status === ApptStatus.PENDING_PAYMENT && !appt.isPaid;
                return (
                  <tr key={appt.id} className={`hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors group ${isReadyForPayment ? 'animate-ripple-ready-row' : ''}`}>
                    <td className="compact-table-cell">
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-lg shrink-0">
                            {(appt.pet?.species || pet?.species) === 'Dog' ? '🐶' : '🐱'}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-pine dark:text-zinc-100 font-black text-base leading-tight">{appt.pet?.name || pet?.name}</p>
                            {appt.parentAppointmentId && (
                              <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                Follow-up
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 dark:text-zinc-600 text-[10px] font-bold mt-0.5 tracking-tight">
                            #P-{appt.petId || pet?.id}
                          </p>
                          <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black mt-0.5 uppercase tracking-tighter">
                            Owner: {appt.client?.name || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="compact-table-cell whitespace-nowrap">
                      <div className="space-y-1">
                        <p className="text-pine dark:text-zinc-100 font-bold text-xs leading-tight">
                          {appt.parentAppointmentId ? 'Follow-up Visit' : 'Normal Visit'}
                        </p>
                        <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black uppercase tracking-tighter">
                          {appt.isHouseCall ? 'House Visit: Yes' : 'Clinic Visit'}
                        </p>
                      </div>
                    </td>
                    <td className="compact-table-cell whitespace-nowrap">
                      <div className="space-y-0.5">
                        <p className="body-text font-bold">{categoriesCount} {categoriesCount === 1 ? 'Category' : 'Categories'}</p>
                        <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase tracking-widest">{servicesCount} {servicesCount === 1 ? 'Service' : 'Services'}</p>
                      </div>
                    </td>
                    <td className="compact-table-cell whitespace-nowrap">
                      <div className="space-y-1.5">
                        <p className="text-pine dark:text-zinc-100 font-black font-mono text-sm">{clinic?.currency || 'KES'} {appt.totalCost.toLocaleString()}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest inline-block ${
                          appt.isPaid
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}>
                          {appt.isPaid ? `Paid: ${appt.paymentMethod}` : 'Unpaid'}
                        </span>
                      </div>
                    </td>
                    <td className="compact-table-cell whitespace-nowrap text-center">
                      <span className={getStatusBadge(appt.status)}>
                        {appt.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="compact-table-cell whitespace-nowrap">
                      <p className="body-text font-bold leading-tight">{formatDate(appt.date)}</p>
                      <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black mt-0.5 uppercase tracking-widest">{formatTime(appt.date)}</p>
                    </td>
                    <td className="compact-table-cell text-center">
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
                          className="w-8 h-8 rounded-lg bg-seafoam hover:bg-seafoam/90 text-white transition-all active:scale-95 shadow-sm flex items-center justify-center mx-auto"
                          title="Actions"
                        >
                          <MoreVertical size={16} />
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
                              className="fixed w-56 rounded-xl shadow-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 z-[101] overflow-hidden"
                              style={{
                                top: `${dropdownPosition.top}px`,
                                right: `${dropdownPosition.right}px`
                              }}
                            >
                              <button
                                onClick={() => {
                                  onManageWorkflow(appt.id);
                                  setOpenDropdownId(null);
                                  setDropdownPosition(null);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-pine dark:text-zinc-100"
                              >
                                <Workflow size={16} className="text-seafoam" />
                                <div>
                                  <p className="font-black text-[10px] uppercase tracking-widest">View Workflow</p>
                                  <p className="text-[8px] text-slate-400 dark:text-zinc-500">Manage appointment tasks</p>
                                </div>
                              </button>
                              {onViewDetails && (
                                <button
                                  onClick={() => {
                                    onViewDetails(appt.id);
                                    setOpenDropdownId(null);
                                    setDropdownPosition(null);
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-pine dark:text-zinc-100 border-t border-slate-100 dark:border-zinc-800"
                                >
                                  <Eye size={16} className="text-seafoam" />
                                  <div>
                                    <p className="font-black text-[10px] uppercase tracking-widest">View Details</p>
                                    <p className="text-[8px] text-slate-400 dark:text-zinc-500">Read-only appointment view</p>
                                  </div>
                                </button>
                              )}
                              {onEditAppointment && (
                                <button
                                  onClick={() => {
                                    onEditAppointment(appt.id);
                                    setOpenDropdownId(null);
                                    setDropdownPosition(null);
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-pine dark:text-zinc-100 border-t border-slate-100 dark:border-zinc-800"
                                >
                                  <Edit size={16} className="text-blue-500" />
                                  <div>
                                    <p className="font-black text-[10px] uppercase tracking-widest">Edit Appointment</p>
                                    <p className="text-[8px] text-slate-400 dark:text-zinc-500">Modify appointment details</p>
                                  </div>
                                </button>
                              )}
                              {onDeleteAppointment && (
                                <button
                                  onClick={() => {
                                    onDeleteAppointment(appt.id);
                                    setOpenDropdownId(null);
                                    setDropdownPosition(null);
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-pine dark:text-zinc-100 border-t border-slate-100 dark:border-zinc-800"
                                >
                                  <Trash2 size={16} className="text-red-500" />
                                  <div>
                                    <p className="font-black text-[10px] uppercase tracking-widest">Delete Appointment</p>
                                    <p className="text-[8px] text-slate-400 dark:text-zinc-500">Remove appointment</p>
                                  </div>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="py-40 text-center">
                     <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-6 opacity-40">📅</div>
                     <p className="text-pine dark:text-zinc-100 font-black text-xl uppercase tracking-tighter">No Appointments</p>
                     <p className="text-seafoam dark:text-zinc-500 text-sm font-medium mt-1 uppercase tracking-widest">No scheduled activity in this context.</p>
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
        <div className="md:hidden space-y-4">
        {paginatedAppointments.length > 0 ? paginatedAppointments.map((appt) => {
          const pet = pets.find(p => p.id === appt.petId);
          const clinic = clinics.find(c => c.id === appt.clinicId);
          const categoriesCount = new Set(appt.tasks.map(t => t.category)).size;
          const servicesCount = appt.tasks.length;
          return (
            <div key={appt.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-lg shadow-slate-200/30 dark:shadow-none overflow-visible">
              {/* Card Header */}
              <div className="bg-slate-50 dark:bg-zinc-800/50 px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 flex items-center justify-center text-xl shrink-0">
                    {(appt.pet?.species || pet?.species) === 'Dog' ? '🐶' : '🐱'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-pine dark:text-zinc-100 font-black text-lg leading-tight">{appt.pet?.name || pet?.name}</p>
                    <p className="text-slate-500 dark:text-zinc-600 text-[10px] font-bold mt-0.5 tracking-tight">
                      #P-{appt.petId || pet?.id}
                    </p>
                    <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black mt-0.5 uppercase tracking-tighter">
                      Owner: {appt.client?.name || 'Unknown'}
                    </p>
                  </div>
                  <span className={getStatusBadge(appt.status)}>
                    {appt.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-6 space-y-4">
                {/* Clinic */}
                <div className="flex justify-between items-start">
                  <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Clinic</span>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-lg">{clinic?.logo}</span>
                    <div>
                      <p className="text-pine dark:text-zinc-100 font-black text-sm">{clinic?.name}</p>
                      <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest">{clinic?.subdomain}</p>
                    </div>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="flex justify-between items-start">
                  <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Schedule</span>
                  <div className="text-right">
                    <p className="text-pine dark:text-zinc-100 font-bold">{formatDate(appt.date)}</p>
                    <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black mt-0.5 uppercase tracking-widest">{formatTime(appt.date)}</p>
                  </div>
                </div>

                {/* Services */}
                <div className="flex justify-between items-start">
                  <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Services</span>
                  <div className="text-right">
                    <p className="text-pine dark:text-zinc-100 font-bold">{categoriesCount} {categoriesCount === 1 ? 'Category' : 'Categories'}</p>
                    <p className="text-seafoam dark:text-zinc-500 text-[9px] font-black mt-0.5 uppercase tracking-widest">{servicesCount} {servicesCount === 1 ? 'Service' : 'Services'}</p>
                  </div>
                </div>

                {/* Payment */}
                <div className="flex justify-between items-start">
                  <span className="text-pine dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">Payment</span>
                  <div className="text-right">
                    <p className="text-pine dark:text-zinc-100 font-black font-mono text-base">{clinic?.currency || 'KES'} {appt.totalCost.toLocaleString()}</p>
                    <span className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest inline-block mt-2 ${
                      appt.isPaid
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {appt.isPaid ? `Paid: ${appt.paymentMethod}` : 'Unpaid'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer - Action Buttons */}
              <div className="bg-slate-50 dark:bg-zinc-800/50 px-6 py-4 border-t border-slate-200 dark:border-zinc-800">
                <div className="space-y-2">
                  <button
                    onClick={() => onManageWorkflow(appt.id)}
                    className="w-full bg-seafoam hover:bg-seafoam/90 text-white px-4 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Workflow size={16} />
                    View Workflow
                  </button>
                  {onViewDetails && (
                    <button
                      onClick={() => onViewDetails(appt.id)}
                      className="w-full bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-pine dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 px-4 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Eye size={16} />
                      View Details
                    </button>
                  )}
                  {onEditAppointment && (
                    <button
                      onClick={() => onEditAppointment(appt.id)}
                      className="w-full bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-blue-500 border border-slate-200 dark:border-zinc-700 px-4 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Edit size={16} />
                      Edit Appointment
                    </button>
                  )}
                  {onDeleteAppointment && (
                    <button
                      onClick={() => onDeleteAppointment(appt.id)}
                      className="w-full bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-red-500 border border-slate-200 dark:border-zinc-700 px-4 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete Appointment
                    </button>
                  )}
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
              limitOptions={[10, 20, 50, 100]}
            />
          )}
        </>
      )}
    </div>
  );
};

export default AppointmentsListView;
