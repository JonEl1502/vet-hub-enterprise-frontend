/**
 * Pet-Owner Portal API Module
 *
 * Client-facing surface. Public discovery/auth endpoints plus ownership-scoped
 * /me/* data. The 'silent' option is used on polling/lookup calls so they don't
 * spam error toasts.
 */

import { get, post } from '../api/client';
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

  petRecords: (petId: string | number, options?: RequestOptions): Promise<ApiResponse<{ medical: any[]; vaccinations: any[] }>> =>
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
    data: { provider: 'STRIPE' | 'MPESA'; phone?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<any>> =>
    post(ENDPOINTS.PORTAL.INVOICE_PAY(appointmentId), data, { showError: true, ...options }),

  invoiceStatus: (appointmentId: string | number, options?: RequestOptions): Promise<ApiResponse<{ isPaid: boolean; transactionStatus: string | null; method: string | null; settledAt: string | null }>> =>
    get(ENDPOINTS.PORTAL.INVOICE_STATUS(appointmentId), { silent: true, ...options }),
};

export default clientPortalAPI;
