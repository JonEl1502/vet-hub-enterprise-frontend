
import React, { useState, useMemo, useEffect } from 'react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { Search, PawPrint, Calendar, Clock, ArrowRight, Check, X, Users, Ghost, Home, Plus, Trash2, Tag, Scale, Heart, User as UserIcon, Link2, Info, ChevronRight, ChevronDown, Pill, AlertCircle, UserPlus, Phone, Mail } from 'lucide-react';
import { Client, Pet, TaskStatus, Visit, EncounterType, VisitType, ENCOUNTER_TYPES } from '../../../types';
import SearchableDropdown from '../../shared/common/SearchableDropdown';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import { useStaff } from '../../../contexts/StaffContext';
import { inventoryAPI, InventoryItem, clientsAPI, petsAPI, dialog, toast } from '../../../services';
import PhoneInput from '../../shared/common/PhoneInput';
import StepIndicator from '../../shared/common/StepIndicator';
import DateTimePicker from '../../shared/common/DateTimePicker';

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
  appointments?: Visit[];
  onSave: (data: any) => void;
  onCancel: () => void;
  initialClientId?: number;
  initialPetId?: number;
  initialReferralId?: number;
  initialParentApptId?: number;
  initialCategoryId?: string;
  initialEncounterType?: EncounterType;
  // Categories/services staged on an Appointment booking, pre-selected on "Start visit".
  initialStagedItems?: { categoryId?: string; serviceId?: string; name: string; price?: number }[];
}

const UNIT_OPTIONS = ['kg', 'lb', 'g', 'tons'];

const NewVisitView: React.FC<Props> = ({ clients, pets, appointments = [], onSave, onCancel, initialClientId, initialPetId, initialReferralId, initialParentApptId, initialCategoryId, initialEncounterType, initialStagedItems }) => {
  const { categories: apiCategories, getServicesByCategory, species: apiSpecies, getBreedsBySpecies } = useReferenceData();
  const { staff } = useStaff();
  const [activeTab, setActiveTab] = useState<'internal' | 'walking'>(initialParentApptId ? 'internal' : 'internal');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(initialClientId || null);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(initialPetId || null);
  // The visit this one follows up on. Seeded from nav, also pickable in-form.
  const [parentApptId, setParentApptId] = useState<number | null>(initialParentApptId || null);
  const [isHouseCall, setIsHouseCall] = useState(false);

  // Get parent appointment information if this is a follow-up
  const parentAppointment = useMemo(() => {
    if (!parentApptId || !appointments) return null;
    return appointments.find(a => a.id === parentApptId);
  }, [parentApptId, appointments]);

  // Previous visits for the selected patient — used to attach a follow-up.
  const patientPriorVisits = useMemo(() => {
    if (!selectedPetId || !appointments) return [];
    return appointments
      .filter(a => a.petId === selectedPetId && a.status !== 'CANCELLED')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [selectedPetId, appointments]);

  // Pre-fill categories/services from an appointment booking's staged items.
  const buildStagedCategories = (): SelectedCategory[] => {
    if (!initialStagedItems?.length) return [];
    const byCat: Record<string, SelectedService[]> = {};
    for (const it of initialStagedItems) {
      const cid = String(it.categoryId ?? '');
      if (!cid) continue;
      (byCat[cid] ||= []).push({ id: String(it.serviceId ?? it.name), name: it.name, price: Number(it.price) || 0 });
    }
    return Object.entries(byCat).map(([categoryId, services]) => ({ categoryId, services }));
  };
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategory[]>(buildStagedCategories());
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
    firstName: '',
    secondName: '',
    surname: '',
    phone: '',
    dialCode: '+254',
    countryCode: 'KE',
    email: '',
    address: ''
  });
  const [walkInPetData, setWalkInPetData] = useState({
    name: '',
    species: 'Dog',
    breed: '',
    gender: 'Male' as 'Male' | 'Female',
    dob: ''
  });

  // Real species/breed dropdowns (same reference data as Register Patient).
  const walkInSpeciesOptions = useMemo(() => (apiSpecies.length ? apiSpecies.map(s => s.name) : ['Dog', 'Cat']), [apiSpecies]);
  const walkInBreedOptions = useMemo(() => {
    const sp = apiSpecies.find(s => s.name === walkInPetData.species);
    if (!sp) return ['Mixed Breed'];
    const names = getBreedsBySpecies(sp.id).map(b => b.name);
    return names.length ? names : ['Mixed Breed'];
  }, [apiSpecies, walkInPetData.species, getBreedsBySpecies]);
  const [isCreatingWalkIn, setIsCreatingWalkIn] = useState(false);

  // API fallback search state
  const [apiClientResults, setApiClientResults] = useState<Client[]>([]);
  const [apiPetResults, setApiPetResults] = useState<Pet[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [isLoadingPets, setIsLoadingPets] = useState(false);

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

  // Encounter typing (migration 041): the service line + (for vet visits) the
  // clinical sub-type. Declared here because the workflow filtering below uses it.
  const [encounterType, setEncounterType] = useState<EncounterType>(initialEncounterType ?? 'VET_VISIT');
  const [visitType, setVisitType] = useState<VisitType | null>(initialParentApptId ? 'FOLLOW_UP' : 'CONSULTATION');
  // Onboard this appointment to the in-patient program (creates a linked
  // hospitalization so the bill, cert and receipt track together).
  const [onboardInpatient, setOnboardInpatient] = useState(false);
  // Walk-in = unscheduled arrival, an arrival-mode flag on the visit typing
  // (replaces the old "Walk-in client" concept). UI-only for now — the DB
  // column (arrival mode) ships with the wizard's API phase.
  const [isWalkIn, setIsWalkIn] = useState(false);

  // Which service categories belong to each encounter type, so the Visit
  // Workflow only offers relevant work and stays in step with the chosen type.
  // VET_VISIT = all clinical (everything except grooming/boarding/retail).
  const NON_CLINICAL_CATS = ['Grooming', 'Boarding'];
  const ENCOUNTER_CATS: Record<EncounterType, string[]> = {
    VET_VISIT: [],
    VACCINATION: ['Vaccination'],
    GROOMING: ['Grooming'],
    BOARDING: ['Boarding'],
    RETAIL: ['Pharmacy', 'Retail'],
  };
  const catsForEncounter = (et: EncounterType) => {
    const allowed = ENCOUNTER_CATS[et] || [];
    const filtered = allowed.length === 0
      ? categoriesWithIcons.filter(c => !NON_CLINICAL_CATS.includes(c.name) && c.name !== 'Retail')
      : categoriesWithIcons.filter(c => allowed.map(a => a.toLowerCase()).includes(c.name.toLowerCase()));
    // Never leave the workflow empty (catalog may lack the exact category).
    return filtered.length > 0 ? filtered : categoriesWithIcons;
  };
  // The categories shown in the Visit Workflow for the current encounter type.
  const workflowCategories = useMemo(() => catsForEncounter(encounterType), [categoriesWithIcons, encounterType]);

  // Switching encounter type realigns the workflow: drop now-irrelevant
  // categories and auto-select the primary one for the new type.
  const handleEncounterType = (et: EncounterType) => {
    setEncounterType(et);
    const cats = catsForEncounter(et);
    const allowedIds = new Set(cats.map(c => c.id));
    setSelectedCategories(prev => {
      const kept = prev.filter(c => allowedIds.has(c.categoryId));
      if (kept.length > 0) return kept;
      // Auto-select only for single-purpose encounters; a general vet visit
      // starts empty so the user picks (no forced Consultation).
      return et !== 'VET_VISIT' && cats[0] ? [{ categoryId: cats[0].id, services: [] }] : [];
    });
  };

  // Auto-populate client when pet is selected (checks local + API pets)
  useEffect(() => {
    if (selectedPetId && !initialClientId) {
      const selectedPet = [...pets, ...apiPetResults].find(p => p.id === selectedPetId);
      if (selectedPet && selectedPet.ownerId && selectedPet.ownerId !== selectedClientId) {
        setSelectedClientId(selectedPet.ownerId);
      }
    }
  }, [selectedPetId, pets, apiPetResults, initialClientId]);

  useEffect(() => {
    if (selectedCategories.length === 0 && categoriesWithIcons.length > 0) {
      const defaultCategories: SelectedCategory[] = [];

      // Pre-select by explicit category if requested (match by id or name)…
      if (initialCategoryId) {
        const targetCat = categoriesWithIcons.find(
          c => c.id === initialCategoryId || c.name.toLowerCase() === initialCategoryId.toLowerCase()
        );
        if (targetCat) defaultCategories.push({ categoryId: targetCat.id, services: [] });
      } else if (encounterType !== 'VET_VISIT') {
        // …else auto-select the primary category for single-purpose encounters
        // (grooming/boarding/vaccination/retail). A general vet visit starts
        // with NOTHING pre-selected — the user picks (no forced Consultation).
        const cats = catsForEncounter(encounterType);
        if (cats[0]) defaultCategories.push({ categoryId: cats[0].id, services: [] });
      }

      if (defaultCategories.length > 0) setSelectedCategories(defaultCategories);
    }
  }, [initialCategoryId, categoriesWithIcons, encounterType]);

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
    if (searchQuery.length < 2) return [];
    return clients.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.id.toString().includes(searchQuery)
    ).slice(0, 10);
  }, [clients, searchQuery]);

  // Direct patient search — match loaded pets by name (pick → sets pet + owner).
  const filteredPets = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return pets.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [pets, searchQuery]);

  // When local search returns nothing, call the API (debounced 400ms)
  useEffect(() => {
    if (searchQuery.length < 2 || filteredClients.length > 0) {
      setApiClientResults([]);
      setIsSearchingApi(false);
      return;
    }
    setIsSearchingApi(true);
    const timer = setTimeout(async () => {
      try {
        const res = await clientsAPI.getAll({ page: 1, limit: 10, search: searchQuery }, { cache: false });
        if (res.success && res.data?.clients) {
          setApiClientResults(res.data.clients.map((c: any) => ({
            ...c,
            id: parseInt(c.id),
            avatar: String(c.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`),
          } as unknown as Client)));
        } else {
          setApiClientResults([]);
        }
      } catch {
        setApiClientResults([]);
      } finally {
        setIsSearchingApi(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, filteredClients.length]);

  // When a client is selected but their pets aren't in the local cache, fetch from API
  useEffect(() => {
    if (!selectedClientId) { setApiPetResults([]); setIsLoadingPets(false); return; }
    if (pets.some(p => p.ownerId === selectedClientId)) { setApiPetResults([]); setIsLoadingPets(false); return; }
    let cancelled = false;
    setIsLoadingPets(true);
    clientsAPI.getById(selectedClientId).then((res: any) => {
      if (cancelled) return;
      if (res.success && res.data?.client?.pets) {
        setApiPetResults(res.data.client.pets.map((p: any) => ({
          id: parseInt(p.id),
          clinicId: 0,
          ownerId: selectedClientId,
          name: String(p.name || ''),
          species: String(p.species || ''),
          breed: String(p.breed || ''),
          gender: (String(p.gender || 'Male')) as 'Male' | 'Female',
          age: 0,
          dob: p.dob || '',
          weight: '',
          avatar: String(p.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.name}`),
          isActive: p.isActive !== false,
          isAlive: p.isAlive !== false,
          dateOfDeath: p.dateOfDeath ?? null,
          medicalHistory: [],
          vaccinations: [],
          rfidChipNumber: '',
        } as Pet)));
      }
      setIsLoadingPets(false);
    }).catch(() => { if (!cancelled) setIsLoadingPets(false); });
    return () => { cancelled = true; };
  }, [selectedClientId, pets]);

  const clientPets = useMemo(() => {
    const local = pets.filter(p => p.ownerId === selectedClientId);
    return local.length > 0 ? local : apiPetResults;
  }, [pets, selectedClientId, apiPetResults]);

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
      const confirmUse = await dialog.confirm({
        title: 'Low stock warning',
        message: `Only ${medication.quantity} ${medication.unit} of this medication remain.\nYou are requesting ${medicationQuantity} ${medication.unit}. Continue?`,
        confirmLabel: 'Continue',
        variant: 'warning',
      });
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
      if (!walkInClientData.firstName.trim() || !walkInClientData.surname.trim() || !walkInClientData.phone) {
        toast.warning('First name, surname and phone are required');
        return;
      }

      if (!walkInPetData.name || !walkInPetData.breed) {
        toast.warning('Pet name and breed are required');
        return;
      }

      // Create client — backend requires firstName/surname (not a single name).
      const clientResponse = await clientsAPI.create({
        firstName: walkInClientData.firstName.trim(),
        secondName: walkInClientData.secondName.trim() || undefined,
        surname: walkInClientData.surname.trim(),
        phone: walkInClientData.phone ? `${walkInClientData.dialCode} ${walkInClientData.phone}`.trim() : walkInClientData.phone,
        email: walkInClientData.email || undefined,
        address: walkInClientData.address || undefined,
      } as any);

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

      // Make the new client+pet visible to the picker (number ids, matching the
      // local lists) so the selection displays without waiting for a full refresh.
      const clientId = Number(newClient.id);
      const petId = Number(newPet.id);
      setApiClientResults(prev => [{ ...(newClient as any), id: clientId, ownerId: clientId }, ...prev.filter(c => c.id !== clientId)]);
      setApiPetResults(prev => [{ ...(newPet as any), id: petId, ownerId: clientId }, ...prev.filter((p: any) => p.id !== petId)]);

      // Auto-select the new client and pet
      setSelectedClientId(clientId);
      setSelectedPetId(petId);

      // Reset form and close modal
      setWalkInClientData({ firstName: '', secondName: '', surname: '', phone: '', dialCode: '+254', countryCode: 'KE', email: '', address: '' });
      setWalkInPetData({ name: '', species: 'Dog', breed: '', gender: 'Male', dob: '' });
      setShowWalkInModal(false);

      // Notify parent to refresh data
      toast.success('Client and pet created successfully!');
    } catch (error) {
      console.error('Error creating walk-in client:', error);
      toast.error('Failed to create walk-in client. Please try again.');
    } finally {
      setIsCreatingWalkIn(false);
    }
  };

  // ── Case 1: inline add-patient when a selected client has no pets yet ──────
  // Reuses the walk-in pet fields/species+breed dropdowns, but creates the pet
  // directly under the already-selected client and auto-selects it — no leaving
  // the page, no separate Register Patient round-trip.
  const [showInlineAddPet, setShowInlineAddPet] = useState(false);
  const [isAddingPet, setIsAddingPet] = useState(false);

  const handleAddPetForClient = async () => {
    if (!selectedClientId) return;
    if (!walkInPetData.name.trim() || !walkInPetData.breed.trim()) {
      toast.warning('Patient name and breed are required');
      return;
    }
    setIsAddingPet(true);
    try {
      const res = await petsAPI.create({
        ownerId: selectedClientId,
        name: walkInPetData.name.trim(),
        species: walkInPetData.species,
        breed: walkInPetData.breed,
        gender: walkInPetData.gender,
        dob: walkInPetData.dob || undefined,
      });
      if (!res.success || !res.data?.pet) throw new Error('Failed to add patient');
      const newPet = res.data.pet;
      const petId = Number(newPet.id);
      // Surface immediately in the picker without waiting for a parent refresh.
      setApiPetResults(prev => [{ ...(newPet as any), id: petId, ownerId: selectedClientId }, ...prev.filter((p: any) => p.id !== petId)]);
      setSelectedPetId(petId);
      setWalkInPetData({ name: '', species: 'Dog', breed: '', gender: 'Male', dob: '' });
      setShowInlineAddPet(false);
      toast.success('Patient added');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add patient');
    } finally {
      setIsAddingPet(false);
    }
  };

  // ── Case 2: reassign when the picked patient's owner is missing/deactivated ─
  const [reassignQuery, setReassignQuery] = useState('');
  const [reassignResults, setReassignResults] = useState<{ id: number; name: string; phone?: string }[]>([]);
  const [reassigning, setReassigning] = useState(false);

  // The patient currently selected, across local + API search results.
  const selectedPet = useMemo(() => {
    if (!selectedPetId) return null;
    return pets.find(p => p.id === selectedPetId) ?? apiPetResults.find(p => p.id === selectedPetId) ?? null;
  }, [selectedPetId, pets, apiPetResults]);

  // Owner record for the selected client (when resolvable).
  const selectedOwner = useMemo(() => {
    if (!selectedClientId) return null;
    return clients.find(c => c.id === selectedClientId) ?? apiClientResults.find(c => c.id === selectedClientId) ?? null;
  }, [selectedClientId, clients, apiClientResults]);

  // A patient is "orphaned" here when it's picked but its owner can't be
  // resolved (deleted) or is deactivated — block the visit, offer reassign.
  const ownerOrphaned = !!selectedPet && (!selectedOwner || (selectedOwner as any).isActive === false);

  useEffect(() => {
    let cancelled = false;
    if (!ownerOrphaned || reassignQuery.trim().length < 2) { setReassignResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await clientsAPI.getAll({ page: 1, limit: 8, search: reassignQuery.trim() } as any, { cache: false });
        if (!cancelled) {
          setReassignResults(((res.data?.clients as any[]) || []).map(c => ({ id: Number(c.id), name: c.name, phone: c.phone })));
        }
      } catch { if (!cancelled) setReassignResults([]); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [reassignQuery, ownerOrphaned]);

  const reassignOwnerForSelectedPet = async (clientId: number) => {
    if (!selectedPet) return;
    setReassigning(true);
    try {
      const res = await petsAPI.reassign(selectedPet.id, clientId);
      if (res.success) {
        const picked = reassignResults.find(c => c.id === clientId);
        if (picked) setApiClientResults(prev => [{ ...(picked as any), id: clientId, ownerId: clientId, isActive: true }, ...prev.filter(c => c.id !== clientId)]);
        setApiPetResults(prev => prev.map((p: any) => p.id === selectedPet.id ? { ...p, ownerId: clientId } : p));
        setSelectedClientId(clientId);
        setReassignQuery(''); setReassignResults([]);
        toast.success('Owner reassigned');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reassign');
    } finally {
      setReassigning(false);
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

  // Vet visits no longer stage a workflow at registration — the clinical
  // wizard on the visit drives that. The visit is seeded with just its
  // entry-point fee (consultation / emergency) from the catalog so the
  // backend's ≥1-task rule and the running bill both hold.
  const vetVisitSeed = () => {
    const want = visitType === 'EMERGENCY' ? 'emergency' : 'consultation';
    const cat = categoriesWithIcons.find(c => c.name.toLowerCase().includes(want))
      || categoriesWithIcons.find(c => c.name.toLowerCase().includes('consultation'));
    const services = cat ? getServicesByCategory(parseInt(cat.id)) : [];
    const svc = services.find(s => s.name.toLowerCase().includes(want)) || services[0];
    return {
      name: svc?.name || (visitType === 'EMERGENCY' ? 'Emergency Fee' : 'Consultation'),
      category: cat?.name || 'Consultation',
      price: svc?.defaultPrice || 0,
    };
  };

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

    // Seed the entry-point fee when a vet visit is registered service-less.
    let seedCost = 0;
    if (encounterType === 'VET_VISIT' && tasks.length === 0) {
      const seed = vetVisitSeed();
      seedCost = seed.price;
      tasks.push({
        id: Math.floor(Math.random() * 1000000),
        name: seed.name,
        category: seed.category,
        status: TaskStatus.PENDING,
        price: seed.price,
        notes: '',
        assignedStaffId: formData.leadStaffId || undefined,
      });
    }

    onSave({
      ...formData,
      clientId: selectedClientId,
      petId: selectedPetId,
      isHouseCall,
      // Arrival mode — ignored by the backend until its column lands.
      isWalkIn,
      tasks,
      totalCost: totalCost + seedCost,
      leadStaffId: formData.leadStaffId,
      originReferralId: initialReferralId,
      parentAppointmentId: parentApptId,
      encounterType,
      // visitType only applies to vet visits; null for grooming/boarding/etc.
      visitType: encounterType === 'VET_VISIT' ? visitType : null,
      // Onboard to in-patient (vet visits only) — links a hospitalization.
      onboardInpatient: encounterType === 'VET_VISIT' && onboardInpatient,
    });
  };

  const isFormValid = useMemo(() => {
    const hasContext = selectedClientId && selectedPetId;
    const hasDateTime = formData.apptDate && formData.apptTime;
    // Vet visits register without staged services (the clinical wizard owns
    // the workflow; the entry-point fee is auto-seeded). Service-driven
    // encounters (grooming/boarding/vaccination) still pick services here.
    const categoriesValid = encounterType === 'VET_VISIT' || selectedCategories.some(c => c.services.length > 0);
    return hasContext && hasDateTime && categoriesValid;
  }, [selectedClientId, selectedPetId, formData, selectedCategories, encounterType]);

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
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 uppercase leading-none">Register Visit</h1>
            <p className="text-seafoam dark:text-zinc-500 font-bold text-[9px] uppercase tracking-widest mt-1">New Visit</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-pine transition-all active:scale-95"><X size={20}/></button>
      </header>

      {/* Step Indicator */}
      <div className="mb-4">
        <StepIndicator
          steps={encounterType === 'VET_VISIT' ? [
            // Vet visits: no service staging at registration — the clinical
            // wizard owns the workflow once the visit opens.
            { id: 'client-pet', label: 'Client & Pet' },
            { id: 'schedule', label: 'Schedule' },
          ] : [
            { id: 'client-pet', label: 'Client & Pet' },
            { id: 'services', label: 'Services' },
            { id: 'schedule', label: 'Schedule' },
          ]}
          currentStep={
            !selectedClientId || !selectedPetId ? 0 :
            encounterType === 'VET_VISIT' ? 1 :
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
                <h3 className="text-sm font-black uppercase text-indigo-900 dark:text-indigo-100">Follow-up Visit</h3>
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

      {/* Encounter type — frames the whole appointment; decides the workflow */}
      <div data-tour="appointment-encounter-type" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm mb-3">
        <p className="text-[9px] font-black text-seafoam uppercase tracking-widest mb-2">Encounter type</p>
        <div className="flex flex-wrap gap-2">
          {ENCOUNTER_TYPES.map(et => (
            <button
              key={et.value}
              type="button"
              onClick={() => handleEncounterType(et.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all border ${
                encounterType === et.value
                  ? 'bg-pine text-white border-pine dark:bg-zinc-100 dark:text-pine'
                  : 'bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
              }`}
            >
              <span>{et.icon}</span> {et.label}
            </button>
          ))}
        </div>
        {encounterType === 'VET_VISIT' ? (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mr-1">Visit type</span>
            {(['ROUTINE', 'CONSULTATION', 'EMERGENCY', 'FOLLOW_UP'] as VisitType[]).map(vt => (
              <button
                key={vt}
                type="button"
                onClick={() => setVisitType(vt)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  visitType === vt ? 'bg-seafoam text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-seafoam'
                }`}
              >
                {vt.replace('_', ' ')}
              </button>
            ))}
            {/* Walk-in is an arrival mode ON the visit typing (no longer a
                client concept). UI-only until the DB column lands. */}
            <button
              type="button"
              onClick={() => setIsWalkIn(w => !w)}
              title="Unscheduled arrival — combines with any visit type"
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${
                isWalkIn ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:border-amber-400'
              }`}
            >
              🚶 Walk-in
            </button>
            <label className="flex items-center gap-1.5 ml-auto cursor-pointer px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/30">
              <input type="checkbox" checked={onboardInpatient} onChange={e => setOnboardInpatient(e.target.checked)} className="accent-red-500" />
              <span className="text-[10px] font-black uppercase tracking-wide text-red-600 dark:text-red-400">🏥 Onboard to In-patient</span>
            </label>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2 font-medium">
            {encounterType === 'BOARDING' ? 'Boarding stay — no clinical record. Boarding details (dates, daily log) are set on the stay.'
              : encounterType === 'GROOMING' ? 'Grooming visit — no clinical record; add grooming services below.'
              : encounterType === 'VACCINATION' ? 'Vaccination visit.'
              : 'Retail sale — items only.'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 space-y-3">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4">
              <div className="space-y-4">
                <div data-tour="appointment-client" className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam" size={16}/>
                    <input
                      type="text"
                      disabled={!!initialParentApptId}
                      placeholder="Search (2+ characters: Name, Phone, ID)..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-12 pr-10 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/10 outline-none font-bold text-sm shadow-inner disabled:opacity-50"
                    />
                    {searchQuery && !initialParentApptId && (
                      <button type="button" onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {/* New Client: quick-create a client + patient inline.
                      (Was "Walk-in" — walk-in is now visit typing, not a
                      client concept; DB naming follows in the API phase.) */}
                  {!initialParentApptId && (
                    <button
                      type="button"
                      onClick={() => setShowWalkInModal(true)}
                      className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-seafoam to-cyan-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wide shadow-md hover:shadow-lg transition-all active:scale-95 whitespace-nowrap"
                    >
                      <UserPlus size={16} />
                      New Client
                    </button>
                  )}
                </div>
                
                {!initialParentApptId && searchQuery.length >= 2 && (() => {
                  const displayClients = filteredClients.length > 0 ? filteredClients : apiClientResults;
                  const fromApi = filteredClients.length === 0;
                  return (
                    <div className="space-y-2">
                      {fromApi && !isSearchingApi && displayClients.length === 0 && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">No clients found</p>
                      )}
                      {fromApi && !isSearchingApi && displayClients.length > 0 && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">Results from server</p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {fromApi && isSearchingApi && [0, 1, 2, 3].map(i => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-100 dark:border-zinc-800">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center">
                              <svg className="w-4 h-4 animate-spin text-seafoam" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                              </svg>
                            </div>
                            <div className="space-y-1.5 flex-1">
                              <div className="h-2 rounded bg-slate-100 dark:bg-zinc-800 w-3/4 animate-pulse"/>
                              <div className="h-1.5 rounded bg-slate-100 dark:bg-zinc-800 w-1/2 animate-pulse"/>
                            </div>
                          </div>
                        ))}
                        {displayClients.map(c => (
                          <button key={c.id} onClick={() => { setSelectedClientId(c.id); setSelectedPetId(null); }} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selectedClientId === c.id ? 'border-seafoam bg-seafoam/5' : 'border-slate-100 dark:border-zinc-800 hover:border-slate-200'}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <img src={(c as any).avatar} className="w-8 h-8 rounded-lg" alt="" />
                              <div className="text-left min-w-0">
                                <p className="text-pine dark:text-zinc-100 font-bold text-xs truncate uppercase">{c.name}</p>
                                <p className="text-slate-400 text-[8px] font-bold uppercase">{c.phone}</p>
                              </div>
                            </div>
                            {selectedClientId === c.id && <Check size={14} className="text-seafoam"/>}
                          </button>
                        ))}
                      </div>
                      {/* Direct patient matches — pick a patient and its owner is set too. */}
                      {filteredPets.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">Patients</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                            {filteredPets.map(p => (
                              <button key={`pet-${p.id}`} onClick={() => { setSelectedPetId(p.id); if (p.ownerId) setSelectedClientId(p.ownerId); setSearchQuery(''); }} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selectedPetId === p.id ? 'border-cyan bg-cyan/5' : 'border-slate-100 dark:border-zinc-800 hover:border-slate-200'}`}>
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-lg">{p.species === 'Cat' ? '🐱' : '🐶'}</span>
                                  <div className="text-left min-w-0">
                                    <p className="text-pine dark:text-zinc-100 font-bold text-xs truncate uppercase">{p.name}</p>
                                    <p className="text-slate-400 text-[8px] font-bold uppercase">{p.species}{p.breed ? ` · ${p.breed}` : ''}</p>
                                  </div>
                                </div>
                                {selectedPetId === p.id && <Check size={14} className="text-cyan"/>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Selected Client Info Display */}
              {selectedClientId && (() => {
                const selectedClient = clients.find(c => c.id === selectedClientId) ?? apiClientResults.find(c => c.id === selectedClientId);
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
                        onClick={() => { setSelectedClientId(null); setSelectedPetId(null); setApiClientResults([]); setApiPetResults([]); }}
                        className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-red-500 hover:border-red-300 transition-all"
                        title="Clear selection"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Case 2: picked patient whose owner is missing/deactivated — reassign inline. */}
              {ownerOrphaned && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-300 dark:border-amber-700/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <AlertCircle size={18} className="text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide">Owner unavailable</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                        <span className="font-bold uppercase">{selectedPet?.name}</span>'s owner is missing or deactivated. Reassign this patient to an active client before starting a visit.
                      </p>
                    </div>
                  </div>
                  <div>
                    <input
                      value={reassignQuery}
                      onChange={e => setReassignQuery(e.target.value)}
                      placeholder="Search a client to reassign…"
                      className="field-input"
                    />
                    {reassignResults.length > 0 && (
                      <div className="mt-2 rounded-xl border border-amber-200 dark:border-amber-700/40 bg-white dark:bg-zinc-900 overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
                        {reassignResults.map(c => (
                          <button key={c.id} disabled={reassigning} onClick={() => reassignOwnerForSelectedPet(c.id)} className="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-900/10 disabled:opacity-50 flex items-center justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block text-xs font-bold text-pine dark:text-zinc-100 uppercase truncate">{c.name}</span>
                              {c.phone && <span className="block text-[9px] text-slate-400 font-bold">{c.phone}</span>}
                            </span>
                            <ArrowRight size={14} className="text-amber-500 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!ownerOrphaned && (selectedClientId || initialParentApptId) && (
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Linked Patient</p>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {isLoadingPets && [0, 1, 2].map(i => (
                      <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-slate-100 dark:border-zinc-800">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                          <svg className="w-4 h-4 animate-spin text-seafoam" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                          </svg>
                        </div>
                        <div className="h-1.5 rounded bg-slate-100 dark:bg-zinc-800 w-10 animate-pulse"/>
                        <div className="h-1.5 rounded bg-slate-100 dark:bg-zinc-800 w-8 animate-pulse"/>
                      </div>
                    ))}
                    {!isLoadingPets && clientPets.map(p => {
                      const petDeceased = p.isAlive === false;
                      const disabled = (!!initialParentApptId && p.id !== initialPetId) || petDeceased;
                      return (
                      <button
                        key={p.id}
                        disabled={disabled}
                        onClick={() => setSelectedPetId(p.id)}
                        title={petDeceased ? 'Patient deceased — no new appointments' : undefined}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                          selectedPetId === p.id ? 'border-cyan bg-cyan/5 scale-105' : 'border-slate-100 dark:border-zinc-800'
                        } ${petDeceased ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                      >
                        <div className="text-xl">{p.species === 'Dog' ? '🐶' : p.species === 'Cat' ? '🐱' : p.species === 'Bird' ? '🐦' : p.species === 'Rabbit' ? '🐰' : p.species === 'Horse' ? '🐴' : '🐾'}</div>
                        <p className="text-pine dark:text-zinc-100 font-bold uppercase text-[8px] truncate w-full text-center">{p.name}</p>
                        <p className={`uppercase text-[7px] font-bold truncate w-full text-center ${petDeceased ? 'text-red-500' : 'text-slate-400'}`}>
                          {petDeceased ? 'Deceased' : p.species}
                        </p>
                      </button>
                      );
                    })}
                    {/* Case 1: add a patient under the selected client, inline. */}
                    {!isLoadingPets && selectedClientId && selectedOwner && !initialParentApptId && (
                      <button
                        type="button"
                        onClick={() => setShowInlineAddPet(v => !v)}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border-2 border-dashed transition-all ${showInlineAddPet ? 'border-cyan bg-cyan/5' : 'border-slate-200 dark:border-zinc-700 hover:border-cyan/60 hover:bg-cyan/5'}`}
                      >
                        <UserPlus size={18} className="text-cyan" />
                        <p className="text-cyan font-bold uppercase text-[8px] text-center">Add patient</p>
                      </button>
                    )}
                  </div>

                  {!isLoadingPets && clientPets.length === 0 && selectedOwner && !showInlineAddPet && (
                    <p className="text-[10px] text-slate-400 px-1">This client has no patients yet — add one to start a visit.</p>
                  )}

                  {/* Inline add-patient form (reuses the walk-in pet fields). */}
                  {showInlineAddPet && selectedClientId && selectedOwner && (
                    <div className="rounded-2xl border-2 border-cyan/30 bg-cyan/5 dark:bg-cyan/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black text-cyan uppercase tracking-widest">New patient for {selectedOwner.name}</p>
                        <button type="button" onClick={() => setShowInlineAddPet(false)} className="p-1 rounded-lg text-slate-400 hover:text-red-500"><X size={14} /></button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Name <span className="text-red-500">*</span></label>
                          <input type="text" placeholder="Max" value={walkInPetData.name} onChange={e => setWalkInPetData({ ...walkInPetData, name: e.target.value })} className="field-input" />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Species <span className="text-red-500">*</span></label>
                          <select value={walkInPetData.species} onChange={e => setWalkInPetData({ ...walkInPetData, species: e.target.value, breed: '' })} className="field-select">
                            {walkInSpeciesOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Breed <span className="text-red-500">*</span></label>
                          <select value={walkInPetData.breed} onChange={e => setWalkInPetData({ ...walkInPetData, breed: e.target.value })} className="field-select">
                            <option value="">Select breed…</option>
                            {walkInBreedOptions.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Gender <span className="text-red-500">*</span></label>
                          <select value={walkInPetData.gender} onChange={e => setWalkInPetData({ ...walkInPetData, gender: e.target.value as 'Male' | 'Female' })} className="field-select">
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Date of Birth (Optional)</label>
                          <input type="date" value={walkInPetData.dob} onChange={e => setWalkInPetData({ ...walkInPetData, dob: e.target.value })} className="field-input" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowInlineAddPet(false)} disabled={isAddingPet} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-xl font-bold text-[10px] uppercase tracking-widest disabled:opacity-50">Cancel</button>
                        <button type="button" onClick={handleAddPetForClient} disabled={isAddingPet || !walkInPetData.name.trim() || !walkInPetData.breed} className="px-4 py-2 bg-cyan text-white rounded-xl font-bold text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                          {isAddingPet ? 'Adding…' : <><Plus size={12} /> Add patient</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Follow-up: attach this visit to one of the patient's prior visits. */}
              {visitType === 'FOLLOW_UP' && selectedPetId && (
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Follow-up to which visit?</p>
                  {patientPriorVisits.length === 0 ? (
                    <p className="text-[10px] text-slate-400 px-1">No previous visits for this patient.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                      {patientPriorVisits.map(v => (
                        <button key={v.id} type="button" onClick={() => setParentApptId(parentApptId === v.id ? null : v.id)} className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border-2 transition-all text-left ${parentApptId === v.id ? 'border-seafoam bg-seafoam/5' : 'border-slate-100 dark:border-zinc-800 hover:border-slate-200'}`}>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{new Date(v.date).toLocaleDateString()} · {v.encounterType ? v.encounterType.replace('_', ' ') : 'Visit'}</span>
                            <span className="block text-[9px] text-slate-400 truncate">{(v.tasks?.length ?? 0)} service{(v.tasks?.length ?? 0) === 1 ? '' : 's'}{v.status ? ` · ${v.status.replace('_', ' ')}` : ''}</span>
                          </span>
                          {parentApptId === v.id && <Check size={14} className="text-seafoam shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
           </div>

           <div data-tour="appointment-services" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                 <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{encounterType === 'GROOMING' ? 'Grooming Services' : encounterType === 'BOARDING' ? 'Boarding Services' : encounterType === 'RETAIL' ? 'Items' : encounterType === 'VET_VISIT' ? 'Clinical Workflow' : 'Visit Workflow'}</h2>
              </div>
              {/* Vet visits: the workflow is no longer picked at registration —
                  the clinical wizard on the visit drives it from the visit type.
                  Only the entry-point fee is seeded onto the bill. */}
              {encounterType === 'VET_VISIT' && (
                <div className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-seafoam/5 border border-seafoam/20">
                  <span className="text-xl shrink-0">{visitType === 'EMERGENCY' ? '🚨' : '🩺'}</span>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">Workflow runs inside the visit</p>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 leading-relaxed">
                      After registering, this visit opens in its <span className="text-seafoam">Clinical Workflow</span> — {visitType === 'EMERGENCY' ? 'emergency triage & stabilization first, then history → examination → diagnostics → treatment' : visitType === 'FOLLOW_UP' ? 'review history first, then examination → treatment' : visitType === 'INPATIENT' ? 'admission first, then the full clinical flow' : 'history → examination → assessment → diagnostics → diagnosis → treatment → communication → follow-up'}.
                      Services &amp; billing are added during the consultation; the {visitType === 'EMERGENCY' ? 'emergency' : 'consultation'} fee is placed on the bill automatically.
                    </p>
                  </div>
                </div>
              )}
              {encounterType !== 'VET_VISIT' && (
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                   {workflowCategories.map(cat => {
                     const isSelected = selectedCategories.some(sc => sc.categoryId === cat.id);
                     return (
                       <button key={cat.id} onClick={() => isSelected ? handleRemoveCategory(cat.id) : handleAddCategory(cat.id)} className={`shrink-0 flex flex-col items-center gap-1.5 p-4 min-w-[110px] rounded-xl border-2 transition-all ${isSelected ? 'bg-seafoam border-seafoam text-white shadow-sm scale-105' : 'bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 text-slate-400'}`}>
                          <span className="text-2xl">{cat.icon}</span>
                          <span className="text-[7.5px] font-black uppercase whitespace-nowrap tracking-widest">{cat.name}</span>
                       </button>
                     );
                   })}
                </div>
              )}
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
           <div data-tour="appointment-scheduling" className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4 sticky top-4">
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
                 <div data-tour="appointment-estimate" className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                    <div>
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estimated Bill</p>
                       <h3 className="text-xl font-black font-mono text-emerald-600 tracking-tighter">KES {totalCost.toLocaleString()}</h3>
                    </div>
                 </div>
                 <button data-tour="appointment-submit" onClick={handleFinalize} disabled={!isFormValid} className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-30">
                    Book Visit
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
                  <LoadingSpinner message="Loading medications..." />
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
                    <h2 className="text-xl font-black text-white uppercase">New Client</h2>
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
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="John"
                      value={walkInClientData.firstName}
                      onChange={(e) => setWalkInClientData({ ...walkInClientData, firstName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Surname <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Doe"
                      value={walkInClientData.surname}
                      onChange={(e) => setWalkInClientData({ ...walkInClientData, surname: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Second Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Middle name"
                      value={walkInClientData.secondName}
                      onChange={(e) => setWalkInClientData({ ...walkInClientData, secondName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <PhoneInput
                      countryCode={walkInClientData.countryCode}
                      dialCode={walkInClientData.dialCode}
                      phone={walkInClientData.phone}
                      onChange={(v) => setWalkInClientData({ ...walkInClientData, countryCode: v.countryCode, dialCode: v.dialCode, phone: v.phone })}
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
                      onChange={(e) => setWalkInPetData({ ...walkInPetData, species: e.target.value, breed: '' })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-cyan/20 cursor-pointer"
                    >
                      {walkInSpeciesOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Breed <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={walkInPetData.breed}
                      onChange={(e) => setWalkInPetData({ ...walkInPetData, breed: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-cyan/20 cursor-pointer"
                    >
                      <option value="">Select breed…</option>
                      {walkInBreedOptions.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
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
                disabled={isCreatingWalkIn || !walkInClientData.firstName || !walkInClientData.surname || !walkInClientData.phone || !walkInPetData.name || !walkInPetData.breed}
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

export default NewVisitView;
