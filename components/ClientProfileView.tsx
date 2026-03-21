
import React, { useState } from 'react';
import { Client, Pet, Appointment, ApptStatus, Message, FULL_ACCESS_ROLES, UserRole } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { Mail, Phone, MapPin, CreditCard, PawPrint, Calendar, ArrowLeft, ChevronRight, ChevronDown, Play, MessageSquare, Activity, MessageCircle, FileText, Receipt, Edit2, Save, X, Plus, TrendingUp, Clock, Printer, Eye, MoreVertical, CheckCircle2, Map } from 'lucide-react';
import { formatDate } from '../services/utils/dateFormatter';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  client: Client;
  pets: Pet[];
  transactions: Transaction[];
  appointments: Appointment[];
  onBack: () => void;
  initialTab?: string;
  onViewPet: (id: number) => void;
  onOpenMessaging: () => void;
  allMessages: Message[];
  onUpdateClient?: (id: number, data: Partial<Client>) => Promise<void>;
  onProcessPayment?: (apptId: number, method: string) => void;
  onViewAppointment?: (appointmentId: number) => void;
  onScheduleAppointment?: () => void;
  onAddPet?: () => void;
}

const ClientProfileView: React.FC<Props> = ({ client, pets, transactions, appointments, onBack, initialTab = 'overview', onViewPet, onOpenMessaging, allMessages, onUpdateClient, onProcessPayment, onViewAppointment, onScheduleAppointment, onAddPet }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<number | null>(null);
  const [docModal, setDocModal] = useState<{ type: 'invoice' | 'receipt' | 'medical_record' | 'notes'; appt: Appointment } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedClient, setEditedClient] = useState<Partial<Client>>(client);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState<string[]>([
    'Client prefers morning appointments',
    'Allergic to certain medications - check records',
  ]);
  const [newNote, setNewNote] = useState('');
  const [openUpcomingPetId, setOpenUpcomingPetId] = useState<number | null>(null);

  const { user } = useAuth();
  const hasFullAccess = FULL_ACCESS_ROLES.includes(user?.role as UserRole);

  // Next upcoming appointment for this client
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextAppointment = appointments
    .filter(a => a.status === ApptStatus.SCHEDULED && new Date(a.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
  const nextApptPet = nextAppointment ? pets.find(p => p.id === nextAppointment.petId) : null;

  const clientMessages = allMessages.filter(m => m.clientId === client.id);

  // Filter transactions from local data (props)
  const clientTransactions = transactions.filter(tx => tx.fromId === client.id || tx.toId === client.id);

  // Calculate statistics - use COMPLETED appointments for accurate metrics
  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter(a => a.status === ApptStatus.COMPLETED).length;
  const upcomingAppointments = appointments.filter(a => a.status === ApptStatus.SCHEDULED).length;
  // Average spend should only consider completed visits
  const averageSpendPerVisit = completedAppointments > 0 ? client.totalSpent / completedAppointments : 0;

  // Per-pet scheduled appointments for quick workflow access
  const scheduledByPet = pets.map(p => ({
    pet: p,
    scheduled: appointments
      .filter(a => a.petId === p.id && a.status === ApptStatus.SCHEDULED)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  })).filter(x => x.scheduled.length > 0);

  // Calculate visit number per pet based on appointment date order
  const getVisitNumber = (appointment: Appointment): number => {
    const petAppointments = appointments
      .filter(a => a.petId === appointment.petId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return petAppointments.findIndex(a => a.id === appointment.id) + 1;
  };

  const handleSave = async () => {
    if (!onUpdateClient) return;
    setIsSaving(true);
    try {
      await onUpdateClient(client.id, editedClient);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update client:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedClient(client);
    setIsEditing(false);
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      setNotes([...notes, newNote.trim()]);
      setNewNote('');
    }
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-2 space-y-6">
        {/* Combined Stats Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
          <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-zinc-800">
            <div className="p-3 text-center">
              <div className="flex items-center justify-center mb-1.5">
                <div className="p-1.5 bg-seafoam/10 rounded-lg"><Calendar size={12} className="text-seafoam" /></div>
              </div>
              <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{totalAppointments}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
            </div>
            <div className="p-3 text-center">
              <div className="flex items-center justify-center mb-1.5">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg"><CheckCircle2 size={12} className="text-emerald-500" /></div>
              </div>
              <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{completedAppointments}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Done</p>
            </div>
            <div className="p-3 text-center">
              <div className="flex items-center justify-center mb-1.5">
                <div className="p-1.5 bg-amber-500/10 rounded-lg"><Clock size={12} className="text-amber-500" /></div>
              </div>
              <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{upcomingAppointments}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Upcoming</p>
            </div>
            <div className="p-3 text-center">
              <div className="flex items-center justify-center mb-1.5">
                <div className="p-1.5 bg-purple-500/10 rounded-lg"><TrendingUp size={12} className="text-purple-500" /></div>
              </div>
              <p className="text-sm font-black text-pine dark:text-zinc-100 leading-none mb-0.5 truncate">{client.currency} {averageSpendPerVisit.toFixed(0)}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Avg/Visit</p>
            </div>
          </div>
          {/* Per-pet scheduled appointment quick access */}
          {scheduledByPet.length > 0 && onViewAppointment && (
            <div className="border-t border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
              {scheduledByPet.map(({ pet, scheduled }) => (
                <div key={pet.id} className="px-3 py-2 bg-amber-50/40 dark:bg-amber-900/10">
                  {scheduled.length === 1 ? (
                    <button
                      onClick={() => onViewAppointment(scheduled[0].id)}
                      className="w-full flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{pet.species === 'Dog' ? '🐶' : '🐱'}</span>
                        <div className="text-left">
                          <p className="text-[8px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">{pet.name} — {formatDate(scheduled[0].date)}</p>
                        </div>
                      </div>
                      <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"><Play size={9} /> Workflow</span>
                    </button>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setOpenUpcomingPetId(openUpcomingPetId === pet.id ? null : pet.id)}
                        className="w-full flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{pet.species === 'Dog' ? '🐶' : '🐱'}</span>
                          <span className="text-[8px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">{pet.name} — {scheduled.length} Appointments</span>
                        </div>
                        <ChevronDown size={12} className={`text-amber-500 transition-transform duration-200 ${openUpcomingPetId === pet.id ? 'rotate-180' : ''}`} />
                      </button>
                      {openUpcomingPetId === pet.id && (
                        <div className="mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden z-20">
                          {scheduled.map(appt => (
                            <button
                              key={appt.id}
                              onClick={() => { onViewAppointment(appt.id); setOpenUpcomingPetId(null); }}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all border-b last:border-b-0 border-slate-100 dark:border-zinc-800"
                            >
                              <div className="flex items-center gap-2">
                                <Play size={10} className="text-amber-500 shrink-0" />
                                <p className="text-[9px] font-black text-pine dark:text-zinc-100 uppercase">{formatDate(appt.date)}</p>
                              </div>
                              <span className="text-[8px] font-black text-amber-500 uppercase tracking-wider">Go →</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-xl">
           <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <Activity className="text-seafoam" size={20} />
                <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Identity Profile</h3>
              </div>
              {onUpdateClient && (
                <button
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-seafoam text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-seafoam/90 transition-all disabled:opacity-50"
                >
                  {isEditing ? (
                    <>
                      <Save size={14} />
                      {isSaving ? 'Saving...' : 'Save'}
                    </>
                  ) : (
                    <>
                      <Edit2 size={14} />
                      Edit
                    </>
                  )}
                </button>
              )}
              {isEditing && (
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-300 dark:hover:bg-zinc-700 transition-all ml-2"
                >
                  <X size={14} />
                  Cancel
                </button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
              <div className="space-y-4">
                 {[
                   { label: 'Full Name', field: 'name', val: isEditing ? editedClient.name : client.name, icon: Activity, type: 'text' },
                   { label: 'Email', field: 'email', val: isEditing ? editedClient.email : client.email, icon: Mail, type: 'email' },
                   { label: 'Phone', field: 'phone', val: isEditing ? editedClient.phone : client.phone, icon: Phone, type: 'tel' },
                   { label: 'Address', field: 'address', val: isEditing ? editedClient.address : client.address, icon: MapPin, type: 'text' },
                   { label: 'Country', field: 'country', val: isEditing ? editedClient.country : client.country, icon: MapPin, type: 'text' },
                 ].map(i => (
                   <div key={i.label} className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg text-slate-400 aspect-square"><i.icon size={14}/></div>
                      <div className="min-w-0 flex-1">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
                         {isEditing ? (
                           <input
                             type={i.type}
                             value={i.val || ''}
                             onChange={(e) => setEditedClient({ ...editedClient, [i.field]: e.target.value })}
                             className="w-full text-pine dark:text-zinc-200 font-bold text-sm leading-tight bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                           />
                         ) : (
                           <p className="text-pine dark:text-zinc-200 font-bold text-sm leading-tight truncate">{i.val}</p>
                         )}
                      </div>
                   </div>
                 ))}
              </div>
              <div className="bg-slate-50 dark:bg-zinc-800/50 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800/50">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Metadata</p>
                 <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                       <span className="text-slate-400">Join Date</span>
                       <span className="text-pine dark:text-zinc-200">{client.joinDate}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                       <span className="text-slate-400">Total Pets</span>
                       <span className="text-seafoam">{pets.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                       <span className="text-slate-400">Completed Visits</span>
                       <span className="text-emerald-500">{completedAppointments}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Map visualization if coordinates exist */}
        {(client.lat && client.lng) && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <Map className="text-cyan" size={20} />
              <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Client Location</h3>
              <span className="ml-auto text-[9px] font-mono text-slate-400">{client.lat.toFixed(5)}, {client.lng.toFixed(5)}</span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700 h-48">
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${client.lng - 0.015},${client.lat - 0.015},${client.lng + 0.015},${client.lat + 0.015}&layer=mapnik&marker=${client.lat},${client.lng}`}
                width="100%" height="100%"
                title="Client location"
                className="border-0"
                loading="lazy"
              />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-xl">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <PawPrint className="text-cyan" size={20} />
                 <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Registered Pets</h3>
              </div>
              <span className="text-[9px] font-black bg-cyan/10 text-cyan px-2.5 py-1 rounded-lg uppercase tracking-widest">{pets.length} Patients</span>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pets.map(pet => {
                const petScheduled = appointments.filter(a => a.petId === pet.id && a.status === ApptStatus.SCHEDULED).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const hasScheduled = petScheduled.length > 0;
                return (
                  <div key={pet.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${hasScheduled ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-400/60 dark:border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]' : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-800 hover:border-seafoam'}`}>
                     <div onClick={() => onViewPet(pet.id)} className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shrink-0 aspect-square">{pet.species === 'Dog' ? '🐶' : '🐱'}</div>
                     <div onClick={() => onViewPet(pet.id)} className="min-w-0 flex-1">
                        <p className="text-pine dark:text-zinc-100 font-black text-sm truncate uppercase">{pet.name}</p>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${hasScheduled ? 'text-amber-600 dark:text-amber-400' : 'text-seafoam dark:text-zinc-500'}`}>
                          {hasScheduled ? `${petScheduled.length} Scheduled` : pet.breed}
                        </p>
                     </div>
                     {hasScheduled && onViewAppointment ? (
                       <div className="flex items-center gap-1 ml-auto">
                         {petScheduled.length === 1 ? (
                           <button
                             onClick={(e) => { e.stopPropagation(); onViewAppointment(petScheduled[0].id); }}
                             className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-amber-600 transition-all"
                           >
                             <Play size={9} /> Workflow
                           </button>
                         ) : (
                           <button
                             onClick={(e) => { e.stopPropagation(); setOpenUpcomingPetId(openUpcomingPetId === pet.id ? null : pet.id); }}
                             className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-amber-600 transition-all relative"
                           >
                             <Calendar size={9} /> {petScheduled.length}
                             {openUpcomingPetId === pet.id && (
                               <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl z-30 overflow-hidden" onClick={e => e.stopPropagation()}>
                                 {petScheduled.map(appt => (
                                   <button key={appt.id} onClick={() => { onViewAppointment(appt.id); setOpenUpcomingPetId(null); }} className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-b last:border-b-0 border-slate-100 dark:border-zinc-800 transition-all">
                                     <span className="text-[9px] font-black text-pine dark:text-zinc-100 uppercase">{formatDate(appt.date)}</span>
                                     <Play size={9} className="text-amber-500" />
                                   </button>
                                 ))}
                               </div>
                             )}
                           </button>
                         )}
                       </div>
                     ) : (
                       <ChevronRight size={14} className="ml-auto text-slate-200 group-hover:text-seafoam" onClick={() => onViewPet(pet.id)} />
                     )}
                  </div>
                );
              })}
           </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-pine rounded-2xl p-5 sm:p-8 text-white shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
             {hasFullAccess ? <CreditCard size={100}/> : <Calendar size={100}/>}
           </div>
           {hasFullAccess ? (
             <>
               <p className="text-mist/40 text-[9px] font-black uppercase tracking-widest mb-2">Lifetime Spending</p>
               <h2 className="text-4xl font-black font-mono tracking-tighter mb-8">{client.currency} {(client.totalSpent || 0).toLocaleString()}</h2>
             </>
           ) : (
             <>
               <p className="text-mist/40 text-[9px] font-black uppercase tracking-widest mb-2">Next Appointment</p>
               {nextAppointment ? (
                 <div className="mb-8">
                   <h2 className="text-2xl font-black font-mono tracking-tighter">{formatDate(nextAppointment.date)}</h2>
                   {nextApptPet && <p className="text-mist/60 text-[10px] font-black uppercase tracking-widest mt-1">{nextApptPet.name}</p>}
                 </div>
               ) : (
                 <div className="mb-8">
                   <p className="text-mist/60 text-sm font-bold mb-3">No upcoming appointments</p>
                   {onScheduleAppointment && (
                     <button
                       onClick={onScheduleAppointment}
                       className="bg-seafoam/20 hover:bg-seafoam/30 text-white border border-seafoam/40 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                     >
                       <Plus size={14} /> Schedule Appointment
                     </button>
                   )}
                 </div>
               )}
             </>
           )}
           <button
            onClick={onOpenMessaging}
            className="w-full bg-white text-pine py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 relative z-10"
           >
            <MessageSquare size={16} /> Messaging Portal
           </button>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-sm">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Recent Activity</h4>
           <div className="space-y-4">
              {appointments.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-sm text-slate-400 shrink-0 aspect-square">📅</div>
                   <div className="min-w-0">
                      <p className="text-[10px] font-black text-pine dark:text-zinc-200 truncate uppercase">Visit #{a.id}</p>
                      <p className="text-[8px] font-bold text-slate-400">{formatDate(a.date)}</p>
                   </div>
                   <span className="ml-auto text-[8px] font-black bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-md border border-emerald-500/20 uppercase">{a.status}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Internal Notes Section */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-sm">
           <div className="flex items-center justify-between mb-4">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Notes</h4>
             <FileText size={16} className="text-slate-400" />
           </div>
           <div className="space-y-3 mb-4">
              {notes.map((note, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
                  <p className="text-xs text-pine dark:text-zinc-200 font-medium">{note}</p>
                  <p className="text-[8px] text-slate-400 mt-1">Added {formatDate(new Date())}</p>
                </div>
              ))}
           </div>
           <div className="flex gap-2">
             <input
               type="text"
               value={newNote}
               onChange={(e) => setNewNote(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
               placeholder="Add a note..."
               className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-pine dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-seafoam"
             />
             <button
               onClick={handleAddNote}
               className="px-4 py-2 bg-seafoam text-white rounded-lg text-xs font-black uppercase hover:bg-seafoam/90 transition-all flex items-center gap-2"
             >
               <Plus size={14} />
               Add
             </button>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
           <button onClick={onBack} className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-seafoam transition-all shadow-lg active:scale-95 shrink-0">
             <ArrowLeft size={18}/>
           </button>
           <div className="flex items-center gap-3 sm:gap-6 min-w-0">
              <img src={client.avatar} className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl border-2 sm:border-4 border-white dark:border-zinc-950 shadow-xl shrink-0 aspect-square" alt="" />
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-1 uppercase truncate">{client.name}</h1>
                <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 truncate">
                   Client Profile
                   <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 shrink-0"></span>
                   ID: {client.id}
                </p>
              </div>
           </div>
        </div>

        <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-x-auto no-scrollbar scroll-smooth">
           {[
             { id: 'overview', label: 'Summary', icon: Activity },
             { id: 'pets', label: 'Patients', icon: PawPrint },
             { id: 'appointments', label: 'Appointments', icon: Calendar },
             { id: 'medical', label: 'Medical History', icon: FileText },
             { id: 'transactions', label: 'Transactions', icon: Receipt },
             { id: 'outreach', label: 'Messaging', icon: MessageCircle },
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                 activeTab === tab.id 
                   ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg' 
                   : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-200'
               }`}
             >
               <tab.icon size={12} />
               {tab.label}
             </button>
           ))}
        </div>
      </header>

      <div className="min-h-[50vh]">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'pets' && (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4">
              {pets.length > 0 ? pets.map(pet => (
                <div key={pet.id} onClick={() => onViewPet(pet.id)} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 hover:border-seafoam transition-all cursor-pointer group shadow-sm">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shrink-0 aspect-square">{pet.species === 'Dog' ? '🐶' : '🐱'}</div>
                      <div className="min-w-0 flex-1">
                         <p className="text-pine dark:text-zinc-100 font-black text-lg truncate uppercase">{pet.name}</p>
                         <p className="text-seafoam text-[9px] font-black uppercase tracking-widest">{pet.breed}</p>
                      </div>
                   </div>
                   <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                      <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Species</span>
                         <span className="text-[9px] font-black text-pine dark:text-zinc-200 uppercase">{pet.species}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Age</span>
                         <span className="text-[9px] font-black text-pine dark:text-zinc-200 uppercase">{pet.age} yrs</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Weight</span>
                         <span className="text-[9px] font-black text-pine dark:text-zinc-200 uppercase">{pet.weight} kg</span>
                      </div>
                   </div>
                </div>
              )) : (
                 <div className="col-span-full py-16 flex flex-col items-center justify-center gap-4 border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem]">
                   <PawPrint size={32} className="text-slate-200 dark:text-zinc-700" />
                   <p className="uppercase font-black text-[10px] tracking-[0.2em] text-slate-300 dark:text-zinc-600">No patients registered</p>
                   {onAddPet && (
                     <button
                       onClick={onAddPet}
                       className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all shadow-lg"
                     >
                       <Plus size={14} /> Add Patient
                     </button>
                   )}
                 </div>
              )}
           </div>
        )}
        {activeTab === 'appointments' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              {appointments.length > 0 ? appointments.map(appt => {
                const pet = pets.find(p => p.id === appt.petId);
                const categoriesCount = new Set(appt.tasks.map(t => t.category)).size;
                const servicesCount = appt.tasks.length;
                return (
                <div key={appt.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:border-seafoam transition-all relative">
                   {/* Header */}
                   <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                         <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-xl shrink-0 aspect-square">
                           {pet?.species === 'Dog' ? '🐶' : '🐱'}
                         </div>
                         <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-pine dark:text-zinc-100 font-black text-sm uppercase truncate">{pet?.name || 'Unknown Pet'}</p>
                              {appt.parentAppointmentId && (
                                <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">Follow-up</span>
                              )}
                              <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                                appt.status === ApptStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                appt.status === ApptStatus.IN_PROGRESS ? 'bg-cyan/10 text-cyan border-cyan/20' :
                                'bg-slate-100 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700'
                              }`}>{appt.status}</span>
                            </div>
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-0.5">Visit #{getVisitNumber(appt)} • {formatDate(appt.date)}</p>
                         </div>
                      </div>
                      {/* Action Menu */}
                      <div className="relative shrink-0 ml-2">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === appt.id ? null : appt.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-pine hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === appt.id && (
                          <div className="absolute right-0 top-9 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                            {onViewAppointment && (
                              <button onClick={() => { onViewAppointment(appt.id); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-seafoam/10 hover:text-seafoam transition-all">
                                <Eye size={13} /> View Appointment
                              </button>
                            )}
                            {!appt.isPaid && onProcessPayment && (
                              <button onClick={() => { setSelectedApptId(appt.id); setShowPaymentModal(true); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                                <CreditCard size={13} /> Process Payment
                              </button>
                            )}
                            <div className="mx-3 my-1 border-t border-slate-100 dark:border-zinc-800" />
                            <button onClick={() => { setDocModal({ type: 'invoice', appt }); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                              <Printer size={13} /> Invoice
                            </button>
                            {appt.isPaid && (
                              <button onClick={() => { setDocModal({ type: 'receipt', appt }); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                                <Receipt size={13} /> Receipt
                              </button>
                            )}
                            {appt.status === ApptStatus.COMPLETED && (
                              <button onClick={() => { setDocModal({ type: 'medical_record', appt }); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-cyan hover:bg-cyan/10 transition-all">
                                <FileText size={13} /> Medical Record
                              </button>
                            )}
                            <button onClick={() => { setDocModal({ type: 'notes', appt }); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                              <MessageSquare size={13} /> Notes
                            </button>
                          </div>
                        )}
                      </div>
                   </div>

                   {/* Body */}
                   <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-base font-black font-mono text-pine dark:text-zinc-200">{client.currency} {appt.totalCost.toLocaleString()}</p>
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border ${
                          appt.isPaid ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}>{appt.isPaid ? 'PAID' : 'UNPAID'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {appt.tasks.slice(0, 4).map(task => (
                          <span key={task.id} className="text-[8px] font-black uppercase bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 px-2 py-1 rounded-lg border border-slate-100 dark:border-zinc-700">
                            {task.name}
                          </span>
                        ))}
                        {appt.tasks.length > 4 && (
                          <span className="text-[8px] font-black uppercase bg-slate-50 dark:bg-zinc-800 text-slate-400 px-2 py-1 rounded-lg">+{appt.tasks.length - 4} more</span>
                        )}
                      </div>
                      {appt.assignedStaff && (
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Staff: {appt.assignedStaff.name}</p>
                      )}
                   </div>
                </div>
              )}) : (
                 <div className="py-16 flex flex-col items-center justify-center gap-4 border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem]">
                   <Calendar size={32} className="text-slate-200 dark:text-zinc-700" />
                   <p className="uppercase font-black text-[10px] tracking-[0.2em] text-slate-300 dark:text-zinc-600">No appointments scheduled</p>
                   {onScheduleAppointment && (
                     <button
                       onClick={onScheduleAppointment}
                       className="flex items-center gap-2 px-5 py-2.5 bg-pine text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-pine/90 transition-all shadow-lg"
                     >
                       <Plus size={14} /> Schedule Appointment
                     </button>
                   )}
                 </div>
              )}
           </div>
        )}
        {activeTab === 'outreach' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              {clientMessages.length > 0 ? clientMessages.map(m => (
                 <div key={m.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-sm group hover:border-seafoam transition-all">
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-seafoam aspect-square"><MessageCircle size={20}/></div>
                          <div>
                             <p className="text-pine dark:text-zinc-100 font-black text-sm uppercase">{m.subject}</p>
                             <p className="text-slate-400 text-[8px] font-black uppercase mt-0.5">{m.channel} • {m.date}</p>
                          </div>
                       </div>
                       <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg border border-emerald-500/20">Sent</span>
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-zinc-400 leading-relaxed pl-13">{m.body}</p>
                    <div className="mt-4 pt-4 border-t border-slate-50 dark:border-zinc-800 flex justify-end">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sender: {m.senderName}</p>
                    </div>
                 </div>
              )) : (
                 <div className="py-16 flex flex-col items-center justify-center gap-4 border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem]">
                   <MessageCircle size={32} className="text-slate-200 dark:text-zinc-700" />
                   <p className="uppercase font-black text-[10px] tracking-[0.2em] text-slate-300 dark:text-zinc-600">No messages sent yet</p>
                   <button
                     onClick={onOpenMessaging}
                     className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all shadow-lg"
                   >
                     <Plus size={14} /> Create Message
                   </button>
                 </div>
              )}
           </div>
        )}
        {activeTab === 'medical' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              {pets.flatMap(pet => pet.medicalHistory || []).length > 0 ? (
                pets.flatMap(pet =>
                  (pet.medicalHistory || []).map(record => ({
                    ...record,
                    petName: pet.name,
                    petId: pet.id,
                    petSpecies: pet.species
                  }))
                )
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(record => (
                  <div key={record.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:border-seafoam transition-all">
                     <div className="flex justify-between items-start mb-4 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                           <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-xl shrink-0">
                             {record.petSpecies === 'Dog' ? '🐶' : '🐱'}
                           </div>
                           <div className="min-w-0">
                              <p className="text-pine dark:text-zinc-100 font-black text-sm uppercase truncate">{record.petName}</p>
                              <p className="text-slate-400 text-[9px] font-black uppercase mt-1">
                                {formatDate(record.date)} • Record #{record.id}
                              </p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {record.appointmentId && onViewAppointment && (
                            <button
                              onClick={() => onViewAppointment(record.appointmentId!)}
                              className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 transition-colors"
                            >
                              View Appt →
                            </button>
                          )}
                          <span className="text-[8px] font-black uppercase bg-seafoam/10 text-seafoam px-2 py-1 rounded-lg border border-seafoam/20">
                            Medical
                          </span>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Diagnosis</p>
                           <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">{record.diagnosis}</p>
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Treatment</p>
                           <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">{record.treatment}</p>
                        </div>
                        {record.medications && record.medications.length > 0 && (
                          <div>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Medications</p>
                             <div className="flex flex-wrap gap-2">
                                {record.medications.map((med, idx) => (
                                  <span key={idx} className="text-[8px] font-black uppercase bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-1 rounded-lg">
                                    {med}
                                  </span>
                                ))}
                             </div>
                          </div>
                        )}
                     </div>
                  </div>
                ))
              ) : (
                 <div className="py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-[10px] tracking-[0.2em]">
                   No medical records found
                 </div>
              )}
           </div>
        )}
        {activeTab === 'transactions' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              {clientTransactions.length > 0 ? clientTransactions.map((tx: any) => (
                <div key={tx.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:border-seafoam transition-all">
                   <div className="flex justify-between items-start mb-4 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                         <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Receipt size={18} className="text-emerald-500" />
                         </div>
                         <div className="min-w-0">
                            <p className="text-pine dark:text-zinc-100 font-black text-sm uppercase truncate">Transaction #{tx.id}</p>
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-1">
                              {formatDate(tx.createdAt || tx.date)} • {tx.method}
                            </p>
                         </div>
                      </div>
                      <div className="text-right shrink-0">
                         <p className="text-lg sm:text-2xl font-black font-mono text-emerald-600">{client.currency} {tx.amount.toLocaleString()}</p>
                         <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg border border-emerald-500/20 inline-block mt-1.5">
                           {tx.status || 'SETTLED'}
                         </span>
                      </div>
                   </div>
                   <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-3 items-center justify-between">
                      <div className="flex flex-wrap gap-3">
                        {tx.appointmentId && (
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Appointment</p>
                              <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">Visit #{tx.appointmentId}</p>
                           </div>
                        )}
                        {tx.receiptNumber && (
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt #</p>
                              <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">{tx.receiptNumber}</p>
                           </div>
                        )}
                        {tx.appointment?.pet && (
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Pet</p>
                              <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">{tx.appointment.pet.name}</p>
                           </div>
                        )}
                      </div>
                      {tx.appointmentId && onViewAppointment && (
                        <button
                          onClick={() => onViewAppointment(parseInt(tx.appointmentId))}
                          className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 transition-colors flex items-center gap-1"
                        >
                          View Appointment →
                        </button>
                      )}
                   </div>
                </div>
              )) : (
                 <div className="py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-[10px] tracking-[0.2em]">
                   No transactions found
                 </div>
              )}
           </div>
        )}
        {/* Rest of tabs logic mapped to existing profile views */}
      </div>

      {/* Click-outside overlay for action menus */}
      {openMenuId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}

      {/* Document Modal */}
      {docModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[800] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setDocModal(null)}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-lg w-full p-5 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                  {docModal.type === 'invoice' && '📄 Invoice'}
                  {docModal.type === 'receipt' && '🧾 Payment Receipt'}
                  {docModal.type === 'medical_record' && '📋 Medical Record'}
                  {docModal.type === 'notes' && '💬 Appointment Notes'}
                </h2>
                <p className="text-seafoam text-[9px] font-black uppercase tracking-widest mt-0.5">
                  Visit #{getVisitNumber(docModal.appt)} • {formatDate(docModal.appt.date)}
                </p>
              </div>
              <button onClick={() => setDocModal(null)} className="text-slate-400 hover:text-pine"><X size={18} /></button>
            </div>

            {(docModal.type === 'invoice' || docModal.type === 'receipt') && (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Client</p>
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{client.name}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{formatDate(docModal.appt.date)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Services</p>
                  {docModal.appt.tasks.map(task => (
                    <div key={task.id} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-xs font-bold text-pine dark:text-zinc-200">{task.name}</span>
                      <span className="text-xs font-black text-pine dark:text-zinc-200">{client.currency} {task.price?.toLocaleString() || '—'}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Total</span>
                    <span className="text-lg font-black text-seafoam">{client.currency} {docModal.appt.totalCost.toLocaleString()}</span>
                  </div>
                </div>
                {docModal.type === 'receipt' && docModal.appt.isPaid && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                    <Receipt size={14} className="text-emerald-500" />
                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">Paid via {docModal.appt.paymentMethod}</p>
                  </div>
                )}
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
                  <Printer size={14} /> Print {docModal.type === 'invoice' ? 'Invoice' : 'Receipt'}
                </button>
              </div>
            )}

            {docModal.type === 'medical_record' && (() => {
              const petForAppt = pets.find(p => p.id === docModal.appt.petId);
              const rec = petForAppt?.medicalHistory?.find(r => r.appointmentId === docModal.appt.id);
              return rec ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 space-y-3">
                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Patient</p><p className="text-sm font-bold text-pine dark:text-zinc-200">{petForAppt?.name}</p></div>
                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Diagnosis</p><p className="text-sm font-bold text-pine dark:text-zinc-200">{rec.diagnosis}</p></div>
                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Treatment</p><p className="text-sm text-slate-600 dark:text-zinc-400 italic">{rec.treatment}</p></div>
                    {rec.medications && rec.medications.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Medications</p>
                        <div className="flex flex-wrap gap-2">
                          {rec.medications.map(m => (
                            <span key={m} className="bg-seafoam/10 text-seafoam px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-seafoam/20">{m}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-center py-8 text-slate-400 font-bold text-sm">No medical record found for this appointment</p>
              );
            })()}

            {docModal.type === 'notes' && (
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 min-h-[100px]">
                  <p className="text-xs text-slate-500 dark:text-zinc-400 italic">{docModal.appt.notes || 'No notes recorded for this appointment.'}</p>
                </div>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest">Staff: {docModal.appt.assignedStaff?.name || 'Unassigned'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedApptId && onProcessPayment && (
        <div className="fixed inset-0 bg-pine/95 dark:bg-black/95 backdrop-blur-xl z-[800] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full p-5 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
              <header className="text-center mb-8">
                 <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Process Payment</h2>
                 <p className="text-seafoam text-[9px] font-black uppercase mt-1 tracking-widest">Select Payment Method</p>
              </header>
              <div className="grid grid-cols-2 gap-3">
                 {[
                   { value: 'M_PESA', label: 'M-PESA' },
                   { value: 'CARD', label: 'CARD' },
                   { value: 'CASH', label: 'CASH' },
                   { value: 'BANK_TRANSFER', label: 'BANK' }
                 ].map(method => (
                   <button
                    key={method.value}
                    onClick={() => {
                      onProcessPayment(selectedApptId, method.value);
                      setShowPaymentModal(false);
                      setSelectedApptId(null);
                    }}
                    className="flex flex-col items-center gap-3 p-6 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-2 border-slate-100 dark:border-zinc-700 hover:border-seafoam transition-all group active:scale-95"
                   >
                     <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg shadow-xs text-slate-300 group-hover:text-seafoam transition-colors"><CreditCard size={24}/></div>
                     <span className="text-[9px] font-black uppercase tracking-widest">{method.label}</span>
                   </button>
                 ))}
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedApptId(null);
                }}
                className="w-full mt-6 py-3 text-slate-400 dark:text-zinc-600 font-black text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors"
              >
                Cancel
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ClientProfileView;
