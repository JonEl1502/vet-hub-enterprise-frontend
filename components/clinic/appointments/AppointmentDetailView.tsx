
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Appointment, ApptTask, TaskStatus, User, Pet, ApptStatus, Clinic, MedicalRecord, Client, ClientDiscount } from '../../../types';
import {
  Share2, X, Plus, ChevronRight, CheckCircle2, Circle, FileText, Receipt,
  CreditCard, Stethoscope, Download, Printer, Calendar, MessageSquare,
  Smile, Meh, Frown, Sparkles, Wand2, Loader2, Link2, ArrowRight, Trash2, Lock, Syringe, Users, Pill, AlertCircle, Search, RefreshCw, Phone, Mail, User as UserIcon, Clock, XCircle, ExternalLink, Copy
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../../constants';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import { generateServiceNote, generateFullVisitSummary, analyzeServiceObservations } from '../../../services/geminiService';
import { formatDate, formatTime } from '../../../services/utils/dateFormatter';
import { vaccinationsAPI, appointmentsAPI, InventoryItem, clientDiscountsAPI, dialog } from '../../../services';
import { VaccinationRecord } from '../../../services/modules/vaccinations.api';
import { appointmentMedicationsAPI, AppointmentMedication } from '../../../services/modules/appointmentMedications.api';
import { toast } from '../../../services/utils/toast';
import { paymentGatewaysAPI } from '../../../services/modules/paymentGateways.api';
import TaskCard from './appointment/TaskCard';
import PatientCard from './appointment/PatientCard';
import MedicationPanel from './appointment/MedicationPanel';
import Money from '../../shared/common/Money';
import { COUNTRIES } from '../../../utils/countries';
import AIAssistant from './appointment/AIAssistant';

import { useAutoSave } from '../../../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import KeyboardShortcutsHelp from '../../shared/common/KeyboardShortcutsHelp';
import { useData } from '../../../contexts/DataContext';
import ErrorDialog from '../../shared/common/ErrorDialog';

interface Props {
  appointment: Appointment;
  pet: Pet;
  client?: Client;
  staffMembers: User[];
  clinics: Clinic[];
  activeClinic: Clinic;
  onUpdateStatus: (apptId: number, taskId: number, status: TaskStatus) => void;
  onUpdateTaskDetails: (apptId: number, taskId: number, data: Partial<ApptTask>) => void;
  onReassign: (apptId: number, taskId: number, staffId: number) => void;
  onDeleteTask?: (apptId: number, taskId: number) => void;
  onBack: () => void;
  onUpdateApptStatus: (id: number, status: ApptStatus, diagnosis: string, silent?: boolean) => void;
  onInjectTask: (apptId: number, task: ApptTask) => void;
  onProcessPayment: (apptId: number, method: string, discountType?: string, discountValue?: number) => void;
  onScheduleFollowup: (parentAppt: Appointment) => void;
  onNavigateToVisit: (visitId: number) => void;
  onNavigateToClient?: (clientId: number) => void;
  onNavigateToPet?: (petId: number) => void;
  onNavigateToStaff?: (staffId: number) => void;
  allAppointments: Appointment[];
  onRefreshDashboard?: () => Promise<void>;
}

const SENTIMENT_PRESETS: Record<'positive' | 'neutral' | 'negative', string[]> = {
  positive: [
    'Excellent tolerance', 'Stable vitals', 'Smooth procedure', 'Highly responsive', 'Recovered quickly',
    'Patient was calm', 'Good appetite', 'Normal behavior', 'Alert and active', 'Cooperative patient',
    'Strong pulse', 'Clear lungs', 'Healthy coat', 'Good hydration', 'Normal temperature',
    'Quick healing', 'Positive prognosis', 'Excellent compliance'
  ],
  neutral: [
    'Standard routine', 'Expected outcome', 'Average response', 'No complications', 'Baseline maintained',
    'Routine procedure', 'Normal findings', 'Typical recovery', 'Standard vitals', 'As expected',
    'Regular monitoring', 'Stable condition', 'Unremarkable exam', 'Within normal limits'
  ],
  negative: [
    'Aggressive behavior', 'Minor complications', 'Difficult handling', 'Stressed patient', 'Slow recovery',
    'Vital variance', 'Elevated temperature', 'Labored breathing', 'Poor appetite', 'Lethargic',
    'Dehydrated', 'Anxious', 'Resistant to treatment', 'Abnormal findings', 'Requires monitoring',
    'Delayed response', 'Adverse reaction', 'Guarded prognosis'
  ]
};

const AppointmentDetailView: React.FC<Props> = ({
  appointment, pet, client, staffMembers, clinics, activeClinic, onUpdateStatus, onUpdateTaskDetails, onDeleteTask,
  onBack, onUpdateApptStatus, onInjectTask, onProcessPayment, onScheduleFollowup, onNavigateToVisit,
  onNavigateToClient, onNavigateToPet, onNavigateToStaff, allAppointments, onRefreshDashboard
}) => {
  // Get inventory from DataContext (already loaded and cached)
  const { inventory, updateAppointmentOptimistically, refreshInventory } = useData();

  // Appointment is finalized when status is PENDING_PAYMENT or COMPLETED (or already paid)
  const isFinalized = appointment.status === ApptStatus.PENDING_PAYMENT || appointment.status === ApptStatus.COMPLETED || appointment.isPaid;

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
  // Pull categories + services from the seeded backend catalog instead of
  // the old hardcoded SERVICE_CATEGORIES / PREDEFINED_SERVICES. The icon
  // mapping still lives in the constants — useful client-side and not worth
  // a schema column right now.
  const { categories: refCategories, services: refServices } = useReferenceData();
  const categoryIconByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of SERVICE_CATEGORIES) m.set(c.name, c.icon);
    return m;
  }, []);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  // Initialise once categories arrive.
  useEffect(() => {
    if (selectedCatId === null && refCategories.length > 0) {
      setSelectedCatId(refCategories[0].id);
    }
  }, [refCategories, selectedCatId]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'record' | 'medications' | 'invoice' | 'receipt'>('record');
  // Per-invoice currency override. Defaults to the clinic's currency on
  // every render where the active clinic changes. The user can override
  // via the picker in the Invoice toolbar (e.g. print a USD invoice for
  // an international client even though the clinic books in KES).
  const [invoiceCurrency, setInvoiceCurrency] = useState<string | null>(null);

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSettlingBill, setIsSettlingBill] = useState(false);
  const [isUpdatingPaymentMethod, setIsUpdatingPaymentMethod] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<string | null>(null);
  const [settleDiscountType, setSettleDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [settleDiscountValue, setSettleDiscountValue] = useState<string>('');
  const [clientDiscounts, setClientDiscounts] = useState<ClientDiscount[]>([]);
  const [selectedClientDiscount, setSelectedClientDiscount] = useState<ClientDiscount | null>(null);

  // ─── Gateway (BYOK Stripe / Mpesa) payment flow ───────────────────────────
  const [gatewayConfigs, setGatewayConfigs] = useState<Array<{ provider: 'STRIPE' | 'MPESA'; isActive: boolean }>>([]);
  const [useGateway, setUseGateway] = useState(true);
  const [mpesaPhone, setMpesaPhone] = useState<string>('');
  const [gatewayStatus, setGatewayStatus] = useState<null | {
    provider: 'STRIPE' | 'MPESA';
    state: 'INITIATING' | 'PENDING' | 'SETTLED' | 'FAILED';
    message?: string;
    checkoutUrl?: string;
    providerRef?: string;
  }>(null);
  const gatewayPollRef = useRef<number | null>(null);

  const activeGatewayProviders = gatewayConfigs.filter(g => g.isActive).map(g => g.provider);
  const gatewayAvailable = (method: string | null) =>
    (method === 'M_PESA' && activeGatewayProviders.includes('MPESA')) ||
    (method === 'CARD' && activeGatewayProviders.includes('STRIPE'));

  useEffect(() => {
    if (!appointment.clinicId) return;
    paymentGatewaysAPI.list(appointment.clinicId)
      .then(res => {
        if (res.success && res.data) {
          setGatewayConfigs(res.data.map(c => ({ provider: c.provider, isActive: c.isActive })));
        }
      })
      .catch(() => setGatewayConfigs([]));
  }, [appointment.clinicId]);

  useEffect(() => {
    // pre-seed phone from client record if present
    if (client?.phone) setMpesaPhone(client.phone);
  }, [client?.id]);

  useEffect(() => {
    return () => {
      if (gatewayPollRef.current) window.clearInterval(gatewayPollRef.current);
    };
  }, []);
  const [isCreatingVaccinations, setIsCreatingVaccinations] = useState(false);
  const [vaccinationRecords, setVaccinationRecords] = useState<VaccinationRecord[]>([]);
  const [showVaccinationModal, setShowVaccinationModal] = useState(false);

  // Local state for task edits (sentiment and notes) before saving
  const [taskEdits, setTaskEdits] = useState<Record<number, Partial<ApptTask>>>({});

  // Per-task loading state for immediate saves
  const [loadingTaskIds, setLoadingTaskIds] = useState<Set<number>>(new Set());
  // Per-task saving state for note saves (disables card like service updates)
  const [savingNoteIds, setSavingNoteIds] = useState<Set<number>>(new Set());
  // Per-task generating state for AI note generation (disables card)
  const [generatingNoteIds, setGeneratingNoteIds] = useState<Set<number>>(new Set());
  // Batch update state - track pending changes (staff + edits only; status is now immediate)
  const [pendingStaffAssignments, setPendingStaffAssignments] = useState<Record<number, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [isRegeneratingTxn, setIsRegeneratingTxn] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Summary preview state
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);
  const [summaryPreviewTab, setSummaryPreviewTab] = useState<'summary' | 'invoice' | 'receipt'>('summary');
  const [summaryPreview, setSummaryPreview] = useState<{
    diagnosis: string;
    treatment: string;
    medications: string[];
    serviceNotes: string[];
  } | null>(null);

  // Medications from appointment payload (appointmentMedications table, no extra API call)
  // taskEdits takes priority for optimistic add/remove within the session
  const apptMedications = useMemo(() => {
    const baseMeds = (appointment as any).medications ?? [];
    // Build a per-task override map from taskEdits
    const editedTasks = new Set(Object.keys(taskEdits).map(Number));
    const baseByTask: Record<number, any[]> = {};
    baseMeds.forEach((med: any) => {
      const tid = med.taskId != null ? parseInt(med.taskId) : -1;
      if (!baseByTask[tid]) baseByTask[tid] = [];
      baseByTask[tid].push(med);
    });
    // Merge: for tasks with edits, prefer taskEdits; for others use base payload
    const result: any[] = [];
    appointment.tasks.forEach(task => {
      const meds = editedTasks.has(task.id) && taskEdits[task.id]?.medications != null
        ? (taskEdits[task.id].medications as any[])
        : (baseByTask[task.id] ?? []);
      meds.forEach(med => result.push({ ...med, taskName: task.name || 'Unknown Task' }));
    });
    return result;
  }, [appointment, taskEdits]);

  // Medication modal state
  const [showMedicationModal, setShowMedicationModal] = useState<number | null>(null); // taskId
  const [medicationModalTab, setMedicationModalTab] = useState<'saved' | 'search'>('saved'); // Tab state
  const [availableMedications, setAvailableMedications] = useState<InventoryItem[]>([]);
  const [loadingMedications, setLoadingMedications] = useState(false);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>('');
  const [medicationQuantity, setMedicationQuantity] = useState<number>(1);
  const [medicationNotes, setMedicationNotes] = useState<string>('');
  const [medicationSearchQuery, setMedicationSearchQuery] = useState<string>('');
  const [medicationError, setMedicationError] = useState<string>('');

  // AI-Generated Notes Preview state
  const [showAINotesPreview, setShowAINotesPreview] = useState(false);
  const [aiGeneratedNotes, setAIGeneratedNotes] = useState<string>('');
  const [editableAINotes, setEditableAINotes] = useState<string>('');
  const [isGeneratingAINotes, setIsGeneratingAINotes] = useState(false);
  const [aiNotesError, setAINotesError] = useState<string>('');

  // AI Assistant for Individual Services state
  const [showAIAssistant, setShowAIAssistant] = useState<number | null>(null); // taskId
  const [aiAssistantInput, setAIAssistantInput] = useState<string>('');
  const [aiAssistantAnalysis, setAIAssistantAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Expandable section state - track which section is open for each task
  type ExpandableSection = 'medication' | 'notes' | 'ai' | null;
  const [expandedSections, setExpandedSections] = useState<Record<number, ExpandableSection>>({});

  // Keyboard shortcuts state
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Error dialog state
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title?: string; message: string }>({ open: false, message: '' });
  const showError = (message: string, title?: string) => setErrorDialog({ open: true, message, title });

  // Medications are now stored as nested objects within tasks
  // No need to load them separately - they're already part of appointment.tasks[].medications

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

  // Load existing vaccination records for this appointment
  useEffect(() => {
    if (appointment.status === ApptStatus.COMPLETED && hasVaccinationTasks) {
      vaccinationsAPI.getByAppointment(appointment.id.toString())
        .then(records => { if (records.length > 0) setVaccinationRecords(records); })
        .catch(() => {});
    }
  }, [appointment.id, appointment.status, hasVaccinationTasks]);

  // Get parent appointment if this is a follow-up
  const parentAppointment = useMemo(() => {
    if (!appointment?.parentAppointmentId || !allAppointments) return null;
    return allAppointments.find(a => a.id === appointment.parentAppointmentId);
  }, [appointment?.parentAppointmentId, allAppointments]);

  // Get child follow-up appointments
  const childFollowUps = useMemo(() => {
    if (!appointment || !allAppointments) return [];
    return allAppointments.filter(a => a.parentAppointmentId === appointment.id);
  }, [appointment, allAppointments]);

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

  // Detect if current appointment is a follow-up (has a parent)
  const isFollowUpAppointment = useMemo(() => {
    const hasParent = appointment?.parentAppointmentId !== undefined &&
                      appointment?.parentAppointmentId !== null &&
                      appointment?.parentAppointmentId > 0;
    console.log('🔍 Follow-up check:', {
      appointmentId: appointment?.id,
      parentAppointmentId: appointment?.parentAppointmentId,
      isFollowUp: hasParent
    });
    return hasParent;
  }, [appointment?.parentAppointmentId, appointment?.id]);

  // Find child appointments (follow-ups of this appointment)
  const childAppointments = useMemo(() => {
    if (!allAppointments || !appointment?.id) return [];
    const children = allAppointments.filter(a =>
      a.parentAppointmentId !== undefined &&
      a.parentAppointmentId !== null &&
      a.parentAppointmentId === appointment.id
    );
    console.log('🔍 Child appointments:', children.length > 0 ? `Found ${children.length}` : 'None');
    return children;
  }, [allAppointments, appointment?.id]);

  // Check if this appointment has follow-ups
  const hasFollowUps = useMemo(() => {
    return childAppointments.length > 0;
  }, [childAppointments]);

  // Get current value from local edits or task
  const getTaskValue = (taskId: number, field: 'sentiment' | 'notes' | 'selectedPhrases') => {
    const task = appointment.tasks.find(t => t.id === taskId);
    if (!task) return field === 'selectedPhrases' ? [] : '';
    return taskEdits[taskId]?.[field] ?? task[field] ?? (field === 'selectedPhrases' ? [] : '');
  };

  // Task status comes directly from the appointment prop (updated via DataContext)
  const getTaskStatus = (taskId: number): TaskStatus => {
    return appointment.tasks.find(t => t.id === taskId)?.status ?? TaskStatus.PENDING;
  };

  // Get current staff assignment considering pending changes
  const getTaskStaffId = (taskId: number): number | undefined => {
    return pendingStaffAssignments[taskId] ?? appointment.tasks.find(t => t.id === taskId)?.assignedStaffId;
  };

  // Handle task status change — immediate API call, no batching
  const handleTaskStatusChange = async (taskId: number, currentStatus: TaskStatus) => {
    if (loadingTaskIds.has(taskId)) return;
    const newStatus = currentStatus === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED;

    // Mark this task as loading
    setLoadingTaskIds(prev => { const s = new Set(prev); s.add(taskId); return s; });

    // Optimistic update via DataContext so the appointment prop re-renders
    updateAppointmentOptimistically(appointment.id, appt => ({
      ...appt,
      tasks: appt.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t),
    }));

    try {
      await appointmentsAPI.updateTask(appointment.id, taskId, { status: newStatus });

      // Auto-manage appointment status based on task completion
      if (newStatus === TaskStatus.COMPLETED && appointment.status === ApptStatus.SCHEDULED) {
        // First task marked done → promote to IN_PROGRESS (silent, no loading spinner)
        onUpdateApptStatus(appointment.id, ApptStatus.IN_PROGRESS, '', true);
      } else if (newStatus === TaskStatus.PENDING && appointment.status === ApptStatus.IN_PROGRESS) {
        // Task unchecked — if ALL tasks are now PENDING, revert to SCHEDULED
        const allPending = appointment.tasks.every(t => t.id === taskId || t.status === TaskStatus.PENDING);
        if (allPending) {
          onUpdateApptStatus(appointment.id, ApptStatus.SCHEDULED, '', true);
        }
      }
    } catch (error: any) {
      // Revert optimistic update
      updateAppointmentOptimistically(appointment.id, appt => ({
        ...appt,
        tasks: appt.tasks.map(t => t.id === taskId ? { ...t, status: currentStatus } : t),
      }));
      showError(error?.response?.data?.message || error?.message || 'Failed to update task status. Please try again.', 'Task Update Failed');
    } finally {
      setLoadingTaskIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  };

  // Handle staff assignment change (local state only)
  const handleStaffAssignment = (taskId: number, staffId: number) => {
    setPendingStaffAssignments(prev => ({
      ...prev,
      [taskId]: staffId
    }));
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

  // Toggle expandable section for a task
  const toggleExpandableSection = (taskId: number, section: ExpandableSection) => {
    console.log(`[AppointmentDetailView] Toggling section "${section}" for task ${taskId}`);
    setExpandedSections(prev => {
      const currentSection = prev[taskId];
      const newSection = currentSection === section ? null : section;
      console.log(`[AppointmentDetailView] Task ${taskId}: ${currentSection} -> ${newSection}`);
      // If clicking the same section, close it; otherwise, open the new section
      return {
        ...prev,
        [taskId]: newSection
      };
    });

    // If opening medication section, load available medications if not already loaded
    if (section === 'medication' && availableMedications.length === 0) {
      console.log('[AppointmentDetailView] Loading available medications for medication section...');
      loadMedications();
    }
  };

  // Load medications with cache-first strategy
  // The inventoryAPI.getAll() already uses the centralized cache system,
  // so we don't need manual localStorage caching here.
  const loadMedications = async (forceRefresh = false) => {
    // If medications are already loaded and not forcing refresh, skip
    if (!forceRefresh && availableMedications.length > 0) {
      console.log('[AppointmentDetailView] Medications already loaded, skipping API call');
      return;
    }

    setLoadingMedications(true);
    setMedicationError('');
    try {
      // Use inventory from DataContext (already loaded and cached)
      const items = inventory || [];

      console.log(`[AppointmentDetailView] Loaded ${items.length} inventory items as available medications (using DataContext)`);
      setAvailableMedications(items);
    } catch (error) {
      console.error('Failed to load medications:', error);
      setMedicationError('Failed to load medications. Please try again.');
      setAvailableMedications([]);
    } finally {
      setLoadingMedications(false);
    }
  };

  // Load medications when inventory from DataContext changes
  useEffect(() => {
    if (inventory.length > 0 && availableMedications.length === 0) {
      loadMedications();
    }
  }, [inventory]);


  const saveTaskNote = async (taskId: number) => {
    const edits = taskEdits[taskId];
    if (!edits) return;

    setSavingNoteIds(prev => new Set(prev).add(taskId));
    try {
      await onUpdateTaskDetails(appointment.id, taskId, edits);
      setTaskEdits(prev => {
        const newEdits = { ...prev };
        delete newEdits[taskId];
        return newEdits;
      });
    } catch (error) {
      console.error('Failed to save task note:', error);
    } finally {
      setSavingNoteIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleAIDescribe = async (taskId: number) => {
    const task = appointment.tasks.find(t => t.id === taskId);
    const selectedPhrases = getTaskValue(taskId, 'selectedPhrases') as string[];
    const sentiment = getTaskValue(taskId, 'sentiment') as string;

    if (!selectedPhrases?.length) return;

    setGeneratingNoteIds(prev => new Set(prev).add(taskId));
    try {
      const narrative = await generateServiceNote(task?.name || '', sentiment || 'neutral', selectedPhrases);
      // Update local state with generated note - DO NOT save to API immediately
      // This allows users to regenerate notes multiple times without API spam
      updateTaskEdit(taskId, { notes: narrative });
    } catch (error) {
      console.error('Failed to generate AI note:', error);
    } finally {
      setGeneratingNoteIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
    }
  };

  const handleSynthesizeSummary = async () => {
    const completedTasks = appointment.tasks.filter(t => t.notes);
    if (completedTasks.length === 0) {
      toast.warning('Please generate AI descriptions for individual services before synthesizing the final summary.');
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
  const handleOpenMedicationModal = (taskId: number) => {
    setShowMedicationModal(taskId);
    setMedicationModalTab('saved'); // Default to saved medications tab

    // Load medications if not already loaded (uses inventory from DataContext - no API call)
    if (availableMedications.length === 0) {
      loadMedications();
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

  const handleAddMedication = async (taskId?: number) => {
    const targetTaskId = taskId || showMedicationModal;
    if (!targetTaskId || !selectedMedicationId) {
      setMedicationError('Please select a medication');
      return;
    }

    const medication = availableMedications.find(m => m.id === selectedMedicationId);
    if (!medication) {
      setMedicationError('Selected medication not found');
      return;
    }

    if (medicationQuantity <= 0) {
      setMedicationError('Quantity must be greater than 0');
      return;
    }

    if (medicationQuantity > medication.quantity) {
      setMedicationError(`Insufficient stock. Only ${medication.quantity} ${medication.unit} available`);
      return;
    }

    if (medication.expiryDate && new Date(medication.expiryDate) < new Date()) {
      setMedicationError('This medication has expired and cannot be used');
      return;
    }

    if (medication.status === 'LOW_STOCK' && medicationQuantity > medication.quantity / 2) {
      const confirmUse = await dialog.confirm({
        title: 'Low stock warning',
        message: `Only ${medication.quantity} ${medication.unit} of this medication remain.\nYou are requesting ${medicationQuantity} ${medication.unit}. Continue?`,
        confirmLabel: 'Continue',
        variant: 'warning',
      });
      if (!confirmUse) return;
    }

    const medicationTotalCost = medication.price * medicationQuantity;

    // Optimistic local state update
    const optimisticMed = {
      inventoryItemId: medication.id,
      inventoryItem: {
        id: medication.id,
        name: medication.name,
        sku: medication.sku,
        category: medication.category,
        unit: medication.unit,
        availableQuantity: medication.quantity,
        unitPrice: medication.price
      },
      quantity: medicationQuantity,
      notes: medicationNotes,
      isDeducted: false,
    };

    const task = appointment.tasks.find(t => t.id === targetTaskId);
    if (task) {
      const currentTaskPrice = taskEdits[targetTaskId]?.price ?? task.price ?? 0;
      const newTaskPrice = currentTaskPrice + medicationTotalCost;
      setTaskEdits(prev => ({
        ...prev,
        [targetTaskId]: {
          ...prev[targetTaskId],
          medications: [...(taskEdits[targetTaskId]?.medications ?? ((appointment as any).medications ?? []).filter((m: any) => String(m.taskId) === String(targetTaskId))), optimisticMed],
          price: newTaskPrice,
        }
      }));
    }

    // Reset form and close modal immediately for responsiveness
    setSelectedMedicationId('');
    setMedicationQuantity(1);
    setMedicationNotes('');
    setMedicationError('');
    if (showMedicationModal) handleCloseMedicationModal();

    // Persist to backend: records the medication, deducts inventory, updates appointment total
    try {
      const saved = await appointmentMedicationsAPI.addMedication(appointment.id, {
        inventoryItemId: medication.id,
        quantity: medicationQuantity,
        taskId: String(targetTaskId),
        notes: medicationNotes || undefined,
      });

      // Replace optimistic entry with real record (has id + isDeducted: true)
      const savedMed = {
        ...saved,
        inventoryItem: optimisticMed.inventoryItem,
      };
      if (task) {
        setTaskEdits(prev => {
          const meds = prev[targetTaskId]?.medications ?? [];
          const idx = meds.indexOf(optimisticMed);
          const updated = idx >= 0
            ? [...meds.slice(0, idx), savedMed, ...meds.slice(idx + 1)]
            : [...meds, savedMed];
          return { ...prev, [targetTaskId]: { ...prev[targetTaskId], medications: updated } };
        });
      }

      // Refresh inventory quantities
      loadMedications(true);
      toast.success(`${medication.name} added — inventory updated`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save medication');
      // Rollback: remove optimistic entry and revert task price
      if (task) {
        const currentTaskPrice = taskEdits[targetTaskId]?.price ?? task.price ?? 0;
        setTaskEdits(prev => ({
          ...prev,
          [targetTaskId]: {
            ...prev[targetTaskId],
            medications: (prev[targetTaskId]?.medications ?? ((appointment as any).medications ?? []).filter((m: any) => String(m.taskId) === String(targetTaskId))).filter((m: any) => m !== optimisticMed),
            price: Math.max(0, (prev[targetTaskId]?.price ?? task.price ?? 0) - medicationTotalCost),
          }
        }));
      }
    }
  };

  const handleRemoveMedication = async (taskId: number, medicationIndex: number) => {
    const task = appointment.tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentMedications = taskEdits[taskId]?.medications ?? ((appointment as any).medications ?? []).filter((m: any) => String(m.taskId) === String(taskId));
    const medicationToRemove = currentMedications[medicationIndex];

    const medName = medicationToRemove?.inventoryItem?.name || 'this medication';
    const qty = medicationToRemove?.quantity;
    const unit = medicationToRemove?.inventoryItem?.unit || 'units';
    const stockNote = medicationToRemove?.isDeducted && qty
      ? `\n${qty} ${unit} will be restored to inventory.`
      : '';
    const ok = await dialog.confirm({
      title: 'Remove medication',
      message: `Remove ${medName} from this task?${stockNote}`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    const updatedMedications = currentMedications.filter((_: any, i: number) => i !== medicationIndex);
    const medicationCost = (medicationToRemove?.inventoryItem?.unitPrice ?? 0) * (medicationToRemove?.quantity ?? 0);
    const currentTaskPrice = taskEdits[taskId]?.price ?? task.price ?? 0;
    const newTaskPrice = Math.max(0, currentTaskPrice - medicationCost);

    // Optimistic removal
    setTaskEdits(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], medications: updatedMedications, price: newTaskPrice }
    }));

    // Remove from backend if it has a persisted ID
    const medId = (medicationToRemove as any)?.id;
    if (medId) {
      try {
        await appointmentMedicationsAPI.removeMedication(medId);
        loadMedications(true); // Refresh inventory
        toast.success(`${medicationToRemove?.inventoryItem?.name || 'Medication'} removed`);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to remove medication');
        // Rollback
        setTaskEdits(prev => ({
          ...prev,
          [taskId]: { ...prev[taskId], medications: currentMedications, price: currentTaskPrice }
        }));
      }
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

  // Check if there are unsaved changes (status is now immediate; only staff/edits are batched)
  const hasUnsavedChanges = useMemo(() => {
    return Object.keys(pendingStaffAssignments).length > 0 ||
           Object.keys(taskEdits).length > 0;
  }, [pendingStaffAssignments, taskEdits]);

  const activeMedRecord = pet.medicalHistory.find(h => h.appointmentId === appointment.id);
  const progress = Math.round((appointment.tasks.filter(t => t.status === TaskStatus.COMPLETED).length / appointment.tasks.length) * 100);

  // Auto-save hook - replaces manual save button
  const autoSaveData = useMemo(() => ({
    staffAssignments: pendingStaffAssignments,
    taskEdits: taskEdits,
  }), [pendingStaffAssignments, taskEdits]);

  const { forceSave } = useAutoSave({
    data: autoSaveData,
    onSave: async (data) => {
      await handleSaveAllChanges();
    },
    delay: 15000, // 15 seconds as per user requirement
    enabled: hasUnsavedChanges,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 's',
        ctrl: true,
        meta: true,
        action: () => {
          if (hasUnsavedChanges) {
            handleManualSave();
          }
        },
        description: 'Save changes',
      },
      {
        key: 'Escape',
        action: () => {
          if (showMedicationModal) setShowMedicationModal(null);
          if (showAIAssistant) setShowAIAssistant(null);
          if (showSummaryPreview) setShowSummaryPreview(false);
          if (showAINotesPreview) setShowAINotesPreview(false);
        },
        description: 'Close modal',
      },
      {
        key: '?',
        shift: true,
        action: () => setShowKeyboardShortcuts(true),
        description: 'Show keyboard shortcuts',
      },
    ],
  });

  // Batch save all pending changes
  const handleSaveAllChanges = async () => {
    setIsSaving(true);
    try {
      // Build consolidated batch update data
      const taskUpdates: Array<{ taskId: number; updates: any }> = [];

      // Combine all task updates (status, staff, edits) into single updates per task
      const allTaskChanges: Record<number, any> = {};

      // Merge staff assignments
      Object.entries(pendingStaffAssignments).forEach(([taskIdStr, staffId]) => {
        const taskId = parseInt(taskIdStr);
        if (!allTaskChanges[taskId]) allTaskChanges[taskId] = {};
        allTaskChanges[taskId].assignedStaffId = staffId;
      });

      // Merge task edits (including medications which are now part of task data)
      Object.entries(taskEdits).forEach(([taskIdStr, edits]) => {
        const taskId = parseInt(taskIdStr);
        if (!allTaskChanges[taskId]) allTaskChanges[taskId] = {};
        Object.assign(allTaskChanges[taskId], edits);
      });

      // Convert to array format
      Object.entries(allTaskChanges).forEach(([taskIdStr, updates]) => {
        taskUpdates.push({
          taskId: parseInt(taskIdStr),
          updates,
        });
      });

      // Use batch update API to save all task changes in a single call
      if (taskUpdates.length > 0) {
        console.log('[Batch Save] Saving all task updates in a single API call:', taskUpdates);

        const batchRes: any = await appointmentsAPI.batchUpdate(appointment.id, {
          taskUpdates: taskUpdates.map(tu => ({
            taskId: tu.taskId,
            updates: tu.updates,
          })),
        });

        // Apply returned appointment data to context so medications/prices are visible
        // after taskEdits is cleared below
        if (batchRes?.success && batchRes.data?.appointment) {
          const a = batchRes.data.appointment;
          updateAppointmentOptimistically(appointment.id, appt => ({
            ...appt,
            totalCost: a.totalCost ?? appt.totalCost,
            tasks: a.tasks
              ? a.tasks.map((t: any) => ({
                  id: parseInt(t.id),
                  name: t.name,
                  category: t.category,
                  status: t.status,
                  assignedStaffId: t.assignedStaffId ? parseInt(t.assignedStaffId) : undefined,
                  assignedStaff: t.assignedStaff ? { id: parseInt(t.assignedStaff.id), name: t.assignedStaff.name } : undefined,
                  price: t.price,
                  notes: t.notes,
                  sentiment: t.sentiment,
                  selectedPhrases: t.selectedPhrases || [],
                  referralId: t.referralId ? parseInt(t.referralId) : undefined,
                  completedAt: t.completedAt,
                  medications: t.medications || [],
                }))
              : appt.tasks,
            medications: a.medications ?? (appt as any).medications,
          }));
        }

        console.log('[Batch Save] Successfully saved all task updates');
      }

      // Clear all pending changes
      setPendingStaffAssignments({});
      setTaskEdits({});

      // Refresh available medications to reflect updated inventory quantities
      // Check if any task had medication changes
      const hasMedicationChanges = taskUpdates.some(tu => tu.updates.medications !== undefined);
      if (hasMedicationChanges) {
        loadMedications(true); // Force refresh to get updated quantities
      }

    } catch (error) {
      console.error('Failed to save changes:', error);
      toast.error('Failed to save some changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Manual save handler - shows full-page loading overlay
  const handleManualSave = async () => {
    setIsManualSaving(true);
    try {
      await forceSave();
    } finally {
      setIsManualSaving(false);
    }
  };

  // Discard all pending changes
  const handleDiscardChanges = () => {
    setPendingStaffAssignments({});
    setTaskEdits({});
    setShowUnsavedChangesModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  // Handle navigation with unsaved changes check
  const handleNavigationWithCheck = (navigationFn: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => navigationFn);
      setShowUnsavedChangesModal(true);
    } else {
      navigationFn();
    }
  };

  // Generate summary preview
  const generateSummaryPreview = async () => {
    // Save any unsaved changes first
    if (hasUnsavedChanges) {
      await handleSaveAllChanges();
    }

    const tasks = appointment.tasks;

    // Use AI-generated notes if available, otherwise create a basic summary
    const diagnosisTasks = tasks.filter(t => t.category === 'Diagnosis' || t.category === 'Examination' || t.category === 'Consultation');

    let diagnosis = '';
    if (diagnosisTasks.length > 0) {
      // Check if we have AI-generated notes
      const tasksWithNotes = diagnosisTasks.filter(t => t.notes && t.notes.length > 50);
      if (tasksWithNotes.length > 0) {
        // Use the AI-generated narrative notes
        diagnosis = tasksWithNotes.map(t => t.notes).join(' ');
      } else {
        // Fallback to basic summary
        diagnosis = diagnosisTasks.map(t => {
          let note = `${t.name}`;
          if (t.selectedPhrases && t.selectedPhrases.length > 0) {
            note += `: ${t.selectedPhrases.join(', ')}`;
          }
          return note;
        }).join('. ') + '.';
      }
    } else {
      diagnosis = 'General checkup - routine examination performed.';
    }

    // Treatment from Treatment/Surgery/Vaccination tasks
    const treatmentTasks = tasks.filter(t =>
      t.category === 'Treatment' ||
      t.category === 'Surgery' ||
      t.category === 'Vaccination' ||
      t.category === 'Grooming' ||
      t.category === 'Dental'
    );

    let treatment = '';
    if (treatmentTasks.length > 0) {
      const tasksWithNotes = treatmentTasks.filter(t => t.notes && t.notes.length > 50);
      if (tasksWithNotes.length > 0) {
        // Use AI-generated narrative notes
        treatment = tasksWithNotes.map(t => t.notes).join(' ');
      } else {
        // Fallback to basic summary
        treatment = treatmentTasks.map(t => {
          let note = `${t.name}`;
          if (t.selectedPhrases && t.selectedPhrases.length > 0) {
            note += `: ${t.selectedPhrases.join(', ')}`;
          }
          return note;
        }).join('. ') + '.';
      }
    } else {
      treatment = 'No specific treatments administered during this visit.';
    }

    // Medications - extract from task medications
    const medications: string[] = [];
    tasks.forEach(t => {
      const taskWithMeds = t as any;
      if (taskWithMeds.medications && Array.isArray(taskWithMeds.medications)) {
        taskWithMeds.medications.forEach((med: any) => {
          const medName = med.inventoryItem?.name || med.name || 'Unknown medication';
          const quantity = med.quantity || 1;
          const unit = med.inventoryItem?.unit || med.unit || 'unit';
          medications.push(`${medName} (${quantity} ${unit})`);
        });
      }
    });

    // Service notes - use AI-generated notes when available
    const serviceNotes = tasks.map(t => {
      // If we have a good AI-generated note, use it
      if (t.notes && t.notes.length > 50 && !t.notes.includes('[') && !t.notes.includes('Observations:')) {
        return `${t.name} (${t.category}): ${t.notes}`;
      }

      // Otherwise, create a structured note
      let note = `${t.name} (${t.category})`;
      if (t.notes && t.notes.length > 0 && t.notes !== 'No notes') {
        note += ` - ${t.notes}`;
      }
      if (t.selectedPhrases && t.selectedPhrases.length > 0) {
        note += ` - Observations: ${t.selectedPhrases.join(', ')}`;
      }
      if (t.sentiment && t.sentiment !== 'neutral') {
        note += ` - Outcome: ${t.sentiment}`;
      }
      return note;
    });

    setSummaryPreview({ diagnosis, treatment, medications, serviceNotes });
    setShowSummaryPreview(true);
  };

  // Generate AI clinical narrative from all service notes
  const handleGenerateAINotes = async () => {
    setIsGeneratingAINotes(true);
    setAINotesError('');

    try {
      // Save any unsaved changes first
      if (hasUnsavedChanges) {
        await handleSaveAllChanges();
      }

      const tasks = appointment.tasks;
      const staffNames = [...new Set(tasks.map(t => {
        const staff = staffMembers.find(s => s.id === (getTaskStaffId(t.id) || t.assignedStaffId));
        return staff?.name || 'Unassigned';
      }))];

      // Collect all medications from appointment payload
      const allMedications: string[] = [];
      ((appointment as any).medications ?? []).forEach((med: any) => {
        allMedications.push(`${med.inventoryItem?.name || 'Unknown'} (${med.quantity} ${med.inventoryItem?.unit || 'units'})`);
      });

      // Prepare services data with all details
      const servicesData = tasks.map(t => ({
        name: t.name,
        category: t.category,
        notes: t.notes || 'No specific notes recorded',
        sentiment: t.sentiment || 'neutral',
        observations: t.selectedPhrases?.join(', ') || 'Standard procedure'
      }));

      // Generate comprehensive clinical narrative
      const narrative = await generateFullVisitSummary(
        pet.name,
        formatDate(appointment.date) + ' ' + formatTime(appointment.date),
        staffNames,
        servicesData,
        allMedications
      );

      setAIGeneratedNotes(narrative);
      setEditableAINotes(narrative);
      setShowAINotesPreview(true);
    } catch (error) {
      console.error('Error generating AI notes:', error);
      setAINotesError('Failed to generate AI notes. Please try again.');
    } finally {
      setIsGeneratingAINotes(false);
    }
  };

  // Accept AI-generated notes — saves to the appointment's clinical narrative / diagnosis field
  const handleAcceptAINotes = () => {
    if (!editableAINotes.trim()) return;
    onUpdateApptStatus(appointment.id, appointment.status, editableAINotes);
    setShowAINotesPreview(false);
  };

  // Regenerate AI notes
  const handleRegenerateAINotes = async () => {
    await handleGenerateAINotes();
  };

  // AI Assistant for Individual Services
  const handleAskAI = async (taskId: number) => {
    if (!aiAssistantInput.trim()) {
      return;
    }

    setIsAnalyzing(true);
    try {
      const task = appointment.tasks.find(t => t.id === taskId);
      if (!task) return;

      const analysis = await analyzeServiceObservations(
        task.name,
        task.category,
        aiAssistantInput,
        pet.species,
        pet.age
      );

      setAIAssistantAnalysis(analysis);
    } catch (error) {
      console.error('Error analyzing observations:', error);
      setAIAssistantAnalysis({
        fullAnalysis: 'Error analyzing observations. Please try again.',
        diagnosticSuggestions: [],
        treatmentRecommendations: [],
        clinicalInsights: ''
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Speech-to-text handler (using Web Speech API)
  const handleStartRecording = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      await dialog.alert({
        title: 'Browser not supported',
        message: 'Speech recognition is not supported in your browser. Please use Chrome or Edge.',
        variant: 'warning',
      });
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAIAssistantInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // TODO: Convert file to base64 and include in AI analysis
      // For now, just show the file name
      setAIAssistantInput(prev => prev + (prev ? '\n' : '') + `[Uploaded file: ${file.name}]`);
    }
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      // Persist any pending edits before doing anything else
      if (hasUnsavedChanges) {
        await handleSaveAllChanges();
      }

      // Single API call: completes all tasks + sets PENDING_PAYMENT + creates PENDING transaction
      const response = await appointmentsAPI.finalize(appointment.id);
      if (response?.success && response.data?.appointment) {
        const a = response.data.appointment;
        updateAppointmentOptimistically(appointment.id, appt => ({
          ...appt,
          status: a.status ?? ApptStatus.PENDING_PAYMENT,
          tasks: a.tasks ?? appt.tasks,
        }));
      } else {
        updateAppointmentOptimistically(appointment.id, appt => ({ ...appt, status: ApptStatus.PENDING_PAYMENT }));
      }
      // Mark all tasks completed in local state
      appointment.tasks.filter(t => t.status !== TaskStatus.COMPLETED)
        .forEach(t => onUpdateStatus(appointment.id, t.id, TaskStatus.COMPLETED));

      toast.success('Visit finalized. Ready to settle bill.');
      refreshInventory().catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || 'Failed to finalize visit');
    } finally {
      setIsFinalizing(false);
    }
  };

  // Handle "Settle Bill" - called from modal with payment method + optional discount
  // Single API call via processPayment — handles tasks completion, transaction, receipt, status update
  const handleSettleBill = async (paymentMethod: string, discountType?: 'PERCENTAGE' | 'FIXED', discountValue?: number) => {
    // Route through gateway (async, webhook-confirmed) when user opted in AND provider is configured.
    if (useGateway && gatewayAvailable(paymentMethod)) {
      const provider: 'STRIPE' | 'MPESA' = paymentMethod === 'M_PESA' ? 'MPESA' : 'STRIPE';
      await handleInitiateGatewayBill(provider, discountType, discountValue);
      return;
    }
    setShowSettleModal(false);
    setIsSettlingBill(true);
    try {
      onProcessPayment(appointment.id, paymentMethod, discountType, discountValue);
      toast.success('Bill settled successfully.');
      await onRefreshDashboard?.();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to settle bill');
    } finally {
      setIsSettlingBill(false);
    }
  };

  const pollGatewayStatus = () => {
    if (gatewayPollRef.current) window.clearInterval(gatewayPollRef.current);
    gatewayPollRef.current = window.setInterval(async () => {
      try {
        const res = await appointmentsAPI.getPaymentStatus(appointment.id);
        if (!res.success || !res.data) return;
        const s = res.data;
        if (s.status === 'SETTLED') {
          if (gatewayPollRef.current) window.clearInterval(gatewayPollRef.current);
          gatewayPollRef.current = null;
          setGatewayStatus(prev => prev && { ...prev, state: 'SETTLED', message: 'Payment confirmed.' });
          toast.success('Payment received — appointment settled.');
          await onRefreshDashboard?.();
        } else if (s.providerStatus && s.providerStatus.startsWith('FAILED')) {
          if (gatewayPollRef.current) window.clearInterval(gatewayPollRef.current);
          gatewayPollRef.current = null;
          setGatewayStatus(prev => prev && { ...prev, state: 'FAILED', message: s.providerStatus || 'Payment failed' });
        }
      } catch {
        // silent — retry on next tick
      }
    }, 3000);
    // Safety: stop polling after 3 minutes
    window.setTimeout(() => {
      if (gatewayPollRef.current) {
        window.clearInterval(gatewayPollRef.current);
        gatewayPollRef.current = null;
      }
    }, 180000);
  };

  const handleInitiateGatewayBill = async (
    provider: 'STRIPE' | 'MPESA',
    discountType?: 'PERCENTAGE' | 'FIXED',
    discountValue?: number
  ) => {
    if (!client) return;
    if (provider === 'MPESA' && !mpesaPhone) {
      toast.error('Enter the customer phone number for M-Pesa payment');
      return;
    }
    setShowSettleModal(false);
    setGatewayStatus({ provider, state: 'INITIATING' });
    try {
      const res = await appointmentsAPI.initiatePayment(appointment.id, {
        clientId: client.id,
        provider,
        phone: provider === 'MPESA' ? mpesaPhone : undefined,
        discountType: discountValue && discountValue > 0 ? discountType : undefined,
        discountValue: discountValue && discountValue > 0 ? discountValue : undefined,
      });
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Failed to initiate payment');
      }
      const payload = res.data.client as any;
      if (provider === 'STRIPE' && payload?.checkoutUrl) {
        // Open Stripe Checkout in a new tab; webhook will confirm.
        window.open(payload.checkoutUrl, '_blank', 'noopener,noreferrer');
        setGatewayStatus({
          provider,
          state: 'PENDING',
          message: 'A new tab opened with the Stripe payment page. We will update automatically when paid.',
          checkoutUrl: payload.checkoutUrl,
          providerRef: res.data.providerRef,
        });
      } else {
        setGatewayStatus({
          provider,
          state: 'PENDING',
          message: payload?.message || 'Waiting for customer confirmation on their phone...',
          providerRef: res.data.providerRef,
        });
      }
      pollGatewayStatus();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to initiate payment';
      setGatewayStatus({ provider, state: 'FAILED', message: msg });
      toast.error(msg);
    }
  };

  const openSettleModal = async () => {
    setSettlePaymentMethod(appointment.paymentMethod ?? null);
    setSettleDiscountType('PERCENTAGE');
    setSettleDiscountValue('');
    setSelectedClientDiscount(null);
    setShowSettleModal(true);
    // Load active client discounts
    if (client) {
      try {
        const res = await clientDiscountsAPI.getActive(client.id);
        if (res.success && res.data?.discounts) setClientDiscounts(res.data.discounts);
      } catch { setClientDiscounts([]); }
    }
  };

  const handleUpdatePaymentMethod = async (method: string) => {
    setIsUpdatingPaymentMethod(true);
    try {
      await appointmentsAPI.update(appointment.id, { paymentMethod: method });
      updateAppointmentOptimistically(appointment.id, appt => ({ ...appt, paymentMethod: method }));
      toast.success(`Payment method set to ${method}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update payment method');
    } finally {
      setIsUpdatingPaymentMethod(false);
    }
  };

  const handleRegenerateTransaction = async () => {
    setIsRegeneratingTxn(true);
    try {
      const result = await appointmentsAPI.regenerateTransaction(appointment.id);
      if (result.data?.transactionId) {
        updateAppointmentOptimistically(appointment.id, appt => ({
          ...appt,
          transactionId: result.data!.transactionId!,
          receiptNumber: result.data!.receiptNumber ?? appt.receiptNumber,
        }));
        toast.success(result.data.created ? 'Transaction generated and linked.' : 'Transaction re-linked successfully.');
      } else {
        toast.error('Appointment is not marked as paid — cannot regenerate transaction.');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to regenerate transaction');
    } finally {
      setIsRegeneratingTxn(false);
    }
  };

  const handleCreateVaccinationRecords = async () => {
    setIsCreatingVaccinations(true);
    try {
      const records = await vaccinationsAPI.createFromAppointment(appointment.id.toString());
      setVaccinationRecords(records);
      toast.success(`${records.length} vaccination record${records.length !== 1 ? 's' : ''} created successfully`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create vaccination records');
    } finally {
      setIsCreatingVaccinations(false);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300 pb-20">
      {/* Full-page loading overlay for manual save */}
      {isManualSaving && (
        <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl flex items-center gap-3">
            <Loader2 size={24} className="animate-spin text-seafoam" />
            <p className="font-black text-pine dark:text-zinc-100 uppercase tracking-widest text-sm">Saving changes...</p>
          </div>
        </div>
      )}
      {/* Full-page loading overlay for finalize */}
      {isFinalizing && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl flex items-center gap-3">
            <Loader2 size={24} className="animate-spin text-pine" />
            <p className="font-black text-pine dark:text-zinc-100 uppercase tracking-widest text-sm">Finalizing visit...</p>
          </div>
        </div>
      )}
      {/* Full-page loading overlay for settle bill */}
      {isSettlingBill && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl flex items-center gap-3">
            <Loader2 size={24} className="animate-spin text-seafoam" />
            <p className="font-black text-pine dark:text-zinc-100 uppercase tracking-widest text-sm">Settling bill...</p>
          </div>
        </div>
      )}
      {/* Floating Action Button */}
      {appointment.status !== ApptStatus.CANCELLED && (
        <>
          {/* Finalized but not paid — Settle Bill (only after finalize API confirmed) */}
          {!appointment.isPaid && !isFinalizing && (appointment.status === ApptStatus.PENDING_PAYMENT || appointment.status === ApptStatus.COMPLETED) && (
            <button
              onClick={openSettleModal}
              disabled={isSettlingBill}
              className="fixed bottom-24 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-seafoam text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:shadow-seafoam/30 hover:bg-seafoam/90 active:scale-95 transition-all animate-in slide-in-from-bottom-4 duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <CreditCard size={15} />
              Settle Bill
            </button>
          )}
          {/* Not yet finalized — Finalize Visit (only when all tasks done) */}
          {!appointment.isPaid && !isFinalizing && appointment.status !== ApptStatus.PENDING_PAYMENT && appointment.status !== ApptStatus.COMPLETED && progress >= 100 && (
            <button
              onClick={handleFinalize}
              disabled={isFinalizing}
              className="fixed bottom-24 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-pine text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:shadow-pine/30 hover:bg-pine/90 active:scale-95 transition-all animate-in slide-in-from-bottom-4 duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={15} />
              Finalize Visit
            </button>
          )}
        </>
      )}

      {/* Non-blocking top-right indicator while a task is being saved */}
      {loadingTaskIds.size > 0 && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-full px-3 py-1.5 shadow-lg pointer-events-none">
          <Loader2 size={12} className="animate-spin text-seafoam" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">Saving task...</span>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => handleNavigationWithCheck(onBack)} className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-seafoam hover:text-pine rounded-xl shadow-sm transition-all active:scale-95">←</button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase leading-none">Visit Overview</h1>
              {appointment.status === ApptStatus.COMPLETED && <span className="bg-emerald-500/10 text-emerald-500 text-[8px] px-2 py-0.5 rounded-full border border-emerald-500/20 font-black uppercase tracking-widest">Finalized</span>}
              {isFollowUpAppointment && (
                <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] px-2 py-0.5 rounded-full border border-indigo-500/20 font-black uppercase tracking-widest flex items-center gap-1">
                  <ArrowRight size={10} className="rotate-180" />
                  Follow-up Visit
                </span>
              )}
              {hasFollowUps && (
                <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[8px] px-2 py-0.5 rounded-full border border-purple-500/20 font-black uppercase tracking-widest flex items-center gap-1">
                  Has Follow-ups
                  <ArrowRight size={10} />
                </span>
              )}
            </div>
            <p className="text-seafoam text-[9px] font-black uppercase tracking-widest mt-0.5">Visit #{appointment.id}</p>
          </div>
        </div>


      </header>

      {/* Follow-up Timeline Banner - Show for all appointments in a follow-up chain */}
      {visitSequence.length > 0 && (() => {
        const currentIndex = visitSequence.findIndex(a => a.id === appointment.id);
        const getStatusLabel = (s: string) => {
          switch (s) {
            case 'COMPLETED': return { text: 'Completed', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: <CheckCircle2 size={10} className="text-emerald-500" /> };
            case 'IN_PROGRESS': return { text: 'In Progress', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: <Clock size={10} className="text-amber-500" /> };
            case 'PENDING_PAYMENT': return { text: 'Pending Pay', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: <CreditCard size={10} className="text-orange-500" /> };
            case 'CANCELLED': return { text: 'Cancelled', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: <XCircle size={10} className="text-red-500" /> };
            default: return { text: 'Scheduled', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: <Calendar size={10} className="text-blue-500" /> };
          }
        };
        return (
          <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2">
            {/* Header bar */}
            <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Link2 size={13} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
                    {parentAppointment ? 'Follow-up Chain' : 'Visit Chain'}
                  </p>
                  <p className="text-[9px] text-indigo-200 font-bold mt-0.5">
                    Visit {currentIndex + 1} of {visitSequence.length}
                    {parentAppointment && <span className="ml-1">· Linked to #{parentAppointment.id}</span>}
                    {!parentAppointment && childFollowUps.length > 0 && <span className="ml-1">· {childFollowUps.length} follow-up{childFollowUps.length > 1 ? 's' : ''}</span>}
                  </p>
                </div>
              </div>
              {appointment.status === ApptStatus.COMPLETED && (
                <button
                  onClick={() => onScheduleFollowup(appointment)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shrink-0"
                >
                  <Plus size={10} /> Follow-up
                </button>
              )}
            </div>

            {/* Timeline scroll area */}
            <div className="p-4 overflow-x-auto no-scrollbar">
              <div className="flex items-start gap-0 min-w-max">
                {visitSequence.map((appt, idx) => {
                  const isCurrent = appt.id === appointment.id;
                  const status = getStatusLabel(appt.status);
                  const categories = appt.tasks?.map(t => t.category).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2) || [];
                  const isLast = idx === visitSequence.length - 1;
                  return (
                    <div key={appt.id} className="flex items-start">
                      {/* Node + card */}
                      <button
                        onClick={() => !isCurrent && onNavigateToVisit(appt.id)}
                        disabled={isCurrent}
                        className={`flex flex-col items-center gap-2 w-[110px] sm:w-[130px] group ${isCurrent ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {/* Circle node */}
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isCurrent
                            ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/30'
                            : 'bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-700 group-hover:border-indigo-500'
                        }`}>
                          {isCurrent ? (
                            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                          ) : (
                            <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400">{idx + 1}</span>
                          )}
                        </div>

                        {/* Card */}
                        <div className={`w-full rounded-xl p-3 border transition-all text-left ${
                          isCurrent
                            ? 'bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-600/20'
                            : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 group-hover:border-indigo-300 group-hover:shadow-sm'
                        }`}>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={`text-[10px] font-black leading-none ${isCurrent ? 'text-white' : 'text-pine dark:text-zinc-100'}`}>
                              #{appt.id}
                            </span>
                            {isCurrent
                              ? <span className="text-[8px] font-black text-indigo-200 uppercase">Current</span>
                              : <span className="scale-90 opacity-70">{status.icon}</span>
                            }
                          </div>
                          <p className={`text-[9px] font-bold mb-1.5 ${isCurrent ? 'text-indigo-100' : 'text-slate-500 dark:text-zinc-400'}`}>
                            {formatDate(appt.date)}
                          </p>
                          <span className={`inline-block text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
                            isCurrent
                              ? 'bg-indigo-500/40 text-indigo-100'
                              : `${status.bg} ${status.color} border ${status.border}`
                          }`}>
                            {status.text}
                          </span>
                          {/* Categories + paid — hidden by default, revealed on hover/focus (desktop) or active (mobile) */}
                          {(categories.length > 0 || appt.isPaid) && (
                            <div className={`mt-1.5 overflow-hidden max-h-0 opacity-0 group-hover:max-h-20 group-hover:opacity-100 group-focus-within:max-h-20 group-focus-within:opacity-100 active:max-h-20 active:opacity-100 transition-all duration-200`}>
                              {categories.length > 0 && (
                                <p className={`text-[8px] font-medium truncate ${isCurrent ? 'text-indigo-200' : 'text-slate-400 dark:text-zinc-500'}`}>
                                  {categories.join(' · ')}
                                </p>
                              )}
                              {appt.isPaid && (
                                <div className={`flex items-center gap-1 mt-1 ${isCurrent ? 'text-emerald-300' : 'text-emerald-500'}`}>
                                  <CheckCircle2 size={9} />
                                  <span className="text-[8px] font-black uppercase">Paid</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Connector line between nodes */}
                      {!isLast && (
                        <div className="flex items-start pt-4 w-6 shrink-0">
                          <div className={`h-0.5 w-full mt-0 ${idx < currentIndex ? 'bg-indigo-400' : 'bg-indigo-100 dark:bg-indigo-900'}`} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}



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

      {/* Combined Patient Info, Date/Time, and Progress Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-lg overflow-hidden">
        {/* Top Section: Patient Info and Appointment Details */}
        <div className="px-4 py-3 bg-gradient-to-br from-pine to-pine/90 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Stethoscope size={60}/></div>

          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
            {/* Patient Info */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl shrink-0">{pet.species === 'Dog' ? '🐶' : '🐱'}</span>
              <div className="min-w-0">
                <p className="text-white/60 text-[8px] font-black uppercase tracking-widest leading-none mb-0.5">Patient</p>
                <h2 className="text-sm font-black tracking-tight uppercase truncate leading-tight">{pet.name}</h2>
                <p className="text-seafoam text-[9px] font-bold truncate">{pet.breed} • {pet.species}{pet.age ? ` • ${pet.age}Y` : ''}</p>
                {onNavigateToPet && (
                  <button onClick={() => onNavigateToPet(pet.id)} className="mt-0.5 flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-white/60 hover:text-white transition-all">
                    <ExternalLink size={8} /> Profile
                  </button>
                )}
              </div>
            </div>

            {/* Client/Owner Info */}
            {client && (
              <div className="flex items-center gap-2 min-w-0">
                <UserIcon size={18} className="text-seafoam shrink-0" />
                <div className="min-w-0">
                  <p className="text-white/60 text-[8px] font-black uppercase tracking-widest leading-none mb-0.5">Owner</p>
                  <h3 className="text-sm font-black uppercase tracking-tight truncate leading-tight">{client.name}</h3>
                  <p className="text-[9px] text-white/70 truncate">{client.phone}{client.email ? ` • ${client.email}` : ''}</p>
                  {onNavigateToClient && (
                    <button onClick={() => onNavigateToClient(client.id)} className="mt-0.5 flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-white/60 hover:text-white transition-all">
                      <ExternalLink size={8} /> Profile
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Clinic + Date */}
            <div className="flex items-center gap-2 min-w-0">
              <Calendar size={18} className="text-seafoam shrink-0" />
              <div className="min-w-0">
                <p className="text-white/60 text-[8px] font-black uppercase tracking-widest leading-none mb-0.5">Clinic · Scheduled</p>
                <p className="text-sm font-black uppercase truncate leading-tight">{activeClinic.name}</p>
                <p className="text-seafoam text-[9px] font-bold">{formatDate(appointment.date)} · {formatTime(appointment.date)}</p>
              </div>
            </div>

            {/* Total Cost */}
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-white/60 text-[8px] font-black uppercase tracking-widest leading-none mb-0.5">Total Bill</p>
                <p className="text-emerald-400 font-black text-base font-mono leading-tight">{activeClinic.currency} {appointment.totalCost.toLocaleString()}</p>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${appointment.isPaid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {appointment.isPaid ? `Paid · ${appointment.paymentMethod}` : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Progress Bar */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400">Visit Progress</p>
            </div>
            <span className="text-xs font-black text-pine dark:text-zinc-100">{progress}%</span>
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-seafoam to-emerald-500 transition-all duration-700 shadow-sm" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column - Services (8 columns) */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
         <div className="px-4 py-3 border-b border-slate-50 dark:border-zinc-800 flex justify-between items-center bg-slate-50/10 dark:bg-zinc-800/10">
            <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Services</h3>
            {appointment.status !== ApptStatus.COMPLETED && !appointment.isPaid && (
              <button onClick={() => setShowInjectModal(true)} className="bg-seafoam/10 text-seafoam px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all shadow-sm flex items-center gap-1.5">
                <Plus size={10}/> Add Service
              </button>
            )}
         </div>
             
             <div className="p-4 space-y-3">
               {(Object.entries(tasksByCategory) as [string, ApptTask[]][]).map(([category, tasks]) => (
                 <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2 px-2 py-1 bg-gradient-to-r from-slate-50 to-transparent dark:from-zinc-800 dark:to-transparent rounded-lg">
                       <span className="text-base">{SERVICE_CATEGORIES.find(c => c.name === category)?.icon || '📋'}</span>
                       <h4 className="text-[8px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-zinc-400">{category}</h4>
                       <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent dark:from-zinc-700 dark:to-transparent"></div>
                    </div>
                    <div className="space-y-2">
                      {tasks.map(task => (
                        <div key={task.id} className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 transition-all group hover:border-seafoam/30 hover:shadow-sm ${loadingTaskIds.has(task.id) || savingNoteIds.has(task.id) || generatingNoteIds.has(task.id) ? 'opacity-60 pointer-events-none' : ''}`}>
                           <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                 <input
                                   type="checkbox"
                                   checked={getTaskStatus(task.id) === TaskStatus.COMPLETED}
                                   onChange={() => handleTaskStatusChange(task.id, getTaskStatus(task.id))}
                                   disabled={isFinalized || loadingTaskIds.has(task.id)}
                                   className="w-4 h-4 rounded border-slate-300 text-seafoam focus:ring-seafoam cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                 />
                                 <div className="flex-1 min-w-0">
                                   <p className={`text-sm font-bold uppercase tracking-tight truncate ${getTaskStatus(task.id) === TaskStatus.COMPLETED ? 'text-slate-400 line-through' : 'text-pine dark:text-zinc-100'}`}>{task.name}</p>
                                   <p className="text-[7px] font-black text-seafoam uppercase tracking-widest mt-0.5">{activeClinic.currency} {task.price?.toLocaleString()}</p>
                                 </div>
                              </div>
                              {appointment.status !== ApptStatus.COMPLETED && !appointment.isPaid && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button className="p-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-seafoam rounded-lg transition-all"><Share2 size={12}/></button>
                                  {onDeleteTask && (
                                    <button
                                      onClick={async () => {
                                        const ok = await dialog.confirmDelete({
                                          title: 'Delete Task',
                                          message: 'This will remove the task from this appointment. This action cannot be undone.',
                                          entityName: task.name,
                                        });
                                        if (ok) onDeleteTask(appointment.id, task.id);
                                      }}
                                      className="p-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                                      title="Delete task"
                                    >
                                      <Trash2 size={12}/>
                                    </button>
                                  )}
                                </div>
                              )}
                           </div>

                           {/* Horizontal Action Buttons */}
                           {!appointment.isPaid && (
                             <div className="mt-3 space-y-2">
                               {/* Staff Assignment Dropdown - Always visible */}
                               <div className="flex items-center gap-2">
                                 <Users size={12} className="text-slate-400 shrink-0" />
                                 <select
                                   value={getTaskStaffId(task.id) || ''}
                                   onChange={(e) => {
                                     const staffId = parseInt(e.target.value);
                                     if (staffId) {
                                       handleStaffAssignment(task.id, staffId);
                                     }
                                   }}
                                   disabled={appointment.isPaid}
                                   className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-[9px] font-bold text-pine dark:text-zinc-300 outline-none cursor-pointer disabled:opacity-50 transition-all"
                                 >
                                   <option value="">Assign Staff...</option>
                                   {availableStaff.map(staff => (
                                     <option key={staff.id} value={staff.id}>
                                       {staff.name} ({staff.role})
                                     </option>
                                   ))}
                                 </select>
                                 {getTaskStaffId(task.id) && (() => {
                                   const assignedStaff = availableStaff.find(s => s.id === getTaskStaffId(task.id));
                                   return assignedStaff ? (
                                     <div className="flex items-center gap-1 px-2 py-1 bg-seafoam/10 rounded-lg shrink-0">
                                       <span className="text-[8px] font-bold text-seafoam uppercase">{assignedStaff.role}</span>
                                     </div>
                                   ) : null;
                                 })()}
                               </div>

                               {/* Horizontal Toggle Buttons */}
                               <div className="flex gap-2">
                                 <button
                                   onClick={() => toggleExpandableSection(task.id, 'medication')}
                                   className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[8px] font-bold transition-all ${
                                     expandedSections[task.id] === 'medication'
                                       ? 'bg-purple-600 text-white border border-purple-600 shadow-sm'
                                       : 'bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-950/40'
                                   }`}
                                 >
                                   <Pill size={12} />
                                   Medication
                                   {(() => {
                                     const baseMeds = ((appointment as any).medications ?? []).filter((m: any) => String(m.taskId) === String(task.id));
                                     const editedMeds = taskEdits[task.id]?.medications;
                                     const meds = editedMeds !== undefined ? editedMeds : baseMeds;
                                     return meds.length > 0 && (
                                       <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-[7px]">
                                         {meds.length}
                                       </span>
                                     );
                                   })()}
                                 </button>

                                 <button
                                   onClick={() => toggleExpandableSection(task.id, 'notes')}
                                   className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[8px] font-bold transition-all ${
                                     expandedSections[task.id] === 'notes'
                                       ? 'bg-cyan-600 text-white border border-cyan-600 shadow-sm'
                                       : 'bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-950/40'
                                   }`}
                                 >
                                   <MessageSquare size={12} />
                                   Notes
                                 </button>

                                 <button
                                   onClick={() => toggleExpandableSection(task.id, 'ai')}
                                   className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[8px] font-bold transition-all ${
                                     expandedSections[task.id] === 'ai'
                                       ? 'bg-indigo-600 text-white border border-indigo-600 shadow-sm'
                                       : 'bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40'
                                   }`}
                                 >
                                   <Sparkles size={12} />
                                   Ask AI
                                 </button>
                               </div>

                               {/* Expandable Sections */}
                               {/* Medication Section */}
                               {expandedSections[task.id] === 'medication' && (() => {
                                 const baseMeds = ((appointment as any).medications ?? []).filter((m: any) => String(m.taskId) === String(task.id));
                                 const editedMeds = taskEdits[task.id]?.medications;
                                 const medications = editedMeds !== undefined ? editedMeds : baseMeds;

                                 return (
                                   <div className="space-y-2 p-3 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-200 dark:border-purple-800 rounded-xl animate-in slide-in-from-top-2 duration-200">
                                     {/* Current Medications List - Always Visible */}
                                     <div className="space-y-1.5 mb-3">
                                       <p className="text-[8px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest">Current Medications:</p>
                                       {medications.length > 0 ? (
                                         medications.map((med: any, index: number) => (
                                           <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-lg border border-purple-200 dark:border-purple-800">
                                             <div className="flex items-center gap-2 flex-1 min-w-0">
                                               <Pill size={12} className="text-purple-500 shrink-0" />
                                               <div className="min-w-0">
                                                 <p className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{med.inventoryItem?.name || 'Medication'}</p>
                                                 <p className="text-[8px] text-slate-400">
                                                   Qty: {med.quantity} {med.inventoryItem?.unit || 'units'}
                                                   {med.isDeducted
                                                     ? <span className="ml-2 text-emerald-500">✓ Deducted</span>
                                                     : <span className="ml-2 text-amber-500">⏳ Reserved</span>}
                                                 </p>
                                               </div>
                                             </div>
                                             {!isFinalized && (
                                               <button
                                                 onClick={() => handleRemoveMedication(task.id, index)}
                                                 title={med.isDeducted ? 'Remove and restore stock' : 'Remove'}
                                                 className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0 transition-colors"
                                               >
                                                 <X size={12} />
                                               </button>
                                             )}
                                           </div>
                                         ))
                                       ) : (
                                         <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-dashed border-purple-300 dark:border-purple-800">
                                           <p className="text-[9px] text-slate-400 dark:text-zinc-500 text-center italic">
                                             No medications added yet
                                           </p>
                                         </div>
                                       )}
                                     </div>

                                   {/* Add Medication Interface — hidden when finalized */}
                                   {!isFinalized && <div className="space-y-2">
                                     <div className="flex items-center justify-between">
                                       <p className="text-[8px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest">Add Medication:</p>
                                       <button
                                         onClick={() => loadMedications(true)}
                                         disabled={loadingMedications}
                                         className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 rounded-md text-[7px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors disabled:opacity-50"
                                       >
                                         {loadingMedications ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                         Refresh
                                       </button>
                                     </div>

                                     {medicationError && (
                                       <div className="p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                                         <p className="text-[9px] text-red-600 dark:text-red-400">{medicationError}</p>
                                       </div>
                                     )}

                                     <input
                                       type="text"
                                       value={medicationSearchQuery}
                                       onChange={(e) => setMedicationSearchQuery(e.target.value)}
                                       placeholder="Search medications..."
                                       className="w-full bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 rounded-lg px-3 py-2 text-[10px] text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-purple-500"
                                     />

                                     <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                       {availableMedications
                                         .filter(med =>
                                           med.name.toLowerCase().includes(medicationSearchQuery.toLowerCase()) ||
                                           med.sku.toLowerCase().includes(medicationSearchQuery.toLowerCase())
                                         )
                                         .map(med => (
                                           <button
                                             key={med.id}
                                             onClick={() => {
                                               setSelectedMedicationId(med.id.toString());
                                               // Auto-select this medication
                                             }}
                                             className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all text-left ${
                                               selectedMedicationId === med.id.toString()
                                                 ? 'bg-purple-100 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700'
                                                 : 'bg-white dark:bg-zinc-900 border-purple-100 dark:border-purple-900 hover:border-purple-200 dark:hover:border-purple-800'
                                             }`}
                                           >
                                             <div className="flex-1 min-w-0">
                                               <p className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{med.name}</p>
                                               <p className="text-[8px] text-slate-400">Stock: {med.quantity} {med.unit}</p>
                                             </div>
                                             {selectedMedicationId === med.id.toString() && (
                                               <CheckCircle2 size={12} className="text-purple-600 shrink-0" />
                                             )}
                                           </button>
                                         ))}
                                     </div>

                                     {selectedMedicationId && (
                                       <div className="space-y-2 p-2 bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 rounded-lg">
                                         <div className="flex items-center gap-2">
                                           <label className="text-[8px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest shrink-0">Qty:</label>
                                           <input
                                             type="number"
                                             min="0"
                                             step="any"
                                             value={medicationQuantity}
                                             onChange={(e) => {
                                               const v = parseFloat(e.target.value);
                                               setMedicationQuantity(isNaN(v) ? 0 : v);
                                             }}
                                             className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-purple-200 dark:border-purple-800 rounded-lg px-2 py-1 text-[10px] text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-purple-500"
                                           />
                                         </div>
                                         <textarea
                                           value={medicationNotes}
                                           onChange={(e) => setMedicationNotes(e.target.value)}
                                           placeholder="Notes (optional)..."
                                           rows={2}
                                           className="w-full bg-slate-50 dark:bg-zinc-950 border border-purple-200 dark:border-purple-800 rounded-lg px-2 py-1.5 text-[10px] text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                         />
                                         <button
                                           onClick={() => handleAddMedication(task.id)}
                                           className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-[9px] font-bold hover:bg-purple-700 transition-colors"
                                         >
                                           <Plus size={12} />
                                           Add to Service
                                         </button>
                                       </div>
                                     )}
                                   </div>}
                                 </div>
                                 );
                               })()}

                               {/* Notes Generation Section */}
                               {expandedSections[task.id] === 'notes' && (
                                 <div className="space-y-3 p-3 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-700 rounded-xl animate-in slide-in-from-top-2 duration-200">
                                   {/* Sentiment Picker */}
                                   <div className="space-y-1.5">
                                     <p className="text-[8px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Outcome Sentiment</p>
                                     <div className="flex gap-2">
                                       {([
                                         { key: 'positive', icon: <Smile size={11}/>, active: 'bg-emerald-500 text-white border-emerald-500 shadow-md', inactive: 'bg-white dark:bg-zinc-800 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' },
                                         { key: 'neutral',  icon: <Meh size={11}/>,   active: 'bg-amber-500 text-white border-amber-500 shadow-md',   inactive: 'bg-white dark:bg-zinc-800 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30' },
                                         { key: 'negative', icon: <Frown size={11}/>, active: 'bg-rose-500 text-white border-rose-500 shadow-md',     inactive: 'bg-white dark:bg-zinc-800 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30' },
                                       ] as const).map(({ key, icon, active, inactive }) => {
                                         const currentSentiment = getTaskValue(task.id, 'sentiment') as string;
                                         return (
                                           <button
                                             key={key}
                                             onClick={() => updateTaskEdit(task.id, { sentiment: key })}
                                             className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                                               currentSentiment === key ? active : inactive
                                             }`}
                                           >
                                             {icon}
                                             {key}
                                           </button>
                                         );
                                       })}
                                     </div>
                                   </div>

                                   {/* Phrase Presets */}
                                   {getTaskValue(task.id, 'sentiment') && (
                                     <div className="space-y-1.5">
                                       <p className="text-[8px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Clinical Observations <span className="font-medium normal-case text-slate-400 dark:text-zinc-500">— pick all that apply</span></p>
                                       <div className="flex flex-wrap gap-1.5 p-2.5 bg-white dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700 max-h-28 overflow-y-auto custom-scrollbar">
                                         {(SENTIMENT_PRESETS[getTaskValue(task.id, 'sentiment') as keyof typeof SENTIMENT_PRESETS] || []).map(txt => {
                                           const selectedPhrases = getTaskValue(task.id, 'selectedPhrases') as string[];
                                           const isSelected = selectedPhrases?.includes(txt);
                                           return (
                                             <button
                                               key={txt}
                                               onClick={() => togglePhrase(task.id, txt)}
                                               className={`px-2 py-1 rounded-md text-[7px] font-bold transition-all border ${
                                                 isSelected
                                                   ? 'bg-pine text-white border-pine shadow-sm'
                                                   : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-pine/40 hover:text-pine dark:hover:text-seafoam'
                                               }`}
                                             >
                                               {isSelected && <span className="mr-1">✓</span>}{txt}
                                             </button>
                                           );
                                         })}
                                       </div>
                                     </div>
                                   )}

                                   {/* Notes Input */}
                                   <div className="space-y-2">
                                     <p className="text-[8px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Clinical Note</p>
                                     <div className="relative">
                                       <MessageSquare className="absolute left-3 top-2.5 text-slate-400 dark:text-zinc-500" size={13}/>
                                       <textarea
                                         rows={4}
                                         value={getTaskValue(task.id, 'notes') as string}
                                         onChange={e => updateTaskEdit(task.id, { notes: e.target.value })}
                                         placeholder="Add clinical observations and notes, or select phrases above then generate with AI..."
                                         className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-xs font-medium text-pine dark:text-zinc-200 placeholder:text-slate-300 dark:placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-seafoam/50 focus:border-seafoam/50 transition-all resize-none"
                                       />
                                     </div>

                                     <div className="flex gap-2">
                                       <button
                                         onClick={() => handleAIDescribe(task.id)}
                                         disabled={!(getTaskValue(task.id, 'selectedPhrases') as string[])?.length || generatingNoteIds.has(task.id)}
                                         className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-br from-indigo-600 to-indigo-500 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:from-indigo-700 hover:to-indigo-600 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-indigo-600 disabled:hover:to-indigo-500"
                                       >
                                         {generatingNoteIds.has(task.id) ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                         {generatingNoteIds.has(task.id) ? 'Generating...' : (getTaskValue(task.id, 'selectedPhrases') as string[])?.length > 0 ? 'Generate AI Note' : 'Select phrases first'}
                                       </button>
                                       {taskEdits[task.id] && (
                                         <button
                                           onClick={() => saveTaskNote(task.id)}
                                           disabled={savingNoteIds.has(task.id)}
                                           className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-br from-pine to-pine/90 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:from-pine/90 hover:to-pine/80 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                         >
                                           {savingNoteIds.has(task.id) ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                           {savingNoteIds.has(task.id) ? 'Saving...' : 'Save Note'}
                                         </button>
                                       )}
                                     </div>
                                   </div>
                                 </div>
                               )}

                               {/* AI Assistant Section */}
                               {expandedSections[task.id] === 'ai' && (
                                 <div className="space-y-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-200 dark:border-indigo-800 rounded-xl animate-in slide-in-from-top-2 duration-200">
                                   <div className="flex items-start gap-2">
                                     <Sparkles className="text-indigo-500 shrink-0 mt-1" size={14} />
                                     <p className="text-[9px] text-indigo-700 dark:text-indigo-400 font-bold">
                                       Describe your observations, use voice input, or upload images for AI-powered diagnostic suggestions.
                                     </p>
                                   </div>

                                   {/* Input Methods */}
                                   <div className="space-y-2">
                                     <textarea
                                       value={aiAssistantInput}
                                       onChange={(e) => setAIAssistantInput(e.target.value)}
                                       placeholder="Describe observations (e.g., 'Patient shows signs of lethargy, decreased appetite, mild fever...')"
                                       className="w-full h-24 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2 text-[10px] text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                     />

                                     <div className="flex gap-2">
                                       <button
                                         onClick={handleStartRecording}
                                         disabled={isRecording}
                                         className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors disabled:opacity-50"
                                       >
                                         {isRecording ? (
                                           <>
                                             <Loader2 size={12} className="animate-spin" />
                                             Recording...
                                           </>
                                         ) : (
                                           <>
                                             <MessageSquare size={12} />
                                             Voice Input
                                           </>
                                         )}
                                       </button>

                                       <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer">
                                         <input
                                           type="file"
                                           accept="image/*,.pdf"
                                           onChange={handleFileUpload}
                                           className="hidden"
                                         />
                                         <Download size={12} />
                                         Upload File
                                       </label>
                                     </div>

                                     <button
                                       onClick={() => handleAskAI(task.id)}
                                       disabled={!aiAssistantInput.trim() || isAnalyzing}
                                       className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-lg text-[9px] font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                     >
                                       {isAnalyzing ? (
                                         <>
                                           <Loader2 size={12} className="animate-spin" />
                                           Analyzing...
                                         </>
                                       ) : (
                                         <>
                                           <Sparkles size={12} />
                                           Analyze with AI
                                         </>
                                       )}
                                     </button>
                                   </div>

                                   {/* AI Analysis Results */}
                                   {aiAssistantAnalysis && (
                                     <div className="space-y-2 p-3 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-lg animate-in fade-in duration-200">
                                       <div className="prose prose-sm dark:prose-invert max-w-none">
                                         <div className="text-[10px] text-pine dark:text-zinc-100 whitespace-pre-wrap">
                                           {aiAssistantAnalysis.fullAnalysis}
                                         </div>
                                       </div>
                                     </div>
                                   )}
                                 </div>
                               )}
                             </div>
                           )}

                           {/* Fallback notes section for paid appointments (read-only) */}
                           {task.status === TaskStatus.COMPLETED && appointment.isPaid && (
                             <div className="space-y-2.5 animate-in slide-in-from-top-1 duration-200 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                {/* Sentiment Display */}
                                <div className="flex items-center gap-2">
                                   <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 shrink-0">Sentiment:</span>
                                   <div className="flex gap-1.5">
                                      {(['positive', 'neutral', 'negative'] as const).map(sent => {
                                        const currentSentiment = getTaskValue(task.id, 'sentiment') as string;
                                        return (
                                          <button
                                           key={sent}
                                           onClick={() => updateTaskEdit(task.id, { sentiment: sent })}
                                           disabled={appointment.isPaid}
                                           className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${currentSentiment === sent ? 'bg-pine text-white border-pine shadow-sm' : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 hover:border-seafoam'}`}
                                          >
                                             {sent === 'positive' && <Smile size={10}/>}
                                             {sent === 'neutral' && <Meh size={10}/>}
                                             {sent === 'negative' && <Frown size={10}/>}
                                             {sent}
                                          </button>
                                        );
                                      })}
                                   </div>
                                </div>

                                {/* Phrase Presets */}
                                {getTaskValue(task.id, 'sentiment') && (
                                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50/50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-800">
                                     {(SENTIMENT_PRESETS[getTaskValue(task.id, 'sentiment') as keyof typeof SENTIMENT_PRESETS] || []).map(txt => {
                                       const selectedPhrases = getTaskValue(task.id, 'selectedPhrases') as string[];
                                       const isSelected = selectedPhrases?.includes(txt);
                                       return (
                                         <button
                                          key={txt}
                                          onClick={() => togglePhrase(task.id, txt)}
                                          disabled={appointment.isPaid}
                                          className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-cyan text-white border-cyan shadow-sm' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-pine hover:border-pine/20'}`}
                                         >
                                           {txt}
                                         </button>
                                       );
                                     })}
                                  </div>
                                )}

                                {/* Notes Input with AI Actions */}
                                <div className="flex gap-2">
                                   <div className="relative flex-1">
                                      <MessageSquare className="absolute left-3 top-2.5 text-slate-300" size={13}/>
                                      <textarea
                                        rows={3}
                                        value={getTaskValue(task.id, 'notes') as string}
                                        onChange={e => updateTaskEdit(task.id, { notes: e.target.value })}
                                        placeholder="Add service observations and notes..."
                                        disabled={appointment.isPaid}
                                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-xs font-medium text-pine dark:text-zinc-200 placeholder:text-slate-300 dark:placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-seafoam/20 focus:border-seafoam transition-all resize-none disabled:bg-slate-50 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed"
                                      />
                                   </div>
                                   <div className="flex flex-col gap-1.5">
                                      {(getTaskValue(task.id, 'selectedPhrases') as string[])?.length > 0 && !appointment.isPaid && (
                                        <button
                                          onClick={() => handleAIDescribe(task.id)}
                                          disabled={generatingNoteIds.has(task.id)}
                                          className="px-3 py-2 bg-gradient-to-br from-cyan/10 to-cyan/5 text-cyan border border-cyan/20 rounded-lg font-black text-[7px] uppercase tracking-widest hover:from-cyan hover:to-cyan/90 hover:text-white transition-all shadow-sm flex items-center justify-center gap-1.5 min-w-[70px] disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          {generatingNoteIds.has(task.id) ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                          <span>{generatingNoteIds.has(task.id) ? 'Generating...' : 'AI Note'}</span>
                                        </button>
                                      )}
                                      {taskEdits[task.id] && !appointment.isPaid && (
                                        <button
                                          onClick={() => saveTaskNote(task.id)}
                                          disabled={savingNoteIds.has(task.id)}
                                          className="px-3 py-2 bg-gradient-to-br from-pine/10 to-pine/5 text-pine border border-pine/20 rounded-lg font-black text-[7px] uppercase tracking-widest hover:from-pine hover:to-pine/90 hover:text-white transition-all shadow-sm flex items-center justify-center gap-1.5 min-w-[70px] disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          {savingNoteIds.has(task.id) ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                          <span>{savingNoteIds.has(task.id) ? 'Saving...' : 'Save'}</span>
                                        </button>
                                      )}
                                   </div>
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
        </div>

        {/* Right Column - Billing, Follow-ups (4 columns) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Billing Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-cyan text-white rounded-lg shadow-sm"><Receipt size={14}/></div>
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Billing</h3>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-100 dark:border-zinc-700 shadow-inner">
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
              <h3 className="text-xl font-black font-mono text-pine dark:text-zinc-100 tracking-tighter">{activeClinic.currency} {appointment.totalCost.toLocaleString()}</h3>
              <div className="mt-2">
                <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase border tracking-widest ${appointment.isPaid ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                  {appointment.isPaid ? `Paid: ${appointment.paymentMethod}` : 'Pending'}
                </span>
              </div>
            </div>

            {appointment.isPaid ? (
              <button
                onClick={() => {
                  setActiveBottomTab('receipt');
                  // Scroll to the receipt section
                  setTimeout(() => {
                    const receiptSection = document.querySelector('[data-section="receipt-tabs"]');
                    if (receiptSection) {
                      receiptSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                className="w-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 py-3 rounded-lg font-black text-[8px] uppercase tracking-[0.2em] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={14} />
                <span>Bill Settled - View Receipt</span>
              </button>
            ) : appointment.status === ApptStatus.PENDING_PAYMENT ? (
              <button
                onClick={openSettleModal}
                className={`w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-3 rounded-lg font-black text-[8px] uppercase tracking-[0.2em] shadow-md active:scale-95 transition-all relative overflow-hidden ${progress === 100 ? 'animate-ripple-ready' : ''}`}
              >
                {progress === 100 && (
                  <span className="absolute inset-0 animate-ripple-pulse bg-white/30 rounded-lg"></span>
                )}
                <span className="relative z-10">Settle Bill</span>
              </button>
            ) : (
              <div className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-500 py-3 rounded-lg font-black text-[8px] uppercase tracking-[0.2em] text-center">
                Finalize visit to enable billing
              </div>
            )}
          </div>

          {/* Follow-up & Scheduling Card - Only show when no timeline in banner */}
          {visitSequence.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-500 text-white rounded-lg shadow-sm"><Link2 size={14}/></div>
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Follow-up Visits</h3>
              </div>

              {/* Show navigation to parent if this is a follow-up */}
              {isFollowUpAppointment && parentAppointment && (
              <button
                onClick={() => onNavigateToVisit(parentAppointment.id)}
                className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white p-3 rounded-lg shadow-md transition-all active:scale-95 group text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <ArrowRight size={10} className="rotate-180" />
                      <h3 className="text-[9px] font-black uppercase tracking-wider">Previous Visit</h3>
                    </div>
                    <p className="text-indigo-100 text-[8px] font-bold opacity-90">
                      Visit #{parentAppointment.id} • {formatDate(parentAppointment.date)}
                    </p>
                  </div>
                  <ArrowRight size={14} className="rotate-180 opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                </div>
              </button>
            )}

            {hasFollowUps && childAppointments.length === 1 && (
              <button
                onClick={() => onNavigateToVisit(childAppointments[0].id)}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white p-3 rounded-lg shadow-md transition-all active:scale-95 group text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <ArrowRight size={10} />
                      <h3 className="text-[9px] font-black uppercase tracking-wider">Next Follow-up</h3>
                    </div>
                    <p className="text-purple-100 text-[8px] font-bold opacity-90">
                      Visit #{childAppointments[0].id} • {formatDate(childAppointments[0].date)}
                    </p>
                  </div>
                  <ArrowRight size={14} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            )}

            {hasFollowUps && childAppointments.length > 1 && (
              <div className="w-full bg-gradient-to-r from-purple-500 to-purple-600 p-3 rounded-lg shadow-md">
                <div className="flex items-center gap-1.5 mb-2">
                  <ArrowRight size={10} className="text-white" />
                  <h3 className="text-[9px] font-black uppercase tracking-wider text-white">Follow-up Visits ({childAppointments.length})</h3>
                </div>
                <div className="space-y-1.5">
                  {childAppointments.slice(0, 3).map((child) => (
                    <button
                      key={child.id}
                      onClick={() => onNavigateToVisit(child.id)}
                      className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white py-2 px-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-between group/child text-left"
                    >
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest">Visit #{child.id}</p>
                        <p className="text-purple-100 text-[7px] font-mono opacity-80">{formatDate(child.date)}</p>
                      </div>
                      <ArrowRight size={10} className="group-hover/child:translate-x-1 transition-transform" />
                    </button>
                  ))}
                  {childAppointments.length > 3 && (
                    <p className="text-white/60 text-[7px] text-center italic pt-0.5">
                      +{childAppointments.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}
            </div>
          )}

          {/* Schedule Follow-up Button - Show on all completed appointments to allow chaining */}
          {appointment.status === ApptStatus.COMPLETED && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
              <button
                onClick={() => onScheduleFollowup(appointment)}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white p-3 rounded-lg shadow-md transition-all active:scale-95 group relative overflow-hidden text-left"
              >
                <div className="absolute -right-2 -bottom-2 text-white/10 group-hover:scale-110 transition-transform duration-500"><Calendar size={40}/></div>
                <div className="flex items-center gap-2 mb-0.5 relative z-10">
                  <Calendar size={12} />
                  <h3 className="text-[9px] font-black uppercase tracking-wider">Schedule Follow-up</h3>
                </div>
                <p className="text-indigo-100 text-[8px] font-bold relative z-10 opacity-80">Create a linked follow-up visit</p>
              </button>
            </div>
          )}

          {/* Vaccination Records Button */}
          {appointment.status === ApptStatus.COMPLETED && hasVaccinationTasks && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
              {vaccinationRecords.length > 0 ? (
                <button
                  onClick={() => setShowVaccinationModal(true)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-lg shadow-md transition-all active:scale-95 group relative overflow-hidden text-left"
                >
                  <div className="absolute -right-2 -bottom-2 text-white/10 group-hover:scale-110 transition-transform duration-500"><Syringe size={40}/></div>
                  <div className="flex items-center gap-2 mb-0.5 relative z-10">
                    <Syringe size={12} />
                    <h3 className="text-[9px] font-black uppercase tracking-wider">View Vaccination Records</h3>
                  </div>
                  <p className="text-emerald-100 text-[8px] font-bold relative z-10 opacity-80">
                    {vaccinationRecords.length} record{vaccinationRecords.length !== 1 ? 's' : ''} from this appointment
                  </p>
                </button>
              ) : (
                <button
                  onClick={handleCreateVaccinationRecords}
                  disabled={isCreatingVaccinations}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white p-3 rounded-lg shadow-md transition-all active:scale-95 group relative overflow-hidden text-left"
                >
                  <div className="absolute -right-2 -bottom-2 text-white/10 group-hover:scale-110 transition-transform duration-500"><Syringe size={40}/></div>
                  <div className="flex items-center gap-2 mb-0.5 relative z-10">
                    <Syringe size={12} />
                    <h3 className="text-[9px] font-black uppercase tracking-wider">
                      {isCreatingVaccinations ? 'Creating...' : 'Create Vaccination Records'}
                    </h3>
                  </div>
                  <p className="text-emerald-100 text-[8px] font-bold relative z-10 opacity-80">
                    Generate vaccination records from this appointment
                  </p>
                </button>
              )}
            </div>
          )}

          {/* Vaccination Records Modal */}
          {showVaccinationModal && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowVaccinationModal(false)}>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Syringe size={18} className="text-emerald-500" />
                    <h2 className="font-black text-pine dark:text-zinc-100 text-sm uppercase tracking-widest">Vaccination Records</h2>
                  </div>
                  <button onClick={() => setShowVaccinationModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="overflow-y-auto p-5 space-y-3">
                  {vaccinationRecords.map((rec) => (
                    <div key={rec.id} className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-black text-pine dark:text-zinc-100 text-sm">{rec.vaccineName}</p>
                          <div className="mt-1.5 space-y-0.5">
                            {rec.administeredAt && (
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-bold">
                                Administered: {new Date(rec.administeredAt).toLocaleDateString()}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-bold">
                              Expires: {new Date(rec.expiryDate).toLocaleDateString()}
                            </p>
                            {rec.batchNumber && (
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-bold">Batch: {rec.batchNumber}</p>
                            )}
                          </div>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shrink-0 ${
                          rec.status === 'ADMINISTERED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          rec.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>{rec.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-Width Tabbed Section - Summary/Invoice/Receipt */}
      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2" data-section="receipt-tabs">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-md overflow-hidden">
                {/* Tab Navigation */}
                <div className="flex overflow-x-auto scrollbar-none bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 p-1.5 gap-1">
                   {[
                     { id: 'record', label: 'Record', icon: FileText },
                     { id: 'medications', label: 'Medications', icon: Pill },
                     { id: 'invoice', label: 'Invoice', icon: Printer },
                     { id: 'receipt', label: 'Receipt', icon: Receipt },
                   ].map(tab => (
                     <button
                       key={tab.id}
                       onClick={() => setActiveBottomTab(tab.id as any)}
                       disabled={tab.id === 'receipt' && !appointment.isPaid}
                       className={`shrink-0 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeBottomTab === tab.id ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-md border border-seafoam/20 dark:border-seafoam/10' : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-900/50 disabled:opacity-20 disabled:cursor-not-allowed'}`}
                     >
                        <tab.icon size={12} className={activeBottomTab === tab.id ? 'text-seafoam' : ''} /> {tab.label}
                     </button>
                   ))}
                </div>

                {/* Content Area */}
                <div className="p-5 animate-in fade-in duration-300 overflow-y-auto max-h-[65vh] custom-scrollbar">
                   {activeBottomTab === 'record' && (
                     <div className="space-y-5">
                        {/* Header + Actions Row */}
                        <div className="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800 pb-4 gap-3">
                           <div>
                             <h4 className="text-base sm:text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Diagnostic Record</h4>
                             <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium mt-0.5">Clinical summary & documentation</p>
                           </div>
                           <button className="p-2 bg-seafoam/10 text-seafoam hover:bg-seafoam/20 rounded-lg hover:scale-105 transition-all shrink-0"><Download size={16}/></button>
                        </div>

                        {/* Workflow Progress Indicator */}
                        <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
                          {/* Step 1: Complete Tasks */}
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${progress === 100 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-500'}`}>
                            {progress === 100 ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                            <span className="text-[8px] font-black uppercase tracking-wider">Tasks {progress}%</span>
                          </div>
                          <div className={`h-0.5 flex-1 ${progress === 100 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-zinc-700'}`}></div>

                          {/* Step 2: Finalize Visit */}
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${appointment.status === ApptStatus.PENDING_PAYMENT || appointment.status === ApptStatus.COMPLETED ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-500'}`}>
                            {appointment.status === ApptStatus.PENDING_PAYMENT || appointment.status === ApptStatus.COMPLETED ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                            <span className="text-[8px] font-black uppercase tracking-wider">Finalized</span>
                          </div>
                          <div className={`h-0.5 flex-1 ${appointment.status === ApptStatus.PENDING_PAYMENT || appointment.status === ApptStatus.COMPLETED ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-zinc-700'}`}></div>

                          {/* Step 3: Settle Bill */}
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${appointment.isPaid ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-500'}`}>
                            {appointment.isPaid ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                            <span className="text-[8px] font-black uppercase tracking-wider">Paid</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleGenerateAINotes}
                            disabled={isGeneratingAINotes || appointment.isPaid}
                            className="flex-1 bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 py-2.5 rounded-lg font-black text-[8px] uppercase tracking-[0.15em] active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isGeneratingAINotes ? (
                              <><Loader2 size={11} className="animate-spin" /> Generating...</>
                            ) : (
                              <><Sparkles size={11} /> AI Notes</>
                            )}
                          </button>
                        </div>

                        {/* Patient Info Row */}
                        <div className="grid grid-cols-2 gap-3">
                           <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-slate-200 dark:border-zinc-700">
                              <p className="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.15em] mb-1">Subject</p>
                              <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{pet.name}</p>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-400">{pet.species} • {pet.breed}</p>
                           </div>
                           <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-slate-200 dark:border-zinc-700">
                              <p className="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.15em] mb-1">Visit Date</p>
                              <p className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">{formatDate(appointment.date)}</p>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-400">{formatTime(appointment.date)}</p>
                           </div>
                        </div>

                        {/* Clinical Narrative */}
                        <div className="space-y-2">
                           <div className="flex items-center gap-2">
                             <div className="h-0.5 w-8 bg-gradient-to-r from-seafoam to-cyan rounded-full"></div>
                             <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.15em]">Clinical Narrative</p>
                           </div>
                           <div className="text-sm font-medium leading-relaxed text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-950/50 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 whitespace-pre-wrap">
                              {activeMedRecord?.treatment || (
                                <div className="text-center py-5">
                                  <p className="text-slate-400 dark:text-zinc-500 italic text-xs">Summary pending synthesis.</p>
                                  <p className="text-[10px] text-slate-400 dark:text-zinc-600 mt-1">Complete all tasks and click "AI Notes" to generate the clinical narrative.</p>
                                </div>
                              )}
                           </div>
                        </div>

                        {/* Visit Summary */}
                        <div className="space-y-3 border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                          <div className="bg-slate-50 dark:bg-zinc-800/60 px-4 py-3 border-b border-slate-200 dark:border-zinc-700">
                            <p className="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-[0.15em]">Visit Summary</p>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            {/* Pet & Client */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.12em] mb-0.5">Patient</p>
                                {onNavigateToPet ? (
                                  <button onClick={() => onNavigateToPet(pet.id)} className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase hover:text-seafoam transition-colors text-left">
                                    {pet.name}
                                  </button>
                                ) : (
                                  <p className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase">{pet.name}</p>
                                )}
                                <p className="text-[9px] text-slate-500 dark:text-zinc-400">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.12em] mb-0.5">Client</p>
                                {client && onNavigateToClient ? (
                                  <button onClick={() => onNavigateToClient(client.id)} className="text-[11px] font-black text-pine dark:text-zinc-100 hover:text-seafoam transition-colors text-left">
                                    {client.name}
                                  </button>
                                ) : (
                                  <p className="text-[11px] font-black text-pine dark:text-zinc-100">{(client?.name ?? appointment.client?.name) || '—'}</p>
                                )}
                                <p className="text-[9px] text-slate-500 dark:text-zinc-400">{client?.phone ?? appointment.client?.phone ?? ''}</p>
                              </div>
                            </div>
                            {/* Date & Time */}
                            <div>
                              <p className="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.12em] mb-0.5">Appointment</p>
                              <p className="text-[11px] font-black text-pine dark:text-zinc-100">{formatDate(appointment.date)} · {formatTime(appointment.date)}</p>
                            </div>
                            {/* Categories & Services */}
                            {Object.keys(tasksByCategory).length > 0 && (
                              <div>
                                <p className="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.12em] mb-1.5">Services</p>
                                <div className="space-y-1">
                                  {Object.entries(tasksByCategory).map(([category, tasks]) => (
                                    <div key={category}>
                                      <p className="text-[8px] font-black text-seafoam uppercase tracking-wider mb-0.5">{category}</p>
                                      {tasks.map(t => (
                                        <p key={t.id} className="text-[10px] text-slate-600 dark:text-zinc-300 pl-2">· {t.name}</p>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Medications */}
                            {apptMedications.length > 0 && (
                              <div>
                                <p className="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.12em] mb-1.5">Medications Used</p>
                                <div className="space-y-1">
                                  {apptMedications.map((m, i) => (
                                    <div key={m.id ?? i} className="flex items-center justify-between">
                                      <p className="text-[10px] text-slate-600 dark:text-zinc-300">· {m.inventoryItem?.name || 'Unknown'}</p>
                                      <p className="text-[9px] font-black text-slate-500 dark:text-zinc-400">{m.quantity} {m.inventoryItem?.unit || 'unit(s)'}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                     </div>
                   )}
                   {activeBottomTab === 'medications' && (
                     <div className="space-y-4">
                       <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
                         <div>
                           <h4 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Medications Used</h4>
                           <p className="text-[10px] text-slate-400 mt-0.5">All medications dispensed in this appointment</p>
                         </div>
                          <span className="text-[9px] font-black bg-seafoam/10 text-seafoam px-2 py-1 rounded-lg uppercase tracking-wider">{apptMedications.length} Item{apptMedications.length !== 1 ? 's' : ''}</span>
                       </div>
                       {apptMedications.length === 0 ? (
                         <div className="flex flex-col items-center justify-center py-12 text-center">
                           <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-3">
                             <Pill size={28} className="text-slate-300 dark:text-zinc-600" />
                           </div>
                           <p className="text-sm font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">No Medication Used</p>
                           <p className="text-[10px] text-slate-300 dark:text-zinc-600 mt-1">No medications were recorded for this appointment</p>
                         </div>
                       ) : (
                         <div className="space-y-2">
                           {apptMedications.map((m, i) => (
                             <div key={m.id ?? i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl">
                               <div className="flex items-center gap-3">
                                 <div className="p-2 bg-purple-500/10 rounded-lg"><Pill size={14} className="text-purple-500" /></div>
                                 <div>
                                   <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase">{m.inventoryItem?.name || m.inventoryItemId}</p>
                                   <p className="text-[9px] text-slate-400 font-medium">{m.taskName}{m.inventoryItem?.category ? ` · ${m.inventoryItem.category}` : ''}</p>
                                   {m.notes && <p className="text-[9px] text-slate-400 italic mt-0.5">{m.notes}</p>}
                                 </div>
                               </div>
                               <div className="text-right">
                                 <p className="text-sm font-black text-pine dark:text-zinc-100">{m.quantity} {m.inventoryItem?.unit || 'unit(s)'}</p>
                                 {m.isDeducted && <p className="text-[8px] text-emerald-500 font-black uppercase tracking-widest mt-0.5">✓ Deducted</p>}
                                 {m.inventoryItem?.unitPrice && (
                                   <p className="text-[9px] text-slate-400">{activeClinic.currency} {(m.inventoryItem.unitPrice * m.quantity).toLocaleString()}</p>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   )}
                   {activeBottomTab === 'invoice' && (() => {
                     // Resolve which currency the invoice prints in. Default
                     // = clinic currency; user can override via the picker.
                     const printCurrency = (invoiceCurrency || activeClinic.currency || 'KES').toUpperCase();
                     const sourceCurrency = (activeClinic.currency || 'KES').toUpperCase();
                     // Unique currency codes from the country list, plus the
                     // current source/print so they're always selectable.
                     const currencyOptions = (() => {
                       const seen = new Set<string>([sourceCurrency, printCurrency]);
                       const out: string[] = [sourceCurrency];
                       if (printCurrency !== sourceCurrency) out.push(printCurrency);
                       for (const c of COUNTRIES) {
                         const code = (c.currency || '').toUpperCase();
                         if (!code || seen.has(code)) continue;
                         seen.add(code);
                         out.push(code);
                       }
                       return out.sort();
                     })();
                     return (
                     <div>
                        <div className="flex justify-end items-center gap-2 mb-3 print:hidden flex-wrap">
                           {/* Currency override — picker defaults to clinic currency */}
                           <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Currency</span>
                             <select
                               value={printCurrency}
                               onChange={(e) => setInvoiceCurrency(e.target.value)}
                               className="text-[10px] font-black uppercase tracking-widest bg-transparent text-pine dark:text-zinc-100 outline-none cursor-pointer"
                             >
                               {currencyOptions.map(code => (
                                 <option key={code} value={code}>{code}</option>
                               ))}
                             </select>
                           </div>
                           {appointment.isPaid && (
                             <button
                               onClick={() => setActiveBottomTab('receipt')}
                               className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-sm hover:shadow-md transition-all active:scale-95"
                             >
                               <Receipt size={13} />
                               View Receipt
                             </button>
                           )}
                           <button
                             onClick={() => {
                               const printContent = document.getElementById('invoice-content');
                               if (printContent) {
                                 const printWindow = window.open('', '_blank');
                                 if (printWindow) {
                                   printWindow.document.write('<html><head><title>Invoice #' + appointment.id + '</title>');
                                   printWindow.document.write('<style>body{font-family:monospace;padding:40px;} .invoice-header{display:flex;justify-content:space-between;border-bottom:2px solid #2d5f5d;padding-bottom:20px;margin-bottom:30px;} .invoice-title{font-size:24px;font-weight:900;text-transform:uppercase;} .invoice-ref{font-size:10px;color:#666;margin-top:5px;} .clinic-name{text-align:right;font-weight:900;font-size:9px;text-transform:uppercase;} .invoice-items{margin-bottom:40px;} .invoice-item{display:flex;justify-content:space-between;margin-bottom:15px;font-size:14px;} .invoice-total{border-top:2px solid #2d5f5d;padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end;} .total-label{font-size:11px;font-weight:900;text-transform:uppercase;color:#666;} .total-amount{font-size:30px;font-weight:900;}</style>');
                                   printWindow.document.write('</head><body>');
                                   printWindow.document.write(printContent.innerHTML);
                                   printWindow.document.write('</body></html>');
                                   printWindow.document.close();
                                   printWindow.onload = () => printWindow.print();
                                 }
                               }
                             }}
                             className="flex items-center gap-1.5 px-3 py-1.5 bg-pine text-white rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-sm hover:shadow-md transition-all active:scale-95"
                           >
                             <Download size={13} />
                             Download PDF
                           </button>
                        </div>
                        <div id="invoice-content" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
                           {/* Invoice Header */}
                           <div className="bg-pine text-white p-5 flex justify-between items-start">
                             <div>
                               <p className="text-2xl font-black uppercase tracking-tighter">INVOICE</p>
                               <p className="text-[9px] font-bold text-white/50 mt-0.5">REF #{appointment.id} • {formatDate(appointment.date)}</p>
                             </div>
                             <div className="text-right">
                               <p className="text-sm font-black uppercase">{activeClinic.name}</p>
                               {activeClinic.slogan && <p className="text-[9px] text-white/60 mt-0.5">{activeClinic.slogan}</p>}
                             </div>
                           </div>
                           {/* Patient & Client Info */}
                           <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-zinc-700 border-b border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50">
                             <div className="px-4 py-2">
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Patient</p>
                               {onNavigateToPet ? (
                                 <button onClick={() => onNavigateToPet(pet.id)} className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight hover:text-seafoam transition-colors text-left print:text-pine print:hover:text-pine">
                                   {pet.name}
                                 </button>
                               ) : (
                                 <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight">{pet.name}</p>
                               )}
                               <p className="text-[9px] text-slate-400 leading-tight">{pet.species} • {pet.breed}</p>
                             </div>
                             <div className="px-4 py-2">
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Client</p>
                               {client && onNavigateToClient ? (
                                 <button onClick={() => onNavigateToClient(client.id)} className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight hover:text-seafoam transition-colors text-left print:text-pine print:hover:text-pine">
                                   {client.name}
                                 </button>
                               ) : (
                                 <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight">{client?.name || '—'}</p>
                               )}
                               <p className="text-[9px] text-slate-400 leading-tight">{client?.phone}</p>
                             </div>
                             <div className="px-4 py-2">
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Clinic</p>
                               <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight">{activeClinic.name}</p>
                               <p className="text-[9px] text-slate-400 leading-tight">{activeClinic.phone || activeClinic.email || ''}</p>
                             </div>
                           </div>
                           {/* Services */}
                           <div className="p-4">
                             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Services</p>
                             <div className="space-y-2">
                               {appointment.tasks.map(t => (
                                 <div key={t.id} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-zinc-800 last:border-b-0">
                                   <div>
                                     <span className="text-sm font-bold text-pine dark:text-zinc-200">{t.name}</span>
                                     {t.category && <span className="ml-2 text-[8px] font-black text-slate-400 uppercase tracking-wider">{t.category}</span>}
                                   </div>
                                   <Money
                                     amount={t.price || 0}
                                     currency={sourceCurrency}
                                     target={printCurrency}
                                     hideOriginal
                                     showCode
                                     primaryClassName="text-sm font-black text-pine dark:text-zinc-100 font-mono"
                                   />
                                 </div>
                               ))}
                             </div>
                           </div>
                           {/* Medications if any */}
                           {appointment.tasks.some(t => t.medications && t.medications.length > 0) && (
                             <div className="p-4 border-t border-slate-200 dark:border-zinc-700">
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Medications Dispensed</p>
                               <div className="space-y-1.5">
                                 {appointment.tasks.flatMap(t => (t.medications || []).map(m => (
                                   <div key={`${t.id}-${m.inventoryItemId}`} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800 last:border-b-0">
                                     <div>
                                       <span className="text-sm font-bold text-pine dark:text-zinc-200">{m.inventoryItem?.name || m.inventoryItemId}</span>
                                       <span className="ml-2 text-[9px] text-slate-400">× {m.quantity} {m.inventoryItem?.unit || ''}</span>
                                     </div>
                                     {m.inventoryItem?.unitPrice ? (
                                       <Money
                                         amount={m.inventoryItem.unitPrice * m.quantity}
                                         currency={sourceCurrency}
                                         target={printCurrency}
                                         hideOriginal
                                         showCode
                                         primaryClassName="text-sm font-black text-pine dark:text-zinc-100 font-mono"
                                       />
                                     ) : <span className="text-[9px] text-slate-400">—</span>}
                                   </div>
                                 )))}
                               </div>
                             </div>
                           )}
                           {/* Total */}
                           <div className="p-4 bg-pine/5 dark:bg-pine/10 border-t-2 border-pine flex justify-between items-end">
                             <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Settlement</span>
                             <Money
                               amount={appointment.totalCost}
                               currency={sourceCurrency}
                               target={printCurrency}
                               hideOriginal
                               showCode
                               primaryClassName="text-2xl font-black tracking-tighter text-pine dark:text-zinc-100 font-mono"
                             />
                           </div>
                        </div>
                     </div>
                     );
                   })()}
                   {activeBottomTab === 'receipt' && appointment.isPaid && (
                     <div>
                        {/* Payment method missing — allow recording it */}
                        {!appointment.paymentMethod && (
                          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl">
                            <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">Payment method not recorded — select one</p>
                            <div className="flex gap-2 flex-wrap">
                              {['CASH', 'M_PESA', 'CARD', 'BANK_TRANSFER'].map(method => (
                                <button
                                  key={method}
                                  onClick={() => handleUpdatePaymentMethod(method)}
                                  disabled={isUpdatingPaymentMethod}
                                  className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isUpdatingPaymentMethod ? <Loader2 size={10} className="animate-spin inline" /> : method.replace('_', ' ')}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Transaction ID missing — allow re-linking */}
                        {!appointment.transactionId && (
                          <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40 rounded-xl flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[9px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest">Transaction ID missing</p>
                              <p className="text-[9px] text-orange-600/70 dark:text-orange-500/70 mt-0.5">Re-link the settled transaction to enable accurate reconsolidation.</p>
                            </div>
                            <button
                              onClick={handleRegenerateTransaction}
                              disabled={isRegeneratingTxn}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                            >
                              {isRegeneratingTxn ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                              {isRegeneratingTxn ? 'Linking…' : 'Regenerate'}
                            </button>
                          </div>
                        )}
                        <div className="flex justify-end mb-3 print:hidden">
                           <button
                             onClick={() => {
                               const printContent = document.getElementById('receipt-content');
                               if (printContent) {
                                 const printWindow = window.open('', '_blank');
                                 if (printWindow) {
                                   printWindow.document.write('<html><head><title>Receipt #' + appointment.id + '</title>');
                                   printWindow.document.write('<style>body{font-family:monospace;padding:40px;background:#f0fdf4;} .receipt-container{background:#f0fdf4;border:4px dashed rgba(34,197,94,0.2);border-radius:24px;padding:40px;color:#15803d;} .receipt-header{display:flex;justify-content:space-between;border-bottom:1px solid rgba(34,197,94,0.2);padding-bottom:20px;margin-bottom:30px;} .receipt-title{font-size:30px;font-weight:900;text-transform:uppercase;} .receipt-ref{font-size:10px;opacity:0.6;margin-top:5px;} .receipt-details{margin-bottom:40px;} .receipt-item{display:flex;justify-content:space-between;margin-bottom:12px;font-size:14px;} .receipt-total{border-top:1px solid rgba(34,197,94,0.2);padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end;} .total-label{font-size:12px;font-weight:900;text-transform:uppercase;} .total-amount{font-size:36px;font-weight:900;}</style>');
                                   printWindow.document.write('</head><body>');
                                   printWindow.document.write(printContent.innerHTML);
                                   printWindow.document.write('</body></html>');
                                   printWindow.document.close();
                                   printWindow.onload = () => printWindow.print();
                                 }
                               }
                             }}
                             className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-sm hover:shadow-md transition-all active:scale-95"
                           >
                             <Download size={13} />
                             Download PDF
                           </button>
                        </div>
                        <div id="receipt-content" className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/40 rounded-xl overflow-hidden shadow-sm">
                           {/* Header */}
                           <div className="bg-emerald-600 text-white px-5 py-4 flex items-start justify-between">
                             <div>
                               <div className="flex items-center gap-2">
                                 <CheckCircle2 size={16} />
                                 <p className="text-lg font-black uppercase tracking-tighter">Receipt</p>
                               </div>
                               <p className="text-[9px] text-white/60 font-bold mt-1 tracking-wider">REF #{appointment.id} · {formatDate(appointment.date)}</p>
                             </div>
                             <div className="text-right">
                               <p className="text-sm font-black uppercase tracking-tight">{activeClinic.name}</p>
                               <p className="text-[9px] text-white/60 mt-0.5 uppercase tracking-wider">PAID{appointment.paymentMethod ? ` · ${appointment.paymentMethod}` : ''}</p>
                             </div>
                           </div>

                           {/* Patient & Client */}
                           <div className="grid grid-cols-2 divide-x divide-emerald-100 dark:divide-emerald-900/30 border-b border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10">
                             <div className="px-4 py-3">
                               <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Patient</p>
                               {onNavigateToPet ? (
                                 <button onClick={() => onNavigateToPet(pet.id)} className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight hover:text-seafoam transition-colors text-left print:text-pine print:hover:text-pine">
                                   {pet.name}
                                 </button>
                               ) : (
                                 <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight">{pet.name}</p>
                               )}
                               <p className="text-[9px] text-slate-400 leading-tight">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</p>
                             </div>
                             <div className="px-4 py-3">
                               <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Client</p>
                               {client && onNavigateToClient ? (
                                 <button onClick={() => onNavigateToClient(client.id)} className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight hover:text-seafoam transition-colors text-left print:text-pine print:hover:text-pine">
                                   {client.name}
                                 </button>
                               ) : (
                                 <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight">{client?.name ?? appointment.client?.name ?? '—'}</p>
                               )}
                               <p className="text-[9px] text-slate-400 leading-tight">{client?.phone ?? appointment.client?.phone ?? ''}</p>
                             </div>
                           </div>

                           {/* Line items */}
                           <div className="p-4 space-y-1.5">
                             {appointment.tasks.map(t => (
                               <div key={t.id} className="flex justify-between items-baseline py-1 border-b border-slate-100 dark:border-zinc-800 last:border-0">
                                 <span className="text-sm font-bold text-pine dark:text-zinc-200">{t.name}</span>
                                 <span className="text-sm font-black text-pine dark:text-zinc-100 font-mono tabular-nums">{activeClinic.currency} {(t.price || 0).toLocaleString()}</span>
                               </div>
                             ))}
                             {apptMedications.length > 0 && apptMedications.map((m, i) => (
                               <div key={m.id ?? i} className="flex justify-between items-baseline py-1 border-b border-slate-100 dark:border-zinc-800 last:border-0">
                                 <span className="text-sm font-bold text-slate-500 dark:text-zinc-400">{m.inventoryItem?.name || 'Medication'} <span className="text-[9px] font-normal">× {m.quantity}</span></span>
                                 {m.inventoryItem?.unitPrice
                                   ? <span className="text-sm font-black text-pine dark:text-zinc-100 font-mono tabular-nums">{activeClinic.currency} {(m.inventoryItem.unitPrice * m.quantity).toLocaleString()}</span>
                                   : <span className="text-[9px] text-slate-300">—</span>}
                               </div>
                             ))}
                           </div>

                           {/* Total */}
                           <div className="flex justify-between items-center px-4 py-3 bg-emerald-600/10 border-t-2 border-emerald-600">
                             <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Amount Paid</span>
                             <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums tracking-tighter">{activeClinic.currency} {appointment.totalCost.toLocaleString()}</span>
                           </div>
                        </div>
                     </div>
                   )}
                </div>
             </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-pine/95 dark:bg-black/95 backdrop-blur-xl z-[800] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200">
              <header className="text-center mb-8">
                 <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Settlement</h2>
                 <p className="text-seafoam text-[9px] font-black uppercase mt-1 tracking-widest">Total: {activeClinic.currency} {appointment.totalCost.toLocaleString()}</p>
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
              <button onClick={() => setShowPaymentModal(false)} className="w-full mt-6 py-3 text-slate-400 dark:text-zinc-600 font-black text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors">Cancel</button>
           </div>
        </div>
      )}

      {showInjectModal && (
        <div className="fixed inset-0 bg-pine/90 dark:bg-black/90 backdrop-blur-xl z-[700] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-4xl w-full p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200">
              <header className="flex justify-between items-start mb-8">
                 <div>
                   <h2 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-tight">Add Services</h2>
                   <p className="text-seafoam text-[9px] font-black uppercase mt-1 tracking-widest">Add items to this visit</p>
                 </div>
                 <button onClick={() => setShowInjectModal(false)} className="text-slate-400 hover:rotate-90 transition-all duration-300"><X size={28}/></button>
              </header>
              <div className="space-y-10">
                 <div className="flex gap-3 overflow-x-auto custom-scrollbar no-scrollbar pb-4 px-1">
                    {refCategories.map(cat => (
                      <button key={cat.id} onClick={() => setSelectedCatId(cat.id)} className={`shrink-0 flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all hover:scale-105 active:scale-95 ${selectedCatId === cat.id ? 'bg-seafoam border-seafoam text-white shadow-lg shadow-seafoam/20' : 'bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 text-slate-400'}`}>
                        <span className="text-3xl">{categoryIconByName.get(cat.name) || '📋'}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest">{cat.name}</span>
                      </button>
                    ))}
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {refServices.filter(s => s.categoryId === selectedCatId).map(svc => (
                       <button
                        key={svc.id}
                        onClick={() => {
                          const price = Number(svc.defaultPrice ?? 0);
                          onInjectTask(appointment.id, {
                            id: Math.floor(Math.random() * 1000000),
                            name: svc.name,
                            category: refCategories.find(c => c.id === selectedCatId)?.name || 'General',
                            status: TaskStatus.PENDING,
                            assignedStaffId: staffMembers[0].id,
                            price
                          });
                          setShowInjectModal(false);
                        }}
                        className="flex items-center justify-between p-6 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700 rounded-2xl hover:border-seafoam transition-all group shadow-xs active:scale-95 text-left"
                       >
                          <div className="min-w-0">
                             <p className="text-base font-black text-pine dark:text-zinc-100 leading-tight truncate uppercase tracking-tight">{svc.name}</p>
                             <p className="text-seafoam font-black font-mono text-xs mt-1.5 uppercase tracking-[0.1em]">Fee: {activeClinic.currency} {Number(svc.defaultPrice ?? 0).toLocaleString()}</p>
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
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-seafoam/10 text-seafoam rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Visit Completion</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Review summary, invoice, and receipt</p>
                </div>
              </div>
              <button
                onClick={() => setShowSummaryPreview(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all active:scale-95"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-zinc-900 p-1.5 mx-6 mt-4 rounded-xl border border-slate-200 dark:border-zinc-800">
              <button
                onClick={() => setSummaryPreviewTab('summary')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  summaryPreviewTab === 'summary' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-lg dark:shadow-none' : 'text-seafoam dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setSummaryPreviewTab('invoice')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  summaryPreviewTab === 'invoice' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-lg dark:shadow-none' : 'text-seafoam dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
                }`}
              >
                Invoice
              </button>
              <button
                onClick={() => setSummaryPreviewTab('receipt')}
                disabled={!appointment.isPaid}
                className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  summaryPreviewTab === 'receipt' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-lg dark:shadow-none' : 'text-seafoam dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
                }`}
              >
                Receipt {!appointment.isPaid && '(After Payment)'}
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-240px)] custom-scrollbar space-y-6">
              {/* Summary Tab */}
              {summaryPreviewTab === 'summary' && (
                <>
                  {/* Diagnostic Record - Consolidated Summary */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-seafoam uppercase tracking-widest">Diagnostic Record</h3>
                    <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-3">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Diagnosis</p>
                        <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">{summaryPreview.diagnosis}</p>
                      </div>
                      <div className="border-t border-slate-200 dark:border-zinc-700 pt-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Treatment</p>
                        <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">{summaryPreview.treatment}</p>
                      </div>
                      {summaryPreview.medications.length > 0 && (
                        <div className="border-t border-slate-200 dark:border-zinc-700 pt-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Medications Administered</p>
                          <ul className="list-disc list-inside space-y-1">
                            {summaryPreview.medications.map((med, idx) => (
                              <li key={idx} className="text-sm text-slate-700 dark:text-zinc-300">{med}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detailed Service Notes */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-seafoam uppercase tracking-widest">Detailed Service Notes</h3>
                    <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2">
                      {summaryPreview.serviceNotes.map((note, idx) => (
                        <div key={idx} className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pb-2 border-b border-slate-200 dark:border-zinc-700 last:border-0 last:pb-0">
                          {note}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Invoice Tab */}
              {summaryPreviewTab === 'invoice' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
                    <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest mb-4">Itemized Services</h3>
                    <div className="space-y-2">
                      {appointment.tasks.map((task, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-zinc-700 last:border-0">
                          <div>
                            <p className="text-sm font-bold text-pine dark:text-zinc-100">{task.name}</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">{task.category}</p>
                          </div>
                          <p className="text-sm font-black text-pine dark:text-zinc-100">{activeClinic.currency} {task.price?.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t-2 border-slate-300 dark:border-zinc-600 flex justify-between items-center">
                      <p className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Total</p>
                      <p className="text-xl font-black text-seafoam">{activeClinic.currency} {appointment.totalCost.toLocaleString()}</p>
                    </div>
                  </div>
                  {!appointment.isPaid && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Payment pending - Complete payment to generate receipt</p>
                    </div>
                  )}
                </div>
              )}

              {/* Receipt Tab */}
              {summaryPreviewTab === 'receipt' && (
                <div className="space-y-4">
                  {appointment.isPaid ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">Payment Received</h3>
                          <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">Visit #{appointment.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{activeClinic.currency} {appointment.totalCost.toLocaleString()}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">via {appointment.paymentMethod}</p>
                        </div>
                      </div>
                      <div className="border-t border-emerald-200 dark:border-emerald-800 pt-4">
                        <p className="text-xs text-emerald-600 dark:text-emerald-500">Payment Date: {formatDate(appointment.date)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-6 text-center">
                      <p className="text-sm text-slate-500 dark:text-zinc-400">Receipt will be available after payment is processed</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
              <button
                onClick={() => setShowSummaryPreview(false)}
                className="flex-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-sm active:scale-95 transition-all"
              >
                Close
              </button>
              {appointment.isPaid ? (
                /* Already settled — nothing more to do from preview */
                null
              ) : (appointment.status === ApptStatus.PENDING_PAYMENT || appointment.status === ApptStatus.COMPLETED) ? (
                /* Finalized but not yet paid */
                <button
                  onClick={() => { setShowSummaryPreview(false); openSettleModal(); }}
                  className="flex-1 bg-seafoam text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard size={13} />
                  Settle Bill
                </button>
              ) : (
                /* Not yet finalized */
                <button
                  onClick={() => { setShowSummaryPreview(false); handleFinalize(); }}
                  className="flex-1 bg-pine dark:bg-zinc-100 text-white dark:text-pine py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-md active:scale-95 transition-all"
                >
                  Finalize Visit
                </button>
              )}
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
                  <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">Medications</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {appointment.tasks.find(t => t.id === showMedicationModal)?.name || 'Task'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseMedicationModal}
                className="p-2 text-slate-400 hover:text-pine transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
              <button
                onClick={() => setMedicationModalTab('saved')}
                className={`flex-1 px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-all ${
                  medicationModalTab === 'saved'
                    ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                    : 'text-slate-400 hover:text-pine dark:hover:text-zinc-100'
                }`}
              >
                Saved Medications ({(() => {
                  const currentMeds = ((appointment as any).medications ?? []).filter((m: any) => String(m.taskId) === String(showMedicationModal));
                  const editedMeds = taskEdits[showMedicationModal!]?.medications;
                  return editedMeds ? editedMeds.length : currentMeds.length;
                })()})
              </button>
              <button
                onClick={() => setMedicationModalTab('search')}
                className={`flex-1 px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-all ${
                  medicationModalTab === 'search'
                    ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                    : 'text-slate-400 hover:text-pine dark:hover:text-zinc-100'
                }`}
              >
                Search & Add
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Tab 1: Saved Medications */}
              {medicationModalTab === 'saved' && (() => {
                const currentMedications = ((appointment as any).medications ?? []).filter((m: any) => String(m.taskId) === String(showMedicationModal));
                const editedMedications = taskEdits[showMedicationModal!]?.medications;
                const medications = editedMedications !== undefined ? editedMedications : currentMedications;

                return (
                  <div className="space-y-3">
                    {medications.length > 0 ? (
                      medications.map((med: any, index: number) => {
                        const unitPrice = med.inventoryItem?.unitPrice ?? 0;
                        const quantity = med.quantity ?? 0;
                        const totalCost = unitPrice * quantity;

                        return (
                          <div key={index} className="p-4 bg-purple-50 dark:bg-purple-950/10 border border-purple-200 dark:border-purple-800 rounded-xl">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Pill size={16} className="text-purple-500 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-pine dark:text-zinc-100 truncate">
                                    {med.inventoryItem?.name || 'Medication'}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs text-slate-600 dark:text-zinc-400">
                                      Qty: {quantity} {med.inventoryItem?.unit || 'units'}
                                    </span>
                                    <span className="text-xs text-purple-600 dark:text-purple-400 font-bold">
                                      @ {activeClinic.currency} {unitPrice.toLocaleString()} per {med.inventoryItem?.unit || 'unit'}
                                    </span>
                                    {med.notes && (
                                      <span className="text-xs text-slate-500 dark:text-zinc-500 truncate">
                                        • {med.notes}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
                                    <p className="text-xs font-bold text-purple-700 dark:text-purple-300">
                                      Total: {activeClinic.currency} {totalCost.toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {!isFinalized && !med.isDeducted && (
                                <button
                                  onClick={() => handleRemoveMedication(showMedicationModal!, index)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors shrink-0"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-12">
                        <Pill className="mx-auto mb-4 text-slate-300 dark:text-zinc-700" size={48} />
                        <p className="font-bold text-slate-400 mb-2">No medications added yet</p>
                        <p className="text-xs text-slate-400">Switch to "Search & Add" tab to add medications</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tab 2: Search & Add */}
              {medicationModalTab === 'search' && (
                <>
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
                                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-zinc-700 space-y-0.5">
                                  <div>
                                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400">
                                      {activeClinic.currency} {(med.price ?? 0).toLocaleString()}
                                    </p>
                                    <p className="text-[9px] text-slate-400">sell / {med.unit}</p>
                                  </div>
                                  {med.costPrice != null && (
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                                        {activeClinic.currency} {med.costPrice.toLocaleString()}
                                      </p>
                                      <p className="text-[9px] text-slate-400">{med.supplierId ? 'supplier cost' : 'cost'} / {med.unit}</p>
                                    </div>
                                  )}
                                </div>
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
                                      min="0"
                                      step="any"
                                      max={med.quantity}
                                      value={medicationQuantity}
                                      onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setMedicationQuantity(isNaN(v) ? 0 : v);
                                      }}
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
                            {/* Pricing Summary */}
                            <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-2">
                              <p className="text-[8px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Pricing</p>
                              {/* Clinic selling */}
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                                  Selling ({medicationQuantity} × {activeClinic.currency} {(med.price ?? 0).toLocaleString()})
                                </span>
                                <span className="text-sm font-black text-purple-700 dark:text-purple-300">
                                  {activeClinic.currency} {((med.price ?? 0) * medicationQuantity).toLocaleString()}
                                </span>
                              </div>
                              {/* Clinic / supplier cost */}
                              {med.costPrice != null && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                                    {med.supplierId ? 'Supplier cost' : 'Clinic cost'} ({medicationQuantity} × {activeClinic.currency} {med.costPrice.toLocaleString()})
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                                    {activeClinic.currency} {(med.costPrice * medicationQuantity).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {/* Margin */}
                              {med.costPrice != null && (
                                <div className="flex items-center justify-between pt-1.5 border-t border-purple-200 dark:border-purple-800">
                                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">Margin</span>
                                  <span className={`text-[11px] font-bold ${(med.price - med.costPrice) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                    {activeClinic.currency} {((med.price - med.costPrice) * medicationQuantity).toLocaleString()}
                                    {med.costPrice > 0 ? ` (${(((med.price - med.costPrice) / med.costPrice) * 100).toFixed(1)}%)` : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
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
                  {medicationModalTab === 'saved' ? 'Close' : 'Cancel'}
                </button>
                {medicationModalTab === 'search' && !isFinalized && (
                  <button
                    onClick={() => handleAddMedication()}
                    disabled={!selectedMedicationId}
                    className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Add Medication
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Modal */}
      {showUnsavedChangesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 rounded-xl">
                  <AlertCircle className="text-amber-500" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Unsaved Changes</h3>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 mt-0.5">You have unsaved changes</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                You have unsaved changes to tasks, staff assignments, or medications. Would you like to save these changes before leaving?
              </p>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
              <button
                onClick={() => setShowUnsavedChangesModal(false)}
                className="flex-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscardChanges}
                className="flex-1 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all"
              >
                Discard Changes
              </button>
              <button
                onClick={async () => {
                  await handleSaveAllChanges();
                  setShowUnsavedChangesModal(false);
                  if (pendingNavigation) {
                    pendingNavigation();
                    setPendingNavigation(null);
                  }
                }}
                className="flex-1 bg-seafoam text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-all"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Clinical Narrative Modal */}
      {showAINotesPreview && (() => {
        const wordCount = editableAINotes.trim() ? editableAINotes.trim().split(/\s+/).length : 0;
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[200] p-0 sm:p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 flex flex-col">

              {/* Header */}
              <div className="bg-gradient-to-r from-[#2d1b69] to-[#7c3aed] px-5 py-4 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white tracking-tight leading-none">Clinical Narrative</h3>
                    <p className="text-[10px] text-purple-200 font-bold mt-0.5">
                      {pet.name} · {formatDate(appointment.date)} · {wordCount} words
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Copy button */}
                  <button
                    onClick={() => navigator.clipboard?.writeText(editableAINotes)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all active:scale-95"
                    title="Copy to clipboard"
                  >
                    <Copy size={15} className="text-white" />
                  </button>
                  <button
                    onClick={() => setShowAINotesPreview(false)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all active:scale-95"
                  >
                    <X size={15} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Meta strip */}
              <div className="px-5 py-2.5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-4 bg-slate-50 dark:bg-zinc-800/50 shrink-0 overflow-x-auto no-scrollbar">
                {[
                  { label: 'Patient', value: `${pet.name} (${pet.species})` },
                  { label: 'Visit', value: `#${appointment.id}` },
                  { label: 'Services', value: `${appointment.tasks.length} tasks` },
                  { label: 'Status', value: appointment.status.replace('_', ' ') },
                ].map(item => (
                  <div key={item.label} className="shrink-0">
                    <p className="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{item.label}</p>
                    <p className="text-[11px] font-bold text-pine dark:text-zinc-100">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {aiNotesError ? (
                  <div className="m-5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                    <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-black text-red-700 dark:text-red-400">Generation failed</p>
                      <p className="text-xs text-red-600 dark:text-red-500 mt-1">{aiNotesError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Clinical Narrative — Edit below</p>
                      <span className="text-[9px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                        AI Generated
                      </span>
                    </div>
                    <textarea
                      value={editableAINotes}
                      onChange={(e) => setEditableAINotes(e.target.value)}
                      className="w-full min-h-[320px] sm:min-h-[380px] bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-4 text-sm text-pine dark:text-zinc-100 leading-relaxed outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 resize-none font-mono transition-all"
                      placeholder="Clinical narrative will appear here..."
                      spellCheck
                    />
                    <p className="text-[9px] text-slate-400 dark:text-zinc-600 mt-2 text-right">{wordCount} words · {editableAINotes.length} characters</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800 flex gap-2.5 shrink-0 bg-white dark:bg-zinc-900">
                <button
                  onClick={() => setShowAINotesPreview(false)}
                  className="px-4 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={handleRegenerateAINotes}
                  disabled={isGeneratingAINotes}
                  className="flex-1 bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-700 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGeneratingAINotes ? (
                    <><Loader2 size={13} className="animate-spin" /> Regenerating...</>
                  ) : (
                    <><Wand2 size={13} /> Regenerate</>
                  )}
                </button>
                <button
                  onClick={handleAcceptAINotes}
                  disabled={!editableAINotes.trim() || appointment.isPaid}
                  className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-purple-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={13} />
                  Save to Record
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Settle Bill Modal */}
      {showSettleModal && (() => {
        const discountVal = parseFloat(settleDiscountValue) || 0;
        const discountAmount = settleDiscountType === 'PERCENTAGE'
          ? (appointment.totalCost * discountVal) / 100
          : discountVal;
        const finalTotal = Math.max(0, appointment.totalCost - discountAmount);
        return (
          <div className="fixed inset-0 bg-pine/95 dark:bg-black/95 backdrop-blur-xl z-[800] flex items-center justify-center p-6 animate-in fade-in" onClick={() => setShowSettleModal(false)}>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-pine px-6 py-5 flex items-center justify-between">
                <div>
                  <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">Settle Bill</p>
                  <p className="text-lg font-black text-white uppercase tracking-tight leading-tight">#{appointment.id} — {pet.name}</p>
                </div>
                <button onClick={() => setShowSettleModal(false)} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"><X size={16} /></button>
              </div>
              <div className="h-1 bg-gradient-to-r from-seafoam via-cyan to-seafoam" />

              <div className="p-6 space-y-5">
                {/* Payment method */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Payment Method</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['M_PESA', 'CARD', 'CASH', 'BANK_TRANSFER'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setSettlePaymentMethod(m)}
                        className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${settlePaymentMethod === m ? 'border-seafoam bg-seafoam/10 text-seafoam' : 'border-slate-100 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-seafoam/40'}`}
                      >
                        <CreditCard size={13} className={settlePaymentMethod === m ? 'text-seafoam' : 'text-slate-300'} />
                        {m.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gateway flow — shows when clinic has configured the matching provider */}
                {gatewayAvailable(settlePaymentMethod) && (
                  <div className="bg-seafoam/10 border border-seafoam/30 rounded-xl p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useGateway}
                        onChange={(e) => setUseGateway(e.target.checked)}
                      />
                      <span className="text-[10px] font-black text-pine uppercase tracking-widest">
                        {settlePaymentMethod === 'M_PESA' ? 'Push STK to customer phone' : 'Charge card via Stripe'}
                      </span>
                    </label>
                    {useGateway && settlePaymentMethod === 'M_PESA' && (
                      <div>
                        <label className="text-[8px] font-black text-seafoam uppercase tracking-widest">Customer phone</label>
                        <input
                          type="tel"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          placeholder="07XX or 2547XX"
                          className="w-full mt-1 bg-white dark:bg-zinc-800 border border-seafoam/30 rounded-lg px-3 py-2 text-sm font-medium text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Client Discounts */}
                {clientDiscounts.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Client Discounts</p>
                    <div className="space-y-1.5">
                      {clientDiscounts.map(cd => (
                        <button
                          key={cd.id}
                          onClick={() => {
                            if (selectedClientDiscount?.id === cd.id) {
                              setSelectedClientDiscount(null);
                              setSettleDiscountType('PERCENTAGE');
                              setSettleDiscountValue('');
                            } else {
                              setSelectedClientDiscount(cd);
                              setSettleDiscountType(cd.discountType);
                              setSettleDiscountValue(String(cd.value));
                            }
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                            selectedClientDiscount?.id === cd.id
                              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'border-slate-100 dark:border-zinc-800 hover:border-emerald-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase truncate">{cd.name}</p>
                            <p className="text-[8px] font-bold text-slate-400">Expires {formatDate(cd.expiresAt)}</p>
                          </div>
                          <span className={`text-sm font-black shrink-0 ml-2 ${selectedClientDiscount?.id === cd.id ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {cd.discountType === 'PERCENTAGE' ? `${cd.value}%` : `${client?.currency || 'KES'} ${Number(cd.value).toLocaleString()}`}
                          </span>
                        </button>
                      ))}
                    </div>
                    {selectedClientDiscount && (
                      <p className="text-[8px] font-bold text-emerald-500 mt-1.5 italic">This discount will be redeemed on payment</p>
                    )}
                  </div>
                )}

                {/* Manual Discount */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{clientDiscounts.length > 0 ? 'Manual Override' : 'Discount'} <span className="text-slate-300 normal-case font-bold">(optional)</span></p>
                  <div className="flex gap-2 mb-2">
                    {(['PERCENTAGE', 'FIXED'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => { setSettleDiscountType(t); setSettleDiscountValue(''); setSelectedClientDiscount(null); }}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${settleDiscountType === t && !selectedClientDiscount ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-amber-300'}`}
                      >
                        {t === 'PERCENTAGE' ? '% Off' : 'Fixed'}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max={settleDiscountType === 'PERCENTAGE' ? 100 : undefined}
                      placeholder={settleDiscountType === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 500'}
                      value={settleDiscountValue}
                      onChange={e => { setSettleDiscountValue(e.target.value); setSelectedClientDiscount(null); }}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-black text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400 pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">
                      {settleDiscountType === 'PERCENTAGE' ? '%' : (client?.currency || 'KES')}
                    </span>
                  </div>
                </div>

                {/* Total summary */}
                <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                    <span>Subtotal</span>
                    <span>{client?.currency || 'KES'} {appointment.totalCost.toLocaleString()}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[10px] font-black uppercase text-amber-500">
                      <span>Discount</span>
                      <span>− {client?.currency || 'KES'} {discountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black uppercase text-pine dark:text-zinc-100 border-t border-slate-200 dark:border-zinc-700 pt-2 mt-1">
                    <span>Total</span>
                    <span className="text-seafoam">{client?.currency || 'KES'} {finalTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Confirm */}
                <button
                  onClick={async () => {
                    if (!settlePaymentMethod) { toast.error('Select a payment method'); return; }
                    // Redeem client discount if selected
                    if (selectedClientDiscount && client) {
                      try {
                        await clientDiscountsAPI.redeem(client.id, selectedClientDiscount.id, appointment.id);
                      } catch { /* redemption logged server-side, payment still proceeds */ }
                    }
                    handleSettleBill(settlePaymentMethod, discountVal > 0 ? settleDiscountType : undefined, discountVal > 0 ? discountVal : undefined);
                  }}
                  className="w-full py-3.5 bg-seafoam text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-seafoam/90 active:scale-95 transition-all shadow-lg hover:shadow-seafoam/30"
                >
                  Confirm Payment{selectedClientDiscount ? ' & Redeem Discount' : ''}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Gateway payment status (Stripe / Mpesa async flows) */}
      {gatewayStatus && (
        <div className="fixed inset-0 bg-pine/95 dark:bg-black/95 backdrop-blur-xl z-[900] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-pine px-6 py-5">
              <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">
                {gatewayStatus.provider === 'MPESA' ? 'M-Pesa Payment' : 'Stripe Payment'}
              </p>
              <p className="text-lg font-black text-white uppercase tracking-tight leading-tight">
                {gatewayStatus.state === 'INITIATING' && 'Initiating...'}
                {gatewayStatus.state === 'PENDING' && 'Waiting for payment'}
                {gatewayStatus.state === 'SETTLED' && 'Payment received'}
                {gatewayStatus.state === 'FAILED' && 'Payment failed'}
              </p>
            </div>
            <div className="h-1 bg-gradient-to-r from-seafoam via-cyan to-seafoam" />
            <div className="p-6 space-y-4">
              <p className="text-sm font-medium text-pine dark:text-zinc-100">
                {gatewayStatus.message || (gatewayStatus.provider === 'MPESA'
                  ? 'An STK push has been sent to the customer. They need to enter their M-Pesa PIN to confirm.'
                  : 'Complete the payment on Stripe to finalize.')}
              </p>
              {gatewayStatus.checkoutUrl && (
                <a
                  href={gatewayStatus.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2.5 text-center bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-seafoam/90"
                >
                  Reopen Stripe Checkout
                </a>
              )}
              {gatewayStatus.state === 'PENDING' && (
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Auto-refreshing every 3s...</span>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setGatewayStatus(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100 text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  {gatewayStatus.state === 'SETTLED' ? 'Done' : 'Close'}
                </button>
                {gatewayStatus.state === 'PENDING' && (
                  <button
                    onClick={async () => {
                      const res = await appointmentsAPI.getPaymentStatus(appointment.id);
                      if (res.success && res.data?.status === 'SETTLED') {
                        setGatewayStatus(prev => prev && { ...prev, state: 'SETTLED', message: 'Payment confirmed.' });
                        await onRefreshDashboard?.();
                      }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-pine text-white text-[9px] font-black uppercase tracking-widest"
                  >
                    Check now
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
        shortcuts={[
          { key: 's', ctrl: true, meta: true, action: () => {}, description: 'Save changes' },
          { key: 'Escape', action: () => {}, description: 'Close modal' },
          { key: '?', shift: true, action: () => {}, description: 'Show keyboard shortcuts' },
        ]}
      />

      {/* Error Dialog */}
      <ErrorDialog
        open={errorDialog.open}
        title={errorDialog.title}
        message={errorDialog.message}
        onClose={() => setErrorDialog({ open: false, message: '' })}
      />
    </div>
  );
};

export default AppointmentDetailView;
