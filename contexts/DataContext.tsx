import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { clientsAPI, petsAPI, appointmentsAPI, transactionsAPI, medicalRecordsAPI, inventoryAPI } from '../services';
import { useAuth } from './AuthContext';
import { useClinic } from './ClinicContext';
import { Client, Pet, Appointment } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { MedicalRecord } from '../services/modules/medicalRecords.api';
import { InventoryItem } from '../services/modules/inventory.api';

interface DataContextType {
  clients: Client[];
  pets: Pet[];
  appointments: Appointment[];
  transactions: Transaction[];
  inventory: InventoryItem[];
  isLoadingClients: boolean;
  isLoadingPets: boolean;
  isLoadingAppointments: boolean;
  isLoadingTransactions: boolean;
  isLoadingInventory: boolean;
  refreshClients: () => Promise<void>;
  refreshPets: () => Promise<void>;
  refreshAppointments: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshInventory: () => Promise<void>;
  updateAppointmentLocally: (id: number, updater: (appt: Appointment) => Appointment) => void;
  getClientById: (id: number) => Client | undefined;
  getPetById: (id: number) => Pet | undefined;
  getClientPets: (clientId: number) => Pet[];
  loadPetMedicalRecords: (petId: number) => Promise<void>;

  // Optimistic update methods
  addClientOptimistically: (client: Client) => void;
  updateClientOptimistically: (id: number, updater: (client: Client) => Client) => void;
  removeClientOptimistically: (id: number) => void;
  addPetOptimistically: (pet: Pet) => void;
  updatePetOptimistically: (id: number, updater: (pet: Pet) => Pet) => void;
  removePetOptimistically: (id: number) => void;
  addAppointmentOptimistically: (appointment: Appointment) => void;
  updateAppointmentOptimistically: (id: number, updater: (appt: Appointment) => Appointment) => void;
  removeAppointmentOptimistically: (id: number) => void;
  addInventoryOptimistically: (item: InventoryItem) => void;
  updateInventoryOptimistically: (id: string, updater: (item: InventoryItem) => InventoryItem) => void;
  removeInventoryOptimistically: (id: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { selectedClinicIds } = useClinic();
  const [clients, setClients] = useState<Client[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingPets, setIsLoadingPets] = useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  // Track when each clinicKey was last fetched. Data is considered fresh for STALE_TIME_MS.
  const STALE_TIME_MS = 10 * 60 * 1000; // 10 minutes
  const fetchedAtMap = useRef<Record<string, number>>({});

  // Stable string key — prevents array reference from triggering unnecessary effect runs
  const clinicIdsKey = useMemo(
    () => [...selectedClinicIds].sort().join(','),
    [selectedClinicIds]
  );

  // Fetch clients when clinic selection changes
  const fetchClients = async () => {
    if (!isAuthenticated || selectedClinicIds.length === 0) {
      setClients([]);
      return;
    }

    setIsLoadingClients(true);
    try {
      // Fetch with pagination - load 100 records for initial cache
      const response: any = await clientsAPI.getAll({ page: 1, limit: 100 });
      if (response.success && response.data.clients) {
        // Transform API response to match frontend Client type
        const transformedClients = response.data.clients.map((client: any) => ({
          id: parseInt(client.id),
          clinicId: parseInt(client.clinicId),
          name: String(client.name || ''),
          email: String(client.email || ''),
          phone: String(client.phone || ''),
          address: String(client.address || ''),
          country: String(client.country || 'Kenya'),
          currency: 'KES', // TODO: Get from client or clinic settings
          gender: client.gender || 'Female',
          region: client.region || 'Local',
          dob: String(client.dob || ''),
          avatar: String(client.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${client.name}`),
          joinDate: String(client.joinedAt || new Date().toISOString().split('T')[0]),
          totalSpent: Number(client.totalSpent) || 0,
          lastVisit: String(client.lastVisitAt || ''),
        }));
        setClients(transformedClients);
        console.log(`✅ [DataContext] Loaded ${transformedClients.length} clients from API (cache)`);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
      setClients([]);
    } finally {
      setIsLoadingClients(false);
    }
  };

  // Fetch pets when clinic selection changes
  const fetchPets = async () => {
    if (!isAuthenticated || selectedClinicIds.length === 0) {
      setPets([]);
      return;
    }

    setIsLoadingPets(true);
    try {
      // Fetch with pagination - load 100 records for initial cache
      const response: any = await petsAPI.getAll({ page: 1, limit: 100 });
      if (response.success && response.data.pets) {
        // Transform API response to match frontend Pet type
        // NOTE: Medical records are NOT fetched here to avoid N+1 query problem
        // They will be loaded on-demand when viewing a specific pet's profile
        const transformedPets = response.data.pets.map((pet: any) => ({
          id: parseInt(pet.id),
          clinicId: parseInt(pet.clinicId),
          ownerId: parseInt(pet.ownerId),
          name: String(pet.name || ''),
          species: String(pet.species || ''),
          breed: String(pet.breed || ''),
          gender: String(pet.gender || ''),
          dob: String(pet.dob || ''),
          age: pet.age || calculateAge(pet.dob),
          weight: `${pet.weightValue || 0}${pet.weightUnit || 'kg'}`,
          avatar: String(pet.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${pet.name}`),
          medicalHistory: [], // Will be loaded on-demand when viewing pet profile
          vaccinations: [], // TODO: Fetch from vaccination records API
          rfidChipNumber: String(pet.rfidChipNumber || ''),
          tagNumber: String(pet.tagNumber || ''),
          appointmentCount: pet.appointmentCount ?? 0,
          medicalRecordCount: pet.medicalRecordCount ?? 0,
          vaccinationCount: pet.vaccinationCount ?? 0,
        }));
        setPets(transformedPets);
        console.log(`✅ [DataContext] Loaded ${transformedPets.length} pets from API (medical records will be loaded on-demand)`);
      }
    } catch (error) {
      console.error('Failed to fetch pets:', error);
      setPets([]);
    } finally {
      setIsLoadingPets(false);
    }
  };

  // Fetch appointments when clinic selection changes
  const fetchAppointments = async () => {
    if (!isAuthenticated || selectedClinicIds.length === 0) {
      setAppointments([]);
      return;
    }

    setIsLoadingAppointments(true);
    try {
      // Fetch 100 most recent appointments — no date filter, client-side filtering handles display
      const response: any = await appointmentsAPI.getAll({ page: 1, limit: 100, sortBy: 'scheduledAt', sortOrder: 'desc' });
      if (response.success && response.data.appointments) {
        const transformedAppointments = response.data.appointments.map((appt: any) => ({
          id: parseInt(appt.id),
          clinicId: parseInt(appt.clinicId),
          clientId: parseInt(appt.clientId),
          petId: parseInt(appt.petId),
          date: appt.scheduledAt,
          status: appt.status,
          totalCost: appt.totalCost,
          isPaid: appt.isPaid,
          paymentMethod: appt.paymentMethod,
          isHouseCall: appt.isHouseCall,
          parentAppointmentId: appt.parentAppointmentId ? parseInt(appt.parentAppointmentId) : undefined,
          originReferralId: appt.originReferralId ? parseInt(appt.originReferralId) : undefined,
          client: appt.client ? { id: parseInt(appt.client.id), name: appt.client.name, phone: appt.client.phone, email: appt.client.email } : undefined,
          pet: appt.pet ? { id: parseInt(appt.pet.id), name: appt.pet.name, species: appt.pet.species, breed: appt.pet.breed } : undefined,
          tasks: appt.tasks.map((task: any) => ({
            id: parseInt(task.id),
            name: task.name,
            category: task.category,
            status: task.status,
            assignedStaffId: task.assignedStaffId ? parseInt(task.assignedStaffId) : undefined,
            price: task.price,
            notes: task.notes,
            sentiment: task.sentiment,
            selectedPhrases: task.selectedPhrases || [],
            referralId: task.referralId ? parseInt(task.referralId) : undefined,
            completedAt: task.completedAt,
          })),
        }));
        setAppointments(transformedAppointments);
        console.log(`✅ [DataContext] Loaded ${transformedAppointments.length} appointments (initial cache)`);
      }
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      setAppointments([]);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  // Fetch transactions
  const fetchTransactions = async () => {
    if (!isAuthenticated || selectedClinicIds.length === 0) {
      setTransactions([]);
      return;
    }

    setIsLoadingTransactions(true);
    try {
      // Fetch with pagination - load 100 records for initial cache
      const response: any = await transactionsAPI.getAll({ page: 1, limit: 100 });
      if (response.success && response.data.transactions) {
        // Transform transaction data to match frontend types
        const transformedTransactions = response.data.transactions.map((tx: any) => ({
          id: tx.id,
          fromId: tx.fromEntityId ? parseInt(tx.fromEntityId) : undefined,
          toId: tx.toEntityId ? parseInt(tx.toEntityId) : undefined,
          amount: parseFloat(tx.amount) || 0,
          currency: tx.currency,
          type: tx.type,
          status: tx.status,
          method: tx.method,
          date: tx.createdAt ? String(tx.createdAt) : new Date().toISOString(), // Map createdAt to date for Transaction interface
          createdAt: tx.createdAt ? String(tx.createdAt) : new Date().toISOString(),
          settledAt: tx.settledAt ? String(tx.settledAt) : undefined,
          appointmentId: tx.appointmentId,
          receiptNumber: tx.receiptNumber,
          client: tx.client,
          appointment: tx.appointment,
        }));
        setTransactions(transformedTransactions);
        console.log(`✅ [DataContext] Loaded ${transformedTransactions.length} transactions from API (cache)`);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      setTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Fetch inventory
  const fetchInventory = async () => {
    if (!isAuthenticated || selectedClinicIds.length === 0) {
      setInventory([]);
      return;
    }

    setIsLoadingInventory(true);
    try {
      const response = await inventoryAPI.getAll({ limit: 1000 });
      if (response.success && response.data.data) {
        // Backend returns paginated response: { data: { data: [...], meta: {...} } }
        const items = response.data.data || [];
        setInventory(items);
        console.log(`✅ Loaded ${items.length} inventory items from API`);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      setInventory([]);
    } finally {
      setIsLoadingInventory(false);
    }
  };

  const calculateAge = (dob: string): number => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Load medical records for a specific pet on-demand
  const loadPetMedicalRecords = async (petId: number) => {
    try {
      console.log(`[DataContext] Loading medical records for pet ${petId}...`);
      const medRecordsResponse: any = await medicalRecordsAPI.getByPetId(petId.toString());

      if (medRecordsResponse.success && medRecordsResponse.data.medicalRecords) {
        const medicalHistory = medRecordsResponse.data.medicalRecords.map((record: MedicalRecord) => ({
          id: parseInt(record.id),
          date: record.recordedAt ? new Date(record.recordedAt).toISOString().split('T')[0] : '',
          appointmentId: record.appointmentId ? parseInt(record.appointmentId) : undefined,
          clinicId: parseInt(record.clinicId),
          clinicName: record.clinic?.name || 'Unknown Clinic',
          diagnosis: record.diagnosis,
          treatment: record.treatment,
          medications: record.medications || [],
          files: record.files || [],
          sharedWith: record.sharedWithClinicIds || [],
          serviceNotes: record.serviceNotes || [],
          originReferralId: record.originReferralId ? parseInt(record.originReferralId) : undefined,
        }));

        // Update the pet's medical history in state
        setPets(prevPets => prevPets.map(pet =>
          pet.id === petId ? { ...pet, medicalHistory } : pet
        ));

        console.log(`✅ [DataContext] Loaded ${medicalHistory.length} medical records for pet ${petId}`);
      }
    } catch (error) {
      console.error(`Failed to fetch medical records for pet ${petId}:`, error);
    }
  };

  // ============================================
  // Auto-fetch: Load initial data cache when authenticated
  // ============================================
  // This provides a cache of recently accessed records (100 per entity type)
  // to support instant navigation to detail pages without additional API calls.
  // View components still fetch their own paginated data for table displays.
  //
  // Benefits:
  // 1. Instant navigation to detail pages (data already in context)
  // 2. Reduced API calls for common navigation patterns
  // 3. Better UX - no loading states when clicking on visible records
  // 4. View components maintain control over their own pagination
  // 5. Leverages the cache system in frontend/services/utils/cache.ts

  // Single effect: fetch ALL data on login or clinic switch.
  // Date range filtering is client-side — no server refetch on filter changes.
  useEffect(() => {
    if (!isAuthenticated || clinicIdsKey === '') {
      fetchedAtMap.current = {};
      setClients([]);
      setPets([]);
      setAppointments([]);
      setTransactions([]);
      setInventory([]);
      return;
    }

    const fetchedAt = fetchedAtMap.current[clinicIdsKey] ?? 0;
    const isStale = Date.now() - fetchedAt > STALE_TIME_MS;

    // Skip if data was recently fetched (ref-based — no stale closure risk)
    if (!isStale) return;

    console.log('🔄 [DataContext] Loading all data on login for clinic(s):', clinicIdsKey);
    fetchedAtMap.current[clinicIdsKey] = Date.now();

    Promise.all([
      fetchClients(),
      fetchPets(),
      fetchAppointments(),
      fetchTransactions(),
      fetchInventory(),
    ]).then(() => {
      console.log('✅ [DataContext] All data loaded and cached');
    }).catch((error) => {
      console.error('❌ [DataContext] Error loading data:', error);
    });
  }, [isAuthenticated, clinicIdsKey]);

  const getClientById = (id: number) => clients.find(c => c.id === id);
  const getPetById = (id: number) => pets.find(p => p.id === id);
  const getClientPets = (clientId: number) => pets.filter(p => p.ownerId === clientId);

  // Update appointment locally for optimistic UI
  const updateAppointmentLocally = (id: number, updater: (appt: Appointment) => Appointment) => {
    setAppointments(prev => prev.map(a => a.id === id ? updater(a) : a));
  };

  // ============================================
  // Optimistic Update Methods
  // ============================================

  // Clients
  const addClientOptimistically = (client: Client) => {
    setClients(prev => [...prev, client]);
  };

  const updateClientOptimistically = (id: number, updater: (client: Client) => Client) => {
    setClients(prev => prev.map(c => c.id === id ? updater(c) : c));
  };

  const removeClientOptimistically = (id: number) => {
    setClients(prev => prev.filter(c => c.id !== id));
  };

  // Pets
  const addPetOptimistically = (pet: Pet) => {
    setPets(prev => [...prev, pet]);
  };

  const updatePetOptimistically = (id: number, updater: (pet: Pet) => Pet) => {
    setPets(prev => prev.map(p => p.id === id ? updater(p) : p));
  };

  const removePetOptimistically = (id: number) => {
    setPets(prev => prev.filter(p => p.id !== id));
  };

  // Appointments
  const addAppointmentOptimistically = (appointment: Appointment) => {
    setAppointments(prev => [...prev, appointment]);
  };

  const updateAppointmentOptimistically = (id: number, updater: (appt: Appointment) => Appointment) => {
    setAppointments(prev => prev.map(a => a.id === id ? updater(a) : a));
  };

  const removeAppointmentOptimistically = (id: number) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  // Inventory
  const addInventoryOptimistically = (item: InventoryItem) => {
    setInventory(prev => [...prev, item]);
  };

  const updateInventoryOptimistically = (id: string, updater: (item: InventoryItem) => InventoryItem) => {
    setInventory(prev => prev.map(i => i.id === id ? updater(i) : i));
  };

  const removeInventoryOptimistically = (id: string) => {
    setInventory(prev => prev.filter(i => i.id !== id));
  };

  const value: DataContextType = {
    clients,
    pets,
    appointments,
    transactions,
    inventory,
    isLoadingClients,
    isLoadingPets,
    isLoadingAppointments,
    isLoadingTransactions,
    isLoadingInventory,
    refreshClients: async () => {
      const key = [...selectedClinicIds].sort().join(',');
      fetchedAtMap.current[key] = 0;
      await fetchClients();
    },
    refreshPets: async () => { await fetchPets(); },
    refreshAppointments: async () => {
      const key = [...selectedClinicIds].sort().join(',');
      fetchedAtMap.current[key] = Date.now(); // reset stale timer after explicit refresh
      await fetchAppointments();
    },
    refreshTransactions: async () => { await fetchTransactions(); },
    refreshInventory: async () => { await fetchInventory(); },
    updateAppointmentLocally,
    getClientById,
    getPetById,
    getClientPets,
    loadPetMedicalRecords,
    // Optimistic update methods
    addClientOptimistically,
    updateClientOptimistically,
    removeClientOptimistically,
    addPetOptimistically,
    updatePetOptimistically,
    removePetOptimistically,
    addAppointmentOptimistically,
    updateAppointmentOptimistically,
    removeAppointmentOptimistically,
    addInventoryOptimistically,
    updateInventoryOptimistically,
    removeInventoryOptimistically,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

