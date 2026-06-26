/**
 * Inpatient / hospitalization API. Shapes mirror inpatient.service transforms.
 */
import { get, post, patch } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type HospitalizationStatus = 'ADMITTED' | 'DISCHARGED' | 'CANCELLED';
export type DischargeOutcome = 'RECOVERED' | 'IMPROVED' | 'UNCHANGED' | 'DEFERRED' | 'DECEASED';
export type LogKind = 'TREATMENT_TASK' | 'MEDICATION' | 'FLUID_INTAKE' | 'FLUID_OUTPUT' | 'FEEDING' | 'ELIMINATION' | 'NURSING_NOTE' | 'PROGRESS_NOTE' | 'COMM_LOG' | 'HANDOVER';

export interface VitalReading {
  id: string; recordedAt: string;
  temperature: number | null; pulse: number | null; respiration: number | null;
  weight: number | null; mucousMembrane: string | null; crt: string | null;
}

export interface HospLog {
  id: string; kind: LogKind; loggedAt: string; status: string | null; data: Record<string, any>; recordedBy: string | null;
}

export interface Hospitalization {
  id: string; clinicId: string; petId: string; clientId: string; appointmentId: string | null;
  inpatientNo: string | null; status: HospitalizationStatus;
  diagnosis: string | null; admissionNotes: string | null; cage: string | null; dailyRate: number | null;
  intakeWeight: number | null; vaccineChecklist?: Record<string, boolean>;
  feedingInstructions: string | null; medicationInstructions: string | null; emergencyContact: string | null; foodProgram?: Record<string, any>;
  admittedAt: string; dischargedAt: string | null; dischargeNotes: string | null;
  homeInstructions: string | null; finalWeight: number | null; weightChange: number | null; outcome: DischargeOutcome | null;
  clinician: { id: string; name: string; role: string } | null;
  pet: { id: string; name: string; species: string; breed: string; avatarUrl: string | null } | null;
  client: { id: string; name: string; phone: string } | null;
  billing: { appointmentId: string; totalCost: number; isPaid: boolean; status: string; hasReminder?: boolean } | null;
  allowedClinicIds?: string[];
  createdAt: string; updatedAt: string;
  // present on full fetch
  vitals?: VitalReading[];
  logs?: HospLog[];
  // present on board
  medsDue?: number; tasksDue?: number;
}

export const inpatientAPI = {
  board: async (options?: RequestOptions): Promise<ApiResponse<{ totalInpatients: number; board: Hospitalization[] }>> =>
    get(ENDPOINTS.INPATIENT.BOARD, { cache: false, ...options }),

  list: async (status: 'active' | 'all' = 'active', options?: RequestOptions): Promise<ApiResponse<{ hospitalizations: Hospitalization[] }>> =>
    get(`${ENDPOINTS.INPATIENT.BASE}?status=${status}`, { cache: false, ...options }),

  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ hospitalization: Hospitalization }>> =>
    get(ENDPOINTS.INPATIENT.BY_ID(id), { cache: false, ...options }),

  admit: async (data: { petId: string | number; clientId: string | number; appointmentId?: string | number; inpatientNo?: string; diagnosis?: string; admissionNotes?: string; cage?: string; clinicianId?: string | number; dailyRate?: number; intakeWeight?: number; vaccineChecklist?: Record<string, boolean>; foodProgram?: Record<string, any>; feedingInstructions?: string; medicationInstructions?: string; emergencyContact?: string }, options?: RequestOptions): Promise<ApiResponse<{ hospitalization: Hospitalization }>> =>
    post(ENDPOINTS.INPATIENT.BASE, data, { showError: true, ...options }),

  update: async (id: string | number, data: Record<string, any>, options?: RequestOptions): Promise<ApiResponse<{ hospitalization: Hospitalization }>> =>
    patch(ENDPOINTS.INPATIENT.BY_ID(id), data, { showError: true, ...options }),

  discharge: async (id: string | number, data: { dischargeNotes?: string; homeInstructions?: string; finalWeight?: number; outcome?: DischargeOutcome; reminder?: { serviceType?: string; title?: string; notes?: string; dueAt: string } | null }, options?: RequestOptions): Promise<ApiResponse<{ hospitalization: Hospitalization }>> =>
    post(ENDPOINTS.INPATIENT.DISCHARGE(id), data, { showError: true, ...options }),

  // Materialize the bill + finalize the appointment; returns the appointment id to settle.
  bill: async (id: string | number, reminder?: { serviceType?: string; title?: string; notes?: string; dueAt: string } | null, options?: RequestOptions): Promise<ApiResponse<{ appointmentId: string | null }>> =>
    post(ENDPOINTS.INPATIENT.BILL(id), reminder ? { reminder } : {}, { showError: true, ...options }),

  addVital: async (id: string | number, data: Partial<Omit<VitalReading, 'id'>>, options?: RequestOptions): Promise<ApiResponse<{ vital: VitalReading }>> =>
    post(ENDPOINTS.INPATIENT.VITALS(id), data, { showError: true, ...options }),

  addLog: async (id: string | number, data: { kind: LogKind; status?: string; loggedAt?: string; data?: Record<string, any> }, options?: RequestOptions): Promise<ApiResponse<{ log: HospLog }>> =>
    post(ENDPOINTS.INPATIENT.LOGS(id), data, { showError: true, ...options }),

  updateLog: async (logId: string | number, data: { status?: string; data?: Record<string, any> }, options?: RequestOptions): Promise<ApiResponse<{ log: HospLog }>> =>
    patch(ENDPOINTS.INPATIENT.LOG_BY_ID(logId), data, { showError: true, ...options }),
};
