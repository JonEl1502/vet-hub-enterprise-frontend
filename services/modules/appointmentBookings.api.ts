import { get, post, patch, del } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'CONVERTED' | 'RESCHEDULED' | 'CANCELLED' | 'NO_SHOW';
export type AppointmentSource = 'FRONT_DESK' | 'PHONE' | 'REMINDER' | 'WEBSITE_API' | 'PORTAL';

export interface StagedItem { categoryId?: string; serviceId?: string; name: string; price?: number; assignedStaffId?: string }

/** The NEW booking entity (table appointment_bookings) — distinct from a Visit. */
export interface Appointment {
  id: string;
  clinicId: string;
  clientId: string;
  petId: string;
  scheduledAt: string;
  status: AppointmentStatus;
  encounterType: string;
  note: string | null;
  leadStaffId: string | null;
  stagedItems: StagedItem[];
  source: AppointmentSource;
  sourceDetail: string | null;
  originReminderId: string | null;
  convertedVisitId: string | null;
  createdAt: string;
  updatedAt: string;
}

const BASE = '/appointment-bookings';

export const appointmentsAPI = {
  list: (params: { petId?: string | number; status?: string } = {}, options?: RequestOptions): Promise<ApiResponse<{ appointments: Appointment[] }>> => {
    const q = new URLSearchParams();
    if (params.petId != null) q.set('petId', String(params.petId));
    if (params.status) q.set('status', params.status);
    const qs = q.toString();
    return get(`${BASE}${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },
  getById: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ appointment: Appointment }>> =>
    get(`${BASE}/${id}`, { cache: false, ...options }),
  create: (data: Partial<Appointment> & { clientId: string | number; petId: string | number; scheduledAt: string }, options?: RequestOptions): Promise<ApiResponse<{ appointment: Appointment }>> =>
    post(BASE, data, { showError: true, ...options }),
  update: (id: string | number, data: Partial<Appointment>, options?: RequestOptions): Promise<ApiResponse<{ appointment: Appointment }>> =>
    patch(`${BASE}/${id}`, data, { showError: true, ...options }),
  remove: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(`${BASE}/${id}`, { showError: true, ...options }),
};
