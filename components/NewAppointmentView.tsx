
import React, { useState, useMemo, useEffect } from 'react';
import { Search, PawPrint, Calendar, Clock, ArrowRight, Check, X, Users, Ghost, Home, Plus, Trash2, Tag, Scale, Heart, User as UserIcon, Link2, Info, ChevronRight, ChevronDown, Pill, AlertCircle, UserPlus, Phone, Mail } from 'lucide-react';
import { Client, Pet, TaskStatus, Appointment } from '../types';
import SearchableDropdown from './SearchableDropdown';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useStaff } from '../contexts/StaffContext';
import { inventoryAPI, InventoryItem, clientsAPI, petsAPI } from '../services';
import StepIndicator from './StepIndicator';
import DateTimePicker from './DateTimePicker';

interface TaskMedication {
  id: string;
  inventoryItemId: string;
  inventoryItem: InventoryItem;
  quantity: number;
  notes?: string;
}

interface SelectedService {
  id: string;
  name: string;
  price: number;
  weightValue?: string;
  weightUnit?: string;
  isNotApplicable?: boolean;
  assignedStaffId?: number;
  medications?: TaskMedication[];
}

interface SelectedCategory {
  categoryId: string;
  services: SelectedService[];
}

interface Props {
  clients: Client[];
  pets: Pet[];
  appointments?: Appointment[];
  onSave: (data: any) => void;
  onCancel: () => void;
  initialClientId?: number;
  initialPetId?: number;
  initialReferralId?: number;
  initialParentApptId?: number;
  initialCategoryId?: string;
}

const UNIT_OPTIONS = ['kg', 'lb', 'g', 'tons'];

const NewAppointmentView: React.FC<Props> = ({ clients, pets, appointments = [], onSave, onCancel, initialClientId, initialPetId, initialReferralId, initialParentApptId, initialCategoryId }) => {
  const { categories: apiCategories, getServicesByCategory } = useReferenceData();
  const { staff } = useStaff();
  const [activeTab, setActiveTab] = useState<'internal' | 'walking'>(initialParentApptId ? 'internal' : 'internal');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(initialClientId || null);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(initialPetId || null);
  const [isHouseCall, setIsHouseCall] = useState(false);

  // Get parent appointment information if this is a follow-up
  const parentAppointment = useMemo(() => {
    if (!initialParentApptId || !appointments) return null;
    return appointments.find(a => a.id === initialParentApptId);
  }, [initialParentApptId, appointments]);

  const [selectedCategories, setSelectedCategories] = useState<SelectedCategory[]>([]);
  const [showCustomModal, setShowCustomModal] = useState<{ catId: string } | null>(null);
  const [customEntry, setCustomEntry] = useState({ name: '', price: 0 });

  // Medication modal state
  const [showMedicationModal, setShowMedicationModal] = useState<{ catId: string; svcId: string } | null>(null);
  const [availableMedications, setAvailableMedications] = useState<InventoryItem[]>([]);
  const [loadingMedications, setLoadingMedications] = useState(false);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>('');
  const [medicationQuantity, setMedicationQuantity] = useState<number>(1);
  const [medicationNotes, setMedicationNotes] = useState<string>('');
  const [medicationSearchQuery, setMedicationSearchQuery] = useState<string>('');
  const [medicationError, setMedicationError] = useState<string>('');

  // Walk-in client modal state
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInClientData, setWalkInClientData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });
  const [walkInPetData, setWalkInPetData] = useState({
    name: '',
    species: 'Dog' as 'Dog' | 'Cat',
    breed: '',
    gender: 'Male' as 'Male' | 'Female',
    dob: ''
  });
  const [isCreatingWalkIn, setIsCreatingWalkIn] = useState(false);

  // Filter staff to only VETs, STAFF, and CLINIC_OWNER
  const availableStaff = useMemo(() => {
    return staff.filter(s => s.role === 'VET' || s.role === 'STAFF' || s.role === 'CLINIC_OWNER');
  }, [staff]);

  // Convert API categories to display format with icons
  const categoryIcons: Record<string, string> = {
    'Consultation': '🩺',
    'Vaccination': '💉',
    'Surgery': '🔪',
    'Diagnostics': '🔬',
    'Grooming': '✂️',
    'Dental': '🦷',
    'Emergency': '🚨',
    'Boarding': '🏠',
    'Nutrition': '🍖',
    'Pharmacy': '💊',
  };

  const categoriesWithIcons = useMemo(() => {
    return apiCategories.map(cat => ({
      id: cat.id.toString(),
      name: cat.name,
      icon: categoryIcons[cat.name] || '📋',
    }));
  }, [apiCategories]);

  // Auto-populate client when pet is selected
  useEffect(() => {
    if (selectedPetId && !initialClientId) {
      const selectedPet = pets.find(p => p.id === selectedPetId);
      if (selectedPet && selectedPet.ownerId && selectedPet.ownerId !== selectedClientId) {
        setSelectedClientId(selectedPet.ownerId);
        console.log(`Auto-populated client ${selectedPet.ownerId} from pet ${selectedPetId}`);
      }
    }
  }, [selectedPetId, pets, initialClientId]);

  useEffect(() => {
    if (selectedCategories.length === 0 && categoriesWithIcons.length > 0) {
      const defaultCategories: SelectedCategory[] = [];

      // Auto-assign staff for default tasks
      const getAutoAssignedStaff = (): number | undefined => {
        const veterinarians = availableStaff.filter(s => s.role === 'VET');
        const clinicOwners = availableStaff.filter(s => s.role === 'CLINIC_OWNER');
        const otherStaff = availableStaff.filter(s => s.role === 'STAFF');

        if (veterinarians.length > 0) return veterinarians[0].id;
        if (clinicOwners.length > 0) return clinicOwners[0].id;
        if (otherStaff.length > 0) return otherStaff[0].id;
        return undefined;
      };

      // Always include Consultation/Weight as baseline
      const consultationCat = categoriesWithIcons.find(c => c.name === 'Consultation');
      if (consultationCat) {
        defaultCategories.push({
          categoryId: consultationCat.id,
          services: [{
            id: 'default-weight',
            name: 'Take Weight',
            price: 0,
            weightValue: '0.00',
            weightUnit: 'kg',
            isNotApplicable: false,
            assignedStaffId: getAutoAssignedStaff()
          }]
        });
      }

      // Pre-select a specific category if requested — match by ID or by name
      if (initialCategoryId && initialCategoryId !== consultationCat?.id) {
        const targetCat = categoriesWithIcons.find(
          c => c.id === initialCategoryId ||
               c.name.toLowerCase() === initialCategoryId.toLowerCase()
        );
        if (targetCat && !defaultCategories.some(c => c.categoryId === targetCat.id)) {
          defaultCategories.push({
            categoryId: targetCat.id,
            services: []
          });
        }
      }

      setSelectedCategories(defaultCategories);
    }
  }, [initialCategoryId, categoriesWithIcons, availableStaff]);

  // Derive default lead staff: first VET, then CLINIC_OWNER, then any other
  const defaultLeadStaffId = useMemo(() => {
    const vet = availableStaff.find(s => s.role === 'VET');
    if (vet) return vet.id;
    const owner = availableStaff.find(s => s.role === 'CLINIC_OWNER');
    if (owner) return owner.id;
    return availableStaff[0]?.id ?? null;
  }, [availableStaff]);

  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    petName: '',
    petSpecies: 'Dog',
    petBreed: 'Mixed Breed',
    petAge: 1,
    apptDate: new Date().toISOString().split('T')[0],
    apptTime: (() => {
      const now = new Date();
      const m = now.getMinutes();
      const roundedMin = m < 30 ? 30 : 0;
      const roundedHr = m < 30 ? now.getHours() : (now.getHours() + 1) % 24;
      return `${String(roundedHr).padStart(2, '0')}:${String(roundedMin).padStart(2, '0')}`;
    })(),
    leadStaffId: null as number | null,
  });

  // Sync defaultLeadStaffId into formData once staff loads
  useEffect(() => {
    if (defaultLeadStaffId && !formData.leadStaffId) {
      setFormData(prev => ({ ...prev, leadStaffId: defaultLeadStaffId }));
    }
  }, [defaultLeadStaffId]);

  const filteredClients = useMemo(() => {
    if (searchQuery.length < 3) return [];
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.phone.includes(searchQuery) ||
      c.id.toString().includes(searchQuery)
    ).slice(0, 10);
  }, [clients, searchQuery]);

  const clientPets = useMemo(() => {
    return pets.filter(p => p.ownerId === selectedClientId);
  }, [pets, selectedClientId]);

  const totalCost = useMemo(() => {
    return selectedCategories.reduce((sum, cat) => 
      sum + cat.services.reduce((sSum, svc) => sSum + (svc.isNotApplicable ? 0 : svc.price), 0)
    , 0);
  }, [selectedCategories]);

  const handleAddCategory = (catId: string) => {
    if (selectedCategories.some(c => c.categoryId === catId)) return;
    setSelectedCategories([...selectedCategories, { categoryId: catId, services: [] }]);
  };

  const handleRemoveCategory = (catId: string) => {
    setSelectedCategories(selectedCategories.filter(c => c.categoryId !== catId));
  };

  // Auto-assign staff to a service based on priority
  const autoAssignStaff = (): number | undefined => {
    // Priority order: VET > CLINIC_OWNER > STAFF
    const veterinarians = availableStaff.filter(s => s.role === 'VET');
    const clinicOwners = availableStaff.filter(s => s.role === 'CLINIC_OWNER');
    const otherStaff = availableStaff.filter(s => s.role === 'STAFF');

    // Return first available in priority order
    if (veterinarians.length > 0) {
      return veterinarians[0].id;
    } else if (clinicOwners.length > 0) {
      return clinicOwners[0].id;
    } else if (otherStaff.length > 0) {
      return otherStaff[0].id;
    }

    return undefined;
  };

  const handleAddService = (catId: string, svcName: string, price: number) => {
    const assignedStaffId = autoAssignStaff();

    setSelectedCategories(selectedCategories.map(cat => {
      if (cat.categoryId === catId) {
        return {
          ...cat,
          services: [...cat.services, {
            id: Math.random().toString(36).substr(2, 9),
            name: svcName,
            price,
            assignedStaffId
          }]
        };
      }
      return cat;
    }));
  };

  const updateWeightTask = (catId: string, svcId: string, data: Partial<SelectedService>) => {
    setSelectedCategories(selectedCategories.map(cat => {
      if (cat.categoryId === catId) {
        return {
          ...cat,
          services: cat.services.map(s => s.id === svcId ? { ...s, ...data } : s)
        };
      }
      return cat;
    }));
  };

  const handleRemoveService = (catId: string, svcId: string) => {
    setSelectedCategories(selectedCategories.map(cat => {
      if (cat.categoryId === catId) {
        return {
          ...cat,
          services: cat.services.filter(s => s.id !== svcId)
        };
      }
      return cat;
    }));
  };

  const handlePriceUpdate = (catId: string, svcId: string, price: number) => {
    setSelectedCategories(selectedCategories.map(cat => {
      if (cat.categoryId === catId) {
        return { ...cat, services: cat.services.map(s => s.id === svcId ? { ...s, price } : s) };
      }
      return cat;
    }));
  };

  // Staff assignment handlers
  const handleStaffAssignment = (catId: string, svcId: string, staffId: number) => {
    setSelectedCategories(selectedCategories.map(cat => {
      if (cat.categoryId === catId) {
        return {
          ...cat,
          services: cat.services.map(s => s.id === svcId ? { ...s, assignedStaffId: staffId } : s)
        };
      }
      return cat;
    }));
  };

  // Medication handlers
  const handleOpenMedicationModal = async (catId: string, svcId: string) => {
    setShowMedicationModal({ catId, svcId });
    setLoadingMedications(true);
    try {
      const response = await inventoryAPI.getAll({ limit: 100 });
      // Backend returns paginated response: { data: { data: [...], meta: {...} } }
      const items = response.data.data || [];
      // Filter to only medications, vaccines, and pharmacy items
      const meds = items.filter(item =>
        ['Medications', 'Vaccines', 'Pharmacy', 'Drugs'].some(cat =>
          item.category.toLowerCase().includes(cat.toLowerCase())
        ) && item.status !== 'OUT_OF_STOCK'
      );
      setAvailableMedications(meds);
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

  const handleAddMedication = () => {
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

    const { catId, svcId } = showMedicationModal;

    setSelectedCategories(selectedCategories.map(cat => {
      if (cat.categoryId === catId) {
        return {
          ...cat,
          services: cat.services.map(svc => {
            if (svc.id === svcId) {
              const medications = svc.medications || [];
              return {
                ...svc,
                medications: [
                  ...medications,
                  {
                    id: Math.random().toString(36).substr(2, 9),
                    inventoryItemId: medication.id,
                    inventoryItem: medication,
                    quantity: medicationQuantity,
                    notes: medicationNotes
                  }
                ]
              };
            }
            return svc;
          })
        };
      }
      return cat;
    }));

    handleCloseMedicationModal();
  };

  const handleRemoveMedication = (catId: string, svcId: string, medId: string) => {
    setSelectedCategories(selectedCategories.map(cat => {
      if (cat.categoryId === catId) {
        return {
          ...cat,
          services: cat.services.map(svc => {
            if (svc.id === svcId) {
              return {
                ...svc,
                medications: (svc.medications || []).filter(m => m.id !== medId)
              };
            }
            return svc;
          })
        };
      }
      return cat;
    }));
  };

  // Walk-in client handlers
  const handleCreateWalkInClient = async () => {
    try {
      setIsCreatingWalkIn(true);

      // Validate required fields
      if (!walkInClientData.name || !walkInClientData.phone) {
        alert('Client name and phone number are required');
        return;
      }

      if (!walkInPetData.name || !walkInPetData.breed) {
        alert('Pet name and breed are required');
        return;
      }

      // Create client
      const clientResponse = await clientsAPI.create({
        name: walkInClientData.name,
        phone: walkInClientData.phone,
        email: walkInClientData.email || undefined,
        address: walkInClientData.address || undefined,
      });

      if (!clientResponse.success || !clientResponse.data?.client) {
        throw new Error('Failed to create client');
      }

      const newClient = clientResponse.data.client;

      // Create pet for the client
      const petResponse = await petsAPI.create({
        ownerId: newClient.id,
        name: walkInPetData.name,
        species: walkInPetData.species,
        breed: walkInPetData.breed,
        gender: walkInPetData.gender,
        dob: walkInPetData.dob || undefined,
      });

      if (!petResponse.success || !petResponse.data?.pet) {
        throw new Error('Failed to create pet');
      }

      const newPet = petResponse.data.pet;

      // Auto-select the new client and pet
      setSelectedClientId(newClient.id);
      setSelectedPetId(newPet.id);

      // Reset form and close modal
      setWalkInClientData({ name: '', phone: '', email: '', address: '' });
      setWalkInPetData({ name: '', species: 'Dog', breed: '', gender: 'Male', dob: '' });
      setShowWalkInModal(false);

      // Notify parent to refresh data
      alert('Walk-in client and pet created successfully!');
    } catch (error) {
      console.error('Error creating walk-in client:', error);
      alert('Failed to create walk-in client. Please try again.');
    } finally {
      setIsCreatingWalkIn(false);
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

  const handleFinalize = () => {
    const tasks = selectedCategories.flatMap(cat => {
      const catName = categoriesWithIcons.find(c => c.id === cat.categoryId)?.name || 'General';
      return cat.services.map(svc => ({
        id: Math.floor(Math.random() * 1000000),
        name: svc.weightValue ? `Take Weight (${svc.weightValue} ${svc.weightUnit})` : svc.name,
        category: catName,
        status: svc.isNotApplicable ? TaskStatus.COMPLETED : TaskStatus.PENDING,
        price: svc.isNotApplicable ? 0 : svc.price,
        notes: svc.isNotApplicable ? 'Not applicable' : '',
        assignedStaffId: svc.assignedStaffId || undefined
      }));
    });

    onSave({
      ...formData,
      clientId: selectedClientId,
      petId: selectedPetId,
      isHouseCall,
      tasks,
      totalCost,
      leadStaffId: formData.leadStaffId,
      originReferralId: initialReferralId,
      parentAppointmentId: initialParentApptId
    });
  };

  const isFormValid = useMemo(() => {
    const hasContext = selectedClientId && selectedPetId;
    const hasDateTime = formData.apptDate && formData.apptTime;
    const categoriesValid = selectedCategories.some(c => c.services.length > 0);
    return hasContext && hasDateTime && categoriesValid;
  }, [selectedClientId, selectedPetId, formData, selectedCategories]);

  const WeightInput = ({ value, unit, onChange, onUnitChange }: { value: string, unit: string, onChange: (v: string) => void, onUnitChange: (u: string) => void }) => {
    const [isUnitOpen, setIsUnitOpen] = useState(false);
    return (
      <div className="flex items-center gap-2 group">
        <div className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 flex items-center shadow-inner">
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="bg-transparent border-none outline-none font-mono font-bold text-pine dark:text-zinc-100 w-full text-sm"
          />
          <div className="relative" onMouseEnter={() => setIsUnitOpen(true)} onMouseLeave={() => setIsUnitOpen(false)}>
            <button type="button" className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold text-seafoam">
              {unit} <ChevronDown size={10}/>
            </button>
            {isUnitOpen && (
              <div className="absolute top-full right-0 mt-1 w-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1">
                 {UNIT_OPTIONS.map(opt => (
                   <button key={opt} onClick={() => { onUnitChange(opt); setIsUnitOpen(false); }} className={`w-full text-left px-2 py-1 rounded-lg text-[10px] font-bold ${unit === opt ? 'bg-seafoam text-white' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>
                     {opt}
                   </button>
                 ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-200 max-w-screen-2xl mx-auto py-3 px-1 sm:px-2">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm text-seafoam"><Calendar size={20}/></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 uppercase leading-none">Register Appointment</h1>
            <p className="text-seafoam dark:text-zinc-500 font-bold text-[9px] uppercase tracking-widest mt-1">New Visit</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-pine transition-all active:scale-95"><X size={20}/></button>
      </header>

      {/* Step Indicator */}
      <div className="mb-4">
        <StepIndicator
          steps={[
            { label: 'Client & Pet', description: 'Select patient' },
            { label: 'Services', description: 'Choose treatments' },
            { label: 'Schedule', description: 'Set date & time' },
          ]}
          currentStep={
            !selectedClientId || !selectedPetId ? 0 :
            selectedCategories.length === 0 ? 1 :
            2
          }
        />
      </div>

      {/* Follow-up Indicator */}
      {parentAppointment && (
        <div className="mb-4 bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Link2 className="text-indigo-600 dark:text-indigo-400" size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-black uppercase text-indigo-900 dark:text-indigo-100">Follow-up Appointment</h3>
                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                  Linked Visit
                </span>
              </div>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                This appointment is a follow-up to <span className="font-bold">Visit #{parentAppointment.id}</span> on{' '}
                <span className="font-bold">{new Date(parentAppointment.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}</span>
              </p>
              {parentAppointment.tasks && parentAppointment.tasks.length > 0 && (
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                  Previous visit included: {parentAppointment.tasks.slice(0, 3).map(t => t.category).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                  {parentAppointment.tasks.length > 3 && ' and more'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 space-y-3">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam" size={16}/>
                    <input
                      type="text"
                      disabled={!!initialParentApptId}
                      placeholder="Search (3+ characters: Name, Phone, ID)..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-12 pr-6 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/10 outline-none font-bold text-sm shadow-inner disabled:opacity-50"
                    />
                  </div>
                  {/* TEMPORARILY DISABLED: Walk-in appointment type */}
                  {/* {!initialParentApptId && (
                    <button
                      onClick={() => setShowWalkInModal(true)}
                      className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-seafoam to-cyan text-white rounded-2xl font-bold text-xs uppercase tracking-wide shadow-md hover:shadow-lg transition-all active:scale-95 whitespace-nowrap"
                    >
                      <UserPlus size={16} />
                      Walk-in
                    </button>
                  )} */}
                </div>
                
                {!initialParentApptId && searchQuery.length >= 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredClients.map(c => (
                      <button key={c.id} onClick={() => { setSelectedClientId(c.id); setSelectedPetId(null); }} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selectedClientId === c.id ? 'border-seafoam bg-seafoam/5' : 'border-slate-100 dark:border-zinc-800 hover:border-slate-200'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={c.avatar} className="w-8 h-8 rounded-lg" alt="" />
                          <div className="text-left min-w-0">
                            <p className="text-pine dark:text-zinc-100 font-bold text-xs truncate uppercase">{c.name}</p>
                            <p className="text-slate-400 text-[8px] font-bold uppercase">{c.phone}</p>
                          </div>
                        </div>
                        {selectedClientId === c.id && <Check size={14} className="text-seafoam"/>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Client Info Display */}
              {selectedClientId && (() => {
                const selectedClient = clients.find(c => c.id === selectedClientId);
                if (!selectedClient) return null;

                return (
                  <div className="bg-gradient-to-br from-seafoam/10 to-cyan/10 dark:from-seafoam/5 dark:to-cyan/5 border-2 border-seafoam/30 dark:border-seafoam/20 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 border-2 border-seafoam/30 flex items-center justify-center shadow-sm">
                        <UserIcon size={20} className="text-seafoam" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[8px] font-black text-seafoam uppercase tracking-widest mb-1">Selected Client</p>
                        <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{selectedClient.name}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-zinc-400 font-bold">
                            <Phone size={10} className="text-seafoam" />
                            <span>{selectedClient.phone}</span>
                          </div>
                          {selectedClient.email && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-zinc-400 font-bold">
                              <Mail size={10} className="text-seafoam" />
                              <span className="truncate max-w-[200px]">{selectedClient.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => { setSelectedClientId(null); setSelectedPetId(null); }}
                        className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-red-500 hover:border-red-300 transition-all"
                        title="Clear selection"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {(selectedClientId || initialParentApptId) && (
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Linked Patient</p>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {clientPets.map(p => (
                      <button key={p.id} disabled={!!initialParentApptId && p.id !== initialPetId} onClick={() => setSelectedPetId(p.id)} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${selectedPetId === p.id ? 'border-cyan bg-cyan/5 scale-105' : 'border-slate-100 dark:border-zinc-800'}`}>
                        <div className="text-xl">{p.species === 'Dog' ? '🐶' : '🐱'}</div>
                        <p className="text-pine dark:text-zinc-100 font-bold uppercase text-[8px] truncate w-full text-center">{p.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
           </div>

           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                 <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Visit Workflow</h2>
              </div>
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                 {categoriesWithIcons.map(cat => {
                   const isSelected = selectedCategories.some(sc => sc.categoryId === cat.id);
                   return (
                     <button key={cat.id} onClick={() => isSelected ? handleRemoveCategory(cat.id) : handleAddCategory(cat.id)} className={`shrink-0 flex flex-col items-center gap-1.5 p-4 min-w-[110px] rounded-xl border-2 transition-all ${isSelected ? 'bg-seafoam border-seafoam text-white shadow-sm scale-105' : 'bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 text-slate-400'}`}>
                        <span className="text-2xl">{cat.icon}</span>
                        <span className="text-[7.5px] font-black uppercase whitespace-nowrap tracking-widest">{cat.name}</span>
                     </button>
                   );
                 })}
              </div>
              <div className="space-y-4">
                 {selectedCategories.map(sc => {
                   const catInfo = categoriesWithIcons.find(c => c.id === sc.categoryId);
                   if (!catInfo) return null;

                   // Get services for this category from API
                   const categoryServices = getServicesByCategory(parseInt(sc.categoryId));

                   return (
                     <div key={sc.categoryId} className="bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4">
                        <div className="flex items-center justify-between mb-3 px-1">
                           <div className="flex items-center gap-2">
                              <span className="text-lg">{catInfo.icon}</span>
                              <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">{catInfo.name}</h3>
                           </div>
                        </div>
                        <div className="space-y-2.5">
                           {sc.services.map(svc => {
                             const assignedStaff = availableStaff.find(s => s.id === svc.assignedStaffId);
                             return (
                             <div key={svc.id} className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
                                <div className="p-3 space-y-2.5">
                                  {/* Service Name Row */}
                                  <div className="flex items-center justify-between gap-2">
                                     <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate uppercase flex-1">{svc.name}</p>
                                     <div className="flex items-center gap-2 shrink-0">
                                       {svc.name === 'Take Weight' && (
                                         <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={svc.isNotApplicable} onChange={e => updateWeightTask(sc.categoryId, svc.id, { isNotApplicable: e.target.checked })} className="w-3 h-3 rounded border-slate-300 text-seafoam" />
                                            <span className="text-[8px] font-bold uppercase text-slate-400">N/A</span>
                                         </label>
                                       )}
                                       {svc.name !== 'Take Weight' && <button onClick={() => handleRemoveService(sc.categoryId, svc.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>}
                                     </div>
                                  </div>

                                  {svc.name === 'Take Weight' && !svc.isNotApplicable && (
                                    <WeightInput value={svc.weightValue || '0.00'} unit={svc.weightUnit || 'kg'} onChange={v => updateWeightTask(sc.categoryId, svc.id, { weightValue: v })} onUnitChange={u => updateWeightTask(sc.categoryId, svc.id, { weightUnit: u })} />
                                  )}

                                  {/* Price Row */}
                                  {!svc.isNotApplicable && (
                                    <div className="flex items-center gap-2">
                                      <Tag size={11} className="text-emerald-500 shrink-0" />
                                      <div className="flex items-center gap-1 flex-1">
                                        <span className="text-[9px] font-black text-slate-400 uppercase">KES</span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={svc.price}
                                          onChange={(e) => handlePriceUpdate(sc.categoryId, svc.id, parseFloat(e.target.value) || 0)}
                                          className="w-24 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg px-2 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300 outline-none focus:ring-2 focus:ring-emerald-400/30"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Staff Assignment */}
                                  <div className="space-y-1.5">
                                     <div className="flex items-center gap-2">
                                        <Users size={11} className="text-slate-400 shrink-0" />
                                        <select
                                          value={svc.assignedStaffId || ''}
                                          onChange={(e) => handleStaffAssignment(sc.categoryId, svc.id, parseInt(e.target.value))}
                                          className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-[9px] font-bold text-pine dark:text-zinc-300 outline-none cursor-pointer"
                                        >
                                          <option value="">Assign Staff...</option>
                                          {availableStaff.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                                          ))}
                                        </select>
                                     </div>
                                     {assignedStaff && (
                                       <div className="flex items-center gap-2 px-2 py-1.5 bg-seafoam/8 dark:bg-seafoam/10 rounded-lg border border-seafoam/20">
                                         <div className="w-5 h-5 rounded-full bg-seafoam text-white flex items-center justify-center text-[8px] font-black shrink-0">
                                           {assignedStaff.name.charAt(0).toUpperCase()}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                           <p className="text-[9px] font-black text-pine dark:text-zinc-100 truncate">{assignedStaff.name}</p>
                                         </div>
                                         <span className="text-[7px] font-black px-1.5 py-0.5 bg-seafoam/20 text-seafoam rounded uppercase tracking-wider shrink-0">{assignedStaff.role}</span>
                                       </div>
                                     )}
                                  </div>

                                     {/* Medications List */}
                                     {svc.medications && svc.medications.length > 0 && (
                                       <div className="mt-3 space-y-1.5">
                                         <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Medications:</p>
                                         {svc.medications.map(med => (
                                           <div key={med.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800">
                                             <div className="flex items-center gap-2 flex-1 min-w-0">
                                               <Pill size={12} className="text-purple-500 shrink-0" />
                                               <div className="min-w-0">
                                                 <p className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{med.inventoryItem.name}</p>
                                                 <p className="text-[8px] text-slate-400">
                                                   Qty: {med.quantity} {med.inventoryItem.unit} • Available: {med.inventoryItem.quantity} {med.inventoryItem.unit}
                                                 </p>
                                               </div>
                                             </div>
                                             <button
                                               onClick={() => handleRemoveMedication(sc.categoryId, svc.id, med.id)}
                                               className="p-1 text-slate-300 hover:text-red-500 shrink-0"
                                             >
                                               <X size={12} />
                                             </button>
                                           </div>
                                         ))}
                                       </div>
                                     )}
                                  </div>
                                </div>
                           );
                           })}
                           <div className="pt-1.5">
                              <select className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-2.5 text-[9px] font-black text-pine dark:text-zinc-300 appearance-none outline-none shadow-xs cursor-pointer" onChange={(e) => {
                                const selectedService = categoryServices.find(s => s.id.toString() === e.target.value);
                                if (selectedService) handleAddService(sc.categoryId, selectedService.name, selectedService.defaultPrice || 0);
                                e.target.value = "";
                              }}>
                                 <option value="">+ ADD SERVICE...</option>
                                 {categoryServices.map(s => <option key={s.id} value={s.id}>{s.name} {s.defaultPrice ? `(KES ${s.defaultPrice})` : ''}</option>)}
                              </select>
                           </div>
                        </div>
                     </div>
                   );
                 })}
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-3">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4 sticky top-4">
              <div className="flex justify-between items-center">
                 <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Scheduling</h2>
              </div>
              <div className="space-y-4">
                 {/* Lead Staff */}
                 <div className="space-y-1.5">
                   <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                     <UserIcon size={12} /> Lead Staff
                   </label>
                   {(() => {
                     const leadStaff = availableStaff.find(s => s.id === formData.leadStaffId);
                     return (
                       <div className="space-y-2">
                         <select
                           value={formData.leadStaffId ?? ''}
                           onChange={e => setFormData({ ...formData, leadStaffId: e.target.value ? Number(e.target.value) : null })}
                           className="w-full bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-[11px] font-black text-pine dark:text-zinc-100 appearance-none outline-none focus:border-seafoam transition-colors"
                         >
                           <option value="">— Unassigned —</option>
                           {availableStaff.map(s => (
                             <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                           ))}
                         </select>
                         {leadStaff && (
                           <div className="flex items-center gap-2 bg-seafoam/5 border border-seafoam/20 rounded-xl px-3 py-2">
                             <div className="w-7 h-7 rounded-full bg-seafoam text-white flex items-center justify-center text-[10px] font-black shrink-0">
                               {leadStaff.name.charAt(0)}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">{leadStaff.name}</p>
                               <p className="text-[8px] font-bold text-seafoam uppercase tracking-wider">{leadStaff.role}</p>
                             </div>
                             <span className="text-[7px] font-black px-1.5 py-0.5 bg-seafoam text-white rounded uppercase shrink-0">Lead</span>
                           </div>
                         )}
                       </div>
                     );
                   })()}
                 </div>
                 <DateTimePicker
                   selectedDate={formData.apptDate ? new Date(formData.apptDate + 'T' + formData.apptTime) : new Date()}
                   selectedTime={formData.apptTime}
                   onDateTimeChange={(date) => {
                     const dateStr = date.toISOString().split('T')[0];
                     const timeStr = date.toTimeString().slice(0, 5);
                     setFormData({...formData, apptDate: dateStr, apptTime: timeStr});
                   }}
                   existingAppointments={appointments || []}
                   staffMembers={availableStaff}
                 />
                 <button onClick={() => setIsHouseCall(!isHouseCall)} className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${isHouseCall ? 'bg-amber-500 text-white border-amber-600 shadow-md' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam'}`}>
                   <Home size={12}/> House Call
                 </button>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                 {/* Date + Time summary */}
                 <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
                    <div className="p-2 bg-seafoam/10 rounded-lg"><Calendar size={14} className="text-seafoam" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Scheduled</p>
                      <p className="text-[11px] font-black text-pine dark:text-zinc-100">{formData.apptDate} <span className="text-seafoam">@ {formData.apptTime}</span></p>
                    </div>
                 </div>
                 {/* Staff summary: lead + assigned */}
                 {(() => {
                   const leadStaff = availableStaff.find(s => s.id === formData.leadStaffId);
                   const allAssigned = selectedCategories.flatMap(sc =>
                     sc.services.flatMap(svc => {
                       const s = availableStaff.find(st => st.id === svc.assignedStaffId);
                       return s ? [s] : [];
                     })
                   );
                   const uniqueAssigned = allAssigned.filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
                   if (!leadStaff && uniqueAssigned.length === 0) return null;
                   return (
                     <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2">
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Team</p>
                       {leadStaff && (
                         <div className="flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-seafoam text-white flex items-center justify-center text-[8px] font-black shrink-0">{leadStaff.name.charAt(0)}</div>
                           <p className="text-[10px] font-black text-pine dark:text-zinc-100 flex-1 truncate">{leadStaff.name}</p>
                           <span className="text-[7px] font-black px-1.5 py-0.5 bg-seafoam text-white rounded uppercase shrink-0">Lead</span>
                         </div>
                       )}
                       {uniqueAssigned.filter(s => s.id !== formData.leadStaffId).map(s => (
                         <div key={s.id} className="flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center text-[8px] font-black shrink-0">{s.name.charAt(0)}</div>
                           <p className="text-[10px] font-black text-pine dark:text-zinc-100 flex-1 truncate">{s.name}</p>
                           <span className="text-[7px] font-black px-1.5 py-0.5 bg-seafoam/10 text-seafoam rounded uppercase shrink-0">{s.role}</span>
                         </div>
                       ))}
                     </div>
                   );
                 })()}
                 <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                    <div>
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estimated Bill</p>
                       <h3 className="text-xl font-black font-mono text-emerald-600 tracking-tighter">KES {totalCost.toLocaleString()}</h3>
                    </div>
                 </div>
                 <button onClick={handleFinalize} disabled={!isFormValid} className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-30">
                    Book Appointment
                 </button>
              </div>
           </div>
        </div>
      </div>

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

      {/* Walk-in Client Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-seafoam to-cyan p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <UserPlus className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase">New Walk-in Client</h2>
                    <p className="text-white/80 text-xs font-bold uppercase tracking-widest mt-1">Quick Registration</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWalkInModal(false)}
                  className="p-2 text-white/80 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Client Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight flex items-center gap-2">
                  <UserIcon size={16} className="text-seafoam" />
                  Client Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Client Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={walkInClientData.name}
                      onChange={(e) => setWalkInClientData({ ...walkInClientData, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="+254 712 345 678"
                      value={walkInClientData.phone}
                      onChange={(e) => setWalkInClientData({ ...walkInClientData, phone: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="john@example.com"
                      value={walkInClientData.email}
                      onChange={(e) => setWalkInClientData({ ...walkInClientData, email: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Address (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="123 Main St"
                      value={walkInClientData.address}
                      onChange={(e) => setWalkInClientData({ ...walkInClientData, address: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                </div>
              </div>

              {/* Pet Information */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight flex items-center gap-2">
                  <PawPrint size={16} className="text-cyan" />
                  Pet Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Pet Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Max"
                      value={walkInPetData.name}
                      onChange={(e) => setWalkInPetData({ ...walkInPetData, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-cyan/20"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Species <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={walkInPetData.species}
                      onChange={(e) => setWalkInPetData({ ...walkInPetData, species: e.target.value as 'Dog' | 'Cat' })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-cyan/20 cursor-pointer"
                    >
                      <option value="Dog">Dog 🐶</option>
                      <option value="Cat">Cat 🐱</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Breed <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Golden Retriever"
                      value={walkInPetData.breed}
                      onChange={(e) => setWalkInPetData({ ...walkInPetData, breed: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-cyan/20"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={walkInPetData.gender}
                      onChange={(e) => setWalkInPetData({ ...walkInPetData, gender: e.target.value as 'Male' | 'Female' })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-cyan/20 cursor-pointer"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Date of Birth (Optional)
                    </label>
                    <input
                      type="date"
                      value={walkInPetData.dob}
                      onChange={(e) => setWalkInPetData({ ...walkInPetData, dob: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-cyan/20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowWalkInModal(false)}
                disabled={isCreatingWalkIn}
                className="px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWalkInClient}
                disabled={isCreatingWalkIn || !walkInClientData.name || !walkInClientData.phone || !walkInPetData.name || !walkInPetData.breed}
                className="px-6 py-3 bg-gradient-to-r from-seafoam to-cyan text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreatingWalkIn ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Create & Continue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewAppointmentView;
