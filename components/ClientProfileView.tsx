
import React, { useState } from 'react';
import { Client, Pet, Appointment, ApptStatus, Message, FULL_ACCESS_ROLES, UserRole } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { Mail, Phone, MapPin, CreditCard, PawPrint, Calendar, ArrowLeft, ChevronRight, MessageSquare, Activity, MessageCircle, FileText, Receipt, Edit2, Save, X, Plus, TrendingUp, Clock, Printer, Eye } from 'lucide-react';
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
}

const ClientProfileView: React.FC<Props> = ({ client, pets, transactions, appointments, onBack, initialTab = 'overview', onViewPet, onOpenMessaging, allMessages, onUpdateClient, onProcessPayment, onViewAppointment, onScheduleAppointment }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedClient, setEditedClient] = useState<Partial<Client>>(client);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState<string[]>([
    'Client prefers morning appointments',
    'Allergic to certain medications - check records',
  ]);
  const [newNote, setNewNote] = useState('');

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
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-seafoam to-cyan rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Calendar size={20} className="opacity-80" />
              <span className="text-xs font-black uppercase tracking-wider opacity-80">Total</span>
            </div>
            <p className="text-3xl font-black mb-1">{totalAppointments}</p>
            <p className="text-xs font-bold opacity-80">Appointments</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp size={20} className="opacity-80" />
              <span className="text-xs font-black uppercase tracking-wider opacity-80">Avg</span>
            </div>
            <p className="text-3xl font-black mb-1">{client.currency} {averageSpendPerVisit.toFixed(0)}</p>
            <p className="text-xs font-bold opacity-80">Per Visit</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Clock size={20} className="opacity-80" />
              <span className="text-xs font-black uppercase tracking-wider opacity-80">Upcoming</span>
            </div>
            <p className="text-3xl font-black mb-1">{upcomingAppointments}</p>
            <p className="text-xs font-bold opacity-80">Scheduled</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-xl">
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
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-xl">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <PawPrint className="text-cyan" size={20} />
                 <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Registered Pets</h3>
              </div>
              <span className="text-[9px] font-black bg-cyan/10 text-cyan px-2.5 py-1 rounded-lg uppercase tracking-widest">{pets.length} Patients</span>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pets.map(pet => (
                <div key={pet.id} onClick={() => onViewPet(pet.id)} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded-2xl hover:border-seafoam transition-all cursor-pointer group">
                   <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shrink-0 aspect-square">{pet.species === 'Dog' ? '🐶' : '🐱'}</div>
                   <div className="min-w-0 flex-1">
                      <p className="text-pine dark:text-zinc-100 font-black text-sm truncate uppercase">{pet.name}</p>
                      <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase tracking-widest">{pet.breed}</p>
                   </div>
                   <ChevronRight size={14} className="ml-auto text-slate-200 group-hover:text-seafoam" />
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-pine rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
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
        
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm">
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
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm">
           <div className="flex items-center justify-between mb-6">
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
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-6">
           <button onClick={onBack} className="w-12 h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-seafoam transition-all shadow-lg active:scale-95">
             <ArrowLeft size={20}/>
           </button>
           <div className="flex items-center gap-6">
              <img src={client.avatar} className="w-20 h-20 rounded-2xl border-[4px] border-white dark:border-zinc-950 shadow-xl shrink-0 aspect-square" alt="" />
              <div className="min-w-0">
                <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-1 uppercase truncate">{client.name}</h1>
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
             { id: 'outreach', label: 'Outreach', icon: MessageCircle },
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
                 <div className="col-span-full py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-[10px] tracking-[0.2em]">No patients registered</div>
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
                <div key={appt.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm hover:border-seafoam transition-all group">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-2xl shrink-0 aspect-square">
                           {pet?.species === 'Dog' ? '🐶' : '🐱'}
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                              <p className="text-pine dark:text-zinc-100 font-black text-base uppercase">{pet?.name || 'Unknown Pet'}</p>
                              {appt.parentAppointmentId && (
                                <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                  Follow-up
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-1">Visit #{getVisitNumber(appt)} • {formatDate(appt.date)}</p>
                         </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-lg ${
                          appt.status === ApptStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          appt.status === ApptStatus.IN_PROGRESS ? 'bg-cyan/10 text-cyan border border-cyan/20' :
                          'bg-slate-100 dark:bg-zinc-800 text-slate-500 border border-slate-200 dark:border-zinc-700'
                        }`}>{appt.status}</span>
                        <p className="text-lg font-black font-mono text-pine dark:text-zinc-200">{client.currency} {appt.totalCost.toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Categories</p>
                            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">{categoriesCount} {categoriesCount === 1 ? 'Category' : 'Categories'}</p>
                         </div>
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Services</p>
                            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">{servicesCount} {servicesCount === 1 ? 'Service' : 'Services'}</p>
                         </div>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Services/Tasks</p>
                         <div className="flex flex-wrap gap-2">
                            {appt.tasks.slice(0, 5).map(task => (
                              <span key={task.id} className="text-[8px] font-black uppercase bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-1 rounded-lg">
                                {task.name}
                              </span>
                            ))}
                            {appt.tasks.length > 5 && (
                              <span className="text-[8px] font-black uppercase bg-slate-50 dark:bg-zinc-800 text-slate-500 px-2 py-1 rounded-lg">+{appt.tasks.length - 5} more</span>
                            )}
                         </div>
                      </div>
                      {(appt as any).assignedStaff && (
                         <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Staff</p>
                            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">{(appt as any).assignedStaff.name}</p>
                         </div>
                      )}
                      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                         <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment Status</p>
                            <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${
                              appt.isPaid
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}>
                              {appt.isPaid ? `PAID: ${appt.paymentMethod}` : 'UNPAID'}
                            </span>
                         </div>
                         {!appt.isPaid && onProcessPayment && (
                            <button
                              onClick={() => {
                                setSelectedApptId(appt.id);
                                setShowPaymentModal(true);
                              }}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 shadow-sm flex items-center gap-2"
                            >
                              <CreditCard size={14} />
                              Process Payment
                            </button>
                         )}
                      </div>
                      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Documents & Records</p>
                         <div className="flex flex-wrap gap-2">
                            <button className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800 hover:bg-seafoam/10 dark:hover:bg-seafoam/10 text-slate-600 dark:text-zinc-400 hover:text-seafoam px-3 py-2 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all border border-slate-200 dark:border-zinc-700 hover:border-seafoam/30">
                              <Printer size={12} />
                              Invoice
                            </button>
                            {appt.isPaid && (
                              <button className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 py-2 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400">
                                <Receipt size={12} />
                                Receipt
                              </button>
                            )}
                            {appt.status === ApptStatus.COMPLETED && (
                              <button className="flex items-center gap-1.5 bg-cyan/10 hover:bg-cyan/20 text-cyan px-3 py-2 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all border border-cyan/20 hover:border-cyan/40">
                                <FileText size={12} />
                                Medical Record
                              </button>
                            )}
                            <button className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-slate-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 px-3 py-2 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all border border-slate-200 dark:border-zinc-700 hover:border-purple-300">
                              <MessageSquare size={12} />
                              Notes
                            </button>
                         </div>
                      </div>
                      {onViewAppointment && (
                        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                          <button
                            onClick={() => onViewAppointment(appt.id)}
                            className="flex items-center gap-2 bg-seafoam/10 hover:bg-seafoam text-seafoam hover:text-white px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 shadow-sm border border-seafoam/20 hover:border-seafoam hover:shadow-lg hover:shadow-seafoam/20"
                          >
                            <Eye size={14} />
                            View Appointment
                          </button>
                        </div>
                      )}
                   </div>
                </div>
              )}) : (
                 <div className="py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-[10px] tracking-[0.2em]">No appointments scheduled</div>
              )}
           </div>
        )}
        {activeTab === 'outreach' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              {clientMessages.length > 0 ? clientMessages.map(m => (
                 <div key={m.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm group hover:border-seafoam transition-all">
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
                 <div className="py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-[10px] tracking-[0.2em]">Zero outreach logs</div>
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
                  <div key={record.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm hover:border-seafoam transition-all">
                     <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-2xl shrink-0 aspect-square">
                             {record.petSpecies === 'Dog' ? '🐶' : '🐱'}
                           </div>
                           <div>
                              <p className="text-pine dark:text-zinc-100 font-black text-base uppercase">{record.petName}</p>
                              <p className="text-slate-400 text-[9px] font-black uppercase mt-1">
                                {formatDate(record.date)} • Record #{record.id}
                              </p>
                           </div>
                        </div>
                        <span className="text-[8px] font-black uppercase bg-seafoam/10 text-seafoam px-3 py-1.5 rounded-lg border border-seafoam/20">
                          Medical Record
                        </span>
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
                <div key={tx.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm hover:border-seafoam transition-all">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 aspect-square">
                            <Receipt size={20} className="text-emerald-500" />
                         </div>
                         <div>
                            <p className="text-pine dark:text-zinc-100 font-black text-base uppercase">Transaction #{tx.id}</p>
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-1">
                              {formatDate(tx.createdAt || tx.date)} • {tx.method}
                            </p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-2xl font-black font-mono text-emerald-600">{client.currency} {tx.amount.toLocaleString()}</p>
                         <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg border border-emerald-500/20 inline-block mt-2">
                           {tx.status || 'SETTLED'}
                         </span>
                      </div>
                   </div>
                   <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-2 gap-4">
                      {tx.appointmentId && (
                         <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Associated Appointment</p>
                            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">Visit #{tx.appointmentId}</p>
                         </div>
                      )}
                      {tx.receiptNumber && (
                         <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt Number</p>
                            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">{tx.receiptNumber}</p>
                         </div>
                      )}
                      {tx.appointment?.pet && (
                         <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Pet</p>
                            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">{tx.appointment.pet.name}</p>
                         </div>
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

      {/* Payment Modal */}
      {showPaymentModal && selectedApptId && onProcessPayment && (
        <div className="fixed inset-0 bg-pine/95 dark:bg-black/95 backdrop-blur-xl z-[800] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200">
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
