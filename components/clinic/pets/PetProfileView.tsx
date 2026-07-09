
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { Pet, Visit, ApptStatus, Client, Clinic, Message } from '../../../types';
import VaccinePassportModal from './VaccinePassportModal';
import ClinicalSnapshotPanel from './ClinicalSnapshotPanel';
import PatientTimeline from './PatientTimeline';
import AppointmentCreateModal from '../appointments/AppointmentCreateModal';
import ReminderCreateModal from '../reminders/ReminderCreateModal';
import { petsAPI, PetSnapshot, PetTimelineEntry } from '../../../services/modules/pets.api';
import { clientsAPI } from '../../../services';
import { toast } from '../../../services/utils/toast';
import { remindersAPI, appointmentsAPI } from '../../../services';
import type { Reminder, Appointment } from '../../../services';
import { Transaction } from '../../../services/modules/transactions.api';
import { Heart, Activity, Calendar, CalendarPlus, Clipboard, Network, ArrowLeft, ExternalLink, ShieldCheck, BookOpen, Download, BadgeCheck, MapPin, Building2, ChevronRight, ChevronDown, Play, MessageSquare, Receipt, Printer, MessageCircle, BellPlus, Shield, Sparkles, BrainCircuit, Tag, Cpu, Info, CheckCircle2, Clock, FileText, Edit2, Save, X, Plus, TrendingUp, AlertCircle, CreditCard, Eye, MoreVertical, Smile } from 'lucide-react';
import { formatDate, formatTime } from '../../../services/utils/dateFormatter';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';

const BEHAVIOUR_TRAITS = ['Calm', 'Very happy', 'Likes petting', 'Well trained', 'Good with kids', 'Food motivated', 'Playful', 'Nervous', 'Anxious at vet', 'Aggressive', 'May bite', 'Hates nail trims', 'Vocal'];

interface Props {
  pet: Pet;
  owner?: Client;
  activeClinic?: Clinic;
  clinics: Clinic[];
  appointments: Visit[];
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
  onViewOwner?: (clientId: number) => void;
}

const PetProfileView: React.FC<Props> = ({
  pet, owner, activeClinic, clinics, appointments, transactions = [], allPets, onBack, initialTab = 'overview',
  onNavigatePet, onOpenMessaging, allMessages, aiSummary, loadingAi, onGenerateAiSummary, onScheduleVaccine, onBookAppointment, onUpdatePet, onProcessPayment, onViewAppointment, onViewOwner
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<number | null>(null);
  // Records restructure (077): conditional Medical / Grooming / Boarding
  // record tabs. Legacy tab ids map in: 'appointments'/'visits' → 'medical';
  // 'vaccines' → 'medical' with the Vaccinations sub-tab (vaccination lives
  // under Medical Record now).
  const [activeTab, setActiveTab] = useState(
    initialTab === 'appointments' || initialTab === 'visits' ? 'medical'
    : initialTab === 'vaccines' ? 'medical'
    : initialTab
  );
  const [vaccineTab, setVaccineTab] = useState<'timeline' | 'history'>('timeline');
  // Medical Record sub-tabs: all visits · clinical records · vaccinations.
  const [visitSubTab, setVisitSubTab] = useState<'all' | 'history' | 'vaccinations'>(initialTab === 'vaccines' ? 'vaccinations' : 'all');

  // Classify every visit into its workflow record(s). A multi-workflow visit
  // (e.g. a vet visit transferred into grooming) appears under EACH matching
  // tab — records are per-workflow, the client/patient rollup stays whole.
  const lcCat = (s?: string) => (s || '').toLowerCase();
  const isGroomingVisit = useCallback((a: Visit) =>
    a.encounterType === 'GROOMING' || (a.tasks || []).some(t => lcCat(t.category).includes('groom')), []);
  const isBoardingVisit = useCallback((a: Visit) =>
    a.encounterType === 'BOARDING' || !!a.boardingStayId || (a.tasks || []).some(t => lcCat(t.category).includes('board')), []);
  const isMedicalVisit = useCallback((a: Visit) =>
    a.encounterType === 'VET_VISIT' || a.encounterType === 'VACCINATION' || !!a.hospitalizationId
    || (a.tasks || []).some(t => !lcCat(t.category).includes('groom') && !lcCat(t.category).includes('board')), []);
  const medicalVisits = useMemo(() => appointments.filter(isMedicalVisit), [appointments, isMedicalVisit]);
  const groomingVisits = useMemo(() => appointments.filter(isGroomingVisit), [appointments, isGroomingVisit]);
  const boardingVisits = useMemo(() => appointments.filter(isBoardingVisit), [appointments, isBoardingVisit]);

  // Boarding stays for this patient — feeds the Boarding Record tab (kennel,
  // belongings log, feeding schedule, daily logs) + the printable report.
  const [petStays, setPetStays] = useState<any[]>([]);
  const [reportStay, setReportStay] = useState<any | null>(null);
  const [groomingReportVisit, setGroomingReportVisit] = useState<Visit | null>(null);
  useEffect(() => {
    let alive = true;
    if (boardingVisits.length === 0) { setPetStays([]); return; }
    import('../../../services').then(({ boardingAPI }) =>
      boardingAPI.list('all').then(res => {
        if (alive && res.success && res.data?.stays) {
          setPetStays(res.data.stays.filter((s: any) => String(s.petId) === String(pet.id)));
        }
      })
    ).catch(() => { /* non-fatal — tab shows visits only */ });
    return () => { alive = false; };
  }, [pet.id, boardingVisits.length]);
  // Create-from-overview modals.
  const [showCreateAppt, setShowCreateAppt] = useState(false);
  const [showCreateReminder, setShowCreateReminder] = useState(false);
  // Reminder being edited from the timeline (null = not editing).
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  // Orphaned-owner reassignment (shown when the pet has no linked owner).
  const [reassignQuery, setReassignQuery] = useState('');
  const [reassignResults, setReassignResults] = useState<{ id: number; name: string; phone?: string }[]>([]);
  const [reassigning, setReassigning] = useState(false);
  useEffect(() => {
    if (owner || reassignQuery.trim().length < 2) { setReassignResults([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await clientsAPI.getAll({ page: 1, limit: 8, search: reassignQuery.trim() }, { cache: false });
        if (alive && res.success && res.data?.clients) {
          setReassignResults(res.data.clients.map((c: any) => ({ id: typeof c.id === 'string' ? parseInt(c.id) : c.id, name: c.name, phone: c.phone })));
        }
      } catch { /* ignore */ }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [reassignQuery, owner]);
  const reassignOwner = async (clientId: number) => {
    setReassigning(true);
    try {
      const res = await petsAPI.reassign(pet.id, clientId);
      if (res.success) { toast.success('Owner reassigned'); onNavigatePet(pet.id); }
    } catch (e: any) { toast.error(e?.message || 'Failed to reassign'); }
    finally { setReassigning(false); }
  };
  const [isEditing, setIsEditing] = useState(false);
  const [editedPet, setEditedPet] = useState<Partial<Pet>>(pet);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState<string[]>(pet.medicalNotes || []);

  // Clinical Snapshot + Patient Timeline — non-blocking enhancements. If either
  // fetch fails the panel simply hides; the rest of the profile is unaffected.
  const [snapshot, setSnapshot] = useState<PetSnapshot | null>(null);
  const [timeline, setTimeline] = useState<PetTimelineEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [bookings, setBookings] = useState<Appointment[]>([]);
  const [loadingClinical, setLoadingClinical] = useState(false);

  // Loads everything the timeline/overview needs: snapshot, timeline entries,
  // and the pet's reminders + appointment bookings. Re-callable after a create.
  const loadClinical = useCallback(async () => {
    setLoadingClinical(true);
    try {
      const [snapRes, tlRes, remRes, apptRes] = await Promise.all([
        petsAPI.getSnapshot(pet.id),
        petsAPI.getTimeline(pet.id),
        remindersAPI.list({ petId: pet.id }),
        appointmentsAPI.list({ petId: pet.id }),
      ]);
      if (snapRes.success && snapRes.data?.snapshot) setSnapshot(snapRes.data.snapshot);
      if (tlRes.success && tlRes.data?.timeline) setTimeline(tlRes.data.timeline.entries || []);
      if (remRes.success && remRes.data?.reminders) setReminders(remRes.data.reminders);
      if (apptRes.success && apptRes.data?.appointments) setBookings(apptRes.data.appointments);
    } catch (err) {
      console.error('Failed to load clinical snapshot/timeline:', err);
    } finally {
      setLoadingClinical(false);
    }
  }, [pet.id]);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setTimeline([]);
    setReminders([]);
    setBookings([]);
    if (!cancelled) loadClinical();
    return () => { cancelled = true; };
  }, [pet.id, loadClinical]);

  const handleDeleteReminder = useCallback(async (r: Reminder) => {
    if (!window.confirm('Delete this reminder? This cannot be undone.')) return;
    const res = await remindersAPI.remove(r.id);
    if (res.success) loadClinical();
  }, [loadClinical]);

  // Visit lookup for the timeline so visit cards can show categories + services.
  const visitsById = useMemo(() => {
    const map: Record<string, Visit> = {};
    for (const a of appointments) map[String(a.id)] = a;
    return map;
  }, [appointments]);
  const [newNote, setNewNote] = useState('');
  const [docModal, setDocModal] = useState<{ type: 'invoice' | 'receipt' | 'medical_record' | 'notes'; appt: Visit } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [likes, setLikes] = useState<string[]>(pet.likes || []);
  const [dislikes, setDislikes] = useState<string[]>(pet.dislikes || []);
  const [prefs, setPrefs] = useState<string[]>(pet.preferences || []);
  const [newPrefInput, setNewPrefInput] = useState<{ category: 'likes' | 'dislikes' | 'prefs'; value: string } | null>(null);
  const [behaviour, setBehaviour] = useState<string[]>(pet.behaviourTraits || []);
  const [behaviourDraft, setBehaviourDraft] = useState('');
  const [showPassport, setShowPassport] = useState(false);
  const [showUpcomingDropdown, setShowUpcomingDropdown] = useState(false);

  const { species: apiSpecies, getBreedsBySpecies } = useReferenceData();

  const speciesOptions = useMemo(() => apiSpecies.map(s => s.name), [apiSpecies]);

  const breedOptions = useMemo(() => {
    const selectedSpecies = apiSpecies.find(s => s.name === (editedPet.species ?? pet.species));
    if (!selectedSpecies) return ['Mixed Breed'];
    const breeds = getBreedsBySpecies(selectedSpecies.id).map(b => b.name);
    return breeds.length > 0 ? breeds : ['Mixed Breed'];
  }, [apiSpecies, editedPet.species, pet.species, getBreedsBySpecies]);

  const petMessages = allMessages.filter(m => m.petId === pet.id);

  // Calculate visit number per pet based on appointment date order
  const getVisitNumber = (appointment: Visit): number => {
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
  const scheduledAppointments = appointments
    .filter(a => a.status === ApptStatus.SCHEDULED)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

    try {
      await onUpdatePet(pet.id, { medicalNotes: updatedNotes });
    } catch (error) {
      console.error('Failed to delete medical note:', error);
      setNotes(notes);
    }
  };

  const handleAddPref = async (category: 'likes' | 'dislikes' | 'prefs', value: string) => {
    if (!value.trim() || !onUpdatePet) return;
    const setters = { likes: setLikes, dislikes: setDislikes, prefs: setPrefs };
    const getters = { likes, dislikes, prefs };
    const updated = [...getters[category], value.trim()];
    setters[category](updated);
    setNewPrefInput(null);
    try {
      await onUpdatePet(pet.id, { [category]: updated } as any);
    } catch (error) {
      setters[category](getters[category]);
    }
  };

  const handleDeletePref = async (category: 'likes' | 'dislikes' | 'prefs', index: number) => {
    if (!onUpdatePet) return;
    const setters = { likes: setLikes, dislikes: setDislikes, prefs: setPrefs };
    const getters = { likes, dislikes, prefs };
    const updated = getters[category].filter((_, i) => i !== index);
    setters[category](updated);
    try {
      await onUpdatePet(pet.id, { [category]: updated } as any);
    } catch (error) {
      setters[category](getters[category]);
    }
  };

  const saveBehaviour = async (next: string[]) => {
    if (!onUpdatePet) return;
    const prev = behaviour;
    setBehaviour(next);
    try {
      await onUpdatePet(pet.id, { behaviourTraits: next } as any);
    } catch (error) {
      setBehaviour(prev);
    }
  };
  const toggleBehaviour = (t: string) => saveBehaviour(behaviour.includes(t) ? behaviour.filter(x => x !== t) : [...behaviour, t]);

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-2 space-y-6">
        {/* Clinical Snapshot — the patient-header panel a vet sees first. */}
        {(snapshot || loadingClinical) && (
          <ClinicalSnapshotPanel snapshot={snapshot} loading={loadingClinical} />
        )}
        {/* Combined Stats Card */}
        <div data-tour="pet-stats" className="flex gap-3">
          {/* Visits — 3 cols */}
          <div className="w-[60%] shrink-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-zinc-800 h-full">
              <div className="p-2 sm:p-3 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="p-1.5 bg-seafoam/10 rounded-lg"><Calendar size={12} className="text-seafoam" /></div>
                </div>
                <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{totalVisits}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
              </div>
              <div className="p-2 sm:p-3 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg"><CheckCircle2 size={12} className="text-emerald-500" /></div>
                </div>
                <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{completedVisits}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Done</p>
              </div>
              <div className="p-2 sm:p-3 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="p-1.5 bg-amber-500/10 rounded-lg"><Clock size={12} className="text-amber-500" /></div>
                </div>
                <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{upcomingVisits}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Upcoming</p>
              </div>
            </div>
          </div>
          {/* Vaccines — own card */}
          <div data-tour="pet-vaccines" className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden p-2 sm:p-3 flex flex-col items-center justify-center text-center">
            <div className="p-1.5 bg-purple-500/10 rounded-lg mb-1.5"><Shield size={12} className="text-purple-500" /></div>
            <p className="text-xl font-black text-pine dark:text-zinc-100 leading-none mb-0.5">{totalVaccines}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{pendingVaccines > 0 ? `${pendingVaccines} Due` : 'Vaccines'}</p>
          </div>
        </div>
        {/* Upcoming Visit Quick-Access */}
        {scheduledAppointments.length > 0 && onViewAppointment && (
          <div data-tour="pet-upcoming" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
            <div className="px-3 py-2 bg-amber-50/50 dark:bg-amber-900/10">
              {scheduledAppointments.length === 1 ? (
                <button
                  onClick={() => onViewAppointment(scheduledAppointments[0].id)}
                  className="w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-amber-500/20 rounded-md"><Play size={10} className="text-amber-600 dark:text-amber-400" /></div>
                    <div className="text-left">
                      <p className="text-[8px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">Scheduled — {formatDate(scheduledAppointments[0].date)}</p>
                    </div>
                  </div>
                  <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">Go to Workflow →</span>
                </button>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setShowUpcomingDropdown(!showUpcomingDropdown)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-amber-500/20 rounded-md"><Calendar size={10} className="text-amber-600 dark:text-amber-400" /></div>
                      <span className="text-[8px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">{scheduledAppointments.length} Upcoming — Select Workflow</span>
                    </div>
                    <ChevronDown size={12} className={`text-amber-500 transition-transform duration-200 ${showUpcomingDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showUpcomingDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl z-20 overflow-hidden">
                      {scheduledAppointments.map(appt => (
                        <button
                          key={appt.id}
                          onClick={() => { onViewAppointment(appt.id); setShowUpcomingDropdown(false); }}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all border-b last:border-b-0 border-slate-100 dark:border-zinc-800"
                        >
                          <div className="flex items-center gap-2">
                            <Play size={10} className="text-amber-500 shrink-0" />
                            <div className="text-left">
                              <p className="text-[9px] font-black text-pine dark:text-zinc-100 uppercase">{formatDate(appt.date)}</p>
                              <p className="text-[8px] text-slate-400">{formatTime(appt.date)}</p>
                            </div>
                          </div>
                          <span className="text-[8px] font-black text-amber-500 uppercase tracking-wider">Workflow →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div data-tour="pet-details" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <Heart className="text-seafoam" size={20} />
              <h3 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Patient Details</h3>
            </div>
            {onUpdatePet && (
              <button
                data-tour="pet-edit"
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
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Patient Name', field: 'name', val: isEditing ? editedPet.name : pet.name, editable: true, type: 'text' },
              { label: 'Species', field: 'species', val: isEditing ? editedPet.species : pet.species, editable: true, type: 'select', options: speciesOptions },
              { label: 'Breed', field: 'breed', val: isEditing ? editedPet.breed : pet.breed, editable: true, type: 'select', options: breedOptions },
              { label: 'Date of Birth', field: 'dob', val: isEditing ? (editedPet.dob ? String(editedPet.dob).split('T')[0] : '') : pet.dob ? formatDate(pet.dob) : 'Unknown', editable: true, type: 'date' },
              { label: 'Sex', field: 'gender', val: isEditing ? editedPet.gender : pet.gender || 'Unknown', editable: false, type: 'text' },
              { label: 'Body Weight', field: 'weight', val: isEditing ? editedPet.weight : pet.weight, editable: true, type: 'text' },
              { label: 'Patient ID', field: 'id', val: `#${pet.id}`, editable: false, type: 'text' },
            ].map(v => (
              <div key={v.label}>
                <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">{v.label}</p>
                {isEditing && v.editable ? (
                  v.type === 'select' ? (
                    <select
                      value={v.val || ''}
                      onChange={(e) => {
                        const update: Partial<typeof editedPet> = { [v.field]: e.target.value };
                        // Reset breed when species changes
                        if (v.field === 'species') update.breed = '';
                        setEditedPet({ ...editedPet, ...update });
                      }}
                      className="w-full text-pine dark:text-zinc-100 font-semibold text-sm leading-tight bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                    >
                      {v.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={v.type}
                      value={v.val || ''}
                      onChange={(e) => setEditedPet({ ...editedPet, [v.field]: e.target.value })}
                      className="w-full text-pine dark:text-zinc-100 font-semibold text-sm leading-tight bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                    />
                  )
                ) : (
                  <p className="text-pine dark:text-zinc-100 font-semibold text-sm leading-tight">{v.val}</p>
                )}
              </div>
            ))}
            {(() => {
              const currentAlive = isEditing ? (editedPet.isAlive ?? true) : (pet.isAlive ?? true);
              const currentDod = isEditing ? editedPet.dateOfDeath : pet.dateOfDeath;
              return (
                <>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Status</p>
                    {isEditing ? (
                      <select
                        value={currentAlive ? 'alive' : 'deceased'}
                        onChange={(e) => {
                          const alive = e.target.value === 'alive';
                          setEditedPet({
                            ...editedPet,
                            isAlive: alive,
                            dateOfDeath: alive ? null : (editedPet.dateOfDeath ?? new Date().toISOString().split('T')[0]),
                          });
                        }}
                        className="w-full text-pine dark:text-zinc-100 font-semibold text-sm leading-tight bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                      >
                        <option value="alive">Alive</option>
                        <option value="deceased">Deceased</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm font-semibold leading-tight ${currentAlive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${currentAlive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        {currentAlive ? 'Alive' : 'Deceased'}
                      </span>
                    )}
                  </div>
                  {!currentAlive && (
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Date of Death</p>
                      {isEditing ? (
                        <input
                          type="date"
                          value={currentDod ? String(currentDod).split('T')[0] : ''}
                          onChange={(e) => setEditedPet({ ...editedPet, dateOfDeath: e.target.value || null })}
                          className="w-full text-pine dark:text-zinc-100 font-semibold text-sm leading-tight bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                        />
                      ) : (
                        <p className="text-pine dark:text-zinc-100 font-semibold text-sm leading-tight">{currentDod ? formatDate(currentDod) : '—'}</p>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 pt-4 sm:pt-8 border-t border-slate-100 dark:border-zinc-800">
             <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-slate-50 dark:bg-zinc-800 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-zinc-700">
                <div className="p-2 sm:p-3 bg-white dark:bg-zinc-900 rounded-xl sm:rounded-2xl shadow-sm text-seafoam shrink-0"><Cpu size={20}/></div>
                <div className="flex-1">
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Implant No.</p>
                   {isEditing ? (
                     <input
                       type="text"
                       value={editedPet.rfidChipNumber || ''}
                       onChange={(e) => setEditedPet({ ...editedPet, rfidChipNumber: e.target.value })}
                       placeholder="Not implanted"
                       className="w-full text-sm font-medium text-pine dark:text-zinc-100 font-mono tracking-tight bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                     />
                   ) : (
                     <p className="text-sm font-medium text-pine dark:text-zinc-100 font-mono tracking-tight">{pet.rfidChipNumber || 'Not implanted'}</p>
                   )}
                </div>
             </div>
             <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-slate-50 dark:bg-zinc-800 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-zinc-700">
                <div className="p-2 sm:p-3 bg-white dark:bg-zinc-900 rounded-xl sm:rounded-2xl shadow-sm text-cyan shrink-0"><Tag size={20}/></div>
                <div className="flex-1">
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registry Tag No.</p>
                   {isEditing ? (
                     <input
                       type="text"
                       value={editedPet.tagNumber || ''}
                       onChange={(e) => setEditedPet({ ...editedPet, tagNumber: e.target.value })}
                       placeholder="Pending registration"
                       className="w-full text-sm font-medium text-pine dark:text-zinc-100 font-mono tracking-tight bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-seafoam"
                     />
                   ) : (
                     <p className="text-sm font-medium text-pine dark:text-zinc-100 font-mono tracking-tight">{pet.tagNumber || 'Pending registration'}</p>
                   )}
                </div>
             </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500/5 to-seafoam/5 border border-indigo-500/10 dark:border-indigo-500/20 rounded-xl p-4 sm:p-6 shadow-sm space-y-6 relative overflow-hidden group">
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
                   <LoadingSpinner message="Analyzing medical history..." />
                </div>
              ) : aiSummary ? (
                <div className="bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/20 dark:border-zinc-800 shadow-inner animate-in fade-in duration-700">
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

      <div>
      {/* Single sidebar card: owner + notes + preferences + behaviour + alerts, accent dividers */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden divide-y divide-seafoam/25">
        <div className="bg-pine p-4 sm:p-5 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform duration-1000"><Heart size={60} /></div>
          <p className="text-mist/40 text-[8px] font-black uppercase tracking-[0.2em] mb-4">Subject Owner</p>
          <div
            onClick={() => owner && onViewOwner?.(owner.id)}
            title={owner && onViewOwner ? 'Open client profile' : undefined}
            className={`flex items-center gap-3 sm:gap-4 mb-4 rounded-xl -m-1 p-1 transition-all ${owner && onViewOwner ? 'cursor-pointer hover:bg-white/10 active:scale-[0.99]' : ''}`}
          >
            <img src={owner?.avatar} className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white/20 border-2 border-white/30 shrink-0 aspect-square" alt="" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-black leading-tight tracking-tight truncate uppercase">{owner?.name || 'No owner linked'}</p>
              <p className="text-mist/50 text-[10px] font-bold mt-1">{owner?.phone || 'Orphaned patient'}</p>
            </div>
            {owner && onViewOwner && <ChevronRight size={16} className="text-mist/40 shrink-0" />}
          </div>
          <div className="space-y-3">
            {!owner && (
              <div className="space-y-2 bg-white/5 border border-white/15 rounded-2xl p-3">
                <div className="flex items-center gap-1.5 text-amber-300 text-[9px] font-black uppercase tracking-widest"><AlertCircle size={13} /> Orphaned — no owner linked</div>
                <input value={reassignQuery} onChange={e => setReassignQuery(e.target.value)} placeholder="Search a client to reassign…" className="w-full px-3 py-2.5 rounded-xl bg-white/10 text-white placeholder-mist/40 text-sm outline-none focus:ring-2 focus:ring-white/40" />
                {reassignResults.length > 0 && (
                  <div className="bg-white rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {reassignResults.map(c => (
                      <button key={c.id} disabled={reassigning} onClick={() => reassignOwner(c.id)} className="w-full text-left px-3 py-2 hover:bg-mist/30 disabled:opacity-50 flex items-center justify-between gap-2">
                        <span className="text-pine text-sm font-bold truncate">{c.name}</span>{c.phone && <span className="text-slate-400 text-xs shrink-0">{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-mist/40 text-[8px] font-bold uppercase tracking-wider">Or Patients → Orphaned Pets for bulk reassign</p>
              </div>
            )}
            {owner && (
              <button onClick={() => onOpenMessaging(owner)} className="w-full bg-white text-pine py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <MessageSquare size={16} /> Establish Channel
              </button>
            )}
            {owner && pet.isAlive !== false && (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onBookAppointment && onBookAppointment(pet.id, owner.id)}
                  disabled={!onBookAppointment}
                  className="flex flex-col items-center justify-center gap-1.5 bg-white text-pine py-3 rounded-2xl font-black text-[8px] uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-40"
                >
                  <Calendar size={16} />
                  New Visit
                </button>
                <button
                  onClick={() => setShowCreateAppt(true)}
                  className="flex flex-col items-center justify-center gap-1.5 bg-white text-pine py-3 rounded-2xl font-black text-[8px] uppercase tracking-widest shadow-xl transition-all active:scale-95"
                >
                  <CalendarPlus size={16} />
                  Appointment
                </button>
                <button
                  onClick={() => setShowCreateReminder(true)}
                  className="flex flex-col items-center justify-center gap-1.5 bg-white text-pine py-3 rounded-2xl font-black text-[8px] uppercase tracking-widest shadow-xl transition-all active:scale-95"
                >
                  <BellPlus size={16} />
                  Reminder
                </button>
              </div>
            )}
            {pet.isAlive === false && (
              <div className="w-full bg-slate-800/60 text-mist/80 py-3 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest">
                Deceased — no new appointments
              </div>
            )}
          </div>
        </div>

        {/* Internal Notes Section */}
        <div className="p-4 sm:p-5">
           <div className="flex items-center justify-between mb-3">
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

        {/* Patient Preferences */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="card-subtitle">Patient Preferences</h4>
            <Sparkles size={14} className="text-slate-400" />
          </div>
          <div className="space-y-4">
            {([
              { key: 'likes' as const, label: 'Likes', color: 'emerald', items: likes },
              { key: 'dislikes' as const, label: 'Dislikes', color: 'red', items: dislikes },
              { key: 'prefs' as const, label: 'Preferences', color: 'indigo', items: prefs },
            ]).map(({ key, label, color, items }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className={`text-[9px] font-black uppercase tracking-widest text-${color}-500`}>{label}</p>
                  <button
                    onClick={() => setNewPrefInput({ category: key, value: '' })}
                    className="text-slate-400 hover:text-seafoam transition-colors"
                  ><Plus size={12} /></button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item, idx) => (
                    <span key={idx} className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-${color}-500/10 text-${color}-600 dark:text-${color}-400 border border-${color}-500/20 group`}>
                      {item}
                      <button onClick={() => handleDeletePref(key, idx)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"><X size={9} /></button>
                    </span>
                  ))}
                  {items.length === 0 && <p className="text-[9px] text-slate-400">None added</p>}
                </div>
                {newPrefInput?.category === key && (
                  <div className="flex gap-2 mt-2">
                    <input
                      autoFocus
                      type="text"
                      value={newPrefInput.value}
                      onChange={(e) => setNewPrefInput({ ...newPrefInput, value: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddPref(key, newPrefInput.value); if (e.key === 'Escape') setNewPrefInput(null); }}
                      placeholder={`Add ${label.toLowerCase()}...`}
                      className="flex-1 px-2 py-1.5 text-xs border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-pine dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-seafoam"
                    />
                    <button onClick={() => handleAddPref(key, newPrefInput.value)} className="px-3 py-1.5 bg-seafoam text-white rounded-lg text-xs font-black">Add</button>
                    <button onClick={() => setNewPrefInput(null)} className="px-3 py-1.5 text-slate-400 rounded-lg text-xs font-black">✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Behaviour — editable here and on the visit rail; both save to the pet record */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="card-subtitle">Behaviour</h4>
            <Smile size={14} className="text-slate-400" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {[...BEHAVIOUR_TRAITS, ...behaviour.filter(b => !BEHAVIOUR_TRAITS.includes(b))].map(t => {
                const on = behaviour.includes(t);
                const risky = ['Aggressive', 'May bite'].includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleBehaviour(t)} disabled={!onUpdatePet}
                    className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${on
                      ? (risky ? 'bg-rose-600 text-white border-rose-600' : 'bg-seafoam text-white border-seafoam')
                      : 'bg-slate-50 dark:bg-zinc-950 text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam/50'} ${!onUpdatePet ? 'opacity-60 cursor-default' : ''}`}>
                    {t}
                  </button>
                );
              })}
            </div>
            {onUpdatePet && (
              <div className="flex gap-1.5">
                <input className="field-input !h-7 text-[11px] flex-1" placeholder="Add a trait…" value={behaviourDraft}
                  onChange={e => setBehaviourDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && behaviourDraft.trim()) { saveBehaviour([...behaviour, behaviourDraft.trim()]); setBehaviourDraft(''); } }} />
                <button type="button" onClick={() => { if (behaviourDraft.trim()) { saveBehaviour([...behaviour, behaviourDraft.trim()]); setBehaviourDraft(''); } }}
                  className="px-2.5 h-7 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all shrink-0">Add</button>
              </div>
            )}
          </div>
        </div>

        {/* Health Alerts */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 p-4">
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
    </div>
  );

  // Visits that have vaccination tasks
  const vaccinationAppointments = appointments
    .filter(appt => appt.tasks.some(t =>
      t.category?.toLowerCase().includes('vaccin') || t.category?.toLowerCase().includes('immuniz')
    ))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const isVaccineApptCompleted = (appt: Visit) =>
    appt.status === ApptStatus.COMPLETED;

  const getVaccineTasks = (appt: Visit) =>
    appt.tasks.filter(t =>
      t.category?.toLowerCase().includes('vaccin') || t.category?.toLowerCase().includes('immuniz')
    );

  const getClinicName = (clinicId: number) =>
    clinics.find(c => Number(c.id) === Number(clinicId))?.name || `Clinic #${clinicId}`;

  const isDeceased = pet.isAlive === false;

  const renderVaccineEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-2xl gap-4 text-center">
      <ShieldCheck size={40} className="text-slate-200 dark:text-zinc-700" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-zinc-600">No vaccination appointments yet</p>
      {isDeceased ? (
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Patient deceased — scheduling disabled</p>
      ) : (
        <button
          onClick={() => onScheduleVaccine(pet.id)}
          className="px-6 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
        >
          Schedule Vaccination Visit
        </button>
      )}
    </div>
  );

  const renderVaccines = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
         <button onClick={() => setVaccineTab('timeline')} className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${vaccineTab === 'timeline' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-xl border border-slate-200 dark:border-zinc-700' : 'text-slate-400 hover:text-pine'}`}>Immunization Timeline</button>
         <button onClick={() => setVaccineTab('history')} className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${vaccineTab === 'history' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-xl border border-slate-200 dark:border-zinc-700' : 'text-slate-400 hover:text-pine'}`}>Verified Passport</button>
      </div>

      {vaccineTab === 'timeline' ? (
        <div className="space-y-4">
          {vaccinationAppointments.length === 0 ? renderVaccineEmptyState() : (
            <>
              {/* Mobile: left-edge vertical line */}
              <div className="md:hidden relative pl-8">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-zinc-800 rounded-full"></div>
                <div className="space-y-4">
                  {vaccinationAppointments.map(appt => {
                    const done = isVaccineApptCompleted(appt);
                    const vacTasks = getVaccineTasks(appt);
                    return (
                      <div key={appt.id} className="relative">
                        <div className={`absolute -left-[1.625rem] top-4 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-950 ${done ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                        <div className={`bg-white dark:bg-zinc-900 border-2 rounded-xl p-4 shadow-sm ${done ? 'border-emerald-500/20' : 'border-indigo-500/20'}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="text-[9px] font-black text-seafoam uppercase tracking-widest mb-0.5">{formatDate(appt.date)}{appt.time ? ` • ${appt.time}` : ''}</p>
                              <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Visit #{getVisitNumber(appt)}</p>
                              <p className="text-[9px] text-slate-400 font-bold mt-0.5">{getClinicName(appt.clinicId)}</p>
                            </div>
                            <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border shrink-0 ${done ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'}`}>
                              {done ? 'Administered' : appt.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {vacTasks.map(t => (
                              <span key={t.id} className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                💉 {t.name}
                              </span>
                            ))}
                          </div>
                          {onViewAppointment && (
                            <button onClick={() => onViewAppointment(appt.id)} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 transition-colors">
                              <Eye size={10} /> View Visit
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Desktop: alternating center-line timeline */}
              <div className="hidden md:block relative max-w-4xl mx-auto py-6">
                <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-slate-200 dark:bg-zinc-800 -translate-x-1/2 rounded-full"></div>
                <div className="space-y-10 relative">
                  {vaccinationAppointments.map((appt, idx) => {
                    const isEven = idx % 2 === 0;
                    const done = isVaccineApptCompleted(appt);
                    const vacTasks = getVaccineTasks(appt);
                    return (
                      <div key={appt.id} className={`flex items-center justify-between gap-8 w-full ${isEven ? 'flex-row' : 'flex-row-reverse'}`}>
                        <div className={`w-1/2 flex ${isEven ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-sm w-full bg-white dark:bg-zinc-900 border-2 rounded-xl p-5 shadow-lg transition-all hover:scale-[1.02] ${done ? 'border-emerald-500/20 hover:border-emerald-500' : 'border-indigo-500/20 hover:border-indigo-500'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className={`p-2.5 rounded-xl ${done ? 'bg-emerald-500/10 text-emerald-600' : 'bg-indigo-500/10 text-indigo-600'}`}>
                                {done ? <CheckCircle2 size={20}/> : <Clock size={20}/>}
                              </div>
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${done ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'}`}>
                                {done ? 'Administered' : appt.status.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-[9px] font-black text-seafoam uppercase tracking-widest mb-0.5">{formatDate(appt.date)}{appt.time ? ` • ${appt.time}` : ''}</p>
                            <h4 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-1">Visit #{getVisitNumber(appt)}</h4>
                            <p className="text-[9px] text-slate-400 font-bold mb-3">{getClinicName(appt.clinicId)}</p>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {vacTasks.map(t => (
                                <span key={t.id} className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                  💉 {t.name}
                                </span>
                              ))}
                            </div>
                            <div className="pt-3 border-t border-slate-50 dark:border-zinc-800 flex items-center justify-between">
                              <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Clinic</p>
                                <p className="text-xs font-bold text-pine dark:text-zinc-300 uppercase">{getClinicName(appt.clinicId)}</p>
                              </div>
                              {onViewAppointment && (
                                <button onClick={() => onViewAppointment(appt.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-seafoam/10 hover:bg-seafoam text-seafoam hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border border-seafoam/20 hover:border-seafoam">
                                  <Eye size={10} /> View Appt
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-4 border-white dark:border-zinc-950 z-10 shrink-0 ${done ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]'}`}></div>
                        <div className="w-1/2"></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isDeceased && (
                <div className="flex justify-center pt-2">
                  <button onClick={() => onScheduleVaccine(pet.id)} className="px-6 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                    Schedule Vaccination
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Verified Passport */
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-8 shadow-xl">
           <div className="flex items-start justify-between mb-6 gap-3">
              <div>
                 <h3 className="text-xl sm:text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Vaccination Passport</h3>
                 <p className="text-seafoam text-[10px] font-black uppercase tracking-widest mt-1">Clinic-verified immunization history</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowPassport(true)}
                  className="flex items-center gap-2 bg-pine text-white px-3 sm:px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-pine/90 transition-all shadow-sm active:scale-95"
                >
                  <ShieldCheck size={14} /> <span className="hidden sm:inline">View &amp; Download</span><span className="sm:hidden">Passport</span>
                </button>
                <button className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-300 hover:border-seafoam transition-all shadow-sm active:scale-95">
                  <Printer size={14} />
                </button>
              </div>
           </div>

           {vaccinationAppointments.length === 0 ? renderVaccineEmptyState() : (
             <div className="space-y-3">
               {vaccinationAppointments.map(appt => {
                 const done = isVaccineApptCompleted(appt);
                 const vacTasks = getVaccineTasks(appt);
                 return (
                   <div key={appt.id} className="p-4 sm:p-5 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-700 hover:border-emerald-500 transition-all group">
                     <div className="flex items-start justify-between gap-3 mb-3">
                       <div className="flex items-center gap-3 min-w-0">
                         <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm text-emerald-500 border border-slate-100 dark:border-zinc-800 shrink-0 group-hover:scale-110 transition-transform">
                           <ShieldCheck size={20}/>
                         </div>
                         <div className="min-w-0">
                           <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">Visit #{getVisitNumber(appt)}</p>
                           <p className="text-[9px] font-bold text-slate-400 mt-0.5">{formatDate(appt.date)} • {getClinicName(appt.clinicId)}</p>
                         </div>
                       </div>
                       <div className="flex items-center gap-2 shrink-0">
                         {done && <span className="text-[8px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg border border-emerald-500/20 uppercase tracking-widest">Verified</span>}
                         {onViewAppointment && (
                           <button onClick={() => onViewAppointment(appt.id)} className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 transition-colors">
                             View →
                           </button>
                         )}
                       </div>
                     </div>
                     <div className="flex flex-wrap gap-1.5">
                       {vacTasks.map(t => (
                         <span key={t.id} className="flex items-center gap-1 text-[8px] font-black uppercase bg-white dark:bg-zinc-900 text-pine dark:text-zinc-200 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700">
                           💉 {t.name}
                         </span>
                       ))}
                     </div>
                   </div>
                 );
               })}
             </div>
           )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-20">
      {/* Identity row on top; the tab bar sits BELOW it, full width. */}
      <header className="flex flex-col gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
           <button onClick={onBack} className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-seafoam transition-all shadow-lg active:scale-95 shrink-0">
             <ArrowLeft size={18}/>
           </button>
           <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-seafoam border-2 border-white dark:border-zinc-950 flex items-center justify-center text-2xl sm:text-3xl shadow-lg shrink-0 aspect-square uppercase">
                {pet.species === 'Dog' ? '🐶' : '🐱'}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-1 uppercase truncate">{pet.name}</h1>
                <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 truncate">
                   Pet Profile
                   <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 shrink-0"></span>
                   ID: {pet.id}
                </p>
              </div>
           </div>
        </div>

        <div data-tour="pet-tabs" className="flex w-full bg-slate-50 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-x-auto no-scrollbar scroll-smooth">
            {[
              { id: 'overview', label: 'Overview', icon: Heart },
              { id: 'timeline', label: 'Timeline', icon: Clock },
              // Conditional record tabs (077): a tab only appears when that
              // record type exists for this patient. Everything clinical —
              // visits, consults, inpatient, surgery, lab, vaccinations —
              // lives under Medical Record (Medical always shows: it's the
              // primary record and hosts vaccinations).
              { id: 'medical', label: 'Medical Record', icon: Clipboard },
              ...(groomingVisits.length > 0 ? [{ id: 'grooming', label: 'Grooming Record', icon: Smile }] : []),
              ...(boardingVisits.length > 0 || petStays.length > 0 ? [{ id: 'boarding', label: 'Boarding Record', icon: Building2 }] : []),
              { id: 'transactions', label: 'Transactions', icon: Receipt },
              { id: 'outreach', label: 'Outreach Log', icon: MessageCircle },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
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
        {activeTab === 'timeline' && <PatientTimeline entries={timeline} reminders={reminders} bookings={bookings} visitsById={visitsById} onEditReminder={setEditingReminder} onDeleteReminder={handleDeleteReminder} loading={loadingClinical} />}
        {/* Medical Record (077) — everything clinical: vet visits, consults,
            hospitalizations, surgeries, lab AND vaccinations (with record +
            certificate access from the Vaccinations sub-tab). */}
        {activeTab === 'medical' && (
           <div className="flex gap-1 bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-fit mb-6">
             {([
               { id: 'all', label: 'All Visits', icon: Calendar },
               { id: 'history', label: 'Clinical Records', icon: Clipboard },
               { id: 'vaccinations', label: 'Vaccinations', icon: ShieldCheck },
             ] as const).map(st => (
               <button
                 key={st.id}
                 onClick={() => setVisitSubTab(st.id)}
                 className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                   visitSubTab === st.id
                     ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow'
                     : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-200'
                 }`}
               >
                 <st.icon size={11} /> {st.label}
               </button>
             ))}
           </div>
        )}
        {activeTab === 'medical' && visitSubTab === 'vaccinations' && renderVaccines()}
        {/* Grooming / Boarding record tabs + Medical "All Visits" share the
            visit-card list — only the source list differs. */}
        {((activeTab === 'medical' && visitSubTab === 'all') || activeTab === 'grooming' || activeTab === 'boarding') && (() => {
          const visibleVisits = activeTab === 'grooming' ? groomingVisits : activeTab === 'boarding' ? boardingVisits : medicalVisits;
          return (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-4">
              {visibleVisits.length > 0 ? visibleVisits.map(appt => {
                const categoriesCount = new Set(appt.tasks.map(t => t.category)).size;
                const servicesCount = appt.tasks.length;
                return (
                <div key={appt.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:border-seafoam transition-all relative">
                   {/* Header */}
                   <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                         <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-xl shrink-0 aspect-square">📅</div>
                         <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-pine dark:text-zinc-100 font-black text-sm uppercase">Visit #{getVisitNumber(appt)}</p>
                              {appt.parentAppointmentId && (
                                <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">Follow-up</span>
                              )}
                              <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                                appt.status === ApptStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                appt.status === ApptStatus.IN_PROGRESS ? 'bg-cyan/10 text-cyan border-cyan/20' :
                                'bg-slate-100 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700'
                              }`}>{appt.status}</span>
                            </div>
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-0.5 truncate">{formatDate(appt.date)}{appt.time ? ` • ${appt.time}` : ''}</p>
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
                                <Eye size={13} /> View Visit
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
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        {owner && <p className="text-base font-black font-mono text-pine dark:text-zinc-200">{owner.currency} {appt.totalCost.toLocaleString()}</p>}
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border ${
                          appt.isPaid
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}>{appt.isPaid ? `PAID` : 'UNPAID'}</span>
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
                      {/* Per-workflow report (077): grooming visits get their
                          own printable Grooming Report — separate from any
                          medical/boarding report for the same patient. */}
                      {activeTab === 'grooming' && (
                        <button
                          onClick={() => setGroomingReportVisit(appt)}
                          className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 transition-colors"
                        >
                          Grooming report →
                        </button>
                      )}
                   </div>
                </div>
              )}) : (
                 <div className="py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-[10px] tracking-[0.2em] col-span-full">
                   {activeTab === 'grooming' ? 'No grooming visits yet' : activeTab === 'boarding' ? 'No boarding history yet' : 'No medical visits found'}
                 </div>
              )}
              {/* Boarding Record: the stays themselves — kennel, dates,
                  belongings log, feeding schedule — with a printable
                  per-stay Boarding Report. */}
              {activeTab === 'boarding' && petStays.length > 0 && (
                <div className="col-span-full space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Boarding stays</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {petStays.map((s: any) => (
                      <div key={s.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Stay · {formatDate(s.dropOffAt)}{s.actualPickupAt ? ` → ${formatDate(s.actualPickupAt)}` : ' (ongoing)'}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{s.kennel ? `Kennel ${s.kennel} · ` : ''}{s.status.replace('_', ' ')}</p>
                          </div>
                          <button
                            onClick={() => setReportStay(s)}
                            className="shrink-0 text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 transition-colors"
                          >
                            Boarding report →
                          </button>
                        </div>
                        {s.belongings && (
                          <p className="text-[11px] text-slate-600 dark:text-zinc-400"><span className="font-black text-[9px] uppercase text-slate-400">Belongings: </span>{s.belongings}</p>
                        )}
                        {s.feedingInstructions && (
                          <p className="text-[11px] text-slate-600 dark:text-zinc-400"><span className="font-black text-[9px] uppercase text-slate-400">Feeding: </span>{s.feedingInstructions}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
           </div>
          );
        })()}
        {activeTab === 'transactions' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              {petTransactions.length > 0 ? petTransactions.map((tx: any) => (
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
                         <p className="text-lg sm:text-2xl font-black font-mono text-emerald-600">{owner?.currency || 'KES'} {tx.amount.toLocaleString()}</p>
                         <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg border border-emerald-500/20 inline-block mt-1.5">
                           {tx.status || 'SETTLED'}
                         </span>
                      </div>
                   </div>
                   <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-3 items-center justify-between">
                      <div className="flex flex-wrap gap-3">
                        {tx.appointmentId && (() => {
                          const appt = appointments.find(a => a.id === parseInt(tx.appointmentId || '0'));
                          return (
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Visit</p>
                              <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">Visit #{appt ? getVisitNumber(appt) : tx.appointmentId}</p>
                           </div>
                          );
                        })()}
                        {tx.receiptNumber && (
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt #</p>
                              <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">{tx.receiptNumber}</p>
                           </div>
                        )}
                      </div>
                      {tx.appointmentId && onViewAppointment && (
                        <button
                          onClick={() => onViewAppointment(parseInt(tx.appointmentId))}
                          className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 transition-colors flex items-center gap-1"
                        >
                          View Visit →
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
        {activeTab === 'medical' && visitSubTab === 'history' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4">
              {(() => {
                const visitAppts = medicalVisits
                  .filter(a => a.status === ApptStatus.COMPLETED || a.status === ApptStatus.PENDING_PAYMENT)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                if (visitAppts.length === 0) return (
                  <div className="py-40 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-sm tracking-[0.4em]">No Medical Records Found</div>
                );
                return visitAppts.map(appt => {
                  const allMeds = appt.tasks.flatMap(t => (t.medications ?? []) as any[]);
                  const categories = [...new Set(appt.tasks.map(t => t.category).filter(Boolean))];
                  return (
                    <div key={appt.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-sm space-y-4 sm:space-y-6 relative group overflow-hidden">
                      <div className="flex justify-between items-start border-b border-slate-50 dark:border-zinc-800 pb-4 sm:pb-6 gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-lg sm:text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Visit #{getVisitNumber(appt)}</p>
                          <p className="text-seafoam text-[10px] font-black uppercase tracking-widest mt-1.5">{formatDate(appt.date)}{appt.time ? ` • ${appt.time}` : ''} • {getClinicName(appt.clinicId)}</p>
                          {categories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {categories.map(cat => (
                                <span key={cat} className="text-[7px] font-black uppercase bg-seafoam/10 text-seafoam border border-seafoam/20 px-1.5 py-0.5 rounded">{cat}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setDocModal({ type: 'medical_record', appt })}
                            className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 transition-colors"
                          >
                            Certificate →
                          </button>
                          {onViewAppointment && (
                            <button
                              onClick={() => onViewAppointment(appt.id)}
                              className="p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl text-slate-400 hover:text-seafoam transition-all"
                            ><ExternalLink size={15}/></button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Services</p>
                        <div className="space-y-1">
                          {appt.tasks.map(t => (
                            <div key={t.id} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-seafoam shrink-0" />
                              <p className="text-sm text-slate-700 dark:text-zinc-300">{t.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {appt.notes && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinical Notes</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 leading-relaxed italic">{appt.notes}</p>
                        </div>
                      )}
                      {allMeds.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50 dark:border-zinc-800">
                          {allMeds.map((m: any, i: number) => (
                            <span key={i} className="bg-seafoam/10 text-seafoam px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border border-seafoam/20">
                              {m.inventoryItem?.name || 'Unknown'}{m.quantity ? ` × ${m.quantity}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
           </div>
        )}
      </div>

      {/* Click-outside overlay for action menus */}
      {openMenuId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}

      {/* Create appointment booking for this patient */}
      {showCreateAppt && owner && (
        <AppointmentCreateModal
          pets={allPets}
          clients={[owner]}
          prefill={{ petId: String(pet.id), petLabel: pet.name }}
          source="FRONT_DESK"
          onClose={() => setShowCreateAppt(false)}
          onSaved={() => { setShowCreateAppt(false); loadClinical(); }}
        />
      )}

      {/* Create or edit a reminder for this patient */}
      {(showCreateReminder || editingReminder) && owner && (
        <ReminderCreateModal
          petId={pet.id}
          clientId={owner.id}
          petLabel={pet.name}
          existing={editingReminder ?? undefined}
          onClose={() => { setShowCreateReminder(false); setEditingReminder(null); }}
          onSaved={() => { setShowCreateReminder(false); setEditingReminder(null); loadClinical(); }}
        />
      )}

      {/* Vaccine Passport Modal */}
      {showPassport && (
        <VaccinePassportModal
          pet={pet}
          owner={owner}
          clinic={activeClinic ?? clinics.find(c => Number(c.id) === Number(pet.clinicId))}
          vaccinationAppointments={vaccinationAppointments}
          getVaccineTasks={getVaccineTasks}
          getClinicName={getClinicName}
          getVisitNumber={getVisitNumber}
          onClose={() => setShowPassport(false)}
        />
      )}

      {/* Boarding Report (077) — per-workflow report, separate from any
          medical/grooming report for the same patient. */}
      {reportStay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[800] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setReportStay(null)}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-xl w-full rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-5 py-3 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">🛏️ Boarding Report</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => import('../shared/printPdf').then(({ printElementAsPdf }) => printElementAsPdf('boarding-report-content', `Boarding Report ${pet.name}`, false))}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-pine text-white rounded-lg font-bold text-[9px] uppercase tracking-widest hover:shadow-md transition-all"
                >
                  <Printer size={12} /> Print / PDF
                </button>
                <button onClick={() => setReportStay(null)} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
              </div>
            </div>
            <div id="boarding-report-content" className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div>
                  <p className="text-lg font-black text-pine dark:text-zinc-100 uppercase">{pet.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}{owner ? ` · ${owner.name}` : ''}</p>
                </div>
                <div className="text-right text-[10px] font-bold text-slate-500">
                  <p>{formatDate(reportStay.dropOffAt)} → {reportStay.actualPickupAt ? formatDate(reportStay.actualPickupAt) : 'ongoing'}</p>
                  <p className="uppercase">{reportStay.status.replace('_', ' ')}{reportStay.kennel ? ` · Kennel ${reportStay.kennel}` : ''}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                {reportStay.intakeWeight != null && <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Intake weight</p><p className="font-bold text-pine dark:text-zinc-100">{reportStay.intakeWeight} kg</p></div>}
                {reportStay.dischargeWeight != null && <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Discharge weight</p><p className="font-bold text-pine dark:text-zinc-100">{reportStay.dischargeWeight} kg{reportStay.weightChange != null ? ` (${reportStay.weightChange > 0 ? '+' : ''}${reportStay.weightChange} kg)` : ''}</p></div>}
                {reportStay.dailyRate != null && <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Daily rate</p><p className="font-bold text-pine dark:text-zinc-100">{owner?.currency || 'KES'} {Number(reportStay.dailyRate).toLocaleString()}</p></div>}
                {reportStay.billing && <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Billing</p><p className="font-bold text-pine dark:text-zinc-100">{owner?.currency || 'KES'} {Number(reportStay.billing.totalCost || 0).toLocaleString()} · {reportStay.billing.isPaid ? 'PAID' : 'OUTSTANDING'}</p></div>}
              </div>
              {reportStay.belongings && (
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Belongings log</p><p className="text-[12px] text-slate-700 dark:text-zinc-300">{reportStay.belongings}</p></div>
              )}
              {reportStay.feedingInstructions && (
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Feeding schedule</p><p className="text-[12px] text-slate-700 dark:text-zinc-300">{reportStay.feedingInstructions}</p></div>
              )}
              {reportStay.medicationInstructions && (
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Medication instructions</p><p className="text-[12px] text-slate-700 dark:text-zinc-300">{reportStay.medicationInstructions}</p></div>
              )}
              {reportStay.specialInstructions && (
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Special instructions</p><p className="text-[12px] text-slate-700 dark:text-zinc-300">{reportStay.specialInstructions}</p></div>
              )}
              {Array.isArray(reportStay.dailyLogs) && reportStay.dailyLogs.length > 0 && (
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily care log</p>
                  <table className="w-full text-[10px]">
                    <thead><tr className="text-left text-slate-400 uppercase text-[8px] font-black"><th className="py-1">Date</th><th>Fed</th><th>Walked</th><th>Meds</th><th>Notes</th></tr></thead>
                    <tbody>
                      {reportStay.dailyLogs.map((l: any) => (
                        <tr key={l.id} className="border-t border-slate-100 dark:border-zinc-800">
                          <td className="py-1 font-bold">{formatDate(l.logDate)}</td>
                          <td>{[l.fedAm && 'AM', l.fedPm && 'PM'].filter(Boolean).join(' + ') || '—'}</td>
                          <td>{l.walked ? 'Yes' : '—'}</td>
                          <td>{l.medicationGiven ? 'Yes' : '—'}</td>
                          <td className="text-slate-500">{l.notes || l.foodNotes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {reportStay.notes && (
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</p><p className="text-[12px] text-slate-700 dark:text-zinc-300">{reportStay.notes}</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grooming Report (077) — per-workflow report for a grooming visit. */}
      {groomingReportVisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[800] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setGroomingReportVisit(null)}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-xl w-full rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-5 py-3 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">✂️ Grooming Report</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => import('../shared/printPdf').then(({ printElementAsPdf }) => printElementAsPdf('grooming-report-content', `Grooming Report ${pet.name}`, false))}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-pine text-white rounded-lg font-bold text-[9px] uppercase tracking-widest hover:shadow-md transition-all"
                >
                  <Printer size={12} /> Print / PDF
                </button>
                <button onClick={() => setGroomingReportVisit(null)} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
              </div>
            </div>
            <div id="grooming-report-content" className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div>
                  <p className="text-lg font-black text-pine dark:text-zinc-100 uppercase">{pet.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}{owner ? ` · ${owner.name}` : ''}</p>
                </div>
                <div className="text-right text-[10px] font-bold text-slate-500">
                  <p>{formatDate(groomingReportVisit.date)}</p>
                  <p className="uppercase">{getClinicName(groomingReportVisit.clinicId)}</p>
                </div>
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Grooming services</p>
                <div className="space-y-1">
                  {groomingReportVisit.tasks.filter(t => (t.category || '').toLowerCase().includes('groom')).map(t => (
                    <div key={t.id} className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-700 dark:text-zinc-300">{t.name}</span>
                      <span className="font-bold text-pine dark:text-zinc-100">{owner?.currency || 'KES'} {Number(t.price || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              {(() => {
                const gd: any = groomingReportVisit.groomingDetail || {};
                const rows: Array<[string, any]> = [
                  ['Temperament', gd.temperament], ['Vaccination status', gd.vaccinationStatus],
                  ['Special instructions', gd.specialInstructions], ['Groomer notes', gd.groomerNotes],
                ].filter(([, v]) => v) as any;
                if (rows.length === 0) return null;
                return (
                  <div className="space-y-2">
                    {rows.map(([label, v]) => (
                      <div key={label}><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p><p className="text-[12px] text-slate-700 dark:text-zinc-300">{String(v)}</p></div>
                    ))}
                  </div>
                );
              })()}
              <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Grooming bill</span>
                <span className="text-sm font-black text-pine dark:text-zinc-100">{owner?.currency || 'KES'} {groomingReportVisit.tasks.filter(t => (t.category || '').toLowerCase().includes('groom')).reduce((s, t) => s + Number(t.price || 0), 0).toLocaleString()} · {groomingReportVisit.isPaid ? 'PAID' : 'OUTSTANDING'}</span>
              </div>
            </div>
          </div>
        </div>
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
                  {docModal.type === 'medical_record' && '🏥 Health Certificate'}
                  {docModal.type === 'notes' && '💬 Visit Notes'}
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
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Patient</p>
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{pet.name}</p>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Owner</p>
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{owner?.name}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{formatDate(docModal.appt.date)} {docModal.appt.time}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Services</p>
                  {docModal.appt.tasks.map(task => (
                    <div key={task.id} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-xs font-bold text-pine dark:text-zinc-200">{task.name}</span>
                      <span className="text-xs font-black text-pine dark:text-zinc-200">{owner?.currency || 'KES'} {task.price?.toLocaleString() || '—'}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Total</span>
                    <span className="text-lg font-black text-seafoam">{owner?.currency || 'KES'} {docModal.appt.totalCost.toLocaleString()}</span>
                  </div>
                </div>
                {docModal.type === 'receipt' && docModal.appt.isPaid && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase">Payment Confirmed</p>
                    </div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Method: {docModal.appt.paymentMethod}</p>
                  </div>
                )}
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
                  <Printer size={14} /> Print {docModal.type === 'invoice' ? 'Invoice' : 'Receipt'}
                </button>
              </div>
            )}

            {docModal.type === 'medical_record' && (() => {
              const appt = docModal.appt;
              const allMeds = appt.tasks.flatMap(t => (t.medications ?? []) as any[]);
              const categories = [...new Set(appt.tasks.map(t => t.category).filter(Boolean))];
              return (
                <div className="space-y-0 font-mono">
                  {/* Certificate top bar */}
                  <div className="bg-pine text-white px-5 py-4 rounded-t-xl flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-white/10 rounded-lg"><Shield size={16} /></div>
                      <div>
                        <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">Certificate of</p>
                        <p className="text-sm font-black uppercase tracking-tight leading-tight">Veterinary Care</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-white/50 uppercase tracking-widest">Cert No.</p>
                      <p className="text-sm font-black tracking-tight">#{appt.id}</p>
                    </div>
                  </div>

                  {/* Decorative rule */}
                  <div className="h-1.5 bg-gradient-to-r from-seafoam via-cyan to-seafoam" />

                  {/* Body */}
                  <div className="border border-t-0 border-slate-200 dark:border-zinc-700 rounded-b-xl overflow-hidden">
                    {/* Patient + owner */}
                    <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 border-b border-slate-100 dark:border-zinc-800">
                      <div className="px-4 py-3">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Patient</p>
                        <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase leading-tight">{pet.name}</p>
                        <p className="text-[9px] text-slate-500 dark:text-zinc-400">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Owner</p>
                        <p className="text-sm font-black text-pine dark:text-zinc-100 leading-tight">{owner?.name}</p>
                        <p className="text-[9px] text-slate-500 dark:text-zinc-400">{owner?.phone}</p>
                      </div>
                    </div>

                    {/* Date + categories */}
                    <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-zinc-800 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-800/20">
                      <div className="px-4 py-3">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Visit Date</p>
                        <p className="text-[11px] font-black text-pine dark:text-zinc-100">{formatDate(appt.date)}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Service Categories</p>
                        <div className="flex flex-wrap gap-1">
                          {categories.map(cat => (
                            <span key={cat} className="text-[7px] font-black uppercase bg-seafoam/10 text-seafoam border border-seafoam/20 px-1.5 py-0.5 rounded">{cat}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Services */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 flex items-center gap-1.5"><Activity size={9} /> Services Performed</p>
                      <div className="space-y-1">
                        {appt.tasks.map(t => (
                          <div key={t.id} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-seafoam shrink-0" />
                            <p className="text-[10px] text-slate-700 dark:text-zinc-200">{t.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Medications */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Medications Administered</p>
                      {allMeds.length > 0 ? (
                        <div className="space-y-1">
                          {allMeds.map((m: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-purple-400 shrink-0" />
                              <p className="text-[10px] text-slate-700 dark:text-zinc-200">{m.inventoryItem?.name || 'Unknown'} <span className="text-slate-400">× {m.quantity} {m.inventoryItem?.unit || ''}</span></p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-400 italic">None administered</p>
                      )}
                    </div>

                    {/* Clinical notes */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Clinical Notes</p>
                      <p className="text-[10px] text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {appt.notes || <span className="italic text-slate-300 dark:text-zinc-600">No clinical notes recorded.</span>}
                      </p>
                    </div>

                    {/* Vet signature + status stamp */}
                    <div className="px-4 py-4 flex items-end justify-between">
                      <div>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.18em] mb-3">Attending Veterinarian</p>
                        <div className="w-32 border-b border-slate-300 dark:border-zinc-600 mb-1" />
                        <p className="text-[9px] font-black text-pine dark:text-zinc-200 uppercase">{appt.leadStaff?.name || appt.assignedStaff?.name || '—'}</p>
                        <p className="text-[8px] text-slate-400">{appt.leadStaff?.role || 'Veterinarian'}</p>
                      </div>
                      <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 ${appt.status === ApptStatus.COMPLETED ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-amber-400 text-amber-600 dark:text-amber-400'}`}>
                        <CheckCircle2 size={14} />
                        <p className="text-[7px] font-black uppercase tracking-wider mt-0.5 text-center leading-tight">{appt.status === ApptStatus.COMPLETED ? 'Verified' : appt.status}</p>
                      </div>
                    </div>
                  </div>

                  {/* Print */}
                  <button className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
                    <Printer size={13} /> Print Certificate
                  </button>
                </div>
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
