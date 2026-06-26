import { get, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

interface RecordPet { id: string; name: string; species: string; breed: string; avatarUrl: string | null }
interface RecordAppt { id: string; scheduledAt: string; encounterType: string }

/** A grooming service performed on a visit (child of the appointment, keyed by task). */
export interface GroomingRecord {
  id: string; clinicId: string; petId: string; appointmentId: string | null;
  taskId: string | null; serviceId: string | null; serviceName: string; status: string;
  difficulty: number | null; billable: boolean; steps: string | null;
  temperature: string | null; weight: string | null;
  beforePhotos: string[]; afterPhotos: string[]; notes: string | null;
  allowedClinicIds: string[]; createdAt: string; updatedAt: string;
  pet: RecordPet | null; appointment: RecordAppt | null;
}

/** A surgical procedure performed on a visit. */
export interface SurgeryRecord {
  id: string; clinicId: string; petId: string; appointmentId: string | null;
  taskId: string | null; serviceId: string | null; serviceName: string; status: string;
  surgeonId: string | null; anesthesia: string | null; procedureNotes: string | null;
  findings: string | null; complications: string | null; postOpInstructions: string | null;
  startedAt: string | null; endedAt: string | null; images: string[]; notes: string | null;
  allowedClinicIds: string[]; createdAt: string; updatedAt: string;
  pet: RecordPet | null; appointment: RecordAppt | null;
}

const listQuery = (params: { petId?: string | number; appointmentId?: string | number }) => {
  const q = new URLSearchParams();
  if (params.petId != null) q.set('petId', String(params.petId));
  if (params.appointmentId != null) q.set('appointmentId', String(params.appointmentId));
  const qs = q.toString();
  return qs ? `?${qs}` : '';
};

export const groomingAPI = {
  list: async (params: { petId?: string | number; appointmentId?: string | number } = {}, options?: RequestOptions): Promise<ApiResponse<{ records: GroomingRecord[] }>> =>
    get(`${ENDPOINTS.GROOMING_RECORDS.BASE}${listQuery(params)}`, { cache: false, ...options }),
  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ record: GroomingRecord }>> =>
    get(ENDPOINTS.GROOMING_RECORDS.BY_ID(id), { cache: false, ...options }),
  update: async (id: string | number, data: Partial<GroomingRecord>, options?: RequestOptions): Promise<ApiResponse<{ record: GroomingRecord }>> =>
    patch(ENDPOINTS.GROOMING_RECORDS.BY_ID(id), data, { showError: true, ...options }),
  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(ENDPOINTS.GROOMING_RECORDS.BY_ID(id), { showError: true, ...options }),
};

export const surgeryAPI = {
  list: async (params: { petId?: string | number; appointmentId?: string | number } = {}, options?: RequestOptions): Promise<ApiResponse<{ records: SurgeryRecord[] }>> =>
    get(`${ENDPOINTS.SURGERY_RECORDS.BASE}${listQuery(params)}`, { cache: false, ...options }),
  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ record: SurgeryRecord }>> =>
    get(ENDPOINTS.SURGERY_RECORDS.BY_ID(id), { cache: false, ...options }),
  update: async (id: string | number, data: Partial<SurgeryRecord>, options?: RequestOptions): Promise<ApiResponse<{ record: SurgeryRecord }>> =>
    patch(ENDPOINTS.SURGERY_RECORDS.BY_ID(id), data, { showError: true, ...options }),
  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(ENDPOINTS.SURGERY_RECORDS.BY_ID(id), { showError: true, ...options }),
};
