
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ApptStatus, Client } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { Search, PawPrint, User, Phone, Mail, Edit, Trash2, MoreVertical, RefreshCw, Calendar } from 'lucide-react';
import { useData } from '../contexts/DataContext';
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
  const [hoveredActionsClient, setHoveredActionsClient] = useState<number | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsHoverTimeoutRef = useRef<number | null>(null);
  const actionsButtonRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const { clients, pets, appointments, isLoadingClients, isLoadingPets, refreshClients } = useData();

  // Date range filter state
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Pets hover card state
  const [hoveredPetsClient, setHoveredPetsClient] = useState<number | null>(null);
  const [petsMenuPosition, setPetsMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [hoveredPetsMenu, setHoveredPetsMenu] = useState(false);
  const petsHoverTimeoutRef = useRef<number | null>(null);
  const petsButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Client-side search filter (min 3 chars)
  const searchFiltered = useMemo(() => {
    if (searchQuery.length < 3) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    );
  }, [clients, searchQuery]);

  // Client-side date range filter
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

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, dateRange]);

  // Client-side pagination
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

  // Pets icon hover handlers
  const handlePetsMouseEnter = (clientId: number) => {
    if (petsHoverTimeoutRef.current) {
      clearTimeout(petsHoverTimeoutRef.current);
    }
    setHoveredPetsClient(clientId);
    const ref = petsButtonRefs.current[clientId];
    if (ref) {
      const rect = ref.getBoundingClientRect();
      setPetsMenuPosition({ top: rect.top, left: rect.left - 8 });
    }
  };

  const handlePetsMouseLeave = () => {
    petsHoverTimeoutRef.current = window.setTimeout(() => {
      if (!hoveredPetsMenu) {
        setHoveredPetsClient(null);
        setPetsMenuPosition(null);
      }
    }, 300);
  };

  const handlePetsMenuEnter = () => {
    if (petsHoverTimeoutRef.current) {
      clearTimeout(petsHoverTimeoutRef.current);
    }
    setHoveredPetsMenu(true);
  };

  const handlePetsMenuLeave = () => {
    setHoveredPetsMenu(false);
    setHoveredPetsClient(null);
    setPetsMenuPosition(null);
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
      <div className="space-y-4 mb-6">
        {/* Header Title - Own section */}
        {/* <div>
          <h1 className="page-header">Client Directory</h1>
          <p className="page-subheader mt-1">Manage Pet Owners & Client Records</p>
        </div> */}

        {/* Filters Row - Search next to DatePicker, Reload/Register far right */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 bg-slate-50/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 backdrop-blur-sm">

          {/* Left: Search + DatePicker (next to each other) */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
            {/* Search */}
            <div className="relative group flex-1 min-w-[250px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
              <input
                type="text"
                placeholder="Search clients (min 3 chars)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all font-bold shadow-sm"
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
              onClick={() => refreshClients()}
              disabled={isLoadingClients || isLoadingPets}
              className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 shadow-sm transition-all flex items-center gap-1.5 active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed p-2.5"
              title="Refresh client data"
            >
              <RefreshCw size={14} className={isLoadingClients || isLoadingPets ? 'animate-spin' : ''} />
            </button>

            {/* Register Client - Prominent CTA */}
            <button
              onClick={onRegisterClient}
              className="compact-button bg-gradient-to-r from-pine to-seafoam text-white shadow-xs shadow-pine/30 hover:shadow-xl hover:shadow-pine/40 transition-all active:scale-95 px-5 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
            >
              <User size={14} className="inline ml-1" /> Register
            </button>
          </div>
        </div>
      </div>


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
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                    whileHover={{ y: -2 }}
                    className="group/card relative bg-white dark:bg-zinc-900 
               border border-slate-200/60 dark:border-zinc-700/60
               shadow-sm hover:shadow-md
               transition-all duration-300
               rounded-2xl p-4"
                  >
                    {/* Alert Badge */}
                    {alert && alert.visit && alert.pet && alert.pet.name && alert.visit.date && (
                      <div className="absolute top-3 right-3 z-20">
                        <div className="relative flex h-2.5 w-2.5">
                          <span
                            className={`animate-ping absolute inset-0 rounded-full opacity-70 ${isVaccination ? "bg-indigo-400" : "bg-amber-400"
                              }`}
                          />
                          <span
                            className={`relative rounded-full h-2.5 w-2.5 ${isVaccination ? "bg-indigo-500" : "bg-amber-500"
                              }`}
                          />
                        </div>

                        <div className="absolute top-full right-0 mt-2 opacity-0 
                        group-hover/card:opacity-100 group-hover/card:translate-y-0 
                        translate-y-2 transition-all duration-300 
                        pointer-events-none z-50">
                          <div className="bg-zinc-900 text-white p-3 rounded-xl shadow-lg w-52">
                            <p className="text-[9px] font-semibold uppercase tracking-widest opacity-60 mb-1">
                              Alert
                            </p>
                            <p className="text-xs font-semibold">
                              {alert.pet.name} — {isVaccination ? "Vaccination" : "Visit"}
                            </p>
                            <p className="text-[10px] opacity-70 mt-1">
                              {formatDate(alert.visit.date)} • {formatTime(alert.visit.date)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      {/* LEFT CONTENT */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() =>
                          onViewClientPets
                            ? onViewClientPets(client.id)
                            : onViewClient(client.id)
                        }
                      >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <img
                            src={client.avatar}
                            alt={String(client.name || "")}
                            className="w-12 h-12 rounded-xl object-cover 
                       border border-slate-200 dark:border-zinc-700 
                       shadow-sm"
                          />

                          <div className="min-w-0">
                            <h3 className="text-base font-semibold text-slate-800 dark:text-white truncate">
                              {String(client.name || "")}
                            </h3>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                              ID: #{String(client.id || "")}
                            </p>
                          </div>
                        </div>

                        {/* Contact */}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-lg">
                            <Mail size={12} className="opacity-60 shrink-0" />
                            <span className="truncate">
                              {String(client.email || "No email")}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-lg">
                            <Phone size={12} className="opacity-60 shrink-0" />
                            <span>{String(client.phone || "No phone")}</span>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT ACTIONS */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {/* Pets Button */}
                        <div
                          ref={(el) => {
                            petsButtonRefs.current[client.id] = el;
                          }}
                          onMouseEnter={() => handlePetsMouseEnter(client.id)}
                          onMouseLeave={handlePetsMouseLeave}
                          className="relative"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (clientPets.length === 0)
                                onAddPetForClient(client.id);
                            }}
                            className="w-9 h-9 flex items-center justify-center
                       bg-slate-100 dark:bg-zinc-800
                       border border-slate-200 dark:border-zinc-700
                       rounded-xl
                       hover:bg-emerald-500 hover:text-white
                       transition-all duration-300"
                          >
                            <PawPrint size={14} />

                            {clientPets.length > 0 && (
                              <span className="absolute -top-1 -right-1 min-w-[14px] h-4 
                               bg-emerald-500 text-white text-[9px] 
                               font-semibold rounded-full flex items-center 
                               justify-center border border-white shadow-sm">
                                {clientPets.length}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* More Actions Button */}
                        <div
                          ref={(el) => {
                            actionsButtonRefs.current[client.id] = el;
                          }}
                          onMouseEnter={() => handleActionsMouseEnter(client.id)}
                          onMouseLeave={handleActionsMouseLeave}
                        >
                          <button
                            className="w-9 h-9 flex items-center justify-center
                       bg-slate-100 dark:bg-zinc-800
                       border border-slate-200 dark:border-zinc-700
                       rounded-xl
                       hover:bg-emerald-500 hover:text-white
                       transition-all duration-300"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                      <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                          Spent
                        </p>
                        <p className="text-base text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          KES {(client.totalSpent || 0).toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-xl">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                          Joined On
                        </p>
                        <p className="text-base text-sm font-semibold text-slate-700 dark:text-white">
                          {formatDate(client.joinDate)}
                        </p>
                      </div>
                      {/* <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-xl">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                          Last Visit
                        </p>
                        <p className="text-base text-sm font-semibold text-slate-700 dark:text-white">
                          {formatDate(client.lastVisitAt)}
                        </p>
                      </div> */}
                    </div>
                  </motion.div>
                );


                // return (
                //   <motion.div
                //     key={client.id}
                //     initial={{ opacity: 0, y: 20 }}
                //     animate={{ opacity: 1, y: 0 }}
                //     transition={{ duration: 0.3, delay: index * 0.05 }}
                //     whileHover={{ scale: 1.02 }}
                //     className="compact-card overflow-visible"
                //   >

                //     {alert && alert.visit && alert.pet && alert.pet.name && alert.visit.date && (
                //       <div className="absolute top-4 right-4 group/alert">
                //         <div className="relative flex h-2 w-2">
                //           <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isVaccination ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
                //           <span className={`relative inline-flex rounded-full h-2 w-2 ${isVaccination ? 'bg-indigo-600' : 'bg-amber-600'}`}></span>
                //         </div>

                //         <div className="absolute top-0 right-6 opacity-0 group-hover/alert:opacity-100 transition-all duration-300 pointer-events-none translate-x-2 group-hover/alert:translate-x-0 z-[120]">
                //           <div className="bg-pine text-white p-3 rounded-xl shadow-2xl w-52 border border-white/10">
                //             <p className="text-[7px] font-black uppercase tracking-[0.2em] mb-1 opacity-50">Alert</p>
                //             <p className="text-xs font-black leading-tight"><span className="text-seafoam">{String(alert.pet.name)}</span>: Upcoming {isVaccination ? 'Vaccination' : 'Visit'}</p>
                //             <p className="text-[8px] font-bold mt-1 opacity-80">{formatDate(alert.visit.date)} @ {formatTime(alert.visit.date)}</p>
                //           </div>
                //         </div>
                //       </div>
                //     )}

                //     <div className="flex gap-3">
                //       <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewClientPets ? onViewClientPets(client.id) : onViewClient(client.id)}>
                //         <div className="flex items-center gap-3 mb-3">
                //           <img src={client.avatar} alt={String(client.name || '')} className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 group-hover:scale-105 transition-transform shadow-inner shrink-0 aspect-square" />
                //           <div className="min-w-0 flex-1">
                //             <div className="flex items-center justify-between gap-2">
                //               <div className="min-w-0">
                //                 <h3 className="card-title text-sm truncate leading-tight">{String(client.name || '')}</h3>
                //                 <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-0.5">ID: #{String(client.id || '')}</p>
                //               </div>
                //               {/* Pets icon inside card */}
                //               <button
                //                 ref={(el) => { petsButtonRefs.current[client.id] = el; }}
                //                 onMouseEnter={() => handlePetsMouseEnter(client.id)}
                //                 onMouseLeave={handlePetsMouseLeave}
                //                 onClick={(e) => {
                //                   e.stopPropagation();
                //                   // If no pets, clicking opens Add Pet modal
                //                   if (clientPets.length === 0) {
                //                     onAddPetForClient(client.id);
                //                   }
                //                   // If pets exist, hover card will handle interactions
                //                 }}
                //                 className="p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-seafoam rounded-lg transition-all relative shadow-sm shrink-0"
                //                 title={clientPets.length > 0 ? "View Pets" : "Add Pet"}
                //               >
                //                 <PawPrint size={14} />
                //                 {clientPets.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan text-white text-[7px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md">{clientPets.length}</span>}
                //               </button>
                //             </div>
                //           </div>
                //         </div>

                //         <div className="space-y-2 mb-4">
                //           <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-[9px] font-bold">
                //             <Mail size={11} className="text-mist dark:text-zinc-700" />
                //             <span className="truncate">{String(client.email || '')}</span>
                //           </div>
                //           <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-[9px] font-bold">
                //             <Phone size={11} className="text-mist dark:text-zinc-700" />
                //             <span>{String(client.phone || '')}</span>
                //           </div>
                //         </div>

                //         <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                //           <div className="bg-slate-50 dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
                //             <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Spent</p>
                //             <p className="text-emerald-600 font-mono font-black text-[10px] truncate">KES {(client.totalSpent || 0).toLocaleString()}</p>
                //           </div>
                //           <div className="bg-slate-50 dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
                //             <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Last Visit</p>
                //             <p className="text-pine dark:text-zinc-300 font-mono font-black text-[10px] truncate">{String(client.lastVisit || 'N/A')}</p>
                //           </div>
                //         </div>
                //       </div>

                //       <div className="flex flex-col gap-2 shrink-0">
                //         {/* More options button */}
                //         <div ref={(el) => { actionsButtonRefs.current[client.id] = el; }} onMouseEnter={() => handleActionsMouseEnter(client.id)} onMouseLeave={handleActionsMouseLeave}>
                //           <button className="w-10 h-10 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-white hover:bg-seafoam rounded-xl transition-all shadow-sm flex items-center justify-center" title="More options">
                //             <MoreVertical size={16} />
                //           </button>
                //         </div>
                //       </div>
                //     </div>
                //   </motion.div>
                // );
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

          {/* Fixed-position pets hover menu - renders outside card overflow */}
          {hoveredPetsClient !== null && petsMenuPosition && (
            <div
              className="fixed z-[9999] w-64 animate-in slide-in-from-left-2 fade-in duration-200"
              style={{ top: petsMenuPosition.top, left: petsMenuPosition.left, transform: 'translateX(-100%) translateX(-16px)' }}
              onMouseEnter={handlePetsMenuEnter}
              onMouseLeave={handlePetsMenuLeave}
            >
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 shadow-2xl overflow-hidden">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 px-2">
                  Pets ({getClientPets(hoveredPetsClient).length})
                </h4>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {getClientPets(hoveredPetsClient).length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      No pets registered
                    </div>
                  ) : (
                    getClientPets(hoveredPetsClient).map((pet) => (
                      <div
                        key={pet.id}
                        className="group/pet bg-slate-50 dark:bg-zinc-800 rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all border border-slate-100 dark:border-zinc-700"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onViewPet) {
                                onViewPet(pet.id);
                              }
                              setHoveredPetsClient(null);
                              setPetsMenuPosition(null);
                              setHoveredPetsMenu(false);
                            }}
                            className="flex-1 cursor-pointer"
                          >
                            <h5 className="text-sm font-bold text-pine dark:text-zinc-100 truncate">
                              {pet.name}
                            </h5>
                            <p className="text-[8px] font-black uppercase tracking-widest text-seafoam dark:text-zinc-500">
                              {pet.species} • {pet.breed}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPrebookAppointment(hoveredPetsClient, pet.id);
                              setHoveredPetsClient(null);
                              setPetsMenuPosition(null);
                              setHoveredPetsMenu(false);
                            }}
                            className="p-2 bg-seafoam hover:bg-pine text-white rounded-lg transition-all shadow-sm shrink-0"
                            title="New Appointment"
                          >
                            <Calendar size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default ClientsView;
