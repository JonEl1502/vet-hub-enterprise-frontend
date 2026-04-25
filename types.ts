
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MERCHANT_ADMIN = 'MERCHANT_ADMIN',
  CLINIC_OWNER = 'CLINIC_OWNER',
  VET = 'VET',
  STAFF = 'STAFF',
  FREELANCER = 'FREELANCER',
  CLIENT = 'CLIENT',
  SUPPLIER = 'SUPPLIER'
}

// Permission IDs stored in User.customPermissions
// Grant these to VET/STAFF/FREELANCER to unlock specific views
export const Permission = {
  VIEW_DASHBOARD:     'VIEW_DASHBOARD',
  VIEW_INVENTORY:     'VIEW_INVENTORY',
  VIEW_PURCHASE_ORDERS: 'VIEW_PURCHASE_ORDERS',
  VIEW_REFERRALS:     'VIEW_REFERRALS',
  VIEW_FINANCE:       'VIEW_FINANCE',
  VIEW_CLINIC_MGMT:   'VIEW_CLINIC_MGMT',
  VIEW_SUPPLIERS:     'VIEW_SUPPLIERS',
} as const;

export type PermissionId = typeof Permission[keyof typeof Permission];

// Roles that have full clinic-level access without needing explicit permissions
export const FULL_ACCESS_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.MERCHANT_ADMIN,
  UserRole.CLINIC_OWNER,
];

// Roles that are restricted by default (only Appointments / Clients / Patients)
export const RESTRICTED_ROLES: UserRole[] = [
  UserRole.VET,
  UserRole.STAFF,
  UserRole.FREELANCER,
];

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED'
}

export enum ApptStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CANCELLED = 'CANCELLED'
}

export enum ReferralStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  COMPLETED = 'COMPLETED',
  DISPUTED = 'DISPUTED'
}

export enum HandshakeStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED'
}

export interface ActivityLog {
  id: number;
  timestamp: string;
  action: string;
  description: string;
}

export interface User {
  id: number;
  title?: string;
  firstName: string;
  secondName?: string;
  surname: string;
  name: string; // computed: title + firstName + secondName + surname
  role: UserRole;
  email: string;
  clinicIds: number[];
  avatar: string;
  customPermissions: string[];
  idNumber?: string;
  dob?: string;
  age?: number;
  certifications?: string[];
  activityLogs?: ActivityLog[];
  supplier?: {
    id: string;
    name: string;
    category?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    rating: number;
    isActive: boolean;
  };
}

export type ClinicStatus = 'ACTIVE' | 'SUSPENDED' | 'DEMO' | 'PENDING';

export interface Clinic {
  id: number;
  merchantId: number;
  ownerId: number;
  name: string;
  subdomain: string;
  logo: string;
  slogan: string;
  colors: {
    primary: string;
    secondary: string;
  };
  balance: number;
  rating: number;
  currency: string;
  currentPlanId: number;
  parentClinicId?: string | null;
  isMain?: boolean;
  specialties?: string[];
  status?: ClinicStatus;
  isDemo?: boolean;
  createdAt?: string;
  aiConfig?: {
    provider: 'gemini' | 'openai' | 'fallback';
    apiKey?: string;
    model?: string;
  };
}

export interface HandshakeClinicRef {
  id: string | number;
  name: string;
  logo?: string | null;
  subdomain?: string | null;
}

export interface Handshake {
  id: number | string;
  requesterClinicId: number | string;
  receiverClinicId: number | string;
  status: HandshakeStatus;
  allowedServices: string[]; // ['OPEN'] or list of service IDs/Names
  createdAt: string;
  note?: string;
  // Populated by API responses; optional so legacy mock data still type-checks.
  requesterClinic?: HandshakeClinicRef;
  receiverClinic?: HandshakeClinicRef;
}

export interface Referral {
  id: number;
  originClinicId: number;
  originClinicName: string;
  destClinicId: number;
  destClinicName: string;
  petId: number;
  petName: string;
  serviceName: string;
  payoutAmount: number;
  currency: string;
  date: string;
  status: ReferralStatus;
  appointmentTaskId?: number;
}

export type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED';

export interface BatchHistory {
  id: number;
  batchNumber: string;
  supplierId: number;
  receivedDate: string;
  expiryDate: string;
  quantityReceived: number;
  costPrice: number;
}

export interface InventoryItem {
  id: number;
  clinicId: number;
  name: string;
  category: string;
  sku: string;
  batchNumber: string;
  quantity: number;
  minThreshold: number;
  unit: string;
  price: number;
  costPrice: number;
  expiryDate: string;
  status: InventoryStatus;
  incomingQty?: number;
  supplierId?: number;
  batchHistory?: BatchHistory[];
}

export interface Entity {
  id: number;
  title?: string;
  firstName: string;
  secondName?: string;
  surname: string;
  name: string; // computed: title + firstName + secondName + surname
  email: string;
  phone: string;
  country: string;
  currency: string;
}

export type ClientRegion =
  | 'Local' | 'African' | 'European' | 'North American' | 'South American'
  | 'Australian' | 'Arabic' | 'East Asian' | 'Southeast Asian' | 'Indian/Pakistani/Bangladeshi';

export type ClientType = 'HIGH_VALUE' | 'VERY_HIGH_VALUE' | 'VALUED' | 'RISKY' | 'VERY_RISKY';

export interface Client extends Entity {
  clinicId: number;
  title?: string;
  firstName: string;
  secondName?: string;
  surname: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  country?: string;
  currency?: string;
  gender: 'Male' | 'Female' | 'Other';
  region: ClientRegion;
  dob?: string;
  avatarUrl?: string;
  avatar?: string;       // computed from avatarUrl in DataContext
  totalSpent: number;
  lastVisitAt?: string;
  joinedAt?: string;
  joinDate?: string;     // computed from joinedAt in DataContext
  lat?: number;
  lng?: number;
  clientType?: ClientType;
  clientTypeNote?: string;
  maxDebt?: number;
  clientRiskRate?: number;
  internalNotes?: string | null;
  pets?: Pet[];
  appointmentCount?: number;
  petCount?: number;
}

export type DiscountType = 'PERCENTAGE' | 'FIXED';

export interface ClientDiscount {
  id: number;
  clientId: number;
  clinicId: number;
  name: string;
  discountType: DiscountType;
  value: number;
  expiresAt: string;
  isRedeemed: boolean;
  redeemedAt?: string;
  redeemedInAppointmentId?: number;
  createdBy: number;
  creatorName?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  clientId: number;
  petId?: number;
  subject: string;
  body: string;
  channel: 'whatsapp' | 'email' | 'sms';
  date: string;
  senderName: string;
}

export interface Supplier {
  id: number;
  name: string;
  category: string;
  contact: string;
  email: string;
  rating: number;
  preferredByClinics: number[];
}

export interface Pet {
  id: number;
  clinicId: number;
  ownerId: number;
  name: string;
  species: string;
  breed: string;
  gender: 'Male' | 'Female';
  age: number;
  dob: string;
  weight: string;
  rfidChipNumber?: string;
  tagNumber?: string;
  medicalHistory: MedicalRecord[];
  vaccinations: VaccinationRecord[];
  avatar?: string;
  pendingVaccines?: VaccinationRecord[];
  medicalNotes?: string[];
  likes?: string[];
  dislikes?: string[];
  preferences?: string[];
  appointmentCount?: number;
  medicalRecordCount?: number;
  vaccinationCount?: number;
}

export interface VaccinationRecord {
  id: number;
  vaccineName: string;
  dateAdministered?: string;
  expiryDate: string;
  clinicName: string;
  batchNumber?: string;
  administeredBy?: string;
  status: 'SCHEDULED' | 'ADMINISTERED' | 'EXPIRED';
  appointmentId?: number;
}

export interface MedicalRecord {
  id: number;
  date: string;
  appointmentId?: number;
  clinicId: number;
  clinicName: string;
  diagnosis: string;
  treatment: string;
  medications?: string[];
  files: string[];
  sharedWith: number[];
  originReferralId?: number;
  serviceNotes?: string[];
}

export interface TaskMedication {
  inventoryItemId: string;
  inventoryItem?: {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    unit?: string;
    availableQuantity?: number;
    unitPrice?: number;
  };
  quantity: number;
  notes?: string;
  batchNumber?: string;
  expiryDate?: string;
  isDeducted?: boolean;
}

export interface ApptTask {
  id: number;
  name: string;
  category: string;
  assignedStaffId: number;
  status: TaskStatus;
  completedAt?: string;
  price?: number;
  referralId?: number;
  notes?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  selectedPhrases?: string[];
  medications?: TaskMedication[];
}

export interface AppointmentMedicationRecord {
  id: string;
  appointmentId: string;
  taskId: string | null;
  inventoryItemId: string;
  quantity: number;
  unitPrice: number;
  batchNumber: string | null;
  expiryDate: string | null;
  notes: string | null;
  isDeducted: boolean;
  createdAt: string;
  inventoryItem: {
    id: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    quantity: number;
  } | null;
  task: {
    id: string;
    name: string;
    category: string;
  } | null;
}

export interface Appointment {
  id: number;
  clinicId: number;
  petId: number;
  clientId: number;
  date: string;
  status: ApptStatus;
  tasks: ApptTask[];
  totalCost: number;
  isPaid: boolean;
  paymentMethod?: string;
  isHouseCall?: boolean;
  parentAppointmentId?: number;
  originReferralId?: number;
  time?: string;
  notes?: string;
  assignedStaff?: { id: number; name: string };
  leadStaffId?: number;
  leadStaff?: { id: number; name: string; role: string };
  // Optional client and pet information from backend
  client?: {
    id: number;
    name: string;
    phone: string;
    email: string;
  };
  pet?: {
    id: number;
    name: string;
    species: string;
    breed: string;
  };
  medications?: AppointmentMedicationRecord[];
  transactionId?: string | null;
  receiptNumber?: string | null;
}

export type PaymentMethod = 'M-PESA' | 'CARD' | 'CASH' | 'BANK_TRANSFER';

export interface Transaction {
  id: number;
  fromId: number;
  toId: number;
  amount: number;
  currency: string;
  type: 'SERVICE' | 'REFERRAL' | 'FREELANCER' | 'SUBSCRIPTION' | 'SUPPLIER' | 'ADVERTISING' | 'LOGISTICS';
  status: 'PENDING' | 'SETTLED' | 'DISPUTED';
  method: PaymentMethod;
  date: string;
}

export enum SubscriptionTier {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE'
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  TRIAL = 'TRIAL',
  PAST_DUE = 'PAST_DUE'
}

export interface SubscriptionPackage {
  id: number;
  name: string;
  tier: SubscriptionTier;
  price: number;
  yearlyPrice?: number; // Discounted yearly price
  billingCycle: 'MONTHLY' | 'YEARLY';
  features: string[];
  limits: {
    patients: number;
    staff: number;
    storageGb: number;
    clinics?: number; // For multi-location
  };
  isActive: boolean;
  isPopular?: boolean;
  description?: string;
}

export interface ClinicSubscription {
  id: number;
  clinicId: number;
  packageId: number;
  package: SubscriptionPackage;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  trialEndsAt?: string;
  cancelledAt?: string;
}

export interface BillingSettings {
  subscriptionPackages: SubscriptionPackage[];
  taxRate: number;
  allowPartialPayments: boolean;
  autoInvoiceGeneration: boolean;
}

export enum SupplierVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED'
}

export interface SupplierRegistrationData {
  // Company Information
  companyName: string;
  category: string;
  registrationNumber?: string;
  taxId?: string;

  // Contact Information
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  country: string;
  website?: string;

  // User Account
  userName: string;
  userEmail: string;
  userPassword: string;

  // Business Details
  description?: string;
  yearsInBusiness?: number;
  certifications?: string[];

  // Verification
  verificationStatus?: SupplierVerificationStatus;
  documents?: File[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
}

export interface PredefinedService {
  id: string;
  categoryId: string;
  name: string;
  basePrice: number;
}
