import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react';
import { clientsAPI, petsAPI, appointmentsAPI, transactionsAPI, inventoryAPI } from '../services';
import { useAuth } from './AuthContext';
import { useClinic } from './ClinicContext';
import { Client, Pet, Appointment } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { InventoryItem } from '../services/modules/inventory.api';

const STALE_MS = 10 * 60 * 1000; // 10 minutes per resource

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
  // On-demand loaders — fetch only if stale, no-op if fresh
  ensureClients: () => Promise<void>;
  ensurePets: () => Promise<void>;
  ensureAppointments: () => Promise<void>;
  ensureTransactions: () => Promise<void>;
  ensureInventory: () => Promise<void>;
  // Force-refresh (bypasses stale check)
  refreshClients: () => Promise<void>;
  refreshPets: () => Promise<void>;
  refreshAppointments: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshInventory: () => Promise<void>;
  updateAppointmentLocally: (id: number, updater: (appt: Appointment) => Appointment) => void;
  getClientById: (id: number) => Client | undefined;
  getPetById: (id: number) => Pet | undefined;
  getClientPets: (clientId: number) => Pet[];
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
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};

const calculateAge = (dob: string): number => {
  if (!dob) return 0;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

  // Per-resource stale timers, keyed by clinicIdsKey
  const clientsAt     = useRef<Record<string, number>>({});
  const petsAt        = useRef<Record<string, number>>({});
  const appointmentsAt = useRef<Record<string, number>>({});
  const transactionsAt = useRef<Record<string, number>>({});
  const inventoryAt   = useRef<Record<string, number>>({});

  const clinicIdsKey = useMemo(
    () => [...selectedClinicIds].sort().join(','),
    [selectedClinicIds]
  );

  // Clear all data and stale timers on logout or clinic switch
  useEffect(() => {
    if (!isAuthenticated || clinicIdsKey === '') {
      setClients([]);
      setPets([]);
      setAppointments([]);
      setTransactions([]);
      setInventory([]);
      clientsAt.current     = {};
      petsAt.current        = {};
      appointmentsAt.current = {};
      transactionsAt.current = {};
      inventoryAt.current   = {};
    }
  }, [isAuthenticated, clinicIdsKey]);

  // ─── Raw fetch functions ──────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    setIsLoadingClients(true);
    try {
      const response: any = await clientsAPI.getAll({ page: 1, limit: 100 });
      if (response.success && response.data.clients) {
        setClients(response.data.clients.map((c: any) => ({
          id: parseInt(c.id),
          clinicId: parseInt(c.clinicId),
          name: String(c.name || ''),
          email: String(c.email || ''),
          phone: String(c.phone || ''),
          address: String(c.address || ''),
          country: String(c.country || 'Kenya'),
          currency: 'KES',
          gender: c.gender || 'Female',
          region: c.region || 'Local',
          dob: String(c.dob || ''),
          avatar: String(c.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`),
          joinDate: String(c.joinedAt || new Date().toISOString().split('T')[0]),
          totalSpent: Number(c.totalSpent) || 0,
          lastVisit: String(c.lastVisitAt || ''),
        })));
      }
    } catch (e) {
      console.error('[DataContext] fetchClients failed:', e);
    } finally {
      setIsLoadingClients(false);
    }
  }, [isAuthenticated, clinicIdsKey]);

  const fetchPets = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    setIsLoadingPets(true);
    try {
      const response: any = await petsAPI.getAll({ page: 1, limit: 100 });
      if (response.success && response.data.pets) {
        setPets(response.data.pets.map((p: any) => ({
          id: parseInt(p.id),
          clinicId: parseInt(p.clinicId),
          ownerId: parseInt(p.ownerId),
          name: String(p.name || ''),
          species: String(p.species || ''),
          breed: String(p.breed || ''),
          gender: String(p.gender || ''),
          dob: String(p.dob || ''),
          age: p.age || calculateAge(p.dob),
          weight: `${p.weightValue || 0}${p.weightUnit || 'kg'}`,
          avatar: String(p.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.name}`),
          medicalHistory: [],
          vaccinations: [],
          rfidChipNumber: String(p.rfidChipNumber || ''),
          tagNumber: String(p.tagNumber || ''),
          appointmentCount: p.appointmentCount ?? 0,
          medicalRecordCount: p.medicalRecordCount ?? 0,
          vaccinationCount: p.vaccinationCount ?? 0,
        })));
      }
    } catch (e) {
      console.error('[DataContext] fetchPets failed:', e);
    } finally {
      setIsLoadingPets(false);
    }
  }, [isAuthenticated, clinicIdsKey]);

  const fetchAppointments = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    setIsLoadingAppointments(true);
    try {
      const response: any = await appointmentsAPI.getAll({ page: 1, limit: 100, sortBy: 'scheduledAt', sortOrder: 'desc' });
      if (response.success && response.data.appointments) {
        setAppointments(response.data.appointments.map((a: any) => ({
          id: parseInt(a.id),
          clinicId: parseInt(a.clinicId),
          clientId: parseInt(a.clientId),
          petId: parseInt(a.petId),
          date: a.scheduledAt,
          status: a.status,
          totalCost: a.totalCost,
          isPaid: a.isPaid,
          paymentMethod: a.paymentMethod,
          isHouseCall: a.isHouseCall,
          parentAppointmentId: a.parentAppointmentId ? parseInt(a.parentAppointmentId) : undefined,
          originReferralId: a.originReferralId ? parseInt(a.originReferralId) : undefined,
          leadStaffId: a.leadStaffId ? parseInt(a.leadStaffId) : undefined,
          leadStaff: a.leadStaff ? { id: parseInt(a.leadStaff.id), name: a.leadStaff.name, role: a.leadStaff.role } : undefined,
          client: a.client ? { id: parseInt(a.client.id), name: a.client.name, phone: a.client.phone, email: a.client.email } : undefined,
          pet: a.pet ? { id: parseInt(a.pet.id), name: a.pet.name, species: a.pet.species, breed: a.pet.breed } : undefined,
          tasks: (a.tasks || []).map((t: any) => ({
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
          })),
          medications: a.medications || [],
        })));
      }
    } catch (e) {
      console.error('[DataContext] fetchAppointments failed:', e);
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [isAuthenticated, clinicIdsKey]);

  const fetchTransactions = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    setIsLoadingTransactions(true);
    try {
      const response: any = await transactionsAPI.getAll();
      if (response.success && response.data.transactions) {
        setTransactions(response.data.transactions.map((tx: any) => ({
          id: tx.id,
          fromId: tx.fromEntityId ? parseInt(tx.fromEntityId) : undefined,
          toId: tx.toEntityId ? parseInt(tx.toEntityId) : undefined,
          amount: parseFloat(tx.amount) || 0,
          currency: tx.currency,
          type: tx.type,
          status: tx.status,
          method: tx.method,
          date: tx.createdAt ? String(tx.createdAt) : new Date().toISOString(),
          createdAt: tx.createdAt ? String(tx.createdAt) : new Date().toISOString(),
          settledAt: tx.settledAt ? String(tx.settledAt) : undefined,
          appointmentId: tx.appointmentId,
          receiptNumber: tx.receiptNumber,
          client: tx.client,
          appointment: tx.appointment,
        })));
      }
    } catch (e) {
      console.error('[DataContext] fetchTransactions failed:', e);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [isAuthenticated, clinicIdsKey]);

  const fetchInventory = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    setIsLoadingInventory(true);
    try {
      const response = await inventoryAPI.getAll({ limit: 200 });
      if (response.success && response.data.data) {
        setInventory(response.data.data || []);
      }
    } catch (e) {
      console.error('[DataContext] fetchInventory failed:', e);
    } finally {
      setIsLoadingInventory(false);
    }
  }, [isAuthenticated, clinicIdsKey]);

  // ─── ensure* — fetch only when stale ─────────────────────────────────────

  const ensureClients = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    if (Date.now() - (clientsAt.current[clinicIdsKey] ?? 0) < STALE_MS) return;
    clientsAt.current[clinicIdsKey] = Date.now();
    await fetchClients();
  }, [isAuthenticated, clinicIdsKey, fetchClients]);

  const ensurePets = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    if (Date.now() - (petsAt.current[clinicIdsKey] ?? 0) < STALE_MS) return;
    petsAt.current[clinicIdsKey] = Date.now();
    await fetchPets();
  }, [isAuthenticated, clinicIdsKey, fetchPets]);

  const ensureAppointments = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    if (Date.now() - (appointmentsAt.current[clinicIdsKey] ?? 0) < STALE_MS) return;
    appointmentsAt.current[clinicIdsKey] = Date.now();
    await fetchAppointments();
  }, [isAuthenticated, clinicIdsKey, fetchAppointments]);

  const ensureTransactions = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    if (Date.now() - (transactionsAt.current[clinicIdsKey] ?? 0) < STALE_MS) return;
    transactionsAt.current[clinicIdsKey] = Date.now();
    await fetchTransactions();
  }, [isAuthenticated, clinicIdsKey, fetchTransactions]);

  const ensureInventory = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    if (Date.now() - (inventoryAt.current[clinicIdsKey] ?? 0) < STALE_MS) return;
    inventoryAt.current[clinicIdsKey] = Date.now();
    await fetchInventory();
  }, [isAuthenticated, clinicIdsKey, fetchInventory]);

  // ─── force-refresh (resets stale timer then fetches) ─────────────────────

  const refreshClients = useCallback(async () => {
    clientsAt.current[clinicIdsKey] = 0;
    await fetchClients();
  }, [clinicIdsKey, fetchClients]);

  const refreshPets = useCallback(async () => {
    petsAt.current[clinicIdsKey] = 0;
    await fetchPets();
  }, [clinicIdsKey, fetchPets]);

  const refreshAppointments = useCallback(async () => {
    appointmentsAt.current[clinicIdsKey] = 0;
    await fetchAppointments();
  }, [clinicIdsKey, fetchAppointments]);

  const refreshTransactions = useCallback(async () => {
    transactionsAt.current[clinicIdsKey] = 0;
    await fetchTransactions();
  }, [clinicIdsKey, fetchTransactions]);

  const refreshInventory = useCallback(async () => {
    inventoryAt.current[clinicIdsKey] = 0;
    await fetchInventory();
  }, [clinicIdsKey, fetchInventory]);

  // ─── Helpers & optimistic updates ────────────────────────────────────────

  const updateAppointmentLocally = useCallback((id: number, updater: (a: Appointment) => Appointment) => {
    setAppointments(prev => prev.map(a => a.id === id ? updater(a) : a));
  }, []);

  const getClientById = useCallback((id: number) => clients.find(c => c.id === id), [clients]);
  const getPetById = useCallback((id: number) => pets.find(p => p.id === id), [pets]);
  const getClientPets = useCallback((clientId: number) => pets.filter(p => p.ownerId === clientId), [pets]);

  const addClientOptimistically = useCallback((c: Client) => setClients(prev => [...prev, c]), []);
  const updateClientOptimistically = useCallback((id: number, upd: (c: Client) => Client) => setClients(prev => prev.map(c => c.id === id ? upd(c) : c)), []);
  const removeClientOptimistically = useCallback((id: number) => setClients(prev => prev.filter(c => c.id !== id)), []);

  const addPetOptimistically = useCallback((p: Pet) => setPets(prev => [...prev, p]), []);
  const updatePetOptimistically = useCallback((id: number, upd: (p: Pet) => Pet) => setPets(prev => prev.map(p => p.id === id ? upd(p) : p)), []);
  const removePetOptimistically = useCallback((id: number) => setPets(prev => prev.filter(p => p.id !== id)), []);

  const addAppointmentOptimistically = useCallback((a: Appointment) => setAppointments(prev => [...prev, a]), []);
  const updateAppointmentOptimistically = useCallback((id: number, upd: (a: Appointment) => Appointment) => setAppointments(prev => prev.map(a => a.id === id ? upd(a) : a)), []);
  const removeAppointmentOptimistically = useCallback((id: number) => setAppointments(prev => prev.filter(a => a.id !== id)), []);

  const addInventoryOptimistically = useCallback((item: InventoryItem) => setInventory(prev => [...prev, item]), []);
  const updateInventoryOptimistically = useCallback((id: string, upd: (i: InventoryItem) => InventoryItem) => setInventory(prev => prev.map(i => i.id === id ? upd(i) : i)), []);
  const removeInventoryOptimistically = useCallback((id: string) => setInventory(prev => prev.filter(i => i.id !== id)), []);

  const value: DataContextType = {
    clients, pets, appointments, transactions, inventory,
    isLoadingClients, isLoadingPets, isLoadingAppointments, isLoadingTransactions, isLoadingInventory,
    ensureClients, ensurePets, ensureAppointments, ensureTransactions, ensureInventory,
    refreshClients, refreshPets, refreshAppointments, refreshTransactions, refreshInventory,
    updateAppointmentLocally,
    getClientById, getPetById, getClientPets,
    addClientOptimistically, updateClientOptimistically, removeClientOptimistically,
    addPetOptimistically, updatePetOptimistically, removePetOptimistically,
    addAppointmentOptimistically, updateAppointmentOptimistically, removeAppointmentOptimistically,
    addInventoryOptimistically, updateInventoryOptimistically, removeInventoryOptimistically,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
