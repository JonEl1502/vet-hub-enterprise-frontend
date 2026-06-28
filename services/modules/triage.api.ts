import { get, post, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

interface RecordPet { id: string; name: string; species: string; breed: string; avatarUrl: string | null }
interface RecordAppt { id: string; scheduledAt: string; encounterType: string; visitType: string | null; status: string }

export type TriageCategory = 'CRITICAL' | 'URGENT' | 'STABLE_URGENT' | 'NON_EMERGENCY';
export type TriageStatus = 'IN_PROGRESS' | 'STABILIZED' | 'CLOSED';
export type TriageOutcome =
  | 'STABILIZED' | 'IMPROVED' | 'UNCHANGED' | 'DETERIORATING'
  | 'CPR' | 'REFERRED' | 'HOSPITALIZED' | 'EUTHANASIA';

/** A single monitoring reading captured during stabilization (trend points). */
export interface TriageMonitoringReading {
  at: string;
  hr?: number | null; rr?: number | null; temp?: number | null; bp?: string | null;
  spo2?: number | null; ecg?: string | null; glucose?: number | null; lactate?: number | null;
  crt?: string | null; mmColour?: string | null; urineOutput?: number | null; painScore?: number | null;
}

export interface TriageTimeLogEvent { at: string; event: string; auto?: boolean }

/** Emergency Triage & Stabilization record — one per visit. */
export interface EmergencyTriageRecord {
  id: string;
  clinicId: string;
  petId: string;
  appointmentId: string | null;
  arrivalAt: string | null;
  triageStartedAt: string | null;
  triageNurseId: string | null;
  attendingVetId: string | null;
  referralSource: string | null;
  triageCategory: TriageCategory | null;
  primarySurvey: Record<string, any>;   // ABCDE checkboxes + notes + vitals
  stabilization: Record<string, any>;   // grouped protocol checklists
  monitoring: TriageMonitoringReading[];
  timeLog: TriageTimeLogEvent[];
  painScore: number | null;
  outcome: TriageOutcome | null;
  status: TriageStatus;
  notes: string | null;
  allowedClinicIds: string[];
  createdAt: string;
  updatedAt: string;
  pet: RecordPet | null;
  appointment: RecordAppt | null;
}

export type TriagePayload = Partial<Omit<EmergencyTriageRecord,
  'id' | 'clinicId' | 'createdAt' | 'updatedAt' | 'pet' | 'appointment'>> & { petId?: string | number };

export const triageAPI = {
  list: async (
    params: { status?: string; petId?: string | number; scope?: 'board' } = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<{ records: EmergencyTriageRecord[] }>> => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.petId != null) q.set('petId', String(params.petId));
    if (params.scope) q.set('scope', params.scope);
    const qs = q.toString();
    return get(`${ENDPOINTS.TRIAGE_RECORDS.BASE}${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },

  getByAppointment: async (appointmentId: string | number, options?: RequestOptions): Promise<ApiResponse<{ record: EmergencyTriageRecord | null }>> =>
    get(ENDPOINTS.TRIAGE_RECORDS.BY_APPOINTMENT(appointmentId), { cache: false, ...options }),

  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ record: EmergencyTriageRecord }>> =>
    get(ENDPOINTS.TRIAGE_RECORDS.BY_ID(id), { cache: false, ...options }),

  create: async (data: TriagePayload, options?: RequestOptions): Promise<ApiResponse<{ record: EmergencyTriageRecord }>> =>
    post(ENDPOINTS.TRIAGE_RECORDS.BASE, data, { showError: true, ...options }),

  update: async (id: string | number, data: TriagePayload, options?: RequestOptions): Promise<ApiResponse<{ record: EmergencyTriageRecord }>> =>
    patch(ENDPOINTS.TRIAGE_RECORDS.BY_ID(id), data, { showError: true, ...options }),

  addMonitoring: async (id: string | number, reading: Partial<TriageMonitoringReading>, options?: RequestOptions): Promise<ApiResponse<{ record: EmergencyTriageRecord }>> =>
    post(ENDPOINTS.TRIAGE_RECORDS.MONITORING(id), reading, { showError: true, ...options }),

  addTimeLog: async (id: string | number, event: { event: string; at?: string; auto?: boolean }, options?: RequestOptions): Promise<ApiResponse<{ record: EmergencyTriageRecord }>> =>
    post(ENDPOINTS.TRIAGE_RECORDS.TIMELOG(id), event, { showError: true, ...options }),

  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(ENDPOINTS.TRIAGE_RECORDS.BY_ID(id), { showError: true, ...options }),
};
