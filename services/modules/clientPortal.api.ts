/**
 * Pet-Owner Portal API Module
 *
 * Client-facing surface. Public discovery/auth endpoints plus ownership-scoped
 * /me/* data. The 'silent' option is used on polling/lookup calls so they don't
 * spam error toasts.
 */

import { get, post, put, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export interface PortalClinic {
  id: string;
  name: string;
  logo: string | null;
  subdomain: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  slogan: string | null;
  currency: string | null;
  countryCode: string | null;
  region: string | null;
  rating: number;
  latitude: number | null;
  longitude: number | null;
  distanceKm?: number;
}

export interface PortalPet {
  id: string;
  clinicId: string;
  ownerId: string;
  name: string;
  species: string;
  breed: string | null;
  gender: string | null;
  dob: string;
  weightValue: number | null;
  weightUnit: string;
  avatarUrl: string | null;
  color: string | null;
  isNeutered: boolean | null;
  isAlive: boolean;
  rfidChipNumber: string | null;
  clinic: { id: string; name: string; logo: string | null } | null;
}

export interface PortalAppointment {
  id: string;
  // True for portal BOOKINGS still awaiting the clinic (id 'booking-<n>').
  isBookingRequest?: boolean;
  clinicId: string;
  petId: string;
  clientId: string;
  scheduledAt: string;
  totalCost: number;
  isPaid: boolean;
  status: string;
  isHouseCall: boolean;
  pet: { id: string; name: string; species: string; avatarUrl: string | null } | null;
  clinic: { id: string; name: string; logo: string | null } | null;
  tasks: Array<{ name: string; category: string; price: number; status: string }>;
}

export interface PortalMessage {
  id: string;
  clientId: string;
  petId: string | null;
  fromOwner: boolean;
  subject: string | null;
  body: string;
  isRead: boolean;
  sentAt: string;
  channel: string;
  clinicId: string | null;
  clinicName: string | null;
}

export interface PortalInvoice {
  appointmentId: string;
  clinicId: string;
  clientId: string;
  petName: string | null;
  scheduledAt: string;
  amount: number;
  currency: string;
  isPaid: boolean;
  status: string;
  clinic: { id: string; name: string; logo: string | null } | null;
}

export interface PortalMyClinic {
  clientId: string;
  clinic: PortalClinic;
}

export interface PortalVisitDetail extends PortalAppointment {
  paymentMethod: string | null;
  isWalkIn: boolean;
  encounterType: string;
  visitType: string | null;
  currency: string;
  clinicPhone: string | null;
  attendingName: string | null;
  tasks: Array<{ id: string; name: string; category: string; price: number; status: string }>;
  events: Array<{ id: string; at: string; label: string; kind: string }>;
}

// A visit rating is write-once: once `rated` is true it is tallied and final.
export interface VisitRating {
  rated: boolean;
  facets: { vet?: number; staff?: number; service?: number; clinic?: number; overall?: number };
  comment: string | null;
  ratedAt: string | null;
}

export interface PortalReminder {
  id: string;
  clinicId: string;
  petId: string | null;
  serviceType: string;
  title: string | null;
  notes: string | null;
  dueAt: string;
  status: 'PENDING' | 'DONE' | 'DISMISSED';
  completedAt: string | null;
  pet: { id: string; name: string; species: string; avatarUrl: string | null } | null;
  clinicName: string | null;
  bookedAppointment: { id: string; scheduledAt: string; status: string } | null;
}

export interface PortalMemory {
  id: string;
  petId: string;
  kind: 'IMAGE' | 'VIDEO';
  url: string;
  caption: string | null;
  takenAt: string | null;
  createdAt: string;
}

export interface PortalPetTransfer {
  id: string;
  petId: string;
  fromClinicId: string;
  toClinicId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  recordShareStatus: 'NONE' | 'REQUESTED' | 'APPROVED' | 'DECLINED';
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
  fromClinic?: { id: string; name: string };
  toClinic?: { id: string; name: string };
}

export interface PortalMemoriesResult {
  memories: PortalMemory[];
  limit: number;
  used: number;
  canAdd: boolean;
  storageReady: boolean;
}


// ---- livestock (VetHubCore Livestock) ----------------------------------
// One portal identity covers pets AND farms — see components/client/usePortalMode.

export interface PortalFarmVisitRequest {
  id: string; reason: string; urgency: 'ROUTINE' | 'SOON' | 'URGENT';
  status: 'REQUESTED' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  preferredDate: string | null; scheduledFor: string | null;
  clinicNotes: string | null; createdAt: string;
}

export interface PortalHoldings {
  petCount: number;
  farmCount: number;
  hasPets: boolean;
  hasFarms: boolean;
  /**
   * 231 — farm mode is the Farmer rung (tier 2+), so holding a farm is no
   * longer enough to enter it. `hasFarms` without this is an upgrade prompt;
   * this without `hasFarms` is an invitation to add one. Neither is an error.
   */
  canUseFarmMode: boolean;
  /**
   * 262 — farm mode is sold at TWO levels, and the UI needs to know which.
   *   'BASIC' — the FREE record book on the Free rung. Herds, money, produce.
   *   'FULL'  — the paid Farmer product. Feeding plans, crops, the vet link.
   *   'NONE'  — no farm anything.
   */
  farmTier: 'NONE' | 'BASIC' | 'FULL';
  /** They threw the "I keep livestock" switch — even if they have no farm yet. */
  optedIn: boolean;
  /** Farms this plan covers. 0 = unlimited. */
  farmLimit: number;
  /** Herds the plan covers. 0 = unlimited. 3 on the free tier. */
  groupLimit: number;
  planName: string | null;
  planTier: number | null;
  suggestedMode: 'PETS' | 'FARM';
}

// ── 262: the FREE farm record book ─────────────────────────────────────────

export const LEDGER_CATEGORIES = {
  EXPENSE: [
    { key: 'FEED', label: 'Feed', unit: 'KG' },
    { key: 'MEDICATION', label: 'Medication', unit: 'DOSE' },
    { key: 'PEST_CONTROL', label: 'Pest control', unit: 'PC' },
    { key: 'LABOUR', label: 'Labour', unit: '' },
    { key: 'TRANSPORT', label: 'Transport', unit: '' },
    { key: 'OTHER_EXPENSE', label: 'Other cost', unit: '' },
    { key: 'LOSS', label: 'Loss', unit: 'HEAD' },
  ],
  INCOME: [
    { key: 'MILK_SALE', label: 'Milk sold', unit: 'L' },
    { key: 'EGG_SALE', label: 'Eggs sold', unit: 'TRAY' },
    { key: 'LIVESTOCK_SALE', label: 'Animals sold', unit: 'HEAD' },
    { key: 'PRODUCE_SALE', label: 'Other produce', unit: 'KG' },
    { key: 'OTHER_INCOME', label: 'Other income', unit: '' },
  ],
} as const;

/** Categories that take a vendor — the agrovet the farmer bought from. */
export const VENDOR_CATEGORIES = ['FEED', 'MEDICATION', 'PEST_CONTROL'];

export interface PortalLedgerEntry {
  id: string;
  farmId: string;
  animalGroupId: string | null;
  animalGroupName: string | null;
  entryDate: string;
  direction: 'INCOME' | 'EXPENSE';
  category: string;
  item: string;
  quantity: number | null;
  unit: string | null;
  amount: number;
  currency: string;
  vendorName: string | null;
  vendorSupplierId: string | null;
  vendorSupplierName: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PortalFarmSummary {
  windowFrom: string | null;
  /** Null on the paid tier — no window at all. */
  windowDays: number | null;
  income: number;
  expense: number;
  /**
   * Money in minus money out over the window. Called `net`, NOT profit — it
   * carries no stock on hand, no depreciation and no unsold produce.
   */
  net: number;
  currency: string;
  byCategory: Array<{
    direction: 'INCOME' | 'EXPENSE';
    category: string;
    amount: number;
    quantity: number | null;
    count: number;
  }>;
  herd: {
    groups: number; headCount: number; females: number;
    males: number; pregnant: number; lactating: number;
  };
  produceQuantity: number;
}

export interface PortalVendor {
  id: string; name: string; category: string | null;
  address: string | null; phone: string | null;
}

/** 231 — a rung on the client ladder. Free (tier 0) is real but not buyable. */
export interface PortalPlan {
  id: string;
  name: string;
  tier: number;
  price: number;
  currency: string;
  billingCycle: string;
  features: string[];
  featureKeys: string[];
  maxFarms: number;
  /** 233 — a FARMER rung (grants `livestock:farms`), not a pet-owner rung. */
  farmPlan: boolean;
  purchasable: boolean;
  billingOptions: Array<{ id: string; cycle: string; price: number; discountPct: number }>;
}

/** 233 — the ladder, plus which half of it this account is being shown. */
export interface PortalPlanList {
  plans: PortalPlan[];
  /** True when the FARMER rungs are included above. */
  farmAccount: boolean;
  /**
   * Whether the client may flip that themselves. False when an admin decided
   * it, when the platform decided it for everyone, or when they already own
   * farms — the portal hides its switch rather than showing a dead one.
   */
  canChooseFarmPlans: boolean;
}

/** What the account is on right now. Never null — no plan means Free. */
export interface PortalPlanState {
  state: 'FREE' | 'ACTIVE';
  featureKeys: string[];
  packageName: string | null;
  tier: number | null;
  expiresAt: string | null;
  maxFarms: number;
  clientId: string | null;
}

export interface PortalFarm {
  id: string;
  name: string;
  farmType: string;
  county: string | null;
  location: string | null;
  sizeAcres: number | null;
  clinic: { id: string; name: string; logo?: string | null } | null;
  headCount: number;
  animalGroupCount: number;
  cropPlotCount: number;
}

export interface PortalAnimalGroup {
  id: string; name: string; species: string; breed: string | null;
  headCount: number; purpose: string | null; housing: string | null;
  /**
   * 262 — herd composition, a SNAPSHOT. Deliberately not reconciled against
   * `headCount`: a farmer who said 7 head and 2 male + 5 female disagrees with
   * themselves the week a calf is born. The UI hints; it never refuses.
   */
  males: number; females: number; adults: number;
  young: number; pregnant: number; lactating: number;
}

export interface PortalCropPlot {
  id: string; name: string; crop: string; sizeAcres: number | null;
  plantedOn: string | null; expectedHarvestOn: string | null;
}

export interface PortalFeedingPlan {
  id: string; name: string; animalGroupName: string | null; feedType: string | null;
  quantityKg: number | null; frequency: string; timesPerDay: number; lastFedAt: string | null;
}

export interface PortalProduceSchedule {
  id: string; produce: string; unit: string; expectedQty: number | null;
  frequency: string; nextDueOn: string | null; sourceName: string | null;
}

export interface PortalProduceRecord {
  id: string; recordedOn: string; quantity: number; unit: string; notes: string | null;
}

export const clientPortalAPI = {
  // ---- public: discovery ---------------------------------------------
  searchClinics: (q: string, options?: RequestOptions): Promise<ApiResponse<{ clinics: PortalClinic[] }>> =>
    get(ENDPOINTS.PORTAL.CLINIC_SEARCH, { params: { q }, silent: true, ...options }),

  nearestClinics: (lat: number, lng: number, options?: RequestOptions): Promise<ApiResponse<{ clinics: PortalClinic[] }>> =>
    get(ENDPOINTS.PORTAL.CLINIC_NEAREST, { params: { lat, lng }, silent: true, ...options }),

  // ---- public: auth --------------------------------------------------
  signup: (
    data: { email: string; password: string; firstName: string; surname: string; secondName?: string; title?: string; phone?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ user: any; tokens: { accessToken: string; refreshToken: string } }>> =>
    post(ENDPOINTS.PORTAL.SIGNUP, data, { showError: true, ...options }),

  acceptInvite: (
    data: { token: string; password?: string; firstName?: string; surname?: string; phone?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ user: any; tokens: { accessToken: string; refreshToken: string } }>> =>
    post(ENDPOINTS.PORTAL.ACCEPT_INVITE, data, { showError: true, ...options }),

  // ---- authenticated CLIENT ------------------------------------------
  myClinics: (options?: RequestOptions): Promise<ApiResponse<{ clinics: PortalMyClinic[] }>> =>
    get(ENDPOINTS.PORTAL.MY_CLINICS, { ...options }),

  joinClinic: (clinicId: string | number, options?: RequestOptions): Promise<ApiResponse<{ clientId: string; linked: boolean; created: boolean }>> =>
    post(ENDPOINTS.PORTAL.JOIN_CLINIC(clinicId), undefined, { showError: true, ...options }),

  pets: (options?: RequestOptions): Promise<ApiResponse<{ pets: PortalPet[] }>> =>
    get(ENDPOINTS.PORTAL.PETS, { ...options }),

  // Global breed catalog (public staff endpoint) — powers the Add-pet breed
  // dropdown, filtered client-side by species name.
  breeds: (options?: RequestOptions): Promise<ApiResponse<{ breeds: Array<{ id: string; name: string; speciesName: string }> }>> =>
    get('/breeds', { silent: true, ...options }),

  createPet: (
    data: { clinicId?: string | number; name: string; species: string; breed?: string; gender?: string; dob: string; weightValue?: number; color?: string; isNeutered?: boolean },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ pet: PortalPet }>> =>
    post(ENDPOINTS.PORTAL.PETS, data, { showError: true, ...options }),

  petRecords: (petId: string | number, options?: RequestOptions): Promise<ApiResponse<{ medical: any[]; vaccinations: any[]; surgeries?: any[] }>> =>
    get(ENDPOINTS.PORTAL.PET_RECORDS(petId), { ...options }),

  appointments: (options?: RequestOptions): Promise<ApiResponse<{ appointments: PortalAppointment[] }>> =>
    get(ENDPOINTS.PORTAL.APPOINTMENTS, { ...options }),

  bookAppointment: (
    data: { petId: string | number; scheduledAt: string; reason?: string; isHouseCall?: boolean },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ appointment: any }>> =>
    post(ENDPOINTS.PORTAL.APPOINTMENTS, data, { showError: true, ...options }),

  messages: (options?: RequestOptions): Promise<ApiResponse<{ messages: PortalMessage[] }>> =>
    get(ENDPOINTS.PORTAL.MESSAGES, { ...options }),

  sendMessage: (
    data: { clinicId: string | number; petId?: string | number; subject?: string; body: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ message: { id: string; sentAt: string } }>> =>
    post(ENDPOINTS.PORTAL.MESSAGES, data, { showError: true, ...options }),

  invoices: (options?: RequestOptions): Promise<ApiResponse<{ invoices: PortalInvoice[] }>> =>
    get(ENDPOINTS.PORTAL.INVOICES, { ...options }),

  payInvoice: (
    appointmentId: string | number,
    data: { provider: 'STRIPE' | 'MPESA' | 'PAYSTACK'; phone?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<any>> =>
    post(ENDPOINTS.PORTAL.INVOICE_PAY(appointmentId), data, { showError: true, ...options }),

  invoiceStatus: (appointmentId: string | number, options?: RequestOptions): Promise<ApiResponse<{ isPaid: boolean; transactionStatus: string | null; method: string | null; settledAt: string | null }>> =>
    get(ENDPOINTS.PORTAL.INVOICE_STATUS(appointmentId), { silent: true, ...options }),

  appointmentDetail: (appointmentId: string | number, options?: RequestOptions): Promise<ApiResponse<{ appointment: PortalVisitDetail }>> =>
    get(ENDPOINTS.PORTAL.APPOINTMENT_DETAIL(appointmentId), { ...options }),

  cancelAppointment: (appointmentId: string | number, options?: RequestOptions): Promise<ApiResponse<{ cancelled: boolean }>> =>
    post(ENDPOINTS.PORTAL.APPOINTMENT_CANCEL(appointmentId), undefined, { showError: true, ...options }),

  requestReschedule: (
    appointmentId: string | number,
    data: { proposedAt?: string; note?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ requested: boolean }>> =>
    post(ENDPOINTS.PORTAL.APPOINTMENT_RESCHEDULE(appointmentId), data, { showError: true, ...options }),

  visitRating: (appointmentId: string | number, options?: RequestOptions): Promise<ApiResponse<{ rating: VisitRating }>> =>
    get(ENDPOINTS.PORTAL.APPOINTMENT_RATING(appointmentId), { silent: true, ...options }),

  // Submit once — the API rejects a second submit for the same visit.
  rateVisit: (
    appointmentId: string | number,
    data: { vet?: number; staff?: number; service?: number; clinic?: number; overall?: number; comment?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ rating: VisitRating }>> =>
    post(ENDPOINTS.PORTAL.APPOINTMENT_RATING(appointmentId), data, { showError: true, ...options }),

  reminders: (options?: RequestOptions): Promise<ApiResponse<{ reminders: PortalReminder[] }>> =>
    get(ENDPOINTS.PORTAL.REMINDERS, { ...options }),

  markMessagesRead: (clinicId?: string | number, options?: RequestOptions): Promise<ApiResponse<{ updated: number }>> =>
    post(ENDPOINTS.PORTAL.MESSAGES_READ, clinicId ? { clinicId } : {}, { silent: true, ...options }),

  requestPetTransfer: (
    petId: string | number,
    data: { clinicId: string | number; note?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ transfer: PortalPetTransfer }>> =>
    post(`/portal/me/pets/${petId}/transfer`, data, { showError: true, ...options }),

  petTransferStatus: (petId: string | number, options?: RequestOptions): Promise<ApiResponse<{ transfer: PortalPetTransfer | null }>> =>
    get(`/portal/me/pets/${petId}/transfer`, { silent: true, cache: false, ...options }),

  cancelPetTransfer: (transferId: string | number, options?: RequestOptions): Promise<ApiResponse<{ cancelled: boolean }>> =>
    post(`/portal/me/transfers/${transferId}/cancel`, undefined, { showError: true, ...options }),

  petMemories: (petId: string | number, options?: RequestOptions): Promise<ApiResponse<PortalMemoriesResult>> =>
    get(ENDPOINTS.PORTAL.PET_MEMORIES(petId), { ...options }),

  /**
   * The client's own profile photo. Two steps like every other upload here:
   * ask for a signed URL, PUT the bytes to storage, then save the public URL.
   */
  avatarUploadUrl: (
    data: { contentType: string; filename?: string; sizeBytes?: number },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ uploadUrl: string; publicUrl: string; key: string }>> =>
    post(ENDPOINTS.PORTAL.AVATAR_UPLOAD_URL, data, { showError: true, ...options }),

  /** Applies to every clinic this account is registered at — one person, one face. */
  updateMyAvatar: (
    avatarUrl: string | null,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ avatarUrl: string | null; updated: number }>> =>
    put(ENDPOINTS.PORTAL.AVATAR, { avatarUrl }, { showError: true, ...options }),

  memoryUploadUrl: (
    petId: string | number,
    data: { contentType: string; filename?: string; sizeBytes?: number },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ uploadUrl: string; publicUrl: string; key: string; kind: 'IMAGE' | 'VIDEO' }>> =>
    post(ENDPOINTS.PORTAL.PET_MEMORY_UPLOAD_URL(petId), data, { showError: true, ...options }),

  addMemory: (
    petId: string | number,
    data: { url: string; key?: string; kind?: 'IMAGE' | 'VIDEO'; caption?: string; takenAt?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ memory: PortalMemory }>> =>
    post(ENDPOINTS.PORTAL.PET_MEMORIES(petId), data, { showError: true, ...options }),

  deleteMemory: (memoryId: string | number, options?: RequestOptions): Promise<ApiResponse<{ deleted: boolean }>> =>
    del(ENDPOINTS.PORTAL.MEMORY(memoryId), { showError: true, ...options }),

  // ---- livestock -------------------------------------------------------
  getHoldings: (options?: RequestOptions): Promise<ApiResponse<PortalHoldings>> =>
    get('/portal/me/holdings', { cache: false, silent: true, ...options }),

  getMyFarms: (options?: RequestOptions): Promise<ApiResponse<{ farms: PortalFarm[] }>> =>
    get('/portal/me/farms', { cache: false, ...options }),

  getFarmDetail: (farmId: string, options?: RequestOptions): Promise<ApiResponse<{ animalGroups: PortalAnimalGroup[]; cropPlots: PortalCropPlot[] }>> =>
    get(`/portal/me/farms/${farmId}`, { cache: false, ...options }),

  getFarmFeeding: (farmId: string, options?: RequestOptions): Promise<ApiResponse<{ plans: PortalFeedingPlan[] }>> =>
    get(`/portal/me/farms/${farmId}/feeding`, { cache: false, ...options }),

  /** Omit quantityKg to log the plan's own ration — one tap in a field. */
  logFeeding: (planId: string, data: { quantityKg?: number; notes?: string } = {}, options?: RequestOptions): Promise<ApiResponse<{ log: { id: string; fedAt: string; quantityKg: number | null } }>> =>
    post(`/portal/me/feeding-plans/${planId}/logs`, data, { showError: true, ...options }),

  getFarmProduce: (farmId: string, options?: RequestOptions): Promise<ApiResponse<{ schedules: PortalProduceSchedule[]; records: PortalProduceRecord[] }>> =>
    get(`/portal/me/farms/${farmId}/produce`, { cache: false, ...options }),

  listVisitRequests: (farmId: string, options?: RequestOptions): Promise<ApiResponse<{ requests: PortalFarmVisitRequest[] }>> =>
    get(`/portal/me/farms/${farmId}/visit-requests`, { cache: false, ...options }),

  requestFarmVisit: (farmId: string, data: { reason: string; urgency?: string; preferredDate?: string; animalGroupId?: string }, options?: RequestOptions): Promise<ApiResponse<{ request: PortalFarmVisitRequest }>> =>
    post(`/portal/me/farms/${farmId}/visit-requests`, data, { showError: true, ...options }),

  /** Owners maintain head count — animals are born, sold and lost between visits. */
  updateHeadCount: (groupId: string, headCount: number, options?: RequestOptions): Promise<ApiResponse<{ group: { id: string; headCount: number } }>> =>
    patch(`/portal/me/animal-groups/${groupId}/head-count`, { headCount }, { showError: true, ...options }),

  recordProduce: (farmId: string, data: { produceScheduleId?: string; quantity: number; unit?: string; recordedOn?: string; notes?: string }, options?: RequestOptions): Promise<ApiResponse<{ record: PortalProduceRecord }>> =>
    post(`/portal/me/farms/${farmId}/produce`, data, { showError: true, ...options }),

  // ── 262: the FREE farm record book ──────────────────────────────────────

  /** The owner declares a herd. Until 262 only a CLINIC could create one. */
  createAnimalGroup: (
    farmId: string,
    data: {
      name: string; species: string; breed?: string; purpose?: string; housing?: string;
      headCount?: number; males?: number; females?: number;
      adults?: number; young?: number; pregnant?: number; lactating?: number;
    },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ group: PortalAnimalGroup }>> =>
    post(`/portal/me/farms/${farmId}/animal-groups`, data, { showError: true, ...options }),

  /** Counts and composition. Breed/housing/purpose stay clinic-maintained. */
  updateAnimalGroup: (
    groupId: string,
    data: Partial<Record<'headCount' | 'males' | 'females' | 'adults' | 'young' | 'pregnant' | 'lactating', number>>,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ group: PortalAnimalGroup }>> =>
    patch(`/portal/me/animal-groups/${groupId}`, data, { showError: true, ...options }),

  getFarmLedger: (
    farmId: string,
    params: { from?: string; direction?: string; animalGroupId?: string; limit?: number } = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<{ entries: PortalLedgerEntry[]; windowFrom: string | null; windowDays: number | null }>> => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
    ).toString();
    return get(`/portal/me/farms/${farmId}/ledger${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },

  /**
   * Record one line — the free tier's entire money model.
   * ⚠️ Do NOT send `direction`; the server derives it from `category`.
   */
  createLedgerEntry: (
    farmId: string,
    data: {
      category: string; item: string; amount: number;
      quantity?: number | null; unit?: string; entryDate?: string;
      animalGroupId?: string; vendorName?: string; vendorSupplierId?: string; notes?: string;
    },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ entry: PortalLedgerEntry }>> =>
    post(`/portal/me/farms/${farmId}/ledger`, data, { showError: true, ...options }),

  updateLedgerEntry: (
    entryId: string,
    data: Partial<{ item: string; amount: number; quantity: number | null; unit: string; entryDate: string; vendorName: string; notes: string }>,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ entry: PortalLedgerEntry }>> =>
    patch(`/portal/me/farm-ledger/${entryId}`, data, { showError: true, ...options }),

  deleteLedgerEntry: (entryId: string, options?: RequestOptions): Promise<ApiResponse<{ deleted: boolean }>> =>
    del(`/portal/me/farm-ledger/${entryId}`, { showError: true, ...options }),

  getFarmSummary: (farmId: string, params: { from?: string } = {}, options?: RequestOptions): Promise<ApiResponse<PortalFarmSummary>> => {
    const qs = params.from ? `?from=${encodeURIComponent(params.from)}` : '';
    return get(`/portal/me/farms/${farmId}/summary${qs}`, { cache: false, ...options });
  },

  /**
   * Type-to-search the agrovet list. READ-ONLY — a name that matches nothing
   * creates no supplier; it is simply kept as text on the record.
   */
  searchFarmVendors: (q: string, options?: RequestOptions): Promise<ApiResponse<{ vendors: PortalVendor[] }>> =>
    get(`/portal/me/farm-vendors?q=${encodeURIComponent(q)}`, { cache: false, silent: true, ...options }),

  /** A farmer adds their own farm — what makes the ladder's farm counts real. */
  createMyFarm: (data: { name: string; farmType?: string; county?: string; location?: string; sizeAcres?: number; notes?: string }, options?: RequestOptions): Promise<ApiResponse<{ farm: PortalFarm }>> =>
    post('/portal/me/farms', data, { showError: true, ...options }),

  // ── the client's own plan (231) ──────────────────────────────────────────
  getMyPlan: (options?: RequestOptions): Promise<ApiResponse<PortalPlanState>> =>
    get('/portal/me/plan', { cache: false, ...options }),

  listPlans: (options?: RequestOptions): Promise<ApiResponse<PortalPlanList>> =>
    get('/portal/me/plans', { cache: false, ...options }),

  /**
   * 233 — declare that this account keeps livestock, revealing the FARMER
   * rungs. Free and reversible; the rungs themselves are what is paid for.
   */
  setFarmAccount: (isFarmer: boolean, options?: RequestOptions): Promise<ApiResponse<PortalPlanList>> =>
    post('/portal/me/farm-account', { isFarmer }, { showError: true, ...options }),

  initiatePlanPayment: (data: { packageId: string; billingOptionId?: string; cycle?: string; phone?: string }, options?: RequestOptions): Promise<ApiResponse<{ attemptId: string; reference: string; authorizationUrl: string }>> =>
    post('/portal/me/plan/initiate', data, { showError: true, ...options }),

  planPaymentStatus: (reference: string, options?: RequestOptions): Promise<ApiResponse<{ status: string; reference: string; resultDesc: string | null }>> =>
    get(`/portal/me/plan/status/${reference}`, { cache: false, silent: true, ...options }),

  cancelMyPlan: (options?: RequestOptions): Promise<ApiResponse<PortalPlanState>> =>
    post('/portal/me/plan/cancel', {}, { showError: true, ...options }),
};

export default clientPortalAPI;