
import React, { useState, useMemo, useRef } from 'react';
import { ApptStatus } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { Search, Eye, PawPrint, CreditCard, User, Plus, Phone, Mail, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { formatDate, formatTime } from '../services/utils/dateFormatter';

interface ClientsViewProps {
  transactions: Transaction[];
  onViewClient: (id: number) => void;
  onViewFinance: (clientId: number) => void;
  onRegisterClient: () => void;
  onAddPetForClient: (id: number) => void;
  onPrebookAppointment: (clientId: number, petId: number) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ transactions, onViewClient, onViewFinance, onRegisterClient, onAddPetForClient, onPrebookAppointment }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredPetClient, setHoveredPetClient] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const { clients, pets, appointments, isLoadingClients, isLoadingPets } = useData();

  const filteredClients = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return clients.filter(c => {
      const name = String(c.name || '').toLowerCase();
      const email = String(c.email || '').toLowerCase();
      const phone = String(c.phone || '');
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [clients, searchQuery]);

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
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">Client Directory</h1>
          <p className="text-seafoam dark:text-zinc-500 font-medium text-[10px] uppercase tracking-widest mt-1">Authorized Owner Node Registry</p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-11 pr-6 py-2.5 text-[11px] text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none w-72 transition-all font-bold shadow-sm"
            />
          </div>
          <button onClick={onRegisterClient} className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 active:scale-95">
            <User size={14} /> Register Client
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredClients.map(client => {
          const clientPets = getClientPets(client.id);
          const alert = getUpcomingClientAlert(client.id);
          const isVaccination = alert?.visit?.tasks?.some(t => t.category.toLowerCase().includes('vac'));

          return (
            <div key={client.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 hover:border-seafoam transition-all group relative overflow-visible shadow-sm">
              
              {alert && alert.visit && alert.pet && alert.pet.name && alert.visit.date && (
                <div className="absolute top-6 right-6 group/alert">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isVaccination ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isVaccination ? 'bg-indigo-600' : 'bg-amber-600'}`}></span>
                  </div>

                  <div className="absolute top-0 right-6 opacity-0 group-hover/alert:opacity-100 transition-all duration-300 pointer-events-none translate-x-2 group-hover/alert:translate-x-0 z-[120]">
                    <div className="bg-pine text-white p-4 rounded-2xl shadow-2xl w-60 border border-white/10">
                       <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-1 opacity-50">Alert</p>
                       <p className="text-xs font-black leading-tight"><span className="text-seafoam">{String(alert.pet.name)}</span>: Upcoming {isVaccination ? 'Vaccination' : 'Visit'}</p>
                       <p className="text-[9px] font-bold mt-1 opacity-80">{formatDate(alert.visit.date)} @ {formatTime(alert.visit.date)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-5">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewClient(client.id)}>
                  <div className="flex items-center gap-4 mb-5">
                    <img src={client.avatar} alt={String(client.name || '')} className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 group-hover:scale-105 transition-transform shadow-inner shrink-0 aspect-square" />
                    <div className="min-w-0">
                      <h3 className="text-lg font-black text-pine dark:text-zinc-100 truncate tracking-tight leading-tight">{String(client.name || '')}</h3>
                      <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-0.5">ID: #{String(client.id || '')}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 mb-6">
                    <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400 text-[10px] font-bold">
                      <Mail size={12} className="text-mist dark:text-zinc-700" />
                      <span className="truncate">{String(client.email || '')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400 text-[10px] font-bold">
                      <Phone size={12} className="text-mist dark:text-zinc-700" />
                      <span>{String(client.phone || '')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-5 border-t border-slate-100 dark:border-zinc-800">
                    <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Yield Contribution</p>
                      <p className="text-emerald-600 font-mono font-black text-[11px] truncate">KES {(client.totalSpent || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Last Ingress</p>
                      <p className="text-pine dark:text-zinc-300 font-mono font-black text-[11px] truncate">{String(client.lastVisit || 'N/A')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => onViewClient(client.id)} className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-seafoam rounded-xl transition-all shadow-sm" title="View Profile">
                    <Eye size={18} />
                  </button>

                  <div className="relative" onMouseEnter={() => handleMouseEnter(client.id)} onMouseLeave={handleMouseLeave}>
                    <button className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-seafoam rounded-xl transition-all relative shadow-sm">
                      <PawPrint size={18} />
                      {clientPets.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-cyan text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md">{clientPets.length}</span>}
                    </button>

                    {hoveredPetClient === client.id && (
                      <div 
                        className="absolute right-full mr-3 top-0 z-[100] w-72 animate-in slide-in-from-right-2 fade-in duration-200"
                        onMouseEnter={() => { if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); }}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-4 shadow-2xl overflow-hidden">
                          <div className="flex justify-between items-center mb-4 px-2">
                             <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Authorized Pets</h4>
                             <button 
                               onClick={(e) => { e.stopPropagation(); onAddPetForClient(client.id); }}
                               className="w-7 h-7 rounded-xl bg-seafoam text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-seafoam/20"
                             >
                               <Plus size={14} />
                             </button>
                          </div>
                          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1 scroll-smooth">
                            {clientPets.length > 0 ? clientPets.map(pet => (
                              <div 
                                key={pet.id} 
                                onClick={(e) => { e.stopPropagation(); onPrebookAppointment(client.id, pet.id); }}
                                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-950 hover:bg-seafoam/5 rounded-2xl border border-slate-100 dark:border-zinc-800 transition-all cursor-pointer group/pet"
                              >
                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-xl shadow-sm shrink-0 aspect-square group-hover/pet:scale-110 transition-transform">{pet.species === 'Dog' ? '🐶' : '🐱'}</div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-pine dark:text-zinc-100 font-black text-xs truncate uppercase tracking-tight">{String(pet.name || '')}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <Calendar size={10} className="text-seafoam"/>
                                    <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase truncate tracking-widest">Create Appointment</p>
                                  </div>
                                </div>
                                <ChevronRight size={14} className="text-slate-200 dark:text-zinc-800 group-hover/pet:text-seafoam transition-colors" />
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
                </div>
              </div>
            </div>
          );
        })} 
      </div>
    </div>
  );
};

export default ClientsView;
