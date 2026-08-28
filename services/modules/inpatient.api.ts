/**
 * Inpatient / hospitalization API. Shapes mirror inpatient.service transforms.
 */
import { get, post, patch, del } from '../api/client';
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
  inpatientNo: string | null; status: HospitalizationStatus; complexity?: number | null; displayFormat?: string;
  diagnosis: string | null; admissionNotes: string | null; notes: string | null; cage: string | null; dailyRate: number | null;
  intakeWeight: number | null; vaccineChecklist?: Record<string, boolean>;
  feedingInstructions: string | null; medicationInstructions: string | null; emergencyContact: string | null; foodProgram?: Record<string, any>;
  admittedAt: string; expectedDischargeAt?: string | null; dischargedAt: string | null; dischargeNotes: string | null; dischargeReason?: string | null;
  homeInstructions: string | null; finalWeight: number | null; weightChange: number | null; outcome: DischargeOutcome | null;
  clinician: { id: string; name: string; role: string } | null;
  pet: { id: string; name: string; species: string; breed: string; avatarUrl: string | null } | null;
  /** email alongside phone (216 UI) — the ward/kennel cards show both. */
  client: { id: string; name: string; phone: string | null; email?: string | null } | null;
  billing: { appointmentId: string; totalCost: number; isPaid: boolean; status: string; hasReminder?: boolean; reminder?: { id: string; serviceType?: string; title?: string; notes?: string; dueAt: string } | null } | null;
  allowedClinicIds?: string[];
  createdAt: string; updatedAt: string;
  // present on full fetch
  vitals?: VitalReading[];
  logs?: HospLog[];
  // present on board
  medsDue?: number; tasksDue?: number;
}

/** A user-named section of the inpatient treatment plan (132). */
export interface TreatmentPlanItem {
  id: string; sectionId: string; inventoryItemId: string | null; name: string;
  quantity: number | null; unit: string | null; frequency: string | null; route: string | null;
  timesOfDay: string[]; startsOn: string | null; endsOn: string | null; notes: string | null; sortOrder: number;
  inventoryItem: { id: string; name: string; unit: string | null; quantity: number } | null;
}
export interface TreatmentPlanSection {
  id: string; hospitalizationId: string; name: string; notes: string | null; sortOrder: number;
  items: TreatmentPlanItem[];
}

/** What a back-date will cost, or did cost. Money — every field is billable. */
export interface InpatientBackdate {
  applied: boolean;
  from: string;
  to: string;
  nightsBefore: number;
  nightsAfter: number;
  nightsAdded: number;
  dailyRate: number;
  perDayFood: number;
  stayBefore: number;
  stayAfter: number;
  foodBefore: number;
  foodAfter: number;
  difference: number;
  visitTotalBefore: number | null;
  visitTotalAfter: number | null;
  /** false = no rate and no food program, so back-dating moves no money. */
  priced: boolean;
  hospitalization?: Hospitalization;
}

export const inpatientAPI = {
  // ── Treatment plan (132). A PLAN, not a charge: nothing here bills or moves
  // stock — administration goes through the MAR / consumable path.
  getPlan: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ sections: TreatmentPlanSection[] }>> =>
    get(`/inpatient/${id}/plan`, { cache: false, ...options }),
  addPlanSection: async (id: string | number, data: { name: string; notes?: string | null }, options?: RequestOptions): Promise<ApiResponse<{ section: TreatmentPlanSection }>> =>
    post(`/inpatient/${id}/plan/sections`, data, { showError: true, ...options }),
  updatePlanSection: async (id: string | number, sectionId: string | number, data: { name?: string; notes?: string | null }, options?: RequestOptions): Promise<ApiResponse<{ section: TreatmentPlanSection }>> =>
    patch(`/inpatient/${id}/plan/sections/${sectionId}`, data, { showError: true, ...options }),
  removePlanSection: async (id: string | number, sectionId: string | number, options?: RequestOptions): Promise<ApiResponse<any>> =>
    del(`/inpatient/${id}/plan/sections/${sectionId}`, { showError: true, ...options }),
  addPlanItem: async (id: string | number, sectionId: string | number, data: Record<string, any>, options?: RequestOptions): Promise<ApiResponse<{ item: TreatmentPlanItem }>> =>
    post(`/inpatient/${id}/plan/sections/${sectionId}/items`, data, { showError: true, ...options }),
  updatePlanItem: async (id: string | number, itemId: string | number, data: Record<string, any>, options?: RequestOptions): Promise<ApiResponse<{ item: TreatmentPlanItem }>> =>
    patch(`/inpatient/${id}/plan/items/${itemId}`, data, { showError: true, ...options }),
  removePlanItem: async (id: string | number, itemId: string | number, options?: RequestOptions): Promise<ApiResponse<any>> =>
    del(`/inpatient/${id}/plan/items/${itemId}`, { showError: true, ...options }),

  // Row-level deletes. Note the FLAT paths — these take the row id, not the
  // stay id, matching the existing PATCH /inpatient/logs/:logId.
  deleteVital: async (vitalId: string | number, options?: RequestOptions): Promise<ApiResponse<any>> =>
    del(`/inpatient/vitals/${vitalId}`, { showError: true, ...options }),
  deleteLog: async (logId: string | number, options?: RequestOptions): Promise<ApiResponse<any>> =>
    del(`/inpatient/logs/${logId}`, { showError: true, ...options }),

  board: async (options?: RequestOptions): Promise<ApiResponse<{ totalInpatients: number; board: Hospitalization[] }>> =>
    get(ENDPOINTS.INPATIENT.BOARD, { cache: false, ...options }),

  list: async (status: 'active' | 'all' = 'active', options?: RequestOptions): Promise<ApiResponse<{ hospitalizations: Hospitalization[] }>> =>
    get(`${ENDPOINTS.INPATIENT.BASE}?status=${status}`, { cache: false, ...options }),

  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ hospitalization: Hospitalization }>> =>
    get(ENDPOINTS.INPATIENT.BY_ID(id), { cache: false, ...options }),

  admit: async (data: { petId: string | number; clientId: string | number; appointmentId?: string | number; inpatientNo?: string; diagnosis?: string; admissionNotes?: string; cage?: string; clinicianId?: string | number; dailyRate?: number; intakeWeight?: number; vaccineChecklist?: Record<string, boolean>; foodProgram?: Record<string, any>; feedingInstructions?: string; medicationInstructions?: string; emergencyContact?: string; expectedDischargeAt?: string }, options?: RequestOptions): Promise<ApiResponse<{ hospitalization: Hospitalization }>> =>
    post(ENDPOINTS.INPATIENT.BASE, data, { showError: true, ...options }),

  update: async (id: string | number, data: Record<string, any>, options?: RequestOptions): Promise<ApiResponse<{ hospitalization: Hospitalization }>> =>
    patch(ENDPOINTS.INPATIENT.BY_ID(id), data, { showError: true, ...options }),

  discharge: async (id: string | number, data: { dischargeNotes?: string; homeInstructions?: string; finalWeight?: number; outcome?: DischargeOutcome; /** Required by the server when discharging BEFORE expectedDischargeAt (178). */ dischargeReason?: string; reminder?: { serviceType?: string; title?: string; notes?: string; dueAt: string } | null }, options?: RequestOptions): Promise<ApiResponse<{ hospitalization: Hospitalization }>> =>
    post(ENDPOINTS.INPATIENT.DISCHARGE(id), data, { showError: true, ...options }),

  // Materialize the bill + finalize the appointment; returns the appointment id to settle.
  bill: async (id: string | number, reminder?: { serviceType?: string; title?: string; notes?: string; dueAt: string } | null, options?: RequestOptions): Promise<ApiResponse<{ appointmentId: string | null }>> =>
    post(ENDPOINTS.INPATIENT.BILL(id), reminder ? { reminder } : {}, { showError: true, ...options }),

  // Undo a discharge so the admission can be corrected. 400s once paid.
  /**
   * Move an admission BACKWARDS and re-price the stay.
   *
   * ⚠️ Always call it with `preview: true` first and show the delta. This is a
   * money operation — the server bills the added nights and days of food — and
   * it REFUSES outright on a settled visit, with the amount in the message.
   */
  backdate: async (
    id: string | number,
    body: { admittedAt: string; reason?: string; moveVisitDate?: boolean },
    preview = false,
    options?: RequestOptions,
  ): Promise<ApiResponse<InpatientBackdate>> =>
    post(`${ENDPOINTS.INPATIENT.BACKDATE(id)}${preview ? '?preview=1' : ''}`, body, { showError: !preview, ...options }),

  reopen: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<any>> =>
    post(ENDPOINTS.INPATIENT.REOPEN(id), {}, { showError: true, ...options }),

  addVital: async (id: string | number, data: Partial<Omit<VitalReading, 'id'>>, options?: RequestOptions): Promise<ApiResponse<{ vital: VitalReading }>> =>
    post(ENDPOINTS.INPATIENT.VITALS(id), data, { showError: true, ...options }),

  addLog: async (id: string | number, data: { kind: LogKind; status?: string; loggedAt?: string; data?: Record<string, any> }, options?: RequestOptions): Promise<ApiResponse<{ log: HospLog }>> =>
    post(ENDPOINTS.INPATIENT.LOGS(id), data, { showError: true, ...options }),

  updateLog: async (logId: string | number, data: { status?: string; data?: Record<string, any> }, options?: RequestOptions): Promise<ApiResponse<{ log: HospLog }>> =>
    patch(ENDPOINTS.INPATIENT.LOG_BY_ID(logId), data, { showError: true, ...options }),
};
