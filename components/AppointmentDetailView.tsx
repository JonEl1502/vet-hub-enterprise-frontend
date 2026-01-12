
import React, { useState, useMemo, useEffect } from 'react';
import { Appointment, ApptTask, TaskStatus, User, Pet, ApptStatus, Clinic, MedicalRecord } from '../types';
import {
  Share2, X, Plus, ChevronRight, CheckCircle2, FileText, Receipt,
  CreditCard, Stethoscope, Download, Printer, Calendar, MessageSquare,
  Smile, Meh, Frown, Sparkles, Wand2, Loader2, Link2, ArrowRight, Trash2, Lock, Syringe, Users, Pill, AlertCircle, Search
} from 'lucide-react';
import { SERVICE_CATEGORIES, PREDEFINED_SERVICES } from '../constants';
import { generateServiceNote, generateFullVisitSummary } from '../services/geminiService';
import { formatDate, formatTime } from '../services/utils/dateFormatter';
import { vaccinationsAPI, inventoryAPI, InventoryItem, appointmentMedicationsAPI } from '../services';

interface Props {
  appointment: Appointment;
  pet: Pet;
  staffMembers: User[];
  clinics: Clinic[];
  activeClinic: Clinic;
  onUpdateStatus: (apptId: number, taskId: number, status: TaskStatus) => void;
  onUpdateTaskDetails: (apptId: number, taskId: number, data: Partial<ApptTask>) => void;
  onReassign: (apptId: number, taskId: number, staffId: number) => void;
  onDeleteTask?: (apptId: number, taskId: number) => void;
  onBack: () => void;
  onUpdateApptStatus: (id: number, status: ApptStatus, diagnosis: string) => void;
  onInjectTask: (apptId: number, task: ApptTask) => void;
  onProcessPayment: (apptId: number, method: string, discountType?: string, discountValue?: number) => void;
  onScheduleFollowup: (parentAppt: Appointment) => void;
  onNavigateToVisit: (visitId: number) => void;
  allAppointments: Appointment[];
}

const SENTIMENT_PRESETS: Record<'positive' | 'neutral' | 'negative', string[]> = {
  positive: ['Excellent tolerance', 'Stable', 'Smooth procedure', 'Highly responsive', 'Recovered quickly', 'Patient was calm'],
  neutral: ['Standard routine', 'Expected outcome', 'Average response', 'No complications', 'Baseline maintained'],
  negative: ['Aggressive', 'Minor complications', 'Difficult handling', 'Stressed patient', 'Slow recovery', 'Vital variance']
};

const AppointmentDetailView: React.FC<Props> = ({
  appointment, pet, staffMembers, clinics, activeClinic, onUpdateStatus, onUpdateTaskDetails, onDeleteTask,
  onBack, onUpdateApptStatus, onInjectTask, onProcessPayment, onScheduleFollowup, onNavigateToVisit, allAppointments
}) => {
  // Early return if required data is missing
  if (!appointment) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="mb-4 px-4 py-2 bg-slate-200 dark:bg-zinc-800 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-700">
          ← Back
        </button>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">Appointment data not available.</p>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="mb-4 px-4 py-2 bg-slate-200 dark:bg-zinc-800 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-700">
          ← Back
        </button>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">Pet information not available for this appointment.</p>
        </div>
      </div>
    );
  }

  const [showInjectModal, setShowInjectModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState(SERVICE_CATEGORIES[0].id);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'record' | 'invoice' | 'receipt'>('record');

  const [loadingTasks, setLoadingTasks] = useState<Record<number, boolean>>({});
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isCreatingVaccinations, setIsCreatingVaccinations] = useState(false);

  // Local state for task edits (sentiment and notes) before saving
  const [taskEdits, setTaskEdits] = useState<Record<number, Partial<ApptTask>>>({});

  // Summary preview state
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);
  const [summaryPreview, setSummaryPreview] = useState<{
    diagnosis: string;
    treatment: string;
    medications: string[];
    serviceNotes: string[];
  } | null>(null);

  // Medication modal state
  const [showMedicationModal, setShowMedicationModal] = useState<number | null>(null); // taskId
  const [availableMedications, setAvailableMedications] = useState<InventoryItem[]>([]);
  const [loadingMedications, setLoadingMedications] = useState(false);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>('');
  const [medicationQuantity, setMedicationQuantity] = useState<number>(1);
  const [medicationNotes, setMedicationNotes] = useState<string>('');
  const [medicationSearchQuery, setMedicationSearchQuery] = useState<string>('');
  const [taskMedications, setTaskMedications] = useState<Record<number, any[]>>({});
  const [medicationError, setMedicationError] = useState<string>('');

  // Load all medications for the appointment on mount
  useEffect(() => {
    const loadAllMedications = async () => {
      try {
        const allMeds = await appointmentMedicationsAPI.getMedicationsByAppointment(appointment.id.toString());
        // Group medications by task ID
        const medsByTask: Record<number, any[]> = {};
        allMeds.forEach((med: any) => {
          if (med.taskId) {
            const taskId = parseInt(med.taskId);
            if (!medsByTask[taskId]) {
              medsByTask[taskId] = [];
            }
            medsByTask[taskId].push(med);
          }
        });
        setTaskMedications(medsByTask);
      } catch (error) {
        console.error('Failed to load appointment medications:', error);
      }
    };

    loadAllMedications();
  }, [appointment.id]);

  const tasksByCategory = useMemo(() => {
    const map: Record<string, ApptTask[]> = {};
    if (appointment?.tasks) {
      appointment.tasks.forEach(t => {
        if (!map[t.category]) map[t.category] = [];
        map[t.category].push(t);
      });
    }
    return map;
  }, [appointment?.tasks]);

  // Check if appointment has vaccination-related tasks
  const hasVaccinationTasks = useMemo(() => {
    return appointment?.tasks?.some(task =>
      task.category?.toLowerCase().includes('vaccination') ||
      task.category?.toLowerCase().includes('vaccine')
    ) || false;
  }, [appointment?.tasks]);

  // Build follow-up chain: only include appointments that are part of a follow-up relationship
  const visitSequence = useMemo(() => {
    if (!allAppointments || !pet?.id || !appointment) return [];

    // Find all appointments in the follow-up chain
    const chain: Appointment[] = [];
    const appointmentMap = new Map(allAppointments.map(a => [a.id, a]));

    // Find the root appointment (the one without a parent)
    let current: Appointment | undefined = appointment;
    while (current?.parentAppointmentId) {
      const parent = appointmentMap.get(current.parentAppointmentId);
      if (!parent) break;
      current = parent;
    }

    // Now traverse down from the root to build the chain
    if (current) {
      chain.push(current);
      let hasChildren = true;
      while (hasChildren) {
        hasChildren = false;
        const lastInChain = chain[chain.length - 1];
        const child = allAppointments.find(a => a.parentAppointmentId === lastInChain.id);
        if (child) {
          chain.push(child);
          hasChildren = true;
        }
      }
    }

    // Only return the chain if it has more than one appointment (i.e., there are actual follow-ups)
    return chain.length > 1 ? chain : [];
  }, [allAppointments, pet?.id, appointment]);

  // Get current value from local edits or task
  const getTaskValue = (taskId: number, field: 'sentiment' | 'notes' | 'selectedPhrases') => {
    const task = appointment.tasks.find(t => t.id === taskId);
    if (!task) return field === 'selectedPhrases' ? [] : '';
    return taskEdits[taskId]?.[field] ?? task[field] ?? (field === 'selectedPhrases' ? [] : '');
  };

  const updateTaskEdit = (taskId: number, updates: Partial<ApptTask>) => {
    setTaskEdits(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], ...updates } as Partial<ApptTask>
    }));
  };

  const togglePhrase = (taskId: number, phrase: string) => {
    const current = getTaskValue(taskId, 'selectedPhrases') as string[];
    const updated = current.includes(phrase) ? current.filter(p => p !== phrase) : [...current, phrase];
    updateTaskEdit(taskId, { selectedPhrases: updated });
  };

  const saveTaskNote = async (taskId: number) => {
    const edits = taskEdits[taskId];
    if (!edits) return;

    setLoadingTasks(prev => ({ ...prev, [taskId]: true }));
    try {
      await onUpdateTaskDetails(appointment.id, taskId, edits);
      // Clear local edits after successful save
      setTaskEdits(prev => {
        const newEdits = { ...prev };
        delete newEdits[taskId];
        return newEdits;
      });
    } finally {
      setLoadingTasks(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleAIDescribe = async (taskId: number) => {
    const task = appointment.tasks.find(t => t.id === taskId);
    const selectedPhrases = getTaskValue(taskId, 'selectedPhrases') as string[];
    const sentiment = getTaskValue(taskId, 'sentiment') as string;

    if (!selectedPhrases?.length) return;

    setLoadingTasks(prev => ({ ...prev, [taskId]: true }));
    try {
      const narrative = await generateServiceNote(task?.name || '', sentiment || 'neutral', selectedPhrases);
      // Update local state with generated note
      updateTaskEdit(taskId, { notes: narrative });
      // Save to API immediately after AI generation
      const edits = { ...taskEdits[taskId], notes: narrative };
      await onUpdateTaskDetails(appointment.id, taskId, edits);
      // Clear local edits after successful save
      setTaskEdits(prev => {
        const newEdits = { ...prev };
        delete newEdits[taskId];
        return newEdits;
      });
    } finally {
      setLoadingTasks(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleSynthesizeSummary = async () => {
    const completedTasks = appointment.tasks.filter(t => t.notes);
    if (completedTasks.length === 0) {
      alert("Please generate AI descriptions for individual services before synthesizing the final summary.");
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const attendingStaff = staffMembers
        .filter(s => appointment.tasks.some(t => t.assignedStaffId === s.id))
        .map(s => s.name);

      const summary = await generateFullVisitSummary(
        pet.name,
        new Date(appointment.date).toLocaleString(),
        attendingStaff,
        completedTasks.map(t => ({ name: t.name, notes: t.notes!, category: t.category }))
      );
      onUpdateApptStatus(appointment.id, appointment.status, summary || '');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Medication handlers
  const handleOpenMedicationModal = async (taskId: number) => {
    setShowMedicationModal(taskId);
    setLoadingMedications(true);
    try {
      const response = await inventoryAPI.getAll({ limit: 100 });
      // Backend returns paginated response: { data: { data: [...], meta: {...} } }
      const items = response.data.data || [];
      // Filter to only medications, vaccines, and pharmacy items
      const meds = items.filter((item: any) =>
        ['Medications', 'Vaccines', 'Pharmacy', 'Drugs'].some(cat =>
          item.category.toLowerCase().includes(cat.toLowerCase())
        ) && item.status !== 'OUT_OF_STOCK'
      );
      setAvailableMedications(meds);

      // Load existing medications for this task
      const existingMeds = await appointmentMedicationsAPI.getMedicationsByAppointment(appointment.id.toString());
      const taskMeds = existingMeds.filter((m: any) => m.taskId === taskId.toString());
      setTaskMedications(prev => ({ ...prev, [taskId]: taskMeds }));
    } catch (error) {
      console.error('Failed to load medications:', error);
      setAvailableMedications([]);
    } finally {
      setLoadingMedications(false);
    }
  };

  const handleCloseMedicationModal = () => {
    setShowMedicationModal(null);
    setSelectedMedicationId('');
    setMedicationQuantity(1);
    setMedicationNotes('');
    setMedicationSearchQuery('');
    setMedicationError('');
  };

  const handleAddMedication = async () => {
    if (!showMedicationModal || !selectedMedicationId) {
      setMedicationError('Please select a medication');
      return;
    }

    const medication = availableMedications.find(m => m.id === selectedMedicationId);
    if (!medication) {
      setMedicationError('Selected medication not found');
      return;
    }

    // Validate quantity
    if (medicationQuantity <= 0) {
      setMedicationError('Quantity must be greater than 0');
      return;
    }

    if (medicationQuantity > medication.quantity) {
      setMedicationError(`Insufficient stock. Only ${medication.quantity} ${medication.unit} available`);
      return;
    }

    // Check if medication is expired
    if (medication.expiryDate && new Date(medication.expiryDate) < new Date()) {
      setMedicationError('This medication has expired and cannot be used');
      return;
    }

    // Check if medication is low stock
    if (medication.status === 'LOW_STOCK' && medicationQuantity > medication.quantity / 2) {
      const confirmUse = window.confirm(
        `Warning: This medication is low in stock (${medication.quantity} ${medication.unit} remaining). ` +
        `You are requesting ${medicationQuantity} ${medication.unit}. Continue?`
      );
      if (!confirmUse) return;
    }

    try {
      const response = await appointmentMedicationsAPI.addMedication(appointment.id.toString(), {
        inventoryItemId: medication.id,
        quantity: medicationQuantity,
        taskId: showMedicationModal.toString(),
        notes: medicationNotes
      });

      // Update local state
      setTaskMedications(prev => ({
        ...prev,
        [showMedicationModal]: [...(prev[showMedicationModal] || []), response]
      }));

      handleCloseMedicationModal();
    } catch (error: any) {
      console.error('Failed to add medication:', error);
      setMedicationError(error?.message || 'Failed to add medication. Please try again.');
    }
  };

  const handleRemoveMedication = async (taskId: number, medicationId: string) => {
    if (!window.confirm('Remove this medication from the task?')) return;

    try {
      await appointmentMedicationsAPI.removeMedication(medicationId);

      // Update local state
      setTaskMedications(prev => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter((m: any) => m.id !== medicationId)
      }));
    } catch (error) {
      console.error('Failed to remove medication:', error);
      alert('Failed to remove medication. Please try again.');
    }
  };

  const filteredMedications = useMemo(() => {
    if (!medicationSearchQuery) return availableMedications;
    const query = medicationSearchQuery.toLowerCase();
    return availableMedications.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.sku.toLowerCase().includes(query) ||
      m.category.toLowerCase().includes(query)
    );
  }, [availableMedications, medicationSearchQuery]);

  // Filter staff to only VETs, STAFF, and CLINIC_OWNER
  const availableStaff = useMemo(() => {
    return staffMembers.filter(s => s.role === 'VET' || s.role === 'STAFF' || s.role === 'CLINIC_OWNER');
  }, [staffMembers]);

  const activeMedRecord = pet.medicalHistory.find(h => h.appointmentId === appointment.id);
  const progress = Math.round((appointment.tasks.filter(t => t.status === TaskStatus.COMPLETED).length / appointment.tasks.length) * 100);

  // Generate summary preview
  const generateSummaryPreview = () => {
    const tasks = appointment.tasks;

    // Diagnosis from Diagnosis/Examination tasks
    const diagnosis = tasks
      .filter(t => t.category === 'Diagnosis' || t.category === 'Examination')
      .map(t => {
        let note = `${t.name}: ${t.notes || 'No notes'}`;
        if (t.sentiment) note += ` [Sentiment: ${t.sentiment}]`;
        if (t.selectedPhrases && t.selectedPhrases.length > 0) {
          note += ` [Observations: ${t.selectedPhrases.join(', ')}]`;
        }
        return note;
      })
      .join('; ') || 'General checkup';

    // Treatment from Treatment/Surgery tasks
    const treatment = tasks
      .filter(t => t.category === 'Treatment' || t.category === 'Surgery')
      .map(t => {
        let note = `${t.name}: ${t.notes || 'Completed'}`;
        if (t.sentiment) note += ` [Outcome: ${t.sentiment}]`;
        if (t.selectedPhrases && t.selectedPhrases.length > 0) {
          note += ` [Details: ${t.selectedPhrases.join(', ')}]`;
        }
        return note;
      })
      .join('; ') || 'No treatment required';

    // Medications
    const medications = tasks
      .filter(t => t.category === 'Medication')
      .map(t => t.name);

    // Service notes - all tasks with full details
    const serviceNotes = tasks.map(t => {
      let note = `${t.name} (${t.category}) - ${t.status}`;
      if (t.notes) note += ` - Notes: ${t.notes}`;
      if (t.sentiment) note += ` - Sentiment: ${t.sentiment}`;
      if (t.selectedPhrases && t.selectedPhrases.length > 0) {
        note += ` - Observations: ${t.selectedPhrases.join(', ')}`;
      }
      return note;
    });

    setSummaryPreview({ diagnosis, treatment, medications, serviceNotes });
    setShowSummaryPreview(true);
  };

  const handleFinalize = () => {
    // If we have an active record synthesis, use it. Otherwise, the store will generate a fallback.
    const diagnosis = activeMedRecord?.treatment || "";
    onUpdateApptStatus(appointment.id, ApptStatus.COMPLETED, diagnosis);
  };

  const handleCreateVaccinationRecords = async () => {
    setIsCreatingVaccinations(true);
    try {
      await vaccinationsAPI.createFromAppointment(appointment.id.toString());
      alert('Vaccination records created successfully!');
    } catch (error) {
      console.error('Failed to create vaccination records:', error);
      alert('Failed to create vaccination records. Please try again.');
    } finally {
      setIsCreatingVaccinations(false);
    }
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-seafoam hover:text-pine rounded-xl shadow-sm transition-all active:scale-95">←</button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase leading-none">Visit Overview</h1>
              {appointment.status === ApptStatus.COMPLETED && <span className="bg-emerald-500/10 text-emerald-500 text-[8px] px-2 py-0.5 rounded-full border border-emerald-500/20 font-black uppercase tracking-widest">Finalized</span>}
            </div>
            <p className="text-seafoam text-[9px] font-black uppercase tracking-widest mt-0.5">Visit #{appointment.id}</p>
          </div>
        </div>

        {visitSequence.length > 0 && (
          <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-x-auto no-scrollbar">
             <div className="flex items-center gap-2 px-3 mr-2 border-r border-slate-200 dark:border-zinc-800">
                <Link2 size={10} className="text-seafoam"/>
                <span className="text-[8px] font-black uppercase text-slate-400 whitespace-nowrap">Follow-up Chain</span>
             </div>
             {visitSequence.map((v, idx) => {
               const isCurrentVisit = v.id === appointment.id;
               const isFollowUp = v.parentAppointmentId !== undefined && v.parentAppointmentId !== null;
               return (
                 <button
                   key={v.id}
                   onClick={() => onNavigateToVisit(v.id)}
                   className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${isCurrentVisit ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-zinc-700' : 'text-slate-400 hover:text-pine'}`}
                   title={`${isFollowUp ? 'Follow-up' : 'Initial'} visit on ${formatDate(v.date)}`}
                 >
                   {isFollowUp ? `F${idx}` : 'Initial'}
                 </button>
               );
             })}
          </div>
        )}
      </header>

      {/* Lock Banner for Paid Appointments */}
      {appointment.isPaid && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-5 flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="p-3 bg-amber-500/20 rounded-xl">
            <Lock size={24} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-1">
              Appointment Locked
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
              This appointment is locked because payment has been processed ({appointment.paymentMethod}).
              To make changes, please contact the clinic owner.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[1.5rem] overflow-hidden shadow-sm">
             <div className="px-5 py-4 border-b border-slate-50 dark:border-zinc-800 flex justify-between items-center bg-slate-50/10 dark:bg-zinc-800/10">
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Services</h3>
                {appointment.status !== ApptStatus.COMPLETED && !appointment.isPaid && (
                  <button onClick={() => setShowInjectModal(true)} className="bg-seafoam/10 text-seafoam px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all shadow-sm flex items-center gap-1.5">
                    <Plus size={10}/> Add Service
                  </button>
                )}
             </div>
             
             <div className="p-5 space-y-6">
               {(Object.entries(tasksByCategory) as [string, ApptTask[]][]).map(([category, tasks]) => (
                 <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-50 dark:border-zinc-800 pb-1.5">
                       <span className="text-lg opacity-80">{SERVICE_CATEGORIES.find(c => c.name === category)?.icon || '📋'}</span>
                       <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{category}</h4>
                    </div>
                    <div className="space-y-3 pl-2">
                      {tasks.map(task => (
                        <div key={task.id} className="bg-slate-50/50 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-800 rounded-2xl p-4 transition-all group hover:border-seafoam/10">
                           <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                              <div className="flex items-center gap-3">
                                 <input
                                   type="checkbox"
                                   checked={task.status === TaskStatus.COMPLETED}
                                   onChange={() => onUpdateStatus(appointment.id, task.id, task.status === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED)}
                                   disabled={appointment.isPaid}
                                   className="w-5 h-5 rounded border-slate-300 text-seafoam focus:ring-seafoam cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                 />
                                 <div>
                                   <p className={`text-base font-black truncate uppercase tracking-tight ${task.status === TaskStatus.COMPLETED ? 'text-slate-400 line-through' : 'text-pine dark:text-zinc-100'}`}>{task.name}</p>
                                   <p className="text-[8px] font-black text-seafoam uppercase tracking-widest mt-0.5">Value: {activeClinic.currency} {task.price?.toLocaleString()}</p>
                                 </div>
                              </div>
                              {appointment.status !== ApptStatus.COMPLETED && !appointment.isPaid && (
                                <div className="flex items-center gap-2">
                                  <button className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-seafoam rounded-lg shadow-sm transition-all"><Share2 size={14}/></button>
                                  {onDeleteTask && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Are you sure you want to delete "${task.name}"? This action cannot be undone.`)) {
                                          onDeleteTask(appointment.id, task.id);
                                        }
                                      }}
                                      className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-red-500 rounded-lg shadow-sm transition-all"
                                      title="Delete task"
                                    >
                                      <Trash2 size={14}/>
                                    </button>
                                  )}
                                </div>
                              )}
                           </div>

                           {/* Staff Assignment & Medications - Always visible */}
                           {!appointment.isPaid && (
                             <div className="mt-3 space-y-3">
                               {/* Staff Assignment */}
                               <div className="flex items-center gap-2">
                                 <Users size={12} className="text-slate-400" />
                                 <select
                                   value={task.assignedStaffId || ''}
                                   onChange={(e) => {
                                     const staffId = parseInt(e.target.value);
                                     if (staffId) {
                                       onUpdateTaskDetails(appointment.id, task.id, { assignedStaffId: staffId });
                                     }
                                   }}
                                   disabled={appointment.isPaid}
                                   className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-[9px] font-bold text-pine dark:text-zinc-300 outline-none cursor-pointer disabled:opacity-50"
                                 >
                                   <option value="">Assign Staff...</option>
                                   {availableStaff.map(staff => (
                                     <option key={staff.id} value={staff.id}>
                                       {staff.name} ({staff.role})
                                     </option>
                                   ))}
                                 </select>
                                 {task.assignedStaffId && (() => {
                                   const assignedStaff = availableStaff.find(s => s.id === task.assignedStaffId);
                                   return assignedStaff ? (
                                     <div className="flex items-center gap-1 px-2 py-1 bg-seafoam/10 rounded-lg">
                                       <span className="text-[8px] font-bold text-seafoam uppercase">{assignedStaff.role}</span>
                                     </div>
                                   ) : null;
                                 })()}
                               </div>

                               {/* Medications List */}
                               {taskMedications[task.id] && taskMedications[task.id].length > 0 && (
                                 <div className="space-y-1.5">
                                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Medications:</p>
                                   {taskMedications[task.id].map((med: any) => (
                                     <div key={med.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800">
                                       <div className="flex items-center gap-2 flex-1 min-w-0">
                                         <Pill size={12} className="text-purple-500 shrink-0" />
                                         <div className="min-w-0">
                                           <p className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{med.inventoryItem?.name || 'Medication'}</p>
                                           <p className="text-[8px] text-slate-400">
                                             Qty: {med.quantity} {med.inventoryItem?.unit || 'units'}
                                             {med.isDeducted && <span className="ml-2 text-emerald-500">✓ Deducted</span>}
                                           </p>
                                         </div>
                                       </div>
                                       {!med.isDeducted && (
                                         <button
                                           onClick={() => handleRemoveMedication(task.id, med.id)}
                                           className="p-1 text-slate-300 hover:text-red-500 shrink-0"
                                         >
                                           <X size={12} />
                                         </button>
                                       )}
                                     </div>
                                   ))}
                                 </div>
                               )}

                               {/* Add Medication Button */}
                               <button
                                 onClick={() => handleOpenMedicationModal(task.id)}
                                 className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg text-[9px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-950/40 transition-colors"
                               >
                                 <Plus size={12} />
                                 Add Medication
                               </button>
                             </div>
                           )}

                           {task.status === TaskStatus.COMPLETED && (
                             <div className="space-y-4 animate-in slide-in-from-top-1 duration-200">
                                <div className="flex flex-wrap gap-1.5">
                                   {(['positive', 'neutral', 'negative'] as const).map(sent => {
                                     const currentSentiment = getTaskValue(task.id, 'sentiment') as string;
                                     return (
                                       <button
                                        key={sent}
                                        onClick={() => updateTaskEdit(task.id, { sentiment: sent })}
                                        disabled={appointment.isPaid}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${currentSentiment === sent ? 'bg-pine text-white border-pine shadow-sm' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-400 hover:border-seafoam'}`}
                                       >
                                          {sent === 'positive' && <Smile size={10}/>}
                                          {sent === 'neutral' && <Meh size={10}/>}
                                          {sent === 'negative' && <Frown size={10}/>}
                                          {sent}
                                       </button>
                                     );
                                   })}
                                </div>

                                {getTaskValue(task.id, 'sentiment') && (
                                  <div className="flex flex-wrap gap-1.5 p-3 bg-white/50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-inner">
                                     {(SENTIMENT_PRESETS[getTaskValue(task.id, 'sentiment') as keyof typeof SENTIMENT_PRESETS] || []).map(txt => {
                                       const selectedPhrases = getTaskValue(task.id, 'selectedPhrases') as string[];
                                       const isSelected = selectedPhrases?.includes(txt);
                                       return (
                                         <button
                                          key={txt}
                                          onClick={() => togglePhrase(task.id, txt)}
                                          disabled={appointment.isPaid}
                                          className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-cyan text-white border-cyan shadow-xs' : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 text-slate-400 hover:text-pine'}`}
                                         >
                                           {txt}
                                         </button>
                                       );
                                     })}
                                  </div>
                                )}

                                <div className="flex gap-2">
                                   <div className="relative flex-1">
                                      <MessageSquare className="absolute left-3 top-3 text-slate-300" size={14}/>
                                      <textarea
                                        rows={2}
                                        value={getTaskValue(task.id, 'notes') as string}
                                        onChange={e => updateTaskEdit(task.id, { notes: e.target.value })}
                                        placeholder="Service observations..."
                                        disabled={appointment.isPaid}
                                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-xs font-medium text-pine dark:text-zinc-200 outline-none focus:ring-2 focus:ring-seafoam/5 transition-all resize-none disabled:bg-slate-50 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed"
                                      />
                                   </div>
                                   {(getTaskValue(task.id, 'selectedPhrases') as string[])?.length > 0 && !appointment.isPaid && (
                                     <button
                                       onClick={() => handleAIDescribe(task.id)}
                                       disabled={loadingTasks[task.id]}
                                       className="px-4 bg-cyan/10 text-cyan border border-cyan/20 rounded-xl font-black text-[8px] uppercase tracking-widest hover:bg-cyan hover:text-white transition-all shadow-xs flex flex-col items-center justify-center gap-1.5 group/ai"
                                     >
                                       {loadingTasks[task.id] ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="group-hover/ai:scale-110 transition-transform" />}
                                       <span>Describe</span>
                                     </button>
                                   )}
                                   {taskEdits[task.id] && !appointment.isPaid && (
                                     <button
                                       onClick={() => saveTaskNote(task.id)}
                                       disabled={loadingTasks[task.id]}
                                       className="px-4 bg-pine/10 text-pine border border-pine/20 rounded-xl font-black text-[8px] uppercase tracking-widest hover:bg-pine hover:text-white transition-all shadow-xs flex flex-col items-center justify-center gap-1.5"
                                     >
                                       {loadingTasks[task.id] ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                       <span>Save</span>
                                     </button>
                                   )}
                                </div>
                             </div>
                           )}
                        </div>
                      ))}
                    </div>
                 </div>
               ))}
             </div>
          </div>

          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[1.5rem] p-6 shadow-sm space-y-5 relative overflow-hidden group">
                   <div className="absolute -right-5 -top-5 text-seafoam/5 group-hover:scale-110 transition-transform duration-700 rotate-12"><Wand2 size={120}/></div>
                   <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-2.5">
                         <div className="p-2 bg-seafoam text-white rounded-lg shadow-sm"><FileText size={16}/></div>
                         <h3 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Visit Summary</h3>
                      </div>
                      <button
                        onClick={handleSynthesizeSummary}
                        disabled={isGeneratingSummary || appointment.status === ApptStatus.CANCELLED || appointment.isPaid}
                        className="p-2 bg-cyan/10 text-cyan rounded-lg hover:bg-cyan hover:text-white transition-all active:scale-90 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Generate Summary"
                      >
                        {isGeneratingSummary ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14}/>}
                      </button>
                   </div>

                   <div className="relative z-10">
                      {activeMedRecord ? (
                        <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-inner max-h-48 overflow-y-auto custom-scrollbar">
                           <p className="text-xs font-medium text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{activeMedRecord.treatment}</p>
                        </div>
                      ) : (
                        <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-xl opacity-30">
                           <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Registry Empty</p>
                        </div>
                      )}
                   </div>

                   {progress === 100 && appointment.status !== ApptStatus.COMPLETED && !appointment.isPaid && (
                     <div className="space-y-2 mt-1">
                       <button
                         onClick={generateSummaryPreview}
                         className="w-full bg-seafoam/10 dark:bg-seafoam/20 text-seafoam border border-seafoam/30 py-2.5 rounded-lg font-black text-[9px] uppercase tracking-[0.2em] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                       >
                         <FileText size={14} /> Preview Summary
                       </button>
                       <button onClick={handleFinalize} className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-3 rounded-lg font-black text-[9px] uppercase tracking-[0.2em] shadow-md active:scale-95 transition-all">Finalize Visit</button>
                     </div>
                   )}
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[1.5rem] p-6 shadow-sm space-y-5">
                   <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-cyan text-white rounded-lg shadow-sm"><Receipt size={16}/></div>
                      <h3 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Billing</h3>
                   </div>
                   
                   <div className="p-5 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700 shadow-inner">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
                      <h3 className="text-2xl font-black font-mono text-pine dark:text-zinc-100 tracking-tighter">{activeClinic.currency} {appointment.totalCost.toLocaleString()}</h3>
                      <div className="mt-3">
                         <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border tracking-widest ${appointment.isPaid ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                            {appointment.isPaid ? `Paid: ${appointment.paymentMethod}` : 'Pending'}
                         </span>
                      </div>
                   </div>

                   {!appointment.isPaid && (
                     <button onClick={() => setShowPaymentModal(true)} className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-4 rounded-lg font-black text-[9px] uppercase tracking-[0.2em] shadow-md active:scale-95 transition-all">Settle Bill</button>
                   )}
                   {appointment.isPaid && (
                     <button onClick={() => setActiveBottomTab('receipt')} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-200 py-4 rounded-lg font-black text-[9px] uppercase tracking-[0.2em] shadow-sm transition-all flex items-center justify-center gap-2"><Printer size={14}/> Print Receipt</button>
                   )}
                </div>
             </div>

             <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[1.5rem] shadow-sm overflow-hidden">
                <div className="flex bg-slate-50/50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800 p-1">
                   {[
                     { id: 'record', label: 'Summary', icon: FileText },
                     { id: 'invoice', label: 'Invoice', icon: Printer },
                     { id: 'receipt', label: 'Receipt', icon: Receipt },
                   ].map(tab => (
                     <button
                       key={tab.id}
                       onClick={() => setActiveBottomTab(tab.id as any)}
                       disabled={tab.id === 'receipt' && !appointment.isPaid}
                       className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeBottomTab === tab.id ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-zinc-700' : 'text-slate-400 hover:text-pine disabled:opacity-20'}`}
                     >
                        <tab.icon size={12}/> {tab.label}
                     </button>
                   ))}
                </div>

                <div className="p-6 animate-in fade-in duration-300 min-h-[400px]">
                   {activeBottomTab === 'record' && (
                     <div className="max-w-4xl mx-auto space-y-8 py-4">
                        <div className="flex justify-between items-end border-b border-slate-100 dark:border-zinc-800 pb-6">
                           <h4 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">Diagnostic Record</h4>
                           <button className="text-seafoam hover:scale-110 transition-transform"><Download size={24}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Subject</p>
                              <p className="text-lg font-black text-pine dark:text-zinc-100 uppercase">{pet.name}</p>
                           </div>
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Date</p>
                              <p className="text-lg font-black text-pine dark:text-zinc-100 uppercase">{formatDate(appointment.date)}</p>
                           </div>
                        </div>
                        <div className="space-y-4">
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Clinical Narrative</p>
                           <div className="text-base font-medium leading-relaxed text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-950 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-inner whitespace-pre-wrap">
                              {activeMedRecord?.treatment || "Summary pending synthesis."}
                           </div>
                        </div>
                     </div>
                   )}
                   {activeBottomTab === 'invoice' && (
                     <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 rounded-2xl p-10 shadow-lg font-mono">
                        <div className="flex justify-between border-b-2 border-pine pb-6 mb-8">
                           <div><p className="text-2xl font-black uppercase tracking-tighter">INVOICE</p><p className="text-[10px] font-bold text-slate-400">REF: {appointment.id}</p></div>
                           <div className="text-right uppercase font-black text-[9px]"><p>{activeClinic.name}</p></div>
                        </div>
                        <div className="space-y-4 mb-12">
                           {appointment.tasks.map(t => (
                             <div key={t.id} className="flex justify-between text-sm"><span className="font-bold">{t.name}</span><span>{activeClinic.currency} {t.price?.toLocaleString()}</span></div>
                           ))}
                        </div>
                        <div className="border-t-2 border-pine pt-6 flex justify-between items-end">
                           <span className="text-[11px] font-black uppercase text-slate-400">Total Settlement</span>
                           <span className="text-3xl font-black tracking-tighter">{activeClinic.currency} {appointment.totalCost.toLocaleString()}</span>
                        </div>
                     </div>
                   )}
                   {activeBottomTab === 'receipt' && appointment.isPaid && (
                     <div className="max-w-3xl mx-auto bg-emerald-50 dark:bg-zinc-950 border-4 border-dashed border-emerald-500/20 rounded-3xl p-10 shadow-lg font-mono text-emerald-700 dark:text-emerald-400">
                        <div className="flex justify-between border-b border-emerald-500/20 pb-6 mb-8">
                           <div><p className="text-3xl font-black uppercase tracking-tighter">PAID</p><p className="text-[10px] font-bold opacity-60">REF: {appointment.id}</p></div>
                           <div className="text-right text-3xl opacity-20"><CheckCircle2 size={40}/></div>
                        </div>
                        <div className="space-y-3 mb-12 text-sm">
                           <div className="flex justify-between"><span>Registry ID</span><span className="font-black">#{pet.id}</span></div>
                           <div className="flex justify-between"><span>Patient</span><span className="font-black uppercase">{pet.name}</span></div>
                           <div className="flex justify-between"><span>Method</span><span className="font-black">{appointment.paymentMethod}</span></div>
                        </div>
                        <div className="border-t border-emerald-500/20 pt-6 flex justify-between items-end">
                           <span className="text-xs font-black uppercase">Captured</span>
                           <span className="text-4xl font-black tracking-tighter">{activeClinic.currency} {appointment.totalCost.toLocaleString()}</span>
                        </div>
                     </div>
                   )}
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-5">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[1.5rem] p-6 shadow-sm group">
             <div className="flex items-center gap-3 mb-6">
               <div className="w-14 h-14 rounded-[1.25rem] bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-3xl shadow-inner group-hover:scale-105 transition-transform duration-300">
                 {pet.species === 'Dog' ? '🐶' : '🐱'}
               </div>
               <div className="min-w-0">
                 <h2 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-tight uppercase truncate">{pet.name}</h2>
                 <p className="text-seafoam text-[8px] font-black uppercase tracking-[0.2em] mt-0.5">{pet.breed} • {pet.age}Y</p>
               </div>
             </div>
             <div className="space-y-3 pt-4 border-t border-slate-50 dark:border-zinc-800">
                <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                   <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-1">Schedule</p>
                   <p className="text-pine dark:text-zinc-100 font-black text-xs">{new Date(appointment.date).toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                   <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-1">Billing Value</p>
                   <p className="text-emerald-600 font-black text-lg font-mono">{activeClinic.currency} {appointment.totalCost.toLocaleString()}</p>
                </div>
             </div>
           </div>

           <div className="bg-pine rounded-[1.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-700"><Stethoscope size={50}/></div>
              <p className="text-mist/40 text-[8px] font-black uppercase tracking-[0.3em] mb-4">Progress Index</p>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                       <span className="text-[10px] font-black uppercase tracking-widest">Done: {progress}%</span>
                    </div>
                 </div>
                 <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-seafoam transition-all duration-700" style={{ width: `${progress}%` }}></div>
                 </div>
                 {appointment.status === ApptStatus.COMPLETED && (
                   <button
                     onClick={() => onScheduleFollowup(appointment)}
                     className="w-full mt-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white py-3 px-4 rounded-xl transition-all active:scale-95 flex items-center justify-between group/btn"
                   >
                     <div className="flex items-center gap-2">
                       <Calendar size={16} />
                       <span className="text-[9px] font-black uppercase tracking-widest">Schedule Follow-up</span>
                     </div>
                     <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                   </button>
                 )}
              </div>
           </div>

           {appointment.status === ApptStatus.COMPLETED && !appointment.isPaid && (
             <button
              onClick={() => onScheduleFollowup(appointment)}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white p-6 rounded-[1.5rem] shadow-xl transition-all active:scale-95 group relative overflow-hidden text-left"
             >
                <div className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-125 transition-transform duration-500"><Calendar size={80}/></div>
                <h3 className="text-lg font-black uppercase tracking-tighter mb-1 relative z-10">Spawn Follow-up</h3>
                <p className="text-indigo-100 text-[9px] font-bold relative z-10 opacity-80">Link new medical node.</p>
                <div className="mt-4 flex items-center gap-2 relative z-10">
                   <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center"><ArrowRight size={14}/></div>
                   <span className="text-[8px] font-black uppercase tracking-widest">Connect Sequence</span>
                </div>
             </button>
           )}

           {appointment.status === ApptStatus.COMPLETED && hasVaccinationTasks && (
             <button
              onClick={handleCreateVaccinationRecords}
              disabled={isCreatingVaccinations}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white p-6 rounded-[1.5rem] shadow-xl transition-all active:scale-95 group relative overflow-hidden text-left"
             >
                <div className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-125 transition-transform duration-500"><Syringe size={80}/></div>
                <h3 className="text-lg font-black uppercase tracking-tighter mb-1 relative z-10">
                  {isCreatingVaccinations ? 'Creating...' : 'Create Vaccination Records'}
                </h3>
                <p className="text-emerald-100 text-[9px] font-bold relative z-10 opacity-80">
                  Generate vaccination records from this appointment.
                </p>
                <div className="mt-4 flex items-center gap-2 relative z-10">
                   <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center"><Syringe size={14}/></div>
                   <span className="text-[8px] font-black uppercase tracking-widest">Auto-Generate</span>
                </div>
             </button>
           )}
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-pine/95 dark:bg-black/95 backdrop-blur-xl z-[800] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200">
              <header className="text-center mb-8">
                 <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Settlement</h2>
                 <p className="text-seafoam text-[9px] font-black uppercase mt-1 tracking-widest">Yield: {activeClinic.currency} {appointment.totalCost.toLocaleString()}</p>
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
                    onClick={() => { onProcessPayment(appointment.id, method.value); setShowPaymentModal(false); setActiveBottomTab('receipt'); }}
                    className="flex flex-col items-center gap-3 p-6 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-2 border-slate-100 dark:border-zinc-700 hover:border-seafoam transition-all group active:scale-95"
                   >
                     <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg shadow-xs text-slate-300 group-hover:text-seafoam transition-colors"><CreditCard size={24}/></div>
                     <span className="text-[9px] font-black uppercase tracking-widest">{method.label}</span>
                   </button>
                 ))}
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="w-full mt-6 py-3 text-slate-400 dark:text-zinc-600 font-black text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors">Abort</button>
           </div>
        </div>
      )}

      {showInjectModal && (
        <div className="fixed inset-0 bg-pine/90 dark:bg-black/90 backdrop-blur-xl z-[700] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-4xl w-full p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200">
              <header className="flex justify-between items-start mb-8">
                 <div>
                   <h2 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-tight">Injection Terminal</h2>
                   <p className="text-seafoam text-[9px] font-black uppercase mt-1 tracking-widest">Augment visit workflow nodes</p>
                 </div>
                 <button onClick={() => setShowInjectModal(false)} className="text-slate-400 hover:rotate-90 transition-all duration-300"><X size={28}/></button>
              </header>
              <div className="space-y-10">
                 <div className="flex gap-3 overflow-x-auto custom-scrollbar no-scrollbar pb-4 px-1">
                    {SERVICE_CATEGORIES.map(cat => (
                      <button key={cat.id} onClick={() => setSelectedCatId(cat.id)} className={`shrink-0 flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all hover:scale-105 active:scale-95 ${selectedCatId === cat.id ? 'bg-seafoam border-seafoam text-white shadow-lg shadow-seafoam/20' : 'bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 text-slate-400'}`}>
                        <span className="text-3xl">{cat.icon}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest">{cat.name}</span>
                      </button>
                    ))}
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PREDEFINED_SERVICES.filter(s => s.categoryId === selectedCatId).map(svc => (
                       <button 
                        key={svc.id} 
                        onClick={() => {
                          onInjectTask(appointment.id, {
                            id: Math.floor(Math.random() * 1000000),
                            name: svc.name,
                            category: SERVICE_CATEGORIES.find(c => c.id === selectedCatId)?.name || 'General',
                            status: TaskStatus.PENDING,
                            assignedStaffId: staffMembers[0].id,
                            price: svc.basePrice
                          });
                          setShowInjectModal(false);
                        }}
                        className="flex items-center justify-between p-6 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700 rounded-2xl hover:border-seafoam transition-all group shadow-xs active:scale-95 text-left"
                       >
                          <div className="min-w-0">
                             <p className="text-base font-black text-pine dark:text-zinc-100 leading-tight truncate uppercase tracking-tight">{svc.name}</p>
                             <p className="text-seafoam font-black font-mono text-xs mt-1.5 uppercase tracking-[0.1em]">Fee: {activeClinic.currency} {svc.basePrice.toLocaleString()}</p>
                          </div>
                          <ChevronRight size={20} className="text-seafoam group-hover:translate-x-1.5 transition-transform" />
                       </button>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Summary Preview Modal */}
      {showSummaryPreview && summaryPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-seafoam/10 text-seafoam rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Visit Summary Preview</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">This summary will be saved to the medical record</p>
                </div>
              </div>
              <button
                onClick={() => setShowSummaryPreview(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all active:scale-95"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] custom-scrollbar space-y-6">
              {/* Diagnosis Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-black text-seafoam uppercase tracking-widest">Diagnosis</h3>
                <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
                  <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">{summaryPreview.diagnosis}</p>
                </div>
              </div>

              {/* Treatment Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-black text-seafoam uppercase tracking-widest">Treatment</h3>
                <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
                  <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">{summaryPreview.treatment}</p>
                </div>
              </div>

              {/* Medications Section */}
              {summaryPreview.medications.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-seafoam uppercase tracking-widest">Medications</h3>
                  <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
                    <ul className="list-disc list-inside space-y-1">
                      {summaryPreview.medications.map((med, idx) => (
                        <li key={idx} className="text-sm text-slate-700 dark:text-zinc-300">{med}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Service Notes Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-black text-seafoam uppercase tracking-widest">Service Notes</h3>
                <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2">
                  {summaryPreview.serviceNotes.map((note, idx) => (
                    <div key={idx} className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pb-2 border-b border-slate-200 dark:border-zinc-700 last:border-0 last:pb-0">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
              <button
                onClick={() => setShowSummaryPreview(false)}
                className="flex-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-sm active:scale-95 transition-all"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowSummaryPreview(false);
                  handleFinalize();
                }}
                className="flex-1 bg-pine dark:bg-zinc-100 text-white dark:text-pine py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-md active:scale-95 transition-all"
              >
                Finalize Visit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medication Selection Modal */}
      {showMedicationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-950/30 rounded-xl">
                  <Pill className="text-purple-600 dark:text-purple-400" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">Add Medication</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Select from inventory</p>
                </div>
              </div>
              <button
                onClick={handleCloseMedicationModal}
                className="p-2 text-slate-400 hover:text-pine transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam" size={16} />
                <input
                  type="text"
                  placeholder="Search medications..."
                  value={medicationSearchQuery}
                  onChange={(e) => setMedicationSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-12 pr-6 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/10 outline-none font-bold text-sm shadow-inner"
                />
              </div>

              {/* Loading State */}
              {loadingMedications && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pine dark:border-zinc-100"></div>
                </div>
              )}

              {/* Medications List */}
              {!loadingMedications && (
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {filteredMedications.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="mx-auto mb-4 text-slate-400" size={48} />
                      <p className="font-bold text-slate-400">No medications found</p>
                    </div>
                  ) : (
                    filteredMedications.map((med) => (
                      <button
                        key={med.id}
                        onClick={() => setSelectedMedicationId(med.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          selectedMedicationId === med.id
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                            : 'border-slate-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-pine dark:text-zinc-100 mb-1">{med.name}</p>
                            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-400">
                              <span className="font-mono">{med.sku}</span>
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-[10px] font-bold">
                                {med.category}
                              </span>
                              {/* Stock Status Badge */}
                              {med.status === 'LOW_STOCK' && (
                                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded text-[10px] font-bold uppercase">
                                  Low Stock
                                </span>
                              )}
                              {med.expiryDate && new Date(med.expiryDate) < new Date() && (
                                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded text-[10px] font-bold uppercase">
                                  Expired
                                </span>
                              )}
                              {med.expiryDate && new Date(med.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && new Date(med.expiryDate) >= new Date() && (
                                <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 rounded text-[10px] font-bold uppercase">
                                  Expiring Soon
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${med.status === 'LOW_STOCK' ? 'text-amber-600 dark:text-amber-400' : 'text-pine dark:text-zinc-100'}`}>
                              {med.quantity} {med.unit}
                            </p>
                            <p className="text-[10px] text-slate-400">Available</p>
                            {med.expiryDate && (
                              <p className="text-[9px] text-slate-400 mt-1">
                                Exp: {new Date(med.expiryDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        {selectedMedicationId === med.id && (
                          <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                                  Quantity
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max={med.quantity}
                                  value={medicationQuantity}
                                  onChange={(e) => setMedicationQuantity(parseInt(e.target.value) || 1)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-pine dark:text-zinc-100 outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                                  Unit
                                </label>
                                <div className="bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-bold text-pine dark:text-zinc-100">
                                  {med.unit}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                                Notes (Optional)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g., Administer after meal"
                                value={medicationNotes}
                                onChange={(e) => setMedicationNotes(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-zinc-800 space-y-3">
              {/* Error Message */}
              {medicationError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <AlertCircle className="text-red-600 dark:text-red-400 shrink-0" size={16} />
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">{medicationError}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleCloseMedicationModal}
                className="px-6 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMedication}
                disabled={!selectedMedicationId}
                className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Add Medication
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentDetailView;
