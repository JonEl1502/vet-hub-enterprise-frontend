
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ApptStatus, Client, FULL_ACCESS_ROLES, UserRole } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { Search, PawPrint, User, Phone, Mail, Edit, Trash2, RefreshCw, Calendar, X, Loader2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { clientsAPI } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatTime } from '../services/utils/dateFormatter';
import { PaginationMeta } from '../services/types/pagination';
import Pagination from './Pagination';
import DateRangePicker, { DateRange } from './DateRangePicker';

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
  const { clients, pets, appointments, isLoadingClients, isLoadingPets, refreshClients, ensureClients, ensurePets, ensureAppointments } = useData();
  useEffect(() => { ensureClients(); ensurePets(); ensureAppointments(); }, [ensureClients, ensurePets, ensureAppointments]);
  const { user } = useAuth();
  const hasFullAccess = FULL_ACCESS_ROLES.includes((user?.role as UserRole));

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const [apiClientResults, setApiClientResults] = useState<Client[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);

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
    if (!dateRange) return searchFiltered;
    return searchFiltered.filter(client => {
      const clientPets = pets.filter(p => p.ownerId === client.id);
      return clientPets.some(pet =>
        appointments.filter(a => a.petId === pet.id).some(appt => {
          const d = new Date(appt.date);
          return d >= dateRange.start && d <= dateRange.end;
        })
      );
    });
  }, [searchFiltered, pets, appointments, dateRange]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, dateRange]);

  const paginatedClients = useMemo(() => {
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
      <div className="space-y-4 mb-6">
        <div className="flex flex-col gap-3 bg-slate-50/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 backdrop-blur-sm">
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

          {/* Row 2 — Date picker + New & Refresh to the right */}
          <div className="flex items-center gap-2">
            <DateRangePicker value={dateRange} onChange={setDateRange} className="min-w-[180px] flex-1" />
            <div className="flex gap-2 ml-auto">
              <button
                onClick={onRegisterClient}
                className="compact-button bg-gradient-to-r from-pine to-seafoam text-white shadow-xs shadow-pine/30 hover:shadow-xl hover:shadow-pine/40 transition-all active:scale-95 px-5 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
              >
                <User size={14} className="inline ml-1" /> Register
              </button>
              <button
                onClick={() => refreshClients()}
                disabled={isLoadingClients || isLoadingPets}
                className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 shadow-sm transition-all flex items-center gap-1.5 active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed p-2.5"
                title="Refresh client data"
              >
                <RefreshCw size={14} className={isLoadingClients || isLoadingPets ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoadingClients || isLoadingPets ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20 animate-pulse">🐾</div>
            <p className="text-[#438883] dark:text-zinc-400 font-bold text-sm">Loading clients...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-visible">
          {isSearchingApi && (
            <div className="flex items-center justify-center gap-2 py-3 border-b border-slate-100 dark:border-zinc-800">
              <Loader2 size={14} className="animate-spin text-seafoam" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Searching server...</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 overflow-visible">
            {filteredClients.map((client, index) => {
              const clientPets = getClientPets(client.id);
              const alerts = getUpcomingClientAlerts(client.id);
              const alert = alerts[0] ?? null;
              const extraAlerts = alerts.length - 1;
              const isVaccination = alert?.visit?.tasks?.some((t: any) => t.category.toLowerCase().includes('vac'));

              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  whileHover={{ y: -2 }}
                  className={`group/card relative bg-white dark:bg-zinc-900 border transition-all duration-300 rounded-2xl p-4 hover:z-[50] ${
                    alert
                      ? isVaccination
                        ? 'border-indigo-200 dark:border-indigo-800/60 shadow-[0_0_0_2px_rgba(129,140,248,0.18),0_4px_20px_rgba(129,140,248,0.12)] hover:shadow-[0_0_0_2px_rgba(129,140,248,0.4),0_8px_28px_rgba(129,140,248,0.22)]'
                        : 'border-amber-200 dark:border-amber-800/60 shadow-[0_0_0_2px_rgba(251,191,36,0.18),0_4px_20px_rgba(251,191,36,0.12)] hover:shadow-[0_0_0_2px_rgba(251,191,36,0.4),0_8px_28px_rgba(251,191,36,0.22)]'
                      : 'border-slate-200/60 dark:border-zinc-700/60 shadow-sm hover:shadow-md'
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
                          <h3 className="text-base font-semibold text-slate-800 dark:text-white truncate">{String(client.name || '')}</h3>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">ID: #{String(client.id || '')}</p>
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
                        <div className="absolute right-full top-0 pr-2 z-50 opacity-0 pointer-events-none group-hover/pets:opacity-100 group-hover/pets:pointer-events-auto transition-opacity duration-150">
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
                              <button
                                onClick={(e) => { e.stopPropagation(); onAddPetForClient(client.id); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                              >
                                <PawPrint size={13} className="text-emerald-500 shrink-0" />
                                <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Add Pet</span>
                              </button>
                            </div>

                            {/* Pet list */}
                            {clientPets.length > 0 && (
                              <div className="border-t border-slate-100 dark:border-zinc-800 px-1.5 py-1.5 space-y-1 max-h-52 overflow-y-auto">
                                {clientPets.map((pet) => (
                                  <div key={pet.id} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 dark:bg-zinc-800 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all">
                                    <div
                                      onClick={(e) => { e.stopPropagation(); if (onViewPet) onViewPet(pet.id); }}
                                      className="flex-1 cursor-pointer min-w-0"
                                    >
                                      <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{pet.name}</p>
                                      <p className="text-[8px] font-black uppercase tracking-widest text-seafoam dark:text-zinc-500">{pet.species}</p>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onPrebookAppointment(client.id, pet.id); }}
                                      className="p-1.5 bg-seafoam hover:bg-pine text-white rounded-lg transition-all shrink-0"
                                      title="New Appointment"
                                    >
                                      <Calendar size={11} />
                                    </button>
                                  </div>
                                ))}
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
                                {onDeleteClient && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteClient(client.id); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                  >
                                    <Trash2 size={13} className="text-red-500 shrink-0" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Delete Client</span>
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
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); onPrebookAppointment(client.id, clientPets[0]?.id); }}
                            className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700"
                          >
                            + Schedule
                          </button>
                        )}
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
            limitOptions={[6, 12, 24, 48]}
          />
        </div>
      )}
    </motion.div>
  );
};

export default ClientsView;
