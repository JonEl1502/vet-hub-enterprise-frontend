
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ApptStatus, Client, FULL_ACCESS_ROLES, UserRole } from '../../../types';
import { Transaction } from '../../../services/modules/transactions.api';
import { Search, PawPrint, User, Phone, Mail, Edit, Trash2, RefreshCw, Calendar, X, Loader2, Filter, ChevronDown, AlertTriangle, ArrowRightLeft, Building2, UserX, UserCheck } from 'lucide-react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import DuplicateClientsModal from './DuplicateClientsModal';
import TransferClinicModal from '../clinic-mgmt/TransferClinicModal';
import { useData } from '../../../contexts/DataContext';
import WalkInModal from './WalkInModal';
import { Zap } from 'lucide-react';
import { clientsAPI } from '../../../services';
import { useAuth } from '../../../contexts/AuthContext';
import { useClinic } from '../../../contexts/ClinicContext';
import { formatDate, formatTime } from '../../../services/utils/dateFormatter';
import { PaginationMeta } from '../../../services/types/pagination';
import Pagination from '../../shared/common/Pagination';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import ScopeClinicBadge from '../../shared/common/ScopeClinicBadge';

interface ClientsViewProps {
  transactions: Transaction[];
  onViewClient: (id: number) => void;
  onViewFinance: (clientId: number) => void;
  onRegisterClient: () => void;
  onAddPetForClient: (id: number) => void;
  onPrebookAppointment: (clientId: number, petId: number) => void;
  onEditClient?: (id: number) => void;
  onDeleteClient?: (id: number) => void;
  onViewPet?: (id: number) => void;
  onViewClientPets?: (clientId: number) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ transactions, onViewClient, onViewFinance, onRegisterClient, onAddPetForClient, onPrebookAppointment, onEditClient, onDeleteClient, onViewPet, onViewClientPets }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { clients, pets, appointments, totals, isLoadingClients, isLoadingPets, refreshClients, ensureClients, ensurePets, ensureAppointments, clientStatus, setClientStatus } = useData();
  useEffect(() => { ensureClients(); ensurePets(); ensureAppointments(); }, [ensureClients, ensurePets, ensureAppointments]);
  const { user } = useAuth();
  const { clinics } = useClinic();
  const clinicNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clinics) m.set(String(c.id), c.name);
    return m;
  }, [clinics]);
  const hasFullAccess = FULL_ACCESS_ROLES.includes((user?.role as UserRole));

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [transferTarget, setTransferTarget] = useState<Client | null>(null);
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'MERCHANT_ADMIN';

  type ClientFilter = 'all' | 'upcoming' | 'pastCount' | 'hasVaccines';
  const [clientFilter, setClientFilter] = useState<ClientFilter>('all');
  const [pastCountMin, setPastCountMin] = useState<number>(3);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [pastCountDialogOpen, setPastCountDialogOpen] = useState(false);
  const [pastCountInput, setPastCountInput] = useState<string>('3');
  const filterContainerRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false);
      }
    };
    if (filterDropdownOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [filterDropdownOpen]);

  const [apiClientResults, setApiClientResults] = useState<Client[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  // A–Z alphabet filter (matches any word of the name; '#' = non-letter start).
  const [letterFilter, setLetterFilter] = useState<string | null>(null);

  const localFiltered = useMemo(() => {
    if (searchQuery.length < 3) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    );
  }, [clients, searchQuery]);

  // API fallback when local search returns nothing
  useEffect(() => {
    if (searchQuery.length < 3 || localFiltered.length > 0) {
      setApiClientResults([]);
      setIsSearchingApi(false);
      return;
    }
    setIsSearchingApi(true);
    const timer = setTimeout(async () => {
      try {
        const res = await clientsAPI.getAll({ page: 1, limit: 20, search: searchQuery }, { cache: false });
        if (res.success && res.data?.clients) {
          setApiClientResults(res.data.clients.map((c: any) => ({
            ...c,
            id: typeof c.id === 'string' ? parseInt(c.id) : c.id,
            avatar: String(c.avatarUrl || c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`),
          } as unknown as Client)));
        } else {
          setApiClientResults([]);
        }
      } catch {
        setApiClientResults([]);
      } finally {
        setIsSearchingApi(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, localFiltered.length]);

  const searchFiltered = useMemo(() => {
    return localFiltered.length > 0 ? localFiltered : apiClientResults;
  }, [localFiltered, apiClientResults]);

  const filtered = useMemo(() => {
    let list = searchFiltered;
    if (dateRange) {
      list = list.filter(client => {
        const clientPets = pets.filter(p => p.ownerId === client.id);
        return clientPets.some(pet =>
          appointments.filter(a => a.petId === pet.id).some(appt => {
            const d = new Date(appt.date);
            return d >= dateRange.start && d <= dateRange.end;
          })
        );
      });
    }
    if (clientFilter === 'upcoming') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter(client => {
        const clientPetIds = pets.filter(p => p.ownerId === client.id).map(p => p.id);
        return appointments.some(a =>
          clientPetIds.includes(a.petId) &&
          a.status === ApptStatus.SCHEDULED &&
          new Date(a.date) >= today
        );
      });
    } else if (clientFilter === 'pastCount') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter(client => {
        const clientPetIds = pets.filter(p => p.ownerId === client.id).map(p => p.id);
        const pastCount = appointments.filter(a =>
          clientPetIds.includes(a.petId) && new Date(a.date) < today
        ).length;
        return pastCount >= pastCountMin;
      });
    } else if (clientFilter === 'hasVaccines') {
      list = list.filter(client =>
        pets.some(p => p.ownerId === client.id && (p.vaccinationCount ?? p.vaccinations?.length ?? 0) > 0)
      );
    }
    if (letterFilter) {
      list = list.filter(c => {
        const name = (c.name || '').trim();
        if (letterFilter === '#') return !/^[a-z]/i.test(name);
        return name.split(/\s+/).some(w => w.toUpperCase().startsWith(letterFilter));
      });
    }
    return list;
  }, [searchFiltered, pets, appointments, dateRange, clientFilter, pastCountMin, letterFilter]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, dateRange, clientFilter, pastCountMin]);

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  // When the user isn't narrowing the list, trust the server total AND let
  // totalPages reflect that total so page 2+ is reachable. With local
  // filters active, pagination tracks the filtered subset since the server
  // total is irrelevant. effectiveTotal uses the larger of the two so a
  // server total smaller than what's locally cached can't hide records.
  const isUnfiltered = searchQuery.length < 3 && !dateRange && clientFilter === 'all';
  const dbTotal = isUnfiltered && typeof totals.clients === 'number' ? totals.clients : filtered.length;
  const effectiveTotal = Math.max(filtered.length, dbTotal);
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / itemsPerPage));
  const paginationMeta: PaginationMeta = {
    currentPage,
    totalPages,
    totalItems: dbTotal,
    itemsPerPage,
    hasNextPage: currentPage < totalPages,
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

  const getClientPets = (clientId: number) => pets.filter(p => p.ownerId === clientId);

  /** Returns all upcoming scheduled visits across a client's pets, sorted by date */
  const getUpcomingClientAlerts = (clientId: number) => {
    const clientPets = getClientPets(clientId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alerts: Array<{ pet: (typeof pets)[0]; visit: (typeof appointments)[0] }> = [];
    for (const pet of clientPets) {
      const visit = appointments.find(a =>
        a.petId === pet.id &&
        a.status === ApptStatus.SCHEDULED &&
        new Date(a.date) >= today
      );
      if (visit) alerts.push({ pet, visit });
    }
    return alerts.sort((a, b) => new Date(a.visit.date).getTime() - new Date(b.visit.date).getTime());
  };

  const filteredClients = useMemo(() => {
    if (!dateRange) return paginatedClients;
    return paginatedClients.filter(client => {
      const clientPets = getClientPets(client.id);
      if (clientPets.length === 0) return false;
      return clientPets.some(pet => {
        const petAppointments = appointments.filter(a => a.petId === pet.id);
        return petAppointments.some(appt => {
          const apptDate = new Date(appt.date);
          return apptDate >= dateRange.start && apptDate <= dateRange.end;
        });
      });
    });
  }, [paginatedClients, pets, appointments, dateRange]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pb-20"
    >
      <div className="space-y-4 mb-6 relative z-[55]">
        <div className="flex flex-col gap-3 bg-slate-50/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 backdrop-blur-sm relative z-[55]">
          {/* Row 1 — Search alone */}
          <div className="relative group w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
            <input
              type="text"
              placeholder="Search clients (min 3 chars)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all font-bold shadow-sm"
            />
            {isSearchingApi && <Loader2 size={14} className="absolute right-9 top-1/2 -translate-y-1/2 text-seafoam animate-spin" />}
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Row 1b — A–Z alphabet filter */}
          <div className="flex flex-wrap items-center gap-1">
            {['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'].map(L => {
              const active = L === 'ALL' ? !letterFilter : letterFilter === L;
              return (
                <button
                  key={L}
                  onClick={() => setLetterFilter(L === 'ALL' ? null : L)}
                  className={`min-w-[26px] px-1.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${active ? 'bg-seafoam text-white shadow-sm' : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-seafoam hover:border-seafoam/40'}`}
                >
                  {L}
                </button>
              );
            })}
          </div>

          {/* Row 2 — Date picker (full width) */}
          <div className="flex items-center gap-2 w-full">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="w-full"
              buttonClassName="w-full justify-between"
            />
          </div>

          {/* Row 3 — Filter + Register + Reload.
              On mobile the filter pill needs its own line so it's not
              squeezed to the icon by Register / Duplicates / Refresh; from
              sm: up everything fits on one row. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 relative z-[55]">
            <div className="relative z-[55] sm:flex-1 sm:min-w-0 w-full" ref={filterContainerRef}>
              <button
                onClick={() => setFilterDropdownOpen(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm font-bold text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
              >
                <Filter size={14} className="text-seafoam shrink-0" />
                <span className="truncate flex-1 min-w-0 text-left">
                  {clientFilter === 'all' && 'All Clients'}
                  {clientFilter === 'upcoming' && 'Upcoming Visit'}
                  {clientFilter === 'pastCount' && `With ${pastCountMin}+ Past Visits`}
                  {clientFilter === 'hasVaccines' && 'With Vaccinated Pets'}
                </span>
                {clientFilter !== 'all' && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setClientFilter('all'); setPastCountDialogOpen(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setClientFilter('all'); setPastCountDialogOpen(false); } }}
                    className="ml-1 p-0.5 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </span>
                )}
                <ChevronDown size={16} className={`transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {filterDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-[min(260px,90vw)] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => { setClientFilter('all'); setPastCountDialogOpen(false); setFilterDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${clientFilter === 'all' ? 'bg-seafoam text-white shadow-md' : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => { setClientFilter('upcoming'); setPastCountDialogOpen(false); setFilterDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${clientFilter === 'upcoming' ? 'bg-seafoam text-white shadow-md' : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      Upcoming Visit
                    </button>
                    <button
                      onClick={() => { setClientFilter('hasVaccines'); setPastCountDialogOpen(false); setFilterDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${clientFilter === 'hasVaccines' ? 'bg-seafoam text-white shadow-md' : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      With Vaccinated Pets
                    </button>
                    <button
                      onClick={() => {
                        setPastCountInput(String(pastCountMin));
                        setPastCountDialogOpen(true);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${clientFilter === 'pastCount' ? 'bg-seafoam text-white shadow-md' : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      With X+ Past Visits…
                    </button>

                    {pastCountDialogOpen && (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
                        <label className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">
                          Minimum Past Visits
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={pastCountInput}
                          onChange={(e) => setPastCountInput(e.target.value)}
                          autoFocus
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPastCountDialogOpen(false)}
                            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              const n = Math.max(1, parseInt(pastCountInput, 10) || 1);
                              setPastCountMin(n);
                              setClientFilter('pastCount');
                              setPastCountDialogOpen(false);
                              setFilterDropdownOpen(false);
                            }}
                            className="flex-1 px-4 py-2 bg-seafoam text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-pine transition-all"
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status filter — segmented control. Defaults to Active so the
                list hides deactivated clients unless explicitly requested. */}
            <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 w-full sm:w-auto shrink-0">
              {([
                { key: 'active', label: 'Active' },
                { key: 'inactive', label: 'Deactivated' },
                { key: 'all', label: 'All' },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setClientStatus(opt.key)}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    clientStatus === opt.key
                      ? 'bg-seafoam text-white shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100'
                  }`}
                  title={opt.key === 'active' ? 'Hide deactivated clients' : opt.key === 'inactive' ? 'Show only deactivated clients' : 'Show every client'}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Action buttons — grouped so on mobile they share one row
                instead of each pushing the filter further. */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowWalkIn(true)}
                className="shrink-0 compact-button bg-white dark:bg-zinc-900 border border-seafoam/40 text-seafoam hover:bg-seafoam/5 transition-all active:scale-95 px-4 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
              >
                <Zap size={14} className="inline ml-1" /> Walk-in
              </button>
              <button
                data-tour="clients-register"
                onClick={onRegisterClient}
                className="shrink-0 compact-button bg-gradient-to-r from-pine to-seafoam text-white shadow-xs shadow-pine/30 hover:shadow-xl hover:shadow-pine/40 transition-all active:scale-95 px-4 sm:px-5 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
              >
                <User size={14} className="inline ml-1" /> Register
              </button>
              {hasFullAccess && (
                <button
                  onClick={() => setShowDuplicates(true)}
                  className="shrink-0 compact-button bg-white dark:bg-zinc-900 border border-amber-300 text-amber-600 dark:text-amber-400 shadow-sm transition-all active:scale-95 px-3 sm:px-4 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-1.5"
                  title="Find and clean up duplicate clients"
                >
                  <AlertTriangle size={14} /> Duplicates
                </button>
              )}
              <button
                onClick={() => refreshClients()}
                disabled={isLoadingClients || isLoadingPets}
                className="shrink-0 compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 shadow-sm transition-all flex items-center gap-1.5 active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed p-2.5 ml-auto sm:ml-0"
                title="Refresh client data"
              >
                <RefreshCw size={14} className={isLoadingClients || isLoadingPets ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoadingClients || isLoadingPets ? (
        <div className="py-32">
          <LoadingSpinner size="lg" message="Loading clients..." />
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-visible">
          {isSearchingApi && (
            <div className="flex items-center justify-center gap-2 py-3 border-b border-slate-100 dark:border-zinc-800">
              <Loader2 size={14} className="animate-spin text-seafoam" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Searching server...</p>
            </div>
          )}
          {paginationMeta.totalItems > 10 && paginationMeta.totalPages > 1 && (
            <div className="px-4 pt-4">
              <Pagination meta={paginationMeta} onPageChange={handlePageChange} compact />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 overflow-visible">
            {filteredClients.map((client, index) => {
              const clientPets = getClientPets(client.id);
              const alerts = getUpcomingClientAlerts(client.id);
              const alert = alerts[0] ?? null;
              const extraAlerts = alerts.length - 1;
              const isVaccination = alert?.visit?.tasks?.some((t: any) => t.category.toLowerCase().includes('vac'));
              const isDeactivated = client.isActive === false;

              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  whileHover={{ y: -2 }}
                  className={`group/card relative border transition-all duration-300 rounded-2xl p-4 hover:z-[50] ${
                    isDeactivated
                      ? 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800/60 shadow-[0_0_0_2px_rgba(249,115,22,0.18),0_4px_20px_rgba(249,115,22,0.12)] hover:shadow-[0_0_0_2px_rgba(249,115,22,0.35),0_8px_28px_rgba(249,115,22,0.22)] hover:border-orange-400'
                      : `bg-white dark:bg-zinc-900 ${
                          alert
                            ? isVaccination
                              ? 'border-indigo-200 dark:border-indigo-800/60 shadow-[0_0_0_2px_rgba(129,140,248,0.18),0_4px_20px_rgba(129,140,248,0.12)] hover:shadow-[0_0_0_2px_rgba(129,140,248,0.4),0_8px_28px_rgba(129,140,248,0.22)]'
                              : 'border-amber-200 dark:border-amber-800/60 shadow-[0_0_0_2px_rgba(251,191,36,0.18),0_4px_20px_rgba(251,191,36,0.12)] hover:shadow-[0_0_0_2px_rgba(251,191,36,0.4),0_8px_28px_rgba(251,191,36,0.22)]'
                            : 'border-slate-200/60 dark:border-zinc-700/60 shadow-sm hover:shadow-md'
                        }`
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* LEFT CONTENT */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onViewClient(client.id)}
                    >
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <img
                          src={client.avatar}
                          alt={String(client.name || '')}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 shadow-sm"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-base font-semibold text-slate-800 dark:text-white truncate">{String(client.name || '')}</h3>
                            {client.isActive === false && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase tracking-widest">
                                <UserX size={9} /> Deactivated
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">ID: #{String(client.id || '')}</p>
                          {/* Owning clinic/branch — only when multiple clinics are in scope. */}
                          <ScopeClinicBadge clinicId={(client as any).clinicId} clinicName={client.clinicName} className="mt-1" />
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-lg">
                          <Mail size={12} className="opacity-60 shrink-0" />
                          <span className="truncate">{String(client.email || 'No email')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-lg">
                          <Phone size={12} className="opacity-60 shrink-0" />
                          <span>{String(client.phone || 'No phone')}</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: badge + single combined menu icon */}
                    <div className="flex flex-col items-center gap-2 shrink-0 pt-1">
                      {/* Always-visible alert badge */}
                      {alert && (
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black select-none whitespace-nowrap ${
                          isVaccination
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-700/50'
                            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700/50'
                        }`}>
                          <Calendar size={8} />
                          <span>{formatDate(alert.visit.date)}</span>
                          {extraAlerts > 0 && <span className="opacity-70 ml-0.5">+{extraAlerts}</span>}
                        </div>
                      )}

                      {/* PawPrint icon — combined menu: View Client / View Pets / Add Pet / pets list / Edit / Delete */}
                      <div className="relative group/pets flex items-center">
                        {/* Menu opens to the LEFT, pr-2 bridge keeps hover alive */}
                        <div className="absolute right-full top-0 pr-2 z-50 opacity-0 pointer-events-none group-hover/pets:opacity-100 group-hover/pets:pointer-events-auto transition-opacity duration-150 delay-500 group-hover/pets:delay-0">
                          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-56 overflow-hidden">
                            {/* Quick actions */}
                            <div className="p-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); onViewClient(client.id); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-all"
                              >
                                <User size={13} className="text-slate-500 shrink-0" />
                                <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">View Client</span>
                              </button>
                              {onViewClientPets && clientPets.length > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onViewClientPets(client.id); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-all"
                                >
                                  <PawPrint size={13} className="text-emerald-500 shrink-0" />
                                  <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                                    View Pets <span className="text-slate-400">({clientPets.length})</span>
                                  </span>
                                </button>
                              )}
                              {client.isActive !== false && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onAddPetForClient(client.id); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                                >
                                  <PawPrint size={13} className="text-emerald-500 shrink-0" />
                                  <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Add Pet</span>
                                </button>
                              )}
                              {client.isActive === false && (
                                <div className="px-3 py-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                                  Client is deactivated — no new pets or appointments. Existing records remain visible.
                                </div>
                              )}
                            </div>

                            {/* Pet list */}
                            {clientPets.length > 0 && (
                              <div className="border-t border-slate-100 dark:border-zinc-800 px-1.5 py-1.5 space-y-1 max-h-52 overflow-y-auto">
                                {clientPets.map((pet) => {
                                  const petDeceased = pet.isAlive === false;
                                  return (
                                  <div key={pet.id} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 dark:bg-zinc-800 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all">
                                    <div
                                      onClick={(e) => { e.stopPropagation(); if (onViewPet) onViewPet(pet.id); }}
                                      className="flex-1 cursor-pointer min-w-0"
                                    >
                                      <p className={`text-xs font-bold truncate ${petDeceased ? 'text-slate-400 dark:text-zinc-500' : 'text-pine dark:text-zinc-100'}`}>
                                        {pet.name}{petDeceased ? ' · Deceased' : ''}
                                      </p>
                                      <p className="text-[8px] font-black uppercase tracking-widest text-seafoam dark:text-zinc-500">{pet.species}</p>
                                    </div>
                                    {client.isActive !== false && !petDeceased && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onPrebookAppointment(client.id, pet.id); }}
                                        className="p-1.5 bg-seafoam hover:bg-pine text-white rounded-lg transition-all shrink-0"
                                        title="New Visit"
                                      >
                                        <Calendar size={11} />
                                      </button>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Edit / Delete */}
                            {(onEditClient || onDeleteClient) && (
                              <div className="border-t border-slate-100 dark:border-zinc-800 p-1.5 space-y-0.5">
                                {onEditClient && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onEditClient(client.id); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                                  >
                                    <Edit size={13} className="text-blue-500 shrink-0" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Edit Client</span>
                                  </button>
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setTransferTarget(client); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"
                                  >
                                    <ArrowRightLeft size={13} className="text-amber-600 shrink-0" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Transfer to clinic</span>
                                  </button>
                                )}
                                {onDeleteClient && (client.isActive !== false) && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteClient(client.id); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"
                                  >
                                    <UserX size={13} className="text-amber-600 shrink-0" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Deactivate Client</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <button className="relative z-10 w-9 h-9 flex items-center justify-center bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl hover:bg-emerald-500 hover:text-white transition-all duration-200">
                          <PawPrint size={14} />
                          {clientPets.length > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-4 bg-emerald-500 text-white text-[9px] font-semibold rounded-full flex items-center justify-center border border-white shadow-sm">
                              {clientPets.length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                    {hasFullAccess ? (
                      <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Spent</p>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          KES {(client.totalSpent || 0).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Next Appt</p>
                        {alert ? (
                          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 truncate">
                            {formatDate(alert.visit.date)}
                          </p>
                        ) : client.isActive === false ? (
                          <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Deactivated</span>
                        ) : (() => {
                          const firstAlivePet = clientPets.find(p => p.isAlive !== false);
                          if (!firstAlivePet) {
                            return <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">No living patients</span>;
                          }
                          return (
                            <button
                              onClick={(e) => { e.stopPropagation(); onPrebookAppointment(client.id, firstAlivePet.id); }}
                              className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700"
                            >
                              + Schedule
                            </button>
                          );
                        })()}
                      </div>
                    )}
                    <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-xl">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Joined On</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-white">{formatDate(client.joinDate)}</p>
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
          />
        </div>
      )}
      <DuplicateClientsModal
        isOpen={showDuplicates}
        onClose={() => setShowDuplicates(false)}
        onAfterDelete={() => refreshClients()}
      />
      <WalkInModal
        isOpen={showWalkIn}
        onClose={() => setShowWalkIn(false)}
        onCreated={() => { refreshClients(); }}
      />
      <TransferClinicModal
        isOpen={!!transferTarget}
        subject="client"
        subjectId={transferTarget?.id ?? null}
        subjectLabel={transferTarget?.name}
        currentClinicId={transferTarget?.clinicId}
        currentClinicName={transferTarget?.clinicName ?? null}
        onClose={() => setTransferTarget(null)}
        onConfirm={async (toClinicId) => {
          if (!transferTarget) return;
          await clientsAPI.transfer(transferTarget.id, toClinicId);
          await refreshClients();
        }}
      />
    </motion.div>
  );
};

export default ClientsView;
