import { get, post, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

// ─── Types ────────────────────────────────────────────────────────
export type ReminderServiceType =
  | 'VACCINATION' | 'DEWORMING' | 'GROOMING' | 'FOLLOW_UP'
  | 'MEDICATION' | 'FEEDING' | 'CHECKUP' | 'OTHER';

export type ReminderStatus = 'PENDING' | 'DONE' | 'DISMISSED';

export interface Reminder {
  id: string;
  clinicId: string;
  petId: string;
  clientId: string;
  originAppointmentId: string | null;
  bookedAppointmentId: string | null;
  serviceType: ReminderServiceType;
  title: string | null;
  notes: string | null;
  dueAt: string;
  status: ReminderStatus;
  recurrence: string | null;
  meta: Record<string, any>;
  contactedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pet: { id: string; name: string; species: string; breed: string; avatarUrl: string | null } | null;
  client: { id: string; name: string; phone: string } | null;
  bookedAppointment: { id: string; scheduledAt: string; status: string } | null;
}

export interface CreateReminderPayload {
  petId: string | number;
  clientId: string | number;
  serviceType?: ReminderServiceType;
  title?: string;
  notes?: string;
  dueAt: string;
  recurrence?: string | null;
  meta?: Record<string, any>;
  originAppointmentId?: string | number;
}

export type ReminderScope = 'upcoming' | 'past' | 'today' | 'all';

// ─── API Methods ──────────────────────────────────────────────────
export const remindersAPI = {
  list: async (
    params: { scope?: ReminderScope; status?: string; serviceType?: string; petId?: string | number; clientId?: string | number } = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<{ reminders: Reminder[] }>> => {
    const q = new URLSearchParams();
    if (params.scope) q.set('scope', params.scope);
    if (params.status) q.set('status', params.status);
    if (params.serviceType) q.set('serviceType', params.serviceType);
    if (params.petId != null) q.set('petId', String(params.petId));
    if (params.clientId != null) q.set('clientId', String(params.clientId));
    const qs = q.toString();
    return get(`${ENDPOINTS.REMINDERS.BASE}${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },

  today: async (options?: RequestOptions): Promise<ApiResponse<{ reminders: Reminder[] }>> =>
    get(ENDPOINTS.REMINDERS.TODAY, { cache: false, ...options }),

  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ reminder: Reminder }>> =>
    get(ENDPOINTS.REMINDERS.BY_ID(id), { cache: false, ...options }),

  create: async (data: CreateReminderPayload, options?: RequestOptions): Promise<ApiResponse<{ reminder: Reminder }>> =>
    post(ENDPOINTS.REMINDERS.BASE, data, { showError: true, ...options }),

  update: async (
    id: string | number,
    data: Partial<CreateReminderPayload> & { status?: ReminderStatus; contacted?: boolean },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ reminder: Reminder }>> =>
    patch(ENDPOINTS.REMINDERS.BY_ID(id), data, { showError: true, ...options }),

  setContacted: async (id: string | number, contacted: boolean, options?: RequestOptions): Promise<ApiResponse<{ reminder: Reminder }>> =>
    patch(ENDPOINTS.REMINDERS.BY_ID(id), { contacted }, { showError: true, ...options }),

  markDone: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ reminder: Reminder }>> =>
    patch(ENDPOINTS.REMINDERS.BY_ID(id), { status: 'DONE' }, { showError: true, ...options }),

  dismiss: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ reminder: Reminder }>> =>
    patch(ENDPOINTS.REMINDERS.BY_ID(id), { status: 'DISMISSED' }, { showError: true, ...options }),

  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ id: string }>> =>
    del(ENDPOINTS.REMINDERS.BY_ID(id), { showError: true, ...options }),

  createAppointment: async (
    id: string | number,
    data: { scheduledAt?: string } = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<{ appointmentId: string }>> =>
    post(ENDPOINTS.REMINDERS.APPOINTMENT(id), data, { showError: true, ...options }),
};

// Labels + suggested default due-offset (days) per service type.
export const REMINDER_SERVICE_META: Record<ReminderServiceType, { label: string; days: number }> = {
  VACCINATION: { label: 'Vaccination', days: 365 },
  DEWORMING: { label: 'Deworming', days: 90 },
  GROOMING: { label: 'Grooming', days: 42 },
  FOLLOW_UP: { label: 'Follow-up', days: 14 },
  MEDICATION: { label: 'Medication', days: 7 },
  FEEDING: { label: 'Feeding', days: 1 },
  CHECKUP: { label: 'Check-up', days: 180 },
  OTHER: { label: 'Other', days: 30 },
};
