import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react';
import { clientsAPI, petsAPI, appointmentsAPI, transactionsAPI, inventoryAPI } from '../services';
import { useAuth } from './AuthContext';
import { useClinic } from './ClinicContext';
import { Client, Pet, Appointment } from '../types';
import { Transaction } from '../services/modules/transactions.api';
import { InventoryItem } from '../services/modules/inventory.api';

// Short TTL acts as an in-flight de-dup window: a page that mounts and
// immediately calls multiple ensure*() helpers in the same tick won't fire
// two parallel requests, but anything past this threshold (route change,
// browser reload, clinic switch, refresh button) refetches from the API.
const STALE_MS = 1500;

// ─── sessionStorage page-cache helpers ────────────────────────────────────
// We keep these for backwards compatibility (some callers may still write),
// but on mount we deliberately do NOT rehydrate from sessionStorage — every
// page reload should hit the API for fresh data.
const DC_PREFIX = 'vethub_dc_';

function savePageCache(resource: string, clinicKey: string, data: unknown, timestamp: number): void {
  try {
    sessionStorage.setItem(`${DC_PREFIX}${resource}_${clinicKey}`, JSON.stringify({ data, timestamp }));
  } catch { /* storage full or unavailable */ }
}

function clearAllPageCache(): void {
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(DC_PREFIX))
      .forEach(k => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

interface DataContextType {
  clients: Client[];
  pets: Pet[];
  appointments: Appointment[];
  transactions: Transaction[];
  inventory: InventoryItem[];
  // Server-reported total record counts for the active clinic context.
  // null until the first fetch lands; pagination components read these so
  // they can show the true DB total (e.g. "1-50/3478") instead of the
  // local-array length (which is capped by the in-memory fetch limit).
  totals: {
    clients: number | null;
    pets: number | null;
    appointments: number | null;
    transactions: number | null;
    inventory: number | null;
  };
  isLoadingClients: boolean;
  isLoadingPets: boolean;
  isLoadingAppointments: boolean;
  isLoadingTransactions: boolean;
  isLoadingInventory: boolean;
  // Client list status filter — controls whether deactivated clients are
  // included server-side. Defaults to 'active'.
  clientStatus: 'active' | 'inactive' | 'all';
  setClientStatus: (status: 'active' | 'inactive' | 'all') => void;
  // Pet list lifecycle filter — controls whether deceased patients are
  // included server-side. Defaults to 'alive'.
  petStatus: 'alive' | 'deceased' | 'all';
  setPetStatus: (status: 'alive' | 'deceased' | 'all') => void;
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
  const [totals, setTotals] = useState<DataContextType['totals']>({
    clients: null, pets: null, appointments: null, transactions: null, inventory: null,
  });

  const [clientStatus, setClientStatusState] = useState<'active' | 'inactive' | 'all'>('active');
  const [petStatus, setPetStatusState] = useState<'alive' | 'deceased' | 'all'>('alive');

  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);

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
  const previousClinicKey = useRef<string>('');
  useEffect(() => {
    if (!isAuthenticated || clinicIdsKey === '') {
      setClients([]);
      setPets([]);
      setAppointments([]);
      setTransactions([]);
      setInventory([]);
      setTotals({ clients: null, pets: null, appointments: null, transactions: null, inventory: null });
      setIsLoadingClients(false);
      setIsLoadingPets(false);
      setIsLoadingAppointments(false);
      setIsLoadingTransactions(false);
      setIsLoadingInventory(false);
      clientsAt.current     = {};
      petsAt.current        = {};
      appointmentsAt.current = {};
      transactionsAt.current = {};
      inventoryAt.current   = {};
      clearAllPageCache();
      previousClinicKey.current = '';
      return;
    }

    // Apply-clinic-and-refresh: refetch on first mount AND on every clinic
    // switch. The user explicitly wants pages to reflect the active clinic
    // without ever serving cached data from a previous session/selection.
    if (previousClinicKey.current !== clinicIdsKey) {
      // Reset state so stale rows don't flash through on a clinic switch
      // (skip on first mount — empty state is already correct).
      if (previousClinicKey.current) {
        setClients([]); setPets([]); setAppointments([]); setTransactions([]); setInventory([]);
        setTotals({ clients: null, pets: null, appointments: null, transactions: null, inventory: null });
      }
      // Wipe stale-timestamp guards so the fetches actually fire.
      clientsAt.current = {};
      petsAt.current = {};
      appointmentsAt.current = {};
      transactionsAt.current = {};
      inventoryAt.current = {};
      clearAllPageCache();
      // Refetch every resource — each view's own ensure*() will hit the
      // short stale-window de-dup if it mounts during these in-flight calls.
      void fetchClients();
      void fetchPets();
      void fetchAppointments();
      void fetchTransactions();
      void fetchInventory(true);
    }
    previousClinicKey.current = clinicIdsKey;
    // We intentionally don't add the fetch* deps — they're stable
    // useCallback-wrapped and we only want this to fire on auth /
    // clinic-key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, clinicIdsKey]);

  // Intentionally NOT rehydrating from sessionStorage on mount: the user
  // wants every page reload to fetch fresh data from the API. The cache
  // helpers stay in place for any future intra-session optimisation, but
  // the source of truth for a freshly-loaded page is always the network.


  // ─── Raw fetch functions ──────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    setIsLoadingClients(true);
    try {
      // Limit bumped to 1000 so the in-memory list reflects most clinics
      // entirely; server `pagination.totalItems` is captured below so the
      // pagination UI shows the true DB total even if we ever overflow.
      // Always bypass the api-client cache here. DataContext is the
      // single source of truth and runs its own staleness logic; the
      // 60s cache inside clientsAPI.getAll would otherwise make the
      // refresh button silently serve stale data.
      const response: any = await clientsAPI.getAll({ page: 1, limit: 1000, status: clientStatus }, { cache: false });
      if (response.success && response.data.clients) {
        const mapped: Client[] = response.data.clients.map((c: any) => ({
          id: parseInt(c.id),
          clinicId: parseInt(c.clinicId),
          clinicName: c.clinicName ?? null,
          title: c.title || '',
          firstName: c.firstName || '',
          secondName: c.secondName || '',
          surname: c.surname || '',
          name: String(c.name || ''),
          email: String(c.email || ''),
          phone: String(c.phone || ''),
          address: String(c.address || ''),
          country: String(c.country || 'Kenya'),
          currency: 'KES',
          gender: c.gender || 'Female',
          region: c.region || 'Local',
          dob: String(c.dob || ''),
          lat: c.lat || null,
          lng: c.lng || null,
          clientType: c.clientType || null,
          clientTypeNote: c.clientTypeNote || '',
          maxDebt: c.maxDebt || null,
          clientRiskRate: c.clientRiskRate || null,
          internalNotes: c.internalNotes || null,
          avatar: String(c.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`),
          joinDate: String(c.joinedAt || new Date().toISOString().split('T')[0]),
          totalSpent: Number(c.totalSpent) || 0,
          lastVisit: String(c.lastVisitAt || ''),
        }));
        setClients(mapped);
        const totalFromServer = Number(response.data?.pagination?.totalItems);
        setTotals(prev => ({ ...prev, clients: Number.isFinite(totalFromServer) ? totalFromServer : mapped.length }));
        savePageCache('clients', clinicIdsKey, mapped, Date.now());
      }
    } catch (e) {
      console.error('[DataContext] fetchClients failed:', e);
    } finally {
      setIsLoadingClients(false);
    }
  }, [isAuthenticated, clinicIdsKey, clientStatus]);

  const fetchPets = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    setIsLoadingPets(true);
    try {
      const response: any = await petsAPI.getAll({ page: 1, limit: 1000, status: petStatus }, { cache: false });
      if (response.success && response.data.pets) {
        const mapped: Pet[] = response.data.pets.map((p: any) => ({
          id: parseInt(p.id),
          clinicId: parseInt(p.clinicId),
          clinicName: p.clinicName ?? null,
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
          isAlive: p.isAlive !== false,
          dateOfDeath: p.dateOfDeath ?? null,
          appointmentCount: p.appointmentCount ?? 0,
          medicalRecordCount: p.medicalRecordCount ?? 0,
          vaccinationCount: p.vaccinationCount ?? 0,
        }));
        setPets(mapped);
        const totalFromServer = Number(response.data?.pagination?.totalItems);
        setTotals(prev => ({ ...prev, pets: Number.isFinite(totalFromServer) ? totalFromServer : mapped.length }));
        savePageCache('pets', clinicIdsKey, mapped, Date.now());
      }
    } catch (e) {
      console.error('[DataContext] fetchPets failed:', e);
    } finally {
      setIsLoadingPets(false);
    }
  }, [isAuthenticated, clinicIdsKey, petStatus]);

  const fetchAppointments = useCallback(async () => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    setIsLoadingAppointments(true);
    try {
      const response: any = await appointmentsAPI.getAll(
        { page: 1, limit: 500, sortBy: 'scheduledAt', sortOrder: 'desc' },
        { cache: false },
      );
      if (response.success && response.data.appointments) {
        const mapped: Appointment[] = response.data.appointments.map((a: any) => ({
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
        }));
        setAppointments(mapped);
        const totalFromServer = Number(response.data?.pagination?.totalItems);
        setTotals(prev => ({ ...prev, appointments: Number.isFinite(totalFromServer) ? totalFromServer : mapped.length }));
        savePageCache('appointments', clinicIdsKey, mapped, Date.now());
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
      const response: any = await transactionsAPI.getAll(undefined, { cache: false });
      if (response.success && response.data.transactions) {
        const mapped: Transaction[] = response.data.transactions.map((tx: any) => ({
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
          referenceNumber: tx.referenceNumber,
          metadata: tx.metadata,
          client: tx.client,
          appointment: tx.appointment,
        }));
        setTransactions(mapped);
        // transactionsAPI doesn't return pagination meta — use loaded length as the best-known total.
        setTotals(prev => ({ ...prev, transactions: mapped.length }));
        savePageCache('transactions', clinicIdsKey, mapped, Date.now());
      }
    } catch (e) {
      console.error('[DataContext] fetchTransactions failed:', e);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [isAuthenticated, clinicIdsKey]);

  const fetchInventory = useCallback(async (bypassCache = false) => {
    if (!isAuthenticated || clinicIdsKey === '') return;
    setIsLoadingInventory(true);
    try {
      const response = await inventoryAPI.getAll(
        { limit: 1000 },
        bypassCache ? { cache: false } : undefined
      );
      if (response.success && response.data.data) {
        const mapped: InventoryItem[] = response.data.data || [];
        setInventory(mapped);
        const totalFromServer = Number((response.data as any)?.meta?.totalItems);
        setTotals(prev => ({ ...prev, inventory: Number.isFinite(totalFromServer) ? totalFromServer : mapped.length }));
        savePageCache('inventory', clinicIdsKey, mapped, Date.now());
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

  // Changing the status filter must force a refetch — the in-memory cache
  // was loaded for the previous filter and would otherwise hide records.
  const setClientStatus = useCallback((status: 'active' | 'inactive' | 'all') => {
    setClientStatusState(prev => {
      if (prev === status) return prev;
      clientsAt.current[clinicIdsKey] = 0;
      return status;
    });
  }, [clinicIdsKey]);

  const setPetStatus = useCallback((status: 'alive' | 'deceased' | 'all') => {
    setPetStatusState(prev => {
      if (prev === status) return prev;
      petsAt.current[clinicIdsKey] = 0;
      return status;
    });
  }, [clinicIdsKey]);

  // When the status changes, fetchClients gets a new identity (it depends
  // on clientStatus). Trigger a fresh fetch so the list reflects the filter.
  // We skip the very first render — the auth/clinic effect above already
  // kicks off the initial fetch, no need to double-fire.
  const clientStatusInitialRender = useRef(true);
  useEffect(() => {
    if (clientStatusInitialRender.current) {
      clientStatusInitialRender.current = false;
      return;
    }
    if (!isAuthenticated || clinicIdsKey === '') return;
    clientsAt.current[clinicIdsKey] = 0;
    void fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientStatus]);

  const petStatusInitialRender = useRef(true);
  useEffect(() => {
    if (petStatusInitialRender.current) {
      petStatusInitialRender.current = false;
      return;
    }
    if (!isAuthenticated || clinicIdsKey === '') return;
    petsAt.current[clinicIdsKey] = 0;
    void fetchPets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petStatus]);

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
    await fetchInventory(true);
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
    clients, pets, appointments, transactions, inventory, totals,
    isLoadingClients, isLoadingPets, isLoadingAppointments, isLoadingTransactions, isLoadingInventory,
    clientStatus, setClientStatus,
    petStatus, setPetStatus,
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
