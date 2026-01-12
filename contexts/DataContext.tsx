import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { clientsAPI, petsAPI, appointmentsAPI, transactionsAPI } from '../services';
import { useAuth } from './AuthContext';
import { useClinic } from './ClinicContext';
import { Client, Pet, Appointment } from '../types';
import { Transaction } from '../services/modules/transactions.api';

interface DataContextType {
  clients: Client[];
  pets: Pet[];
  appointments: Appointment[];
  transactions: Transaction[];
  isLoadingClients: boolean;
  isLoadingPets: boolean;
  isLoadingAppointments: boolean;
  isLoadingTransactions: boolean;
  refreshClients: () => Promise<void>;
  refreshPets: () => Promise<void>;
  refreshAppointments: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  updateAppointmentLocally: (id: number, updater: (appt: Appointment) => Appointment) => void;
  getClientById: (id: number) => Client | undefined;
  getPetById: (id: number) => Pet | undefined;
  getClientPets: (clientId: number) => Pet[];
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
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingPets, setIsLoadingPets] = useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const lastFetchedClinicIds = useRef<string>('');

  // Fetch clients when clinic selection changes
  const fetchClients = async () => {
    if (!isAuthenticated || selectedClinicIds.length === 0) {
      setClients([]);
      return;
    }

    setIsLoadingClients(true);
    try {
      const response: any = await clientsAPI.getAll();
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
        console.log(`✅ Loaded ${transformedClients.length} clients from API`);
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
      const response: any = await petsAPI.getAll();
      if (response.success && response.data.pets) {
        // Transform API response to match frontend Pet type
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
          medicalHistory: [], // TODO: Fetch from medical records API
          vaccinations: [], // TODO: Fetch from vaccination records API
          rfidChipNumber: String(pet.rfidChipNumber || ''),
          tagNumber: String(pet.tagNumber || ''),
        }));
        setPets(transformedPets);
        console.log(`✅ Loaded ${transformedPets.length} pets from API`);
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
      const response: any = await appointmentsAPI.getAll();
      if (response.success && response.data.appointments) {
        // Transform API response to match frontend Appointment type
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
        console.log(`✅ Loaded ${transformedAppointments.length} appointments from API`);
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
      const response: any = await transactionsAPI.getAll();
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
        console.log(`✅ Loaded ${transformedTransactions.length} transactions from API`);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      setTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
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

  // Auto-fetch when authenticated and clinic is selected
  useEffect(() => {
    const clinicIdsKey = selectedClinicIds.join(',');

    // Prevent duplicate fetches for the same clinic selection
    if (clinicIdsKey && lastFetchedClinicIds.current === clinicIdsKey) {
      return;
    }

    if (isAuthenticated && selectedClinicIds.length > 0) {
      lastFetchedClinicIds.current = clinicIdsKey;
      fetchClients();
      fetchPets();
      fetchAppointments();
      fetchTransactions();
    }
  }, [isAuthenticated, selectedClinicIds.join(',')]);

  const getClientById = (id: number) => clients.find(c => c.id === id);
  const getPetById = (id: number) => pets.find(p => p.id === id);
  const getClientPets = (clientId: number) => pets.filter(p => p.ownerId === clientId);

  // Update appointment locally for optimistic UI
  const updateAppointmentLocally = (id: number, updater: (appt: Appointment) => Appointment) => {
    setAppointments(prev => prev.map(a => a.id === id ? updater(a) : a));
  };

  const value: DataContextType = {
    clients,
    pets,
    appointments,
    transactions,
    isLoadingClients,
    isLoadingPets,
    isLoadingAppointments,
    isLoadingTransactions,
    refreshClients: fetchClients,
    refreshPets: fetchPets,
    refreshAppointments: fetchAppointments,
    refreshTransactions: fetchTransactions,
    updateAppointmentLocally,
    getClientById,
    getPetById,
    getClientPets,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

