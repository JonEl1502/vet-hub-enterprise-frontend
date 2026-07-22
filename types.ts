
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MERCHANT_ADMIN = 'MERCHANT_ADMIN',
  CLINIC_OWNER = 'CLINIC_OWNER',
  CLINIC_MANAGER = 'CLINIC_MANAGER',
  CLINIC_VIEWER = 'CLINIC_VIEWER',
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

// Roles that have full clinic-level access without needing explicit permissions.
// CLINIC_MANAGER inherits the same default surface as CLINIC_OWNER — the
// owner-only actions (subscription, ownership transfer, role promotion to
// owner/manager, financial reports without canViewFinancials) are gated
// elsewhere by checking the specific role string.
export const FULL_ACCESS_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.MERCHANT_ADMIN,
  UserRole.CLINIC_OWNER,
  UserRole.CLINIC_MANAGER,
];

// Roles that are restricted by default (only Visits / Clients / Patients)
export const RESTRICTED_ROLES: UserRole[] = [
  UserRole.VET,
  UserRole.STAFF,
  UserRole.FREELANCER,
  UserRole.CLINIC_VIEWER,
];

// Roles the owner can pick when inviting someone to run a clinic.
// FREELANCER is intentionally excluded — that's a standalone profile
// (cross-clinic moonlighter), not a per-clinic invite target.
export const CLINIC_INVITE_ROLES: UserRole[] = [
  UserRole.CLINIC_MANAGER,
  UserRole.VET,
  UserRole.STAFF,
  UserRole.CLINIC_VIEWER,
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
  isActive?: boolean;
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
  latitude?: number | null;
  longitude?: number | null;
  countryCode?: string | null;
  dialCode?: string | null;
  region?: 'AFRICA' | 'ASIA' | 'LATAM' | 'MIDDLE_EAST' | 'EUROPE' | 'OCEANIA' | 'NORTH_AMERICA' | null;
  city?: string | null;
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
  specialties?: string[];
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
  manufacturer?: string | null;
  imageUrl?: string | null;
  countryOfOrigin?: string | null;
  storageConditions?: string | null;
  prescriptionOnly?: boolean;
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
  clinicName?: string | null;
  // Pet-owner portal account state (backend-computed; 30-day login window).
  portalStatus?: 'none' | 'active' | 'dormant';
  portalLastLoginAt?: string | null;
  // Sum of finalized unpaid visits (backend aggregate on the list payload).
  outstandingBalance?: number;
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
  // Walk-in completeness (migration 045)
  profileStatus?: 'COMPLETE' | 'NEEDS_UPDATE';
  pendingFields?: string[];
  isActive?: boolean;
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
  clinicName?: string | null;
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
  color?: string | null;
  markings?: string | null;
  isNeutered?: boolean | null;
  passportPhotoUrl?: string | null;
  isAlive?: boolean;
  dateOfDeath?: string | null;
  medicalHistory: MedicalRecord[];
  vaccinations: VaccinationRecord[];
  avatar?: string;
  pendingVaccines?: VaccinationRecord[];
  medicalNotes?: string[];
  allergies?: string[];
  chronicConditions?: string[];
  profileStatus?: 'COMPLETE' | 'NEEDS_UPDATE';
  pendingFields?: string[];
  likes?: string[];
  dislikes?: string[];
  preferences?: string[];
  behaviourTraits?: string[];
  healthAlerts?: string[];
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

export type TaskAttachmentKind = 'XRAY' | 'MRI' | 'ULTRASOUND' | 'PHOTO' | 'LAB' | 'DOC' | 'OTHER';

export interface TaskAttachment {
  url: string;
  key?: string | null;
  kind: TaskAttachmentKind;
  contentType?: string | null;
  sizeBytes?: number | null;
  label?: string | null;
  createdAt: string;
  createdBy?: string | null;
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
  attachments?: TaskAttachment[];
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

// Service line for an appointment/encounter. MUST match the backend enum
// (migration 041) — these exact strings are sent to and stored by the API.
export type EncounterType = 'VET_VISIT' | 'GROOMING' | 'BOARDING' | 'RETAIL' | 'VACCINATION';
// Clinical sub-type, only meaningful for VET_VISIT encounters. Migration 077
// added VACCINATION (vaccination is now a vet-visit sub-type, not a top-level
// encounter) and ROUTINE_CHECK. INPATIENT is kept for legacy rows only —
// hospitalization is an escalation toggle on a vet visit, not a visit type.
export type VisitType = 'ROUTINE' | 'ROUTINE_CHECK' | 'CONSULTATION' | 'VACCINATION' | 'DEWORMING' | 'EMERGENCY' | 'FOLLOW_UP' | 'INPATIENT';

// Human labels + icons keyed by encounter type (UI display).
// Exactly THREE top-level encounter types (migration 077 restructure):
// vaccination lives inside Vet Visit as a visit type now. The VACCINATION and
// RETAIL enum values are kept for back-compat with existing rows only.
export const ENCOUNTER_TYPES: { value: EncounterType; label: string; icon: string }[] = [
  { value: 'VET_VISIT', label: 'Vet Visit', icon: '🩺' },
  { value: 'GROOMING', label: 'Grooming', icon: '✂️' },
  { value: 'BOARDING', label: 'Boarding', icon: '🏠' },
];

// The Vet Visit "Visit Type" dropdown (migration 077 restructure).
// Hospitalization/Inpatient is deliberately NOT here — it's the inpatient
// escalation toggle within the vet-visit workflow. Walk-in is an arrival-mode
// toggle, not a visit type.
export const VISIT_TYPES: { value: VisitType; label: string; icon: string }[] = [
  { value: 'VACCINATION', label: 'Vaccination', icon: '💉' },
  { value: 'DEWORMING', label: 'Deworming', icon: '🪱' },
  // Trimmed 2026-07-18 (user: only the four below stay pickable). Enum values
  // remain valid for legacy rows — these are just hidden from pickers.
  // { value: 'ROUTINE', label: 'Routine Consultation', icon: '🩺' },
  // { value: 'ROUTINE_CHECK', label: 'Routine Check', icon: '✅' },
  { value: 'CONSULTATION', label: 'Consultation', icon: '💬' },
  { value: 'EMERGENCY', label: 'Emergency', icon: '🚨' },
  { value: 'FOLLOW_UP', label: 'Follow-up', icon: '🔁' },
];

// Grooming intake + report card (migration 044), only used for GROOMING.
export interface GroomingDetail {
  temperament?: string;
  vaccinationStatus?: string;
  specialInstructions?: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
  groomerNotes?: string;
}

export interface Visit {
  id: number;
  clinicId: number;
  petId: number;
  clientId: number;
  date: string;
  status: ApptStatus;
  encounterType?: EncounterType;
  visitType?: VisitType | null;
  groomingDetail?: GroomingDetail;
  // Reverse links to the program record this appointment anchors.
  boardingStayId?: string | null;
  hospitalizationId?: string | null;
  tasks: ApptTask[];
  totalCost: number;
  isPaid: boolean;
  paymentMethod?: string;
  isHouseCall?: boolean;
  isWalkIn?: boolean;
  // Group visit (077): sibling visits created in one multi-patient
  // registration share this ref. Billing stays per-visit.
  groupVisitId?: string | null;
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
