
import { useState, useEffect, useCallback } from 'react';
import { User, Clinic, Pet, Visit, ApptTask, Transaction, UserRole, ApptStatus, TaskStatus, Referral, ReferralStatus, PaymentMethod, InventoryItem, Client, MedicalRecord, BillingSettings, Message, Supplier, ActivityLog, Handshake, HandshakeStatus } from './types';
import { handshakesAPI } from './services';
import type { Handshake as ApiHandshakeT } from './services/modules/handshakes.api';

export const getTodayDate = () => new Date().toISOString().split('T')[0];

const mockLogs: ActivityLog[] = [
  { id: 1, timestamp: new Date().toLocaleString(), action: 'LOGIN', description: 'Established clinical session node.' },
  { id: 2, timestamp: new Date(Date.now() - 3600000).toLocaleString(), action: 'VISIT_UPDATE', description: 'Finalized medical sequence for Visit #102.' },
  { id: 3, timestamp: new Date(Date.now() - 7200000).toLocaleString(), action: 'INVENTORY_REFILL', description: 'Updated stock levels for Rabies Vax.' },
];

export const mockStaff: User[] = [
  { 
    id: 1, name: "Dr. Maxwell", role: UserRole.VET, email: "max@goldenpaws.com", 
    clinicIds: [101, 103], avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maxwell", 
    customPermissions: ['WRITE_REPORTS', 'VIEW_FINANCE'],
    idNumber: "ID-990812-V", dob: "1988-08-12", age: 36, 
    certifications: ["PhD Veterinary Medicine", "Surgical Specialist", "Radiology Node"],
    activityLogs: [...mockLogs]
  },
  { 
    id: 3, name: "John Reception", role: UserRole.STAFF, email: "john@goldenpaws.com", 
    clinicIds: [101], avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John", 
    customPermissions: ['MANAGE_APPOINTMENTS'],
    idNumber: "ID-850110-S", dob: "1985-01-10", age: 39,
    certifications: ["Front Desk Operations", "Client Protocol"],
    activityLogs: [...mockLogs.slice(0, 1)]
  },
  { 
    id: 4, name: "Mike Groomer", role: UserRole.FREELANCER, email: "mike@grooming.com", 
    clinicIds: [101, 102], avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike", 
    customPermissions: [],
    idNumber: "ID-921122-G", dob: "1992-11-22", age: 32,
    certifications: ["Professional Grooming Level 3"],
    activityLogs: []
  },
  { 
    id: 5, name: "Sarah Tech", role: UserRole.STAFF, email: "sarah@goldenpaws.com", 
    clinicIds: [101, 102, 103], avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah", 
    customPermissions: [],
    idNumber: "ID-950505-T", dob: "1995-05-05", age: 29,
    certifications: ["Veterinary Technician License"],
    activityLogs: [...mockLogs]
  }
];

const mockUsers: User[] = [
  { id: 2, name: "Sarah Owner", role: UserRole.CLINIC_OWNER, email: "sarah@vetbiz.com", clinicIds: [101, 102, 103], avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Owner", customPermissions: ['ALL'] },
  ...mockStaff,
];

const mockClinics: Clinic[] = [
  { id: 101, merchantId: 1, ownerId: 2, name: "Golden Paws Nairobi", subdomain: "goldenpaws", logo: "🐾", slogan: "Gentle Care for Every Paw", colors: { primary: "#1C7A5B", secondary: "#144E35" }, balance: 125000, rating: 4.8, currency: 'KES', currentPlanId: 2 },
  { id: 102, merchantId: 1, ownerId: 2, name: "Westlands Vet Care", subdomain: "westlands", logo: "🏥", slogan: "Excellence in Veterinary Medicine", colors: { primary: "#2EA1B8", secondary: "#144E35" }, balance: 84000, rating: 4.5, currency: 'KES', currentPlanId: 1 },
  { id: 103, merchantId: 1, ownerId: 2, name: "Karen Animal Hospital", subdomain: "karenhospital", logo: "🐕", slogan: "Elite Care Node", colors: { primary: "#6366f1", secondary: "#1e1b4b" }, balance: 210000, rating: 4.9, currency: 'KES', currentPlanId: 2 },
  { id: 201, merchantId: 5, ownerId: 99, name: "Apex Surgical Center", subdomain: "apex", logo: "⚡", slogan: "Precision Surgery", colors: { primary: "#ef4444", secondary: "#450a0a" }, balance: 500000, rating: 4.9, currency: 'KES', currentPlanId: 2 },
  { id: 202, merchantId: 6, ownerId: 98, name: "Coastal Paws Clinic", subdomain: "coastal", logo: "🌊", slogan: "Breezy Recovery", colors: { primary: "#0ea5e9", secondary: "#0c4a6e" }, balance: 12000, rating: 4.2, currency: 'KES', currentPlanId: 1 },
];

const mockHandshakes: Handshake[] = [
  { id: 1, requesterClinicId: 101, receiverClinicId: 102, status: HandshakeStatus.ACCEPTED, allowedServices: ['OPEN'], createdAt: '2024-01-01' },
  { id: 2, requesterClinicId: 101, receiverClinicId: 201, status: HandshakeStatus.ACCEPTED, allowedServices: ['Surgery', 'Laboratory'], createdAt: '2024-02-15' },
  { id: 3, requesterClinicId: 202, receiverClinicId: 101, status: HandshakeStatus.PENDING, allowedServices: ['OPEN'], createdAt: '2024-06-20', note: "Requesting surgical support for high-risk patients." }
];

const mockClients: Client[] = [
  { id: 501, name: "Alice Mwikali", email: "alice@example.com", phone: "+254 700 000000", country: "Kenya", currency: "KES", clinicId: 101, address: "Westlands, Nairobi", joinDate: "2023-01-15", totalSpent: 45000, lastVisit: "2024-06-10", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice", gender: 'Female', region: 'Local', dob: '1992-05-15' },
  { id: 502, name: "David Kimani", email: "david@example.com", phone: "+254 711 111111", country: "Kenya", currency: "KES", clinicId: 101, address: "Kilimani, Nairobi", joinDate: "2023-05-20", totalSpent: 12000, lastVisit: "2024-05-15", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David", gender: 'Male', region: 'Local', dob: '1985-11-22' },
  { id: 503, name: "John Smith", email: "john@exp.com", phone: "+254 799 111222", country: "Kenya", currency: "KES", clinicId: 101, address: "Karen", joinDate: "2024-01-05", totalSpent: 85000, lastVisit: "2024-06-12", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Smith", gender: 'Male', region: 'European', dob: '1978-02-10' }
];

const mockPets: Pet[] = [
  { id: 801, clinicId: 101, ownerId: 501, name: "Simba", species: "Dog", breed: "Rhodesian Ridgeback", gender: 'Male', age: 4, dob: '2020-05-10', weight: "32.40kg", rfidChipNumber: "RF-998811", tagNumber: "GP-NAI-001", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Simba", medicalHistory: [{ id: 1, date: '2024-05-10', appointmentId: 1, clinicId: 101, clinicName: 'Golden Paws Nairobi', diagnosis: 'Seasonal Allergies', treatment: 'Antihistamines prescribed', files: [], sharedWith: [] }], vaccinations: [{ id: 1, vaccineName: 'Rabies Premium', dateAdministered: '2024-01-10', expiryDate: '2025-01-10', clinicName: 'Golden Paws Nairobi', batchNumber: 'RX-99', administeredBy: 'Dr. Maxwell', status: 'ADMINISTERED' }] },
  { id: 802, clinicId: 101, ownerId: 501, name: "Luna", species: "Cat", breed: "Siamese", gender: 'Female', age: 2, dob: '2022-03-15', weight: "4.50kg", rfidChipNumber: "RF-776622", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Luna", medicalHistory: [], vaccinations: [] },
  { id: 803, clinicId: 101, ownerId: 503, name: "Charlie", species: "Dog", breed: "Golden Retriever", gender: 'Male', age: 1, dob: '2023-01-05', weight: "22.15kg", avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Charlie", medicalHistory: [], vaccinations: [] }
];

const mockAppointments: Visit[] = [
  { id: 1, clinicId: 101, petId: 801, clientId: 501, date: getTodayDate() + 'T09:00', status: ApptStatus.SCHEDULED, totalCost: 5000, isPaid: true, paymentMethod: 'M-PESA', tasks: [
    { id: 101, name: 'Check Vital Signs', category: 'Medical', status: TaskStatus.PENDING, assignedStaffId: 1, price: 1500, notes: "Baseline vitals check." },
    { id: 102, name: 'Rabies Booster', category: 'Vaccination', status: TaskStatus.PENDING, assignedStaffId: 1, price: 3500 }
  ] },
];

const mockTransactions: Transaction[] = [
  { id: 1, fromId: 501, toId: 101, amount: 5000, currency: 'KES', type: 'SERVICE', status: 'SETTLED', method: 'M-PESA', date: getTodayDate() },
];

const mockSuppliers: Supplier[] = [
  { id: 1, name: "VetMed Global Supplies", category: "Pharmaceuticals", contact: "+254 788 123456", email: "sales@vetmedglobal.com", rating: 4.9, preferredByClinics: [101] },
];

const mockInventory: InventoryItem[] = [
  { id: 1, clinicId: 101, name: 'Rabies Vax', category: 'Vaccines', sku: 'VAX-001', batchNumber: 'B12-2024', quantity: 45, minThreshold: 10, unit: 'Vials', price: 2000, costPrice: 1200, expiryDate: '2025-10-10', status: 'IN_STOCK', incomingQty: 100, supplierId: 1, batchHistory: [{ id: 1, batchNumber: 'B12-2024', supplierId: 1, receivedDate: '2024-01-10', expiryDate: '2025-10-10', quantityReceived: 50, costPrice: 1200 }] }
];

export function useStore() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>(mockClinics);
  const [activeClinicIds, setActiveClinicIds] = useState<number[]>([mockClinics[0].id]);
  const [allStaff, setAllStaff] = useState<User[]>(mockUsers);
  const [appointments, setAppointments] = useState<Visit[]>(mockAppointments);
  const [pets, setPets] = useState<Pet[]>(mockPets);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  const [handshakes, setHandshakes] = useState<Handshake[]>([]);
  const [billingSettings, setBillingSettings] = useState<BillingSettings>({
    subscriptionPackages: [
      { id: 1, name: 'Core Node', price: 5000, billingCycle: 'MONTHLY', features: ['PATIENTS_UNLIMITED'], limits: { patients: 500, staff: 5, storageGb: 10 }, isActive: true },
      { id: 2, name: 'Enterprise Cluster', price: 15000, billingCycle: 'MONTHLY', features: ['B2B_REFERRALS', 'AI_DIAGNOSTICS'], limits: { patients: 5000, staff: 25, storageGb: 100 }, isActive: true }
    ],
    taxRate: 16,
    allowPartialPayments: false,
    autoInvoiceGeneration: true
  });

  const login = (email: string) => { 
    setCurrentUser(allStaff[0]); 
    setIsAuthenticated(true); 
    return true; 
  };

  const updateTaskStatus = (apptId: number, taskId: number, status: TaskStatus) => {
    setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, tasks: a.tasks.map(t => t.id === taskId ? { ...t, status } : t) } : a));
  };

  const updateTaskDetails = (apptId: number, taskId: number, data: Partial<ApptTask>) => {
    setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, tasks: a.tasks.map(t => t.id === taskId ? { ...t, ...data } : t) } : a));
  };

  // Local state update only - backend handles all business logic
  // (medical records, medication deduction, vaccination records)
  const updateAppointmentStatus = (id: number, status: ApptStatus, _diagnosis?: string) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const processPayment = (apptId: number, method: string) => {
    setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, isPaid: true, paymentMethod: method } : a));
  };

  const addTransaction = (from: number, to: number, amount: number, type: any, method: any) => {
    setTransactions(prev => [...prev, { id: Math.floor(Math.random() * 10000), fromId: from, toId: to, amount, currency: 'KES', type, method, status: 'SETTLED', date: getTodayDate() }]);
  };

  const injectTask = (apptId: number, task: any) => setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, tasks: [...a.tasks, task], totalCost: a.totalCost + (task.price || 0) } : a));
  const reassignTask = (apptId: number, taskId: number, staffId: number) => setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, tasks: a.tasks.map(t => t.id === taskId ? { ...t, assignedStaffId: staffId } : t) } : a));
  const addPet = (p: any) => { const n = { ...p, id: Math.floor(Math.random()*10000), medicalHistory: [], vaccinations: [] }; setPets(prev => [...prev, n]); return n; };
  const addClient = (c: any) => { const n = { ...c, id: Math.floor(Math.random()*10000), joinDate: getTodayDate(), totalSpent: 0 }; setClients(prev => [...prev, n]); return n; };
  const addAppointment = (a: any) => { const n = { ...a, id: Math.floor(Math.random()*10000), status: ApptStatus.SCHEDULED }; setAppointments(prev => [...prev, n]); return n; };
  const updateClinic = (id: number, data: any) => setClinics(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  const updateStaff = (id: number, data: any) => setAllStaff(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  const addStaff = (data: any) => { 
    const n = { 
      ...data, 
      id: Math.floor(Math.random() * 10000),
      activityLogs: [{ id: 1, timestamp: new Date().toLocaleString(), action: 'ACCOUNT_CREATED', description: 'Staff node initialized in registry.' }]
    }; 
    setAllStaff(prev => [...prev, n]); 
    return n; 
  };
  const recordMessage = (msg: any) => setMessages(prev => [{ ...msg, id: Math.floor(Math.random()*10000), date: new Date().toLocaleString(), senderName: currentUser?.name || 'System' }, ...prev]);
  const toggleClinicSelection = (id: number) => {
    setActiveClinicIds(prev => prev.includes(id) ? (prev.length === 1 ? prev : prev.filter(x => x !== id)) : [...prev, id]);
  };
  const updateInventoryItem = (id: number, data: Partial<InventoryItem>) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  };
  const addReferral = (ref: Omit<Referral, 'id' | 'date' | 'status'>) => {
    const n: Referral = { ...ref, id: Math.floor(Math.random() * 10000), date: getTodayDate(), status: ReferralStatus.REQUESTED };
    setReferrals(prev => [...prev, n]);
    return n;
  };

  // ---- Handshakes (API-backed) ----
  const mapApiHandshake = (h: ApiHandshakeT): Handshake => ({
    id: h.id,
    requesterClinicId: h.requesterClinicId,
    receiverClinicId: h.receiverClinicId,
    status: h.status as HandshakeStatus,
    allowedServices: h.allowedServices || [],
    note: h.note ?? undefined,
    createdAt: typeof h.createdAt === 'string' ? h.createdAt : new Date(h.createdAt as any).toISOString(),
    requesterClinic: h.requesterClinic ? { id: h.requesterClinic.id, name: h.requesterClinic.name, logo: h.requesterClinic.logo ?? undefined, subdomain: h.requesterClinic.subdomain ?? undefined, specialties: h.requesterClinic.specialties || [] } : undefined,
    receiverClinic: h.receiverClinic ? { id: h.receiverClinic.id, name: h.receiverClinic.name, logo: h.receiverClinic.logo ?? undefined, subdomain: h.receiverClinic.subdomain ?? undefined, specialties: h.receiverClinic.specialties || [] } : undefined,
  });

  const refreshHandshakes = useCallback(async () => {
    try {
      const res = await handshakesAPI.getAll();
      if (res.success && res.data) {
        const merged = [
          ...(res.data.sent || []).map(mapApiHandshake),
          ...(res.data.received || []).map(mapApiHandshake),
        ];
        // De-dupe in case the same record appears in both arrays (shouldn't, but safe)
        const seen = new Set<string>();
        const deduped = merged.filter(h => {
          const k = String(h.id);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setHandshakes(deduped);
      }
    } catch (e) {
      // Network/API error — keep existing state, UI shows whatever was loaded last.
    }
  }, []);

  // Auto-load handshakes whenever the active clinic changes (X-Clinic-Id header is set from activeClinicIds).
  useEffect(() => {
    if (!isAuthenticated) return;
    refreshHandshakes();
  }, [isAuthenticated, activeClinicIds, refreshHandshakes]);

  const addHandshake = async (h: Omit<Handshake, 'id' | 'createdAt'>): Promise<Handshake | null> => {
    try {
      const res = await handshakesAPI.create({
        receiverClinicId: h.receiverClinicId as any,
        allowedServices: h.allowedServices,
        note: h.note,
      });
      if (res.success && res.data?.handshake) {
        const mapped = mapApiHandshake(res.data.handshake);
        setHandshakes(prev => [mapped, ...prev]);
        // Refresh to pick up the receiver-side mirror + populated clinic refs
        refreshHandshakes();
        return mapped;
      }
    } catch {
      // Surface via toast/showError (already enabled on the API call)
    }
    return null;
  };

  const updateHandshakeStatus = async (id: number | string, status: HandshakeStatus) => {
    // Optimistic update
    setHandshakes(prev => prev.map(h => String(h.id) === String(id) ? { ...h, status } : h));
    try {
      if (status === HandshakeStatus.ACCEPTED) {
        await handshakesAPI.accept(id);
      } else if (status === HandshakeStatus.DECLINED) {
        await handshakesAPI.reject(id);
      } else {
        await handshakesAPI.update(id, { status: status as any });
      }
      refreshHandshakes();
    } catch {
      // Revert on failure
      refreshHandshakes();
    }
  };

  const deleteHandshake = async (id: number | string) => {
    setHandshakes(prev => prev.filter(h => String(h.id) !== String(id)));
    try {
      await handshakesAPI.delete(id);
    } catch {
      refreshHandshakes();
    }
  };

  return {
    isAuthenticated, currentUser, clinics, activeClinicIds, allStaff, appointments, pets, clients, referrals, transactions, inventory, billingSettings, messages, suppliers, handshakes,
    login, updateClinic, addPet, addClient, addAppointment, toggleClinicSelection, updateTaskStatus, updateAppointmentStatus,
    reassignTask, addTransaction, updateStaff, addStaff, injectTask, processPayment, recordMessage, updateInventoryItem, updateTaskDetails, addReferral, addHandshake, updateHandshakeStatus, deleteHandshake, refreshHandshakes,
    setSuppliers,
  };
}
