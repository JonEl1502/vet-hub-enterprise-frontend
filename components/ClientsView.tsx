
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ApptStatus, Client } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { Search, PawPrint, User, Phone, Mail, Edit, Trash2, MoreVertical, RefreshCw } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { formatDate, formatTime } from '../services/utils/dateFormatter';
import { clientsAPI } from '../services';
import { CacheInvalidators } from '../services/utils/cache';
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
  const [hoveredActionsClient, setHoveredActionsClient] = useState<number | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsHoverTimeoutRef = useRef<number | null>(null);
  const actionsButtonRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const { pets, appointments, isLoadingPets } = useData();

  // Date range filter state
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Server-side pagination state
  const [paginatedClients, setPaginatedClients] = useState<Client[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 12,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  // Fetch clients with server-side pagination
  const fetchClients = async (forceRefresh = false) => {
    if (forceRefresh) {
      CacheInvalidators.invalidateClients();
    }
    setIsLoadingClients(true);
    try {
      // Only apply search filter if query has 3 or more characters
      const effectiveSearch = searchQuery.length >= 3 ? searchQuery : '';

      const response = await clientsAPI.getAll({
        page: currentPage,
        limit: itemsPerPage,
        search: effectiveSearch,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (response.success && response.data) {
        // Transform clients to match the Client type
        const transformedClients = response.data.clients.map((client: any) => ({
          id: parseInt(client.id),
          clinicId: parseInt(client.clinicId),
          name: client.name,
          email: client.email || '',
          phone: client.phone || '',
          address: client.address || '',
          city: client.city,
          state: client.state,
          zipCode: client.zipCode,
          country: client.country || '',
          currency: client.currency || 'USD',
          joinDate: client.createdAt || new Date().toISOString(),
          avatar: client.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${client.name}`,
          totalSpent: client.totalSpent || 0,
          lastVisit: client.lastVisit,
          gender: client.gender || 'Other',
          region: client.region || 'Local',
          dob: client.dob || '',
          isActive: client.isActive,
          createdAt: client.createdAt,
          updatedAt: client.updatedAt,
        }));

        setPaginatedClients(transformedClients);
        setPaginationMeta(response.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  // Fetch clients when pagination parameters change
  useEffect(() => {
    fetchClients();
  }, [currentPage, itemsPerPage, searchQuery]);

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

  // Reset to first page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const getClientPets = (clientId: number) => pets.filter(p => p.ownerId === clientId);

  const getFirstNamePossessive = (name: string) => {
    const firstName = name.split(' ')[0];
    return firstName.endsWith('s') ? `${firstName}'` : `${firstName}'s`;
  };

  const handleActionsMouseEnter = (clientId: number) => {
    if (actionsHoverTimeoutRef.current) window.clearTimeout(actionsHoverTimeoutRef.current);
    setHoveredActionsClient(clientId);
    const ref = actionsButtonRefs.current[clientId];
    if (ref) {
      const rect = ref.getBoundingClientRect();
      setActionsMenuPosition({ top: rect.top, left: rect.left - 8 });
    }
  };

  const handleActionsMouseLeave = () => {
    actionsHoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredActionsClient(null);
      setActionsMenuPosition(null);
    }, 300);
  };

  const getUpcomingClientAlert = (clientId: number) => {
    const clientPets = getClientPets(clientId);
    const now = new Date();
    // Set to start of today to include all appointments from today onwards
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    for (const pet of clientPets) {
      const visit = appointments.find(a =>
        a.petId === pet.id &&
        a.status === ApptStatus.SCHEDULED &&
        new Date(a.date) >= today
      );
      if (visit) return { pet, visit };
    }
    return null;
  };

  // Filter clients by date range (based on their pets' appointments)
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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Client Directory</h1>
          <p className="page-subheader mt-1">Manage Pet Owners & Client Records</p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
            <input
              type="text"
              placeholder="Search clients (min 3 chars)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none w-64 transition-all font-bold shadow-sm"
            />
          </div>
          <button
            onClick={() => fetchClients(true)}
            disabled={isLoadingClients || isLoadingPets}
            className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 shadow-sm transition-all flex items-center gap-2 active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh client data"
          >
            <RefreshCw size={12} className={isLoadingClients || isLoadingPets ? 'animate-spin' : ''} />
          </button>
          <button onClick={onRegisterClient} className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg transition-all flex items-center gap-2 active:scale-95">
            <User size={12} /> Register Client
          </button>
        </div>
      </header>

      {/* Date Range Filter */}
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
      />

      {/* Loading State - appears below search */}
      {isLoadingClients || isLoadingPets ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20 animate-pulse">
              🐾
            </div>
            <p className="text-[#438883] dark:text-zinc-400 font-bold text-sm">Loading clients...</p>
          </div>
        </div>
      ) : (
        <>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-visible">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 overflow-visible">
          {filteredClients.map((client, index) => {
          const clientPets = getClientPets(client.id);
          const alert = getUpcomingClientAlert(client.id);
          const isVaccination = alert?.visit?.tasks?.some(t => t.category.toLowerCase().includes('vac'));

          return (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className="compact-card overflow-visible"
            >
              
              {alert && alert.visit && alert.pet && alert.pet.name && alert.visit.date && (
                <div className="absolute top-4 right-4 group/alert">
                  <div className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isVaccination ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isVaccination ? 'bg-indigo-600' : 'bg-amber-600'}`}></span>
                  </div>

                  <div className="absolute top-0 right-6 opacity-0 group-hover/alert:opacity-100 transition-all duration-300 pointer-events-none translate-x-2 group-hover/alert:translate-x-0 z-[120]">
                    <div className="bg-pine text-white p-3 rounded-xl shadow-2xl w-52 border border-white/10">
                       <p className="text-[7px] font-black uppercase tracking-[0.2em] mb-1 opacity-50">Alert</p>
                       <p className="text-xs font-black leading-tight"><span className="text-seafoam">{String(alert.pet.name)}</span>: Upcoming {isVaccination ? 'Vaccination' : 'Visit'}</p>
                       <p className="text-[8px] font-bold mt-1 opacity-80">{formatDate(alert.visit.date)} @ {formatTime(alert.visit.date)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewClientPets ? onViewClientPets(client.id) : onViewClient(client.id)}>
                  <div className="flex items-center gap-3 mb-3">
                    <img src={client.avatar} alt={String(client.name || '')} className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 group-hover:scale-105 transition-transform shadow-inner shrink-0 aspect-square" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="card-title text-sm truncate leading-tight">{String(client.name || '')}</h3>
                          <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-0.5">ID: #{String(client.id || '')}</p>
                        </div>
                        {/* Pets icon inside card */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (clientPets.length > 0) {
                              onPrebookAppointment(client.id, clientPets[0].id);
                            } else {
                              onAddPetForClient(client.id);
                            }
                          }}
                          className="p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-seafoam rounded-lg transition-all relative shadow-sm shrink-0"
                          title={clientPets.length > 0 ? "New Appointment" : "Add Pet"}
                        >
                          <PawPrint size={14} />
                          {clientPets.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan text-white text-[7px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md">{clientPets.length}</span>}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-[9px] font-bold">
                      <Mail size={11} className="text-mist dark:text-zinc-700" />
                      <span className="truncate">{String(client.email || '')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-[9px] font-bold">
                      <Phone size={11} className="text-mist dark:text-zinc-700" />
                      <span>{String(client.phone || '')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                    <div className="bg-slate-50 dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Spent</p>
                      <p className="text-emerald-600 font-mono font-black text-[10px] truncate">KES {(client.totalSpent || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Last Visit</p>
                      <p className="text-pine dark:text-zinc-300 font-mono font-black text-[10px] truncate">{String(client.lastVisit || 'N/A')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {/* More options button */}
                  <div ref={(el) => { actionsButtonRefs.current[client.id] = el; }} onMouseEnter={() => handleActionsMouseEnter(client.id)} onMouseLeave={handleActionsMouseLeave}>
                    <button className="w-10 h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-white hover:bg-seafoam rounded-xl transition-all shadow-sm flex items-center justify-center" title="More options">
                      <MoreVertical size={16} />
                    </button>
                  </div>
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
      {hoveredActionsClient !== null && actionsMenuPosition && (
        <div
          className="fixed z-[9998] w-48 animate-in slide-in-from-right-2 fade-in duration-200"
          style={{ top: actionsMenuPosition.top, left: actionsMenuPosition.left, transform: 'translateX(-100%)' }}
          onMouseEnter={() => { if (actionsHoverTimeoutRef.current) window.clearTimeout(actionsHoverTimeoutRef.current); }}
          onMouseLeave={handleActionsMouseLeave}
        >
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-2 shadow-2xl overflow-hidden">
            {onEditClient && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditClient(hoveredActionsClient); setHoveredActionsClient(null); setActionsMenuPosition(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all group/action"
              >
                <Edit size={16} className="text-blue-500" />
                <span className="text-sm font-bold text-slate-700 dark:text-zinc-300 group-hover/action:text-blue-600 dark:group-hover/action:text-blue-400">
                  Edit Client
                </span>
              </button>
            )}
            {onDeleteClient && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteClient(hoveredActionsClient); setHoveredActionsClient(null); setActionsMenuPosition(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all group/action"
              >
                <Trash2 size={16} className="text-red-500" />
                <span className="text-sm font-bold text-slate-700 dark:text-zinc-300 group-hover/action:text-red-600 dark:group-hover/action:text-red-400">
                  Delete Client
                </span>
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

export default ClientsView;
