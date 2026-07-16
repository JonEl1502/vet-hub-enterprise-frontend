/**
 * Pet-Owner Portal API Module
 *
 * Client-facing surface. Public discovery/auth endpoints plus ownership-scoped
 * /me/* data. The 'silent' option is used on polling/lookup calls so they don't
 * spam error toasts.
 */

import { get, post, del } from '../api/client';
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
  tasks: Array<{ id: string; name: string; category: string; price: number; status: string }>;
  events: Array<{ id: string; at: string; label: string; kind: string }>;
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

export interface PortalMemoriesResult {
  memories: PortalMemory[];
  limit: number;
  used: number;
  canAdd: boolean;
  storageReady: boolean;
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

  reminders: (options?: RequestOptions): Promise<ApiResponse<{ reminders: PortalReminder[] }>> =>
    get(ENDPOINTS.PORTAL.REMINDERS, { ...options }),

  markMessagesRead: (clinicId?: string | number, options?: RequestOptions): Promise<ApiResponse<{ updated: number }>> =>
    post(ENDPOINTS.PORTAL.MESSAGES_READ, clinicId ? { clinicId } : {}, { silent: true, ...options }),

  petMemories: (petId: string | number, options?: RequestOptions): Promise<ApiResponse<PortalMemoriesResult>> =>
    get(ENDPOINTS.PORTAL.PET_MEMORIES(petId), { ...options }),

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
};

export default clientPortalAPI;
