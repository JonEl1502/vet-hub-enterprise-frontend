
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ApptStatus, Clinic, Pet } from '../types';
import { Search, Eye, Clipboard, Calendar, Network, Plus, MoreHorizontal, ShieldCheck, Info, Building2, Users, Mail, Phone, MapPin, Sparkles, CalendarPlus, Loader2, Edit, Trash2, MoreVertical, RefreshCw } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { formatDate, formatTime } from '../services/utils/dateFormatter';
import { PaginationMeta } from '../services/types/pagination';
import Pagination from './Pagination';
import DateRangePicker, { DateRange } from './DateRangePicker';

interface Props {
  clinics: Clinic[];
  onViewPet: (id: number, initialTab?: string) => void;
  onGenerateAiSummary: (history: any[]) => void;
  loadingAi: boolean;
  onRegisterPet: () => void;
  onNewAppointment: (clientId: number, petId: number) => void;
  onEditPet?: (id: number) => void;
  onDeletePet?: (id: number) => void;
}

const PetsView: React.FC<Props> = ({ clinics, onViewPet, onGenerateAiSummary, loadingAi, onRegisterPet, onNewAppointment, onEditPet, onDeletePet }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredActionsPet, setHoveredActionsPet] = useState<number | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsHoverTimeoutRef = useRef<number | null>(null);
  const actionsButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const { pets, clients, appointments, isLoadingPets, isLoadingClients, refreshPets } = useData();

  // Date range filter state
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Client-side search filter (min 3 chars)
  const searchFiltered = useMemo(() => {
    if (searchQuery.length < 3) return pets;
    const q = searchQuery.toLowerCase();
    return pets.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.species.toLowerCase().includes(q) ||
      (p.breed || '').toLowerCase().includes(q)
    );
  }, [pets, searchQuery]);

  // Client-side date range filter (by upcoming appointments)
  const filtered = useMemo(() => {
    if (!dateRange) return searchFiltered;
    return searchFiltered.filter(pet => {
      const petAppts = appointments.filter(a => a.petId === pet.id);
      return petAppts.some(a => {
        const d = new Date(a.date);
        return d >= dateRange.start && d <= dateRange.end;
      });
    });
  }, [searchFiltered, appointments, dateRange]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, dateRange]);

  // Client-side pagination
  const paginatedPets = useMemo(() => {
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

  const getUpcomingVisit = (petId: number) => {
    const now = new Date();
    // Set to start of today to include all appointments from today onwards
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    return appointments.find(a =>
      a.petId === petId &&
      a.status === ApptStatus.SCHEDULED &&
      new Date(a.date) >= today
    );
  };

  const handleActionsMouseEnter = (petId: number) => {
    if (actionsHoverTimeoutRef.current) window.clearTimeout(actionsHoverTimeoutRef.current);
    setHoveredActionsPet(petId);
    // Compute position for the fixed-position actions menu
    const ref = actionsButtonRefs.current[petId];
    if (ref) {
      const rect = ref.getBoundingClientRect();
      setActionsMenuPosition({ top: rect.top, left: rect.left - 8 });
    }
  };

  const handleActionsMouseLeave = () => {
    actionsHoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredActionsPet(null);
      setActionsMenuPosition(null);
    }, 300);
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pb-20"
    >
      <div className="space-y-4 mb-6">
        {/* Header Title - Own section */}
        {/* <div>
          <h1 className="page-header">Patient Directory</h1>
          <p className="page-subheader mt-1">Manage Animal Patients & Records</p>
        </div> */}

        {/* Filters Row - Search next to DatePicker, Reload/Register far right */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 bg-slate-50/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 backdrop-blur-sm">

          {/* Left: Search + DatePicker (next to each other) */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
            {/* Search */}
            <div className="relative group flex-1 min-w-[250px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
              <input
                type="text"
                placeholder="Search patients (min 3 chars)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all font-bold shadow-xs"
              />
            </div>

            {/* DatePicker - Right next to search */}
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="min-w-[220px]"
            />
          </div>

          {/* Right: Reload + Register (far right, same row) */}
          <div className="flex gap-2 ml-auto">
            {/* Reload */}
            <button
              onClick={() => refreshPets()}
              disabled={isLoadingPets || isLoadingClients}
              className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 shadow-sm transition-all flex items-center gap-1.5 active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed p-2.5"
              title="Refresh pet data"
            >
              <RefreshCw size={14} className={isLoadingPets || isLoadingClients ? 'animate-spin' : ''} />
            </button>

            {/* Register Pet - Prominent CTA */}
            <button
              onClick={onRegisterPet}
              className="compact-button bg-gradient-to-r from-pine to-seafoam text-white shadow-xs shadow-pine/30 hover:shadow-xl hover:shadow-pine/40 transition-all active:scale-95 px-5 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
            >
              <Plus size={14} className="inline ml-1" /> Register
            </button>
          </div>
        </div>
      </div>

      {/* Loading State - appears below search */}
      {isLoadingPets || isLoadingClients ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20 animate-pulse">
              🐾
            </div>
            <p className="text-[#438883] dark:text-zinc-400 font-bold text-sm">Loading patients...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-visible">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 overflow-visible">
              {paginatedPets.map((pet, index) => {
                const owner = clients.find(c => c.id === pet.ownerId);
                const clinic = clinics.find(c => c.id === pet.clinicId);
                const upcomingVisit = getUpcomingVisit(pet.id);
                const isVaccination = upcomingVisit?.tasks?.some(t => t.category.toLowerCase().includes('vac'));

                return (
                  <motion.div
                    key={pet.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    className="compact-card overflow-visible"
                  >

                    {upcomingVisit && upcomingVisit.date && (
                      <div className="absolute top-4 right-4 group/alert">
                        <div className="relative flex h-2 w-2">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isVaccination ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${isVaccination ? 'bg-indigo-600' : 'bg-amber-600'}`}></span>
                        </div>

                        <div className="absolute top-0 right-6 opacity-0 group-hover/alert:opacity-100 transition-all duration-300 pointer-events-none translate-x-2 group-hover/alert:translate-x-0 z-[120]">
                          <div className="bg-pine text-white p-3 rounded-xl shadow-2xl w-52 border border-white/10">
                            <p className="text-[7px] font-black uppercase tracking-[0.2em] mb-1 opacity-50">Alert</p>
                            <p className="text-xs font-black leading-tight">Upcoming {isVaccination ? 'Vaccination' : 'Visit'}</p>
                            <p className="text-[8px] font-bold mt-1.5">{formatDate(upcomingVisit.date)} @ {formatTime(upcomingVisit.date)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Horizontal layout: pet info on left, actions on right */}
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewPet(pet.id)}>
                        {/* Pet header - more compact */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-xl group-hover:scale-105 transition-transform shrink-0">
                            {pet.species === 'Dog' ? '🐶' : '🐱'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h3 className="card-title text-sm truncate leading-tight">{pet.name}</h3>
                              <button
                                onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'vaccines'); }}
                                className="p-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-100 dark:border-indigo-500/20 hover:scale-110 transition-transform"
                              >
                                <ShieldCheck size={10} />
                              </button>
                            </div>
                            <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase tracking-widest">{pet.breed} • {pet.species} • {pet.age}</p>
                          </div>
                        </div>

                        {/* Owner and clinic info - more compact */}
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[9px] font-bold">
                            <Users size={10} className="text-mist dark:text-zinc-700 shrink-0" />
                            <span className="truncate">{owner?.name || 'External'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[9px] font-bold">
                            <Building2 size={10} className="text-mist dark:text-zinc-700 shrink-0" />
                            <span className="truncate">{owner?.phone}</span>
                          </div>
                          {/* <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[9px] font-bold">
                      <Building2 size={10} className="text-mist dark:text-zinc-700 shrink-0" />
                      <span className="truncate">{clinic?.name}</span>
                    </div> */}
                        </div>

                        {/* Weight and ID - more compact */}
                        {/* <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                          <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl">
                            <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                              Weight
                            </p>
                            <p className="text-base text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              {pet.weight || 'N/A'}
                            </p>
                          </div>

                          <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-xl">
                            <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                              Appointments
                            </p>
                            <p className="text-base font-semibold text-slate-700 dark:text-white">
                              {String(pet.appointmentCount || 0)}
                            </p>
                          </div>

                        </div> */}
                      </div>

                      {/* Action buttons - keep only primary action visible */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {/* <button
                    onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'overview'); }}
                    className="p-2.5 bg-seafoam hover:bg-seafoam/90 text-white rounded-lg transition-all shadow-sm"
                    title="View Patient"
                  >
                    <Eye size={14} />
                  </button> */}

                        {/* Dropdown menu for all other actions */}
                        <div className="relative" onMouseEnter={() => handleActionsMouseEnter(pet.id)} onMouseLeave={handleActionsMouseLeave}>
                          <button
                            ref={(el) => { actionsButtonRefs.current[pet.id] = el; }}
                            className="p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-white hover:bg-seafoam rounded-lg transition-all shadow-sm"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                     {/* Weight and ID - more compact */}
                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                          <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl">
                            <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                              Weight
                            </p>
                            <p className="text-base text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              {pet.weight || 'N/A'}
                            </p>
                          </div>

                          <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-xl">
                            <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                              Appointments
                            </p>
                            <p className="text-base font-semibold text-slate-700 dark:text-white">
                              {String(pet.appointmentCount || 0)}
                            </p>
                          </div>

                        </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            <Pagination
              meta={paginationMeta}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              showLimitSelector={true}
              limitOptions={[6, 12, 24, 48]}
            />
          </div>

          {/* Fixed-position actions hover menu - renders outside card overflow */}
          {hoveredActionsPet !== null && actionsMenuPosition && (
            <div
              className="fixed z-[9999] w-44 animate-in slide-in-from-right-2 fade-in duration-200"
              style={{ top: actionsMenuPosition.top, left: actionsMenuPosition.left, transform: 'translateX(-100%)' }}
              onMouseEnter={() => { if (actionsHoverTimeoutRef.current) window.clearTimeout(actionsHoverTimeoutRef.current); }}
              onMouseLeave={handleActionsMouseLeave}
            >
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1.5 shadow-2xl overflow-hidden">
                {/* <button
                  onClick={(e) => { e.stopPropagation(); onViewPet(hoveredActionsPet, 'history'); setHoveredActionsPet(null); setActionsMenuPosition(null); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                >
                  <Clipboard size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">Medical Records</span>
                </button> */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const pet = paginatedPets.find(p => p.id === hoveredActionsPet);
                    if (pet) onNewAppointment(pet.ownerId, pet.id);
                    setHoveredActionsPet(null);
                    setActionsMenuPosition(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-cyan/10 dark:hover:bg-cyan/10 rounded-lg transition-colors"
                >
                  <CalendarPlus size={12} className="text-cyan dark:text-cyan" />
                  <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">New Appointment</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onViewPet(hoveredActionsPet, 'appointments'); setHoveredActionsPet(null); setActionsMenuPosition(null); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                >
                  <Calendar size={12} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">View Visits</span>
                </button>
                {onEditPet && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditPet(hoveredActionsPet); setHoveredActionsPet(null); setActionsMenuPosition(null); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors border-t border-slate-100 dark:border-zinc-800 mt-1 pt-2"
                  >
                    <Edit size={12} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">Edit Pet</span>
                  </button>
                )}
                {onDeletePet && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeletePet(hoveredActionsPet); setHoveredActionsPet(null); setActionsMenuPosition(null); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} className="text-red-600 dark:text-red-400" />
                    <span className="text-red-600 dark:text-red-400 font-bold text-[10px]">Delete Pet</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );

};

export default PetsView;
