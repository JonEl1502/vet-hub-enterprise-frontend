
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
  name: string;
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
  aiConfig?: {
    provider: 'gemini' | 'openai' | 'fallback';
    apiKey?: string;
    model?: string;
  };
}

export interface Handshake {
  id: number;
  requesterClinicId: number;
  receiverClinicId: number;
  status: HandshakeStatus;
  allowedServices: string[]; // ['OPEN'] or list of service IDs/Names
  createdAt: string;
  note?: string;
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
  name: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
}

export type ClientRegion = 
  | 'Local' | 'African' | 'European' | 'North American' | 'South American' 
  | 'Australian' | 'Arabic' | 'East Asian' | 'Southeast Asian' | 'Indian/Pakistani/Bangladeshi';

export interface Client extends Entity {
  clinicId: number;
  address: string;
  joinDate: string;
  avatar?: string;
  totalSpent: number;
  lastVisit?: string;
  gender: 'Male' | 'Female' | 'Other';
  region: ClientRegion;
  dob: string;
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
