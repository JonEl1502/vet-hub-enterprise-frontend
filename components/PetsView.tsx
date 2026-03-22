
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ApptStatus, Clinic, Pet } from '../types';
import { Search, Calendar, Plus, ShieldCheck, Building2, Users, CalendarPlus, Edit, Trash2, MoreVertical, RefreshCw } from 'lucide-react';
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
  const { pets, clients, appointments, isLoadingPets, isLoadingClients, refreshPets, ensurePets, ensureClients, ensureAppointments } = useData();
  useEffect(() => { ensurePets(); ensureClients(); ensureAppointments(); }, [ensurePets, ensureClients, ensureAppointments]);

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const searchFiltered = useMemo(() => {
    if (searchQuery.length < 3) return pets;
    const q = searchQuery.toLowerCase();
    return pets.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.species.toLowerCase().includes(q) ||
      (p.breed || '').toLowerCase().includes(q)
    );
  }, [pets, searchQuery]);

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

  useEffect(() => { setCurrentPage(1); }, [searchQuery, dateRange]);

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

  /** Returns all upcoming scheduled visits for a pet, sorted by date */
  const getUpcomingVisits = (petId: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointments
      .filter(a => a.petId === petId && a.status === ApptStatus.SCHEDULED && new Date(a.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pb-20"
    >
      <div className="space-y-4 mb-6">
        <div className="flex flex-col gap-3 bg-slate-50/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 backdrop-blur-sm">
          {/* Row 1 — Search alone */}
          <div className="relative group w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
            <input
              type="text"
              placeholder="Search patients (min 3 chars)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all font-bold shadow-xs"
            />
          </div>

          {/* Row 2 — Date picker + New & Refresh to the right */}
          <div className="flex items-center gap-2">
            <DateRangePicker value={dateRange} onChange={setDateRange} className="min-w-[180px] flex-1" />
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => refreshPets()}
                disabled={isLoadingPets || isLoadingClients}
                className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 shadow-sm transition-all flex items-center gap-1.5 active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed p-2.5"
                title="Refresh pet data"
              >
                <RefreshCw size={14} className={isLoadingPets || isLoadingClients ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={onRegisterPet}
                className="compact-button bg-gradient-to-r from-pine to-seafoam text-white shadow-xs shadow-pine/30 hover:shadow-xl hover:shadow-pine/40 transition-all active:scale-95 px-5 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
              >
                <Plus size={14} className="inline ml-1" /> Register
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoadingPets || isLoadingClients ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20 animate-pulse">🐾</div>
            <p className="text-[#438883] dark:text-zinc-400 font-bold text-sm">Loading patients...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 overflow-visible">
            {paginatedPets.map((pet, index) => {
              const owner = clients.find(c => c.id === pet.ownerId);
              const upcomingVisits = getUpcomingVisits(pet.id);
              const upcomingVisit = upcomingVisits[0];
              const extraVisits = upcomingVisits.length - 1;
              const isVaccination = upcomingVisit?.tasks?.some((t: any) => t.category.toLowerCase().includes('vac'));

              return (
                <motion.div
                  key={pet.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className={`compact-card overflow-visible hover:z-[50] ${
                    upcomingVisit
                      ? isVaccination
                        ? 'border-indigo-200 dark:border-indigo-800/60 shadow-[0_0_0_2px_rgba(129,140,248,0.18),0_4px_20px_rgba(129,140,248,0.12)] hover:shadow-[0_0_0_2px_rgba(129,140,248,0.4),0_8px_28px_rgba(129,140,248,0.22)]'
                        : 'border-amber-200 dark:border-amber-800/60 shadow-[0_0_0_2px_rgba(251,191,36,0.18),0_4px_20px_rgba(251,191,36,0.12)] hover:shadow-[0_0_0_2px_rgba(251,191,36,0.4),0_8px_28px_rgba(251,191,36,0.22)]'
                      : ''
                  }`}
                >
                  <div className="flex gap-2 items-start">
                    {/* LEFT: pet info */}
                    <div className="flex-1 min-w-0">
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

                      <div className="space-y-1 mb-2">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[9px] font-bold">
                          <Users size={10} className="text-mist dark:text-zinc-700 shrink-0" />
                          <span className="truncate">{owner?.name || 'External'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[9px] font-bold">
                          <Building2 size={10} className="text-mist dark:text-zinc-700 shrink-0" />
                          <span className="truncate">{owner?.phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: badge + actions icon with inline menu */}
                    <div className="flex flex-col items-center gap-2 shrink-0 pt-1">
                      {/* Always-visible upcoming visit badge */}
                      {upcomingVisit && (
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black select-none whitespace-nowrap ${
                          isVaccination
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-700/50'
                            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700/50'
                        }`}>
                          <Calendar size={8} />
                          <span>{formatDate(upcomingVisit.date)}</span>
                          {extraVisits > 0 && <span className="opacity-70 ml-0.5">+{extraVisits}</span>}
                        </div>
                      )}

                      {/* Actions icon + inline menu */}
                      <div className="relative group/actions flex items-center">
                        {/* Menu opens to the LEFT, pr-2 bridge keeps hover alive */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 pr-2 z-50 opacity-0 pointer-events-none group-hover/actions:opacity-100 group-hover/actions:pointer-events-auto transition-opacity duration-150">
                          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1.5 shadow-xl w-44">
                            <button
                              onClick={(e) => { e.stopPropagation(); onViewPet(pet.id); }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                              <Search size={12} className="text-slate-500 dark:text-zinc-400 shrink-0" />
                              <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">View Patient</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNewAppointment(pet.ownerId, pet.id);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-cyan/10 dark:hover:bg-cyan/10 rounded-lg transition-colors"
                            >
                              <CalendarPlus size={12} className="text-cyan dark:text-cyan shrink-0" />
                              <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">New Appointment</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'appointments'); }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                            >
                              <Calendar size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">View Visits</span>
                            </button>
                            {onEditPet && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditPet(pet.id); }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors border-t border-slate-100 dark:border-zinc-800 mt-1 pt-2"
                              >
                                <Edit size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="text-pine dark:text-zinc-100 font-bold text-[10px]">Edit Pet</span>
                              </button>
                            )}
                            {onDeletePet && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onDeletePet(pet.id); }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 size={12} className="text-red-600 dark:text-red-400 shrink-0" />
                                <span className="text-red-600 dark:text-red-400 font-bold text-[10px]">Delete Pet</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <button className="relative z-10 p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-white hover:bg-seafoam rounded-lg transition-all shadow-sm">
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Weight</p>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{pet.weight || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-xl">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Appointments</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-white">{String(pet.appointmentCount || 0)}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <Pagination
            meta={paginationMeta}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            showLimitSelector={true}
            limitOptions={[6, 12, 24, 48]}
          />
        </div>
      )}
    </motion.div>
  );
};

export default PetsView;
