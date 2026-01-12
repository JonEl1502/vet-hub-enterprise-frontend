
import React, { useState, useMemo } from 'react';
import { ApptStatus, Clinic } from '../types';
import { Search, Eye, Clipboard, Calendar, Network, Plus, MoreHorizontal, ShieldCheck, Info, Building2, Users, Mail, Phone, MapPin, Sparkles, CalendarPlus, Loader2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { formatDate, formatTime } from '../services/utils/dateFormatter';

interface Props {
  clinics: Clinic[];
  onViewPet: (id: number, initialTab?: string) => void;
  onGenerateAiSummary: (history: any[]) => void;
  loadingAi: boolean;
  onRegisterPet: () => void;
  onNewAppointment: (clientId: number, petId: number) => void;
}

const PetsView: React.FC<Props> = ({ clinics, onViewPet, onGenerateAiSummary, loadingAi, onRegisterPet, onNewAppointment }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { pets, clients, appointments, isLoadingPets, isLoadingClients } = useData();

  const filteredPets = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return pets.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.breed.toLowerCase().includes(query) || 
      p.species.toLowerCase().includes(query)
    );
  }, [pets, searchQuery]);

  const getUpcomingVisit = (petId: number) => {
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + 7);

    return appointments.find(a => 
      a.petId === petId && 
      a.status === ApptStatus.SCHEDULED && 
      new Date(a.date) >= now && 
      new Date(a.date) <= limit
    );
  };

  if (isLoadingPets || isLoadingClients) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-seafoam animate-spin" />
          <p className="text-seafoam dark:text-zinc-500 font-black text-sm uppercase tracking-widest">Loading patients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">Patient Registry</h1>
          <p className="text-seafoam dark:text-zinc-500 font-medium text-[10px] uppercase tracking-widest mt-1">Active Patient Node Management</p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-11 pr-6 py-2.5 text-[11px] text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none w-72 transition-all font-bold shadow-sm"
            />
          </div>
          <button onClick={onRegisterPet} className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 active:scale-95">
            <Plus size={14} /> Register Pet
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredPets.map(pet => {
          const owner = clients.find(c => c.id === pet.ownerId);
          const clinic = clinics.find(c => c.id === pet.clinicId);
          const upcomingVisit = getUpcomingVisit(pet.id);
          const isVaccination = upcomingVisit?.tasks?.some(t => t.category.toLowerCase().includes('vac'));

          return (
            <div key={pet.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 hover:border-seafoam transition-all group relative overflow-visible shadow-sm">
              
              {upcomingVisit && upcomingVisit.date && (
                 <div className="absolute top-6 right-6 group/alert">
                    <div className="relative flex h-2.5 w-2.5">
                       <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isVaccination ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
                       <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isVaccination ? 'bg-indigo-600' : 'bg-amber-600'}`}></span>
                    </div>

                    <div className="absolute top-0 right-6 opacity-0 group-hover/alert:opacity-100 transition-all duration-300 pointer-events-none translate-x-2 group-hover/alert:translate-x-0 z-[120]">
                       <div className="bg-pine text-white p-4 rounded-2xl shadow-2xl w-60 border border-white/10">
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-1 opacity-50">Alert</p>
                          <p className="text-xs font-black leading-tight">Upcoming {isVaccination ? 'Vaccination' : 'Visit'}</p>
                          <p className="text-[9px] font-bold mt-1.5">{formatDate(upcomingVisit.date)} @ {formatTime(upcomingVisit.date)}</p>
                       </div>
                    </div>
                 </div>
              )}

              <div className="flex gap-5">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewPet(pet.id)}>
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform shadow-inner shrink-0 aspect-square">
                      {pet.species === 'Dog' ? '🐶' : '🐱'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-pine dark:text-zinc-100 truncate tracking-tight leading-tight">{pet.name}</h3>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'vaccines'); }}
                          className="p-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-500/20 hover:scale-110 transition-transform"
                        >
                          <ShieldCheck size={12} />
                        </button>
                      </div>
                      <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-0.5">{pet.breed} • {pet.age}Y</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 mb-6">
                    <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400 text-[10px] font-bold">
                      <Users size={12} className="text-mist dark:text-zinc-700" />
                      <span className="truncate">Owner: {owner?.name || 'External'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400 text-[10px] font-bold">
                      <Building2 size={12} className="text-mist dark:text-zinc-700" />
                      <span className="truncate">{clinic?.name}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-5 border-t border-slate-100 dark:border-zinc-800">
                    <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Weight</p>
                      <p className="text-pine dark:text-zinc-300 font-mono font-black text-[11px] truncate">{pet.weight || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Patient ID</p>
                      <p className="text-pine dark:text-zinc-300 font-mono font-black text-[11px] truncate">#{pet.id}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'overview'); }} className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-seafoam rounded-xl transition-all shadow-sm" title="View Patient">
                    <Eye size={18} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'history'); }} className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-emerald-600 rounded-xl transition-all shadow-sm" title="Medical Ledger">
                    <Clipboard size={18} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onViewPet(pet.id, 'appointments'); }} className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-amber-500 rounded-xl transition-all shadow-sm" title="Visits">
                    <Calendar size={18} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onNewAppointment(pet.ownerId, pet.id); }}
                    className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-cyan rounded-xl transition-all shadow-sm" 
                    title="New Appointment"
                  >
                    <CalendarPlus size={18} />
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

export default PetsView;
