
import React, { useState } from 'react';
import { Pet, MedicalRecord, Appointment, ApptStatus, Client, Clinic, VaccinationRecord, Message } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { Heart, Activity, Calendar, Clipboard, Network, ArrowLeft, ExternalLink, ShieldCheck, BookOpen, Download, BadgeCheck, MapPin, Building2, ChevronRight, MessageSquare, Receipt, Printer, MessageCircle, Shield, Sparkles, BrainCircuit, Tag, Cpu, Info, CheckCircle2, Clock, FileText, Edit2, Save, X, Plus, TrendingUp, AlertCircle, CreditCard, Eye } from 'lucide-react';
import { formatDate, formatTime } from '../services/utils/dateFormatter';

interface Props {
  pet: Pet;
  owner?: Client;
  clinics: Clinic[];
  history: MedicalRecord[];
  appointments: Appointment[];
  transactions?: Transaction[];
  allPets: Pet[];
  onBack: () => void;
  initialTab?: string;
  onNavigatePet: (id: number) => void;
  onOpenMessaging: (client: Client) => void;
  allMessages: Message[];
  aiSummary?: string | null;
  loadingAi?: boolean;
  onGenerateAiSummary?: () => void;
  onScheduleVaccine: (petId: number) => void;
  onBookAppointment?: (petId: number, clientId: number) => void;
  onUpdatePet?: (id: number, data: Partial<Pet>) => Promise<void>;
  onProcessPayment?: (apptId: number, method: string) => void;
  onViewAppointment?: (appointmentId: number) => void;
}

const PetProfileView: React.FC<Props> = ({
  pet, owner, clinics, history, appointments, transactions = [], allPets, onBack, initialTab = 'overview',
  onNavigatePet, onOpenMessaging, allMessages, aiSummary, loadingAi, onGenerateAiSummary, onScheduleVaccine, onBookAppointment, onUpdatePet, onProcessPayment, onViewAppointment
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [vaccineTab, setVaccineTab] = useState<'timeline' | 'history'>('timeline');
  const [isEditing, setIsEditing] = useState(false);
  const [editedPet, setEditedPet] = useState<Partial<Pet>>(pet);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState<string[]>(pet.medicalNotes || []);
  const [newNote, setNewNote] = useState('');

  const petMessages = allMessages.filter(m => m.petId === pet.id);
  const allVaccines = [...(pet.vaccinations || []), ...(pet.pendingVaccines || [])].sort((a, b) =>
    new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime()
  );

  // Calculate visit number per pet based on appointment date order
  const getVisitNumber = (appointment: Appointment): number => {
    const petAppointments = appointments
      .filter(a => a.petId === appointment.petId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return petAppointments.findIndex(a => a.id === appointment.id) + 1;
  };

  // Filter transactions for this pet from appointments
  const petTransactions = transactions.filter(tx => {
    // Check if transaction is related to any appointment for this pet
    if (tx.appointmentId) {
      const relatedAppt = appointments.find(appt => appt.id === parseInt(tx.appointmentId || '0'));
      return relatedAppt !== undefined;
    }
    return false;
  });

  // Calculate statistics
  const totalVisits = appointments.length;
  const completedVisits = appointments.filter(a => a.status === ApptStatus.COMPLETED).length;
  const upcomingVisits = appointments.filter(a => a.status === ApptStatus.SCHEDULED).length;
  const totalVaccines = pet.vaccinations?.length || 0;
  const pendingVaccines = pet.pendingVaccines?.length || 0;

  const handleSave = async () => {
    if (!onUpdatePet) return;
    setIsSaving(true);
    try {
      await onUpdatePet(pet.id, editedPet);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update pet:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedPet(pet);
    setIsEditing(false);
  };

  const handleAddNote = async () => {
    if (newNote.trim() && onUpdatePet) {
      const updatedNotes = [...notes, newNote.trim()];
      setNotes(updatedNotes);
      setNewNote('');

      // Save to database
      try {
        await onUpdatePet(pet.id, { medicalNotes: updatedNotes });
      } catch (error) {
        console.error('Failed to save medical note:', error);
        // Revert on error
        setNotes(notes);
      }
    }
  };

  const handleDeleteNote = async (index: number) => {
    if (!onUpdatePet) return;

    const updatedNotes = notes.filter((_, idx) => idx !== index);
    setNotes(updatedNotes);

    // Save to database
    try {
      await onUpdatePet(pet.id, { medicalNotes: updatedNotes });
    } catch (error) {
      console.error('Failed to delete medical note:', error);
      // Revert on error
      setNotes(notes);
    }
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-2 space-y-4">
        {/* Statistics Cards - more compact */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="bg-gradient-to-br from-seafoam to-cyan rounded-lg p-3 text-white shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <Calendar size={14} className="opacity-80" />
              <span className="text-[7px] font-black uppercase tracking-wider opacity-80">Total</span>
            </div>
            <p className="text-xl font-black mb-0.5">{totalVisits}</p>
            <p className="text-[9px] font-bold opacity-80">Visits</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg p-3 text-white shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <CheckCircle2 size={14} className="opacity-80" />
              <span className="text-[7px] font-black uppercase tracking-wider opacity-80">Done</span>
            </div>
            <p className="text-xl font-black mb-0.5">{completedVisits}</p>
            <p className="text-[9px] font-bold opacity-80">Completed</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg p-3 text-white shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <Clock size={14} className="opacity-80" />
              <span className="text-[7px] font-black uppercase tracking-wider opacity-80">Next</span>
            </div>
            <p className="text-xl font-black mb-0.5">{upcomingVisits}</p>
            <p className="text-[9px] font-bold opacity-80">Upcoming</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg p-3 text-white shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <Shield size={14} className="opacity-80" />
              <span className="text-[7px] font-black uppercase tracking-wider opacity-80">Vaccines</span>
            </div>
            <p className="text-xl font-black mb-0.5">{totalVaccines}</p>
            <p className="text-[9px] font-bold opacity-80">{pendingVaccines} Pending</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <Heart className="text-seafoam" size={20} />
              <h3 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Vital Parameters</h3>
            </div>
            {onUpdatePet && (
              <button
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-seafoam/90 transition-all disabled:opacity-50"
              >
                {isEditing ? (
                  <>
                    <Save size={12} />
                    {isSaving ? 'Saving...' : 'Save'}
                  </>
                ) : (
                  <>
                    <Edit2 size={12} />
                    Edit
                  </>
                )}
              </button>
            )}
            {isEditing && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-300 dark:hover:bg-zinc-700 transition-all ml-2"
              >
                <X size={12} />
                Cancel
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Pet Name', field: 'name', val: isEditing ? editedPet.name : pet.name, editable: true },
              { label: 'Species', field: 'species', val: isEditing ? editedPet.species : pet.species, editable: false },
              { label: 'Breed', field: 'breed', val: isEditing ? editedPet.breed : pet.breed, editable: true },
              { label: 'Date of Birth', field: 'dob', val: isEditing ? editedPet.dob : pet.dob || 'Unknown', editable: true, type: 'date' },
              { label: 'Gender', field: 'gender', val: isEditing ? editedPet.gender : pet.gender || 'Unknown', editable: false },
              { label: 'Weight', field: 'weight', val: isEditing ? editedPet.weight : pet.weight, editable: true },
              { label: 'Patient ID', field: 'id', val: `#${pet.id}`, editable: false },
            ].map(v => (
              <div key={v.label}>
                <p className="text-[9px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest mb-0.5">{v.label}</p>
                {isEditing && v.editable ? (
                  <input
                    type={v.type || 'text'}
                    value={v.val || ''}
                    onChange={(e) => setEditedPet({ ...editedPet, [v.field]: e.target.value })}
                    className="w-full text-pine dark:text-zinc-100 font-black text-base leading-tight uppercase bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  />
                ) : (
                  <p className="text-pine dark:text-zinc-100 font-black text-base leading-tight uppercase">{v.val}</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-100 dark:border-zinc-800">
             <div className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-zinc-800 rounded-3xl border border-slate-100 dark:border-zinc-700">
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm text-seafoam"><Cpu size={24}/></div>
                <div className="flex-1">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">RFID Chip</p>
                   {isEditing ? (
                     <input
                       type="text"
                       value={editedPet.rfidChipNumber || ''}
                       onChange={(e) => setEditedPet({ ...editedPet, rfidChipNumber: e.target.value })}
                       placeholder="NOT_INJECTED"
                       className="w-full text-sm font-black text-pine dark:text-zinc-100 font-mono tracking-tighter bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                     />
                   ) : (
                     <p className="text-sm font-black text-pine dark:text-zinc-100 font-mono tracking-tighter">{pet.rfidChipNumber || 'NOT_INJECTED'}</p>
                   )}
                </div>
             </div>
             <div className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-zinc-800 rounded-3xl border border-slate-100 dark:border-zinc-700">
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm text-cyan"><Tag size={24}/></div>
                <div className="flex-1">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Microchip ID</p>
                   {isEditing ? (
                     <input
                       type="text"
                       value={editedPet.tagNumber || ''}
                       onChange={(e) => setEditedPet({ ...editedPet, tagNumber: e.target.value })}
                       placeholder="PENDING_REG"
                       className="w-full text-sm font-black text-pine dark:text-zinc-100 font-mono tracking-tighter bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                     />
                   ) : (
                     <p className="text-sm font-black text-pine dark:text-zinc-100 font-mono tracking-tighter">{pet.tagNumber || 'PENDING_REG'}</p>
                   )}
                </div>
             </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500/5 to-seafoam/5 border border-indigo-500/10 dark:border-indigo-500/20 rounded-xl p-6 shadow-sm space-y-6 relative overflow-hidden group">
           <div className="absolute -right-10 -top-10 text-indigo-500/10 rotate-12 group-hover:scale-110 transition-transform duration-1000"><BrainCircuit size={150} /></div>
           <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-lg"><Sparkles size={20}/></div>
                 <div>
                    <h3 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Health Intelligence</h3>
                    <p className="text-indigo-600/60 text-[8px] font-black uppercase tracking-widest">Clinical History Insights</p>
                 </div>
              </div>
              {!aiSummary && !loadingAi && (
                <button onClick={onGenerateAiSummary} className="compact-button bg-white dark:bg-zinc-800 border border-indigo-100 dark:border-zinc-700 text-indigo-600 shadow-md active:scale-95 transition-all">Generate Summary</button>
              )}
           </div>

           <div className="relative z-10 min-h-[120px]">
              {loadingAi ? (
                <div className="py-12 flex flex-col items-center gap-4 text-indigo-500">
                   <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                   <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Analyzing medical history...</p>
                </div>
              ) : aiSummary ? (
                <div className="bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm p-8 rounded-3xl border border-white/20 dark:border-zinc-800 shadow-inner animate-in fade-in duration-700">
                   <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
                   <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Engine: Gemini-3-Flash-Preview</span>
                      <button onClick={onGenerateAiSummary} className="text-[9px] font-black text-indigo-500 uppercase hover:underline">Refresh Summary</button>
                   </div>
                </div>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-indigo-100 dark:border-zinc-800 rounded-[2rem]">
                   <p className="text-slate-400 dark:text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em]">No summary available. Click above to generate.</p>
                </div>
              )}
           </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-pine rounded-xl p-6 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform duration-1000"><Heart size={60} /></div>
          <p className="text-mist/40 text-[8px] font-black uppercase tracking-[0.2em] mb-4">Subject Owner</p>
          <div className="flex items-center gap-4 mb-6">
            <img src={owner?.avatar} className="w-16 h-16 rounded-xl bg-white/20 border-2 border-white/30 shrink-0 aspect-square" alt="" />
            <div className="min-w-0">
              <p className="text-xl font-black leading-tight tracking-tight truncate uppercase">{owner?.name}</p>
              <p className="text-mist/50 text-[10px] font-bold mt-1">{owner?.phone}</p>
            </div>
          </div>
          <div className="space-y-3">
            <button onClick={() => owner && onOpenMessaging(owner)} className="w-full bg-white text-pine py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
              <MessageSquare size={16} /> Establish Channel
            </button>
            {onBookAppointment && owner && (
              <button
                onClick={() => onBookAppointment(pet.id, owner.id)}
                className="w-full bg-white text-pine py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Calendar size={16} />
                Book Appointment
              </button>
            )}
          </div>
        </div>

        {/* Internal Notes Section */}
        <div className="compact-card">
           <div className="flex items-center justify-between mb-4">
             <h4 className="card-subtitle">Medical Notes</h4>
             <FileText size={14} className="text-slate-400" />
           </div>
           <div className="space-y-3 mb-4">
              {notes.length > 0 ? notes.map((note, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 group relative">
                  <button
                    onClick={() => handleDeleteNote(idx)}
                    className="absolute top-2 right-2 p-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 dark:hover:bg-red-900/40"
                    title="Delete note"
                  >
                    <X size={12} />
                  </button>
                  <p className="text-xs text-pine dark:text-zinc-200 font-medium pr-6">{note}</p>
                  <p className="text-[8px] text-slate-400 mt-1">Medical Note</p>
                </div>
              )) : (
                <p className="text-xs text-slate-400 text-center py-4">No medical notes yet</p>
              )}
           </div>
           <div className="flex gap-2">
             <input
               type="text"
               value={newNote}
               onChange={(e) => setNewNote(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
               placeholder="Add a medical note..."
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

        {/* Health Alerts */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 shadow-sm">
           <div className="flex items-center gap-2 mb-3">
             <AlertCircle size={16} className="text-amber-600" />
             <h4 className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Health Alerts</h4>
           </div>
           <div className="space-y-2">
             {pendingVaccines > 0 && (
               <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                 <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                 <span className="font-bold">{pendingVaccines} pending vaccination{pendingVaccines > 1 ? 's' : ''}</span>
               </div>
             )}
             {upcomingVisits > 0 && (
               <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                 <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                 <span className="font-bold">{upcomingVisits} upcoming appointment{upcomingVisits > 1 ? 's' : ''}</span>
               </div>
             )}
             {pendingVaccines === 0 && upcomingVisits === 0 && (
               <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">All up to date! ✓</p>
             )}
           </div>
        </div>
      </div>
    </div>
  );

  const renderVaccines = () => (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800 self-start inline-flex">
         <button onClick={() => setVaccineTab('timeline')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${vaccineTab === 'timeline' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-xl border border-slate-200 dark:border-zinc-700' : 'text-slate-400 hover:text-pine'}`}>Immunization Timeline</button>
         <button onClick={() => setVaccineTab('history')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${vaccineTab === 'history' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-xl border border-slate-200 dark:border-zinc-700' : 'text-slate-400 hover:text-pine'}`}>Verified Passport</button>
      </div>

      {vaccineTab === 'timeline' ? (
        <div className="relative space-y-12 py-10 max-w-4xl mx-auto">
          {/* Vertical Timeline Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-slate-200 dark:bg-zinc-800 -translate-x-1/2 rounded-full"></div>
          
          <div className="space-y-16 relative">
             {allVaccines.map((vac, idx) => {
               const isEven = idx % 2 === 0;
               const isAdministered = vac.status === 'ADMINISTERED';
               return (
                 <div key={vac.id} className={`flex items-center justify-between gap-8 w-full ${isEven ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`w-1/2 flex ${isEven ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-md w-full bg-white dark:bg-zinc-900 border-2 rounded-xl p-6 shadow-lg transition-all hover:scale-105 group ${isAdministered ? 'border-emerald-500/20 hover:border-emerald-500' : 'border-indigo-500/20 hover:border-indigo-500'}`}>
                          <div className="flex items-center justify-between mb-6">
                             <div className={`p-3 rounded-2xl ${isAdministered ? 'bg-emerald-500/10 text-emerald-600' : 'bg-indigo-500/10 text-indigo-600'}`}>
                                {isAdministered ? <CheckCircle2 size={24}/> : <Clock size={24}/>}
                             </div>
                             <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${isAdministered ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'}`}>{vac.status}</span>
                          </div>
                          <h4 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-2">{vac.vaccineName}</h4>
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{isAdministered ? `Administered: ${vac.dateAdministered}` : `Target Date: ${vac.expiryDate}`}</p>
                          <div className="mt-6 pt-6 border-t border-slate-50 dark:border-zinc-800">
                             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Clinic</p>
                             <p className="text-xs font-bold text-pine dark:text-zinc-300 uppercase">{vac.clinicName}</p>
                          </div>
                       </div>
                    </div>

                    {/* Timeline Dot */}
                    <div className={`w-6 h-6 rounded-full border-4 border-slate-50 dark:border-zinc-950 z-10 transition-transform hover:scale-150 ${isAdministered ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]'}`}></div>

                    <div className="w-1/2"></div>
                 </div>
               );
             })}
          </div>

          <div className="flex justify-center pt-12">
             <button onClick={() => onScheduleVaccine(pet.id, 'Routine Booster')} className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-xl active:scale-95 transition-all">Schedule Vaccination</button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-8 shadow-xl">
           <div className="flex items-center justify-between mb-12">
              <div>
                 <h3 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Vaccination Records</h3>
                 <p className="text-seafoam text-[10px] font-black uppercase tracking-widest mt-1">Legally binding clinical history</p>
              </div>
              <button className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-300 hover:border-seafoam transition-all shadow-md active:scale-95">
                 <Printer size={16} /> Export Vaccination History
              </button>
           </div>
           
           <div className="space-y-6">
              {pet.vaccinations?.map(v => (
                <div key={v.id} className="flex items-center justify-between p-8 bg-slate-50 dark:bg-zinc-800/50 rounded-[2.25rem] border border-slate-100 dark:border-zinc-700 group hover:border-emerald-500 transition-all">
                   <div className="flex items-center gap-8">
                      <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center shadow-lg text-emerald-500 border border-slate-100 dark:border-zinc-800 group-hover:scale-110 transition-transform"><ShieldCheck size={32}/></div>
                      <div>
                         <p className="text-xl font-black text-pine dark:text-zinc-100 leading-tight uppercase tracking-tight">{v.vaccineName}</p>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Batch: {v.batchNumber || 'NOT_TRACKED'}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-black text-pine dark:text-zinc-200 uppercase mb-1">Administered: {v.dateAdministered}</p>
                      <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-lg border border-emerald-500/20 uppercase tracking-widest">System Verified</span>
                   </div>
                </div>
              ))}
              {pet.vaccinations?.length === 0 && <div className="py-32 text-center opacity-20 font-black uppercase tracking-[0.3em] text-sm">No Records Found</div>}
           </div>
        </div>
      )}
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
              <div className="w-20 h-20 rounded-2xl bg-seafoam border-[4px] border-white dark:border-zinc-950 flex items-center justify-center text-4xl shadow-xl shrink-0 aspect-square uppercase">
                {pet.species === 'Dog' ? '🐶' : '🐱'}
              </div>
              <div className="min-w-0">
                <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-1 uppercase truncate">{pet.name}</h1>
                <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 truncate">
                   Pet Profile
                   <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 shrink-0"></span>
                   ID: {pet.id}
                </p>
              </div>
           </div>
        </div>

        <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-x-auto no-scrollbar scroll-smooth">
            {[
              { id: 'overview', label: 'Overview', icon: Heart },
              { id: 'vaccines', label: 'Immunization', icon: ShieldCheck },
              { id: 'appointments', label: 'Appointments', icon: Calendar },
              { id: 'visits', label: 'Visit History', icon: Clipboard },
              { id: 'transactions', label: 'Transactions', icon: Receipt },
              { id: 'outreach', label: 'Outreach Log', icon: MessageCircle },
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
        {activeTab === 'vaccines' && renderVaccines()}
        {activeTab === 'appointments' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              {appointments.length > 0 ? appointments.map(appt => {
                const categoriesCount = new Set(appt.tasks.map(t => t.category)).size;
                const servicesCount = appt.tasks.length;
                return (
                <div key={appt.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm hover:border-seafoam transition-all group">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-2xl shrink-0 aspect-square">📅</div>
                         <div>
                            <div className="flex items-center gap-2">
                              <p className="text-pine dark:text-zinc-100 font-black text-base uppercase">Visit #{getVisitNumber(appt)}</p>
                              {appt.parentAppointmentId && (
                                <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                  Follow-up
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-1">{formatDate(appt.date)} • {appt.time}</p>
                         </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-lg ${
                          appt.status === ApptStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          appt.status === ApptStatus.IN_PROGRESS ? 'bg-cyan/10 text-cyan border border-cyan/20' :
                          'bg-slate-100 dark:bg-zinc-800 text-slate-500 border border-slate-200 dark:border-zinc-700'
                        }`}>{appt.status}</span>
                        {owner && <p className="text-lg font-black font-mono text-pine dark:text-zinc-200">{owner.currency} {appt.totalCost.toLocaleString()}</p>}
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
                      {appt.assignedStaff && (
                         <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Staff</p>
                            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">{appt.assignedStaff.name}</p>
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
                 <div className="py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-[10px] tracking-[0.2em]">
                   No appointments found
                 </div>
              )}
           </div>
        )}
        {activeTab === 'transactions' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              {petTransactions.length > 0 ? petTransactions.map((tx: any) => (
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
                         <p className="text-2xl font-black font-mono text-emerald-600">{owner?.currency || 'KES'} {tx.amount.toLocaleString()}</p>
                         <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg border border-emerald-500/20 inline-block mt-2">
                           {tx.status || 'SETTLED'}
                         </span>
                      </div>
                   </div>
                   <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-2 gap-4">
                      {tx.appointmentId && (() => {
                        const appt = appointments.find(a => a.id === parseInt(tx.appointmentId || '0'));
                        return (
                         <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Associated Appointment</p>
                            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">Visit #{appt ? getVisitNumber(appt) : tx.appointmentId}</p>
                         </div>
                        );
                      })()}
                      {tx.receiptNumber && (
                         <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt Number</p>
                            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">{tx.receiptNumber}</p>
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
        {activeTab === 'visits' && (
           <div className="space-y-6 animate-in slide-in-from-bottom-4">
              {history.length > 0 ? history.map(rec => (
                <div key={rec.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-12 shadow-sm space-y-8 relative group overflow-hidden">
                   {rec.originReferralId && <div className="absolute top-0 right-0 p-4"><span className="bg-indigo-500 text-white text-[7px] font-black px-2 py-1 rounded-full uppercase tracking-widest">B2B Case</span></div>}
                   <div className="flex justify-between items-start border-b border-slate-50 dark:border-zinc-800 pb-8">
                      <div>
                        <p className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{rec.diagnosis}</p>
                        <p className="text-seafoam text-[10px] font-black uppercase tracking-widest mt-1.5">{rec.date} • Clinic: {rec.clinicName}</p>
                      </div>
                      <button className="p-3.5 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-slate-400 hover:text-seafoam transition-all"><Download size={20}/></button>
                   </div>
                   <div className="space-y-6">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinical Notes</p>
                      <p className="text-base font-medium text-slate-700 dark:text-zinc-300 leading-relaxed italic">{rec.treatment}</p>
                   </div>
                   {rec.medications && (
                     <div className="flex flex-wrap gap-2.5 pt-6 border-t border-slate-50 dark:border-zinc-800">
                       {rec.medications.map(m => (
                         <span key={m} className="bg-seafoam/10 text-seafoam px-4 py-2 rounded-2xl text-[9px] font-black uppercase border border-seafoam/20">{m}</span>
                       ))}
                     </div>
                   )}
                </div>
              )) : (
                <div className="py-40 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-sm tracking-[0.4em]">No Medical Records Found</div>
              )}
           </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedApptId && onProcessPayment && (
        <div className="fixed inset-0 bg-pine/95 dark:bg-black/95 backdrop-blur-xl z-[800] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full p-6 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
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

export default PetProfileView;
