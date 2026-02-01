
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ApptStatus, Client } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { Search, Eye, PawPrint, CreditCard, User, Plus, Phone, Mail, ChevronRight, Calendar, Loader2, Edit, Trash2, MoreVertical } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { formatDate, formatTime } from '../services/utils/dateFormatter';
import { clientsAPI } from '../services';
import { PaginationMeta } from '../services/types/pagination';
import Pagination from './Pagination';

interface ClientsViewProps {
  transactions: Transaction[];
  onViewClient: (id: number) => void;
  onViewFinance: (clientId: number) => void;
  onRegisterClient: () => void;
  onAddPetForClient: (id: number) => void;
  onPrebookAppointment: (clientId: number, petId: number) => void;
  onEditClient?: (id: number) => void;
  onDeleteClient?: (id: number) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ transactions, onViewClient, onViewFinance, onRegisterClient, onAddPetForClient, onPrebookAppointment, onEditClient, onDeleteClient }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredPetClient, setHoveredPetClient] = useState<number | null>(null);
  const [hoveredActionsClient, setHoveredActionsClient] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const actionsHoverTimeoutRef = useRef<number | null>(null);
  const { pets, appointments, isLoadingPets } = useData();

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
  const fetchClients = async () => {
    setIsLoadingClients(true);
    try {
      const response = await clientsAPI.getAll({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery,
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
          avatar: client.avatar,
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

  const handleMouseEnter = (clientId: number) => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    setHoveredPetClient(clientId);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredPetClient(null);
    }, 300); // 300ms buffer to allow moving cursor to the pop-up
  };

  const handleActionsMouseEnter = (clientId: number) => {
    if (actionsHoverTimeoutRef.current) window.clearTimeout(actionsHoverTimeoutRef.current);
    setHoveredActionsClient(clientId);
  };

  const handleActionsMouseLeave = () => {
    actionsHoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredActionsClient(null);
    }, 300);
  };

  const getUpcomingClientAlert = (clientId: number) => {
    const clientPets = getClientPets(clientId);
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + 7);

    for (const pet of clientPets) {
      const visit = appointments.find(a => 
        a.petId === pet.id && 
        a.status === ApptStatus.SCHEDULED && 
        new Date(a.date) >= now && 
        new Date(a.date) <= limit
      );
      if (visit) return { pet, visit };
    }
    return null;
  };

  if (isLoadingClients || isLoadingPets) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-seafoam animate-spin" />
          <p className="text-seafoam dark:text-zinc-500 font-black text-sm uppercase tracking-widest">Loading clients...</p>
        </div>
      </div>
    );
  }

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
          <p className="page-subheader mt-1">Authorized Owner Node Registry</p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none w-64 transition-all font-bold shadow-sm"
            />
          </div>
          <button onClick={onRegisterClient} className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg transition-all flex items-center gap-2 active:scale-95">
            <User size={12} /> Register Client
          </button>
        </div>
      </header>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
          {paginatedClients.map((client, index) => {
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
              className="compact-card"
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
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewClient(client.id)}>
                  <div className="flex items-center gap-3 mb-3">
                    <img src={client.avatar} alt={String(client.name || '')} className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 group-hover:scale-105 transition-transform shadow-inner shrink-0 aspect-square" />
                    <div className="min-w-0">
                      <h3 className="card-title text-sm truncate leading-tight">{String(client.name || '')}</h3>
                      <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-0.5">ID: #{String(client.id || '')}</p>
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
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Yield Contribution</p>
                      <p className="text-emerald-600 font-mono font-black text-[10px] truncate">KES {(client.totalSpent || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Last Ingress</p>
                      <p className="text-pine dark:text-zinc-300 font-mono font-black text-[10px] truncate">{String(client.lastVisit || 'N/A')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => onViewClient(client.id)} className="p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-seafoam rounded-lg transition-all shadow-sm" title="View Profile">
                    <Eye size={16} />
                  </button>

                  <div className="relative" onMouseEnter={() => handleMouseEnter(client.id)} onMouseLeave={handleMouseLeave}>
                    <button className="p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-seafoam rounded-lg transition-all relative shadow-sm">
                      <PawPrint size={16} />
                      {clientPets.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan text-white text-[7px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md">{clientPets.length}</span>}
                    </button>

                    {hoveredPetClient === client.id && (
                      <div
                        className="absolute right-full mr-2 top-0 z-[100] w-64 animate-in slide-in-from-right-2 fade-in duration-200"
                        onMouseEnter={() => { if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); }}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xl overflow-hidden">
                          <div className="flex justify-between items-center mb-3 px-1">
                             <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Authorized Pets</h4>
                             <button
                               onClick={(e) => { e.stopPropagation(); onAddPetForClient(client.id); }}
                               className="w-6 h-6 rounded-lg bg-seafoam text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-seafoam/20"
                             >
                               <Plus size={12} />
                             </button>
                          </div>
                          <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1.5 pr-1 scroll-smooth">
                            {clientPets.length > 0 ? clientPets.map(pet => (
                              <div
                                key={pet.id}
                                onClick={(e) => { e.stopPropagation(); onPrebookAppointment(client.id, pet.id); }}
                                className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-zinc-950 hover:bg-seafoam/5 rounded-xl border border-slate-100 dark:border-zinc-800 transition-all cursor-pointer group/pet"
                              >
                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-lg shadow-sm shrink-0 aspect-square group-hover/pet:scale-110 transition-transform">{pet.species === 'Dog' ? '🐶' : '🐱'}</div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-pine dark:text-zinc-100 font-black text-[10px] truncate uppercase tracking-tight">{String(pet.name || '')}</p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Calendar size={9} className="text-seafoam"/>
                                    <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase truncate tracking-widest">Create Appointment</p>
                                  </div>
                                </div>
                                <ChevronRight size={12} className="text-slate-200 dark:text-zinc-800 group-hover/pet:text-seafoam transition-colors" />
                              </div>
                            )) : (
                              <div className="py-8 text-center bg-slate-50/50 dark:bg-zinc-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                                <p className="text-slate-300 dark:text-zinc-700 text-[8px] font-black uppercase tracking-[0.2em] italic">No Linked Patient Nodes</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={() => onViewFinance(client.id)} className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-cyan rounded-xl transition-all shadow-sm" title="Ledger">
                    <CreditCard size={18} />
                  </button>

                  {(onEditClient || onDeleteClient) && (
                    <div className="relative" onMouseEnter={() => handleActionsMouseEnter(client.id)} onMouseLeave={handleActionsMouseLeave}>
                      <button className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-white hover:bg-seafoam rounded-xl transition-all shadow-sm">
                        <MoreVertical size={18} />
                      </button>

                      {hoveredActionsClient === client.id && (
                        <div
                          className="absolute right-full mr-3 top-0 z-[100] w-48 animate-in slide-in-from-right-2 fade-in duration-200"
                          onMouseEnter={() => { if (actionsHoverTimeoutRef.current) window.clearTimeout(actionsHoverTimeoutRef.current); }}
                          onMouseLeave={handleActionsMouseLeave}
                        >
                          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-2 shadow-2xl overflow-hidden">
                            {onEditClient && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditClient(client.id); setHoveredActionsClient(null); }}
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
                                onClick={(e) => { e.stopPropagation(); onDeleteClient(client.id); setHoveredActionsClient(null); }}
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
                    </div>
                  )}
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
    </motion.div>
  );
};

export default ClientsView;
