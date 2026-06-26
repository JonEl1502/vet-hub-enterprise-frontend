import { get, post, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type DiagSource = 'INTERNAL' | 'EXTERNAL';
export type LabStatus = 'ORDERED' | 'RESULTED';
export type ImagingModality = 'XRAY' | 'ULTRASOUND' | 'CT' | 'MRI' | 'ENDOSCOPY' | 'OTHER';

export interface LabMarker { name: string; value: string; unit?: string; refRange?: string; flag?: 'LOW' | 'NORMAL' | 'HIGH' | '' }

interface RecordPet { id: string; name: string; species: string; breed: string; avatarUrl: string | null }
interface RecordAppt { id: string; scheduledAt: string; encounterType: string }

/** Result of closing a diagnostic record onto its workflow invoice. */
export interface ModuleBillResult<R> { appointmentId: string | null; record: R }
export interface ReminderDraft { serviceType?: string; title?: string; notes?: string; dueAt: string; recurrence?: string | null }

export interface LabAttachment { url: string; name?: string; kind?: string }

export interface LabRecord {
  id: string; clinicId: string; petId: string; appointmentId: string | null;
  source: DiagSource; externalSource: string | null; panelName: string;
  testType?: string | null; specimen?: string | null; attachments?: LabAttachment[];
  markers: LabMarker[]; resultDate: string | null; status: LabStatus; notes: string | null;
  allowedClinicIds?: string[];
  createdAt: string; updatedAt: string; pet: RecordPet | null; appointment: RecordAppt | null;
}

/** One image in a study — its own descriptive metadata. Legacy records may
 *  still hold plain URL strings, so consumers should normalise. */
export interface ImagingImage { url: string; description?: string; notes?: string; diagnosis?: string }

export interface ImagingRecord {
  id: string; clinicId: string; petId: string; appointmentId: string | null;
  source: DiagSource; externalSource: string | null; modality: ImagingModality;
  bodyPart: string | null; images: (ImagingImage | string)[]; findings: string | null; studyDate: string | null;
  allowedClinicIds?: string[];
  createdAt: string; updatedAt: string; pet: RecordPet | null; appointment: RecordAppt | null;
}

export const labAPI = {
  list: async (params: { petId?: string | number; source?: string } = {}, options?: RequestOptions): Promise<ApiResponse<{ records: LabRecord[] }>> => {
    const q = new URLSearchParams();
    if (params.petId != null) q.set('petId', String(params.petId));
    if (params.source) q.set('source', params.source);
    const qs = q.toString();
    return get(`${ENDPOINTS.LAB_RECORDS.BASE}${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },
  create: async (data: Partial<LabRecord> & { petId: string | number; panelName: string }, options?: RequestOptions): Promise<ApiResponse<{ record: LabRecord }>> =>
    post(ENDPOINTS.LAB_RECORDS.BASE, data, { showError: true, ...options }),
  update: async (id: string | number, data: Partial<LabRecord>, options?: RequestOptions): Promise<ApiResponse<{ record: LabRecord }>> =>
    patch(ENDPOINTS.LAB_RECORDS.BY_ID(id), data, { showError: true, ...options }),
  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(ENDPOINTS.LAB_RECORDS.BY_ID(id), { showError: true, ...options }),
  // Close the lab record (status RESULTED) + finalize its linked appointment → settle.
  bill: async (id: string | number, reminder?: ReminderDraft | null, options?: RequestOptions): Promise<ApiResponse<ModuleBillResult<LabRecord>>> =>
    post(`${ENDPOINTS.LAB_RECORDS.BY_ID(id)}/bill`, { reminder }, { showError: true, ...options }),
};

export const imagingAPI = {
  list: async (params: { petId?: string | number; modality?: string } = {}, options?: RequestOptions): Promise<ApiResponse<{ records: ImagingRecord[] }>> => {
    const q = new URLSearchParams();
    if (params.petId != null) q.set('petId', String(params.petId));
    if (params.modality) q.set('modality', params.modality);
    const qs = q.toString();
    return get(`${ENDPOINTS.IMAGING_RECORDS.BASE}${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },
  create: async (data: Partial<ImagingRecord> & { petId: string | number }, options?: RequestOptions): Promise<ApiResponse<{ record: ImagingRecord }>> =>
    post(ENDPOINTS.IMAGING_RECORDS.BASE, data, { showError: true, ...options }),
  update: async (id: string | number, data: Partial<ImagingRecord>, options?: RequestOptions): Promise<ApiResponse<{ record: ImagingRecord }>> =>
    patch(ENDPOINTS.IMAGING_RECORDS.BY_ID(id), data, { showError: true, ...options }),
  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(ENDPOINTS.IMAGING_RECORDS.BY_ID(id), { showError: true, ...options }),
  // Close imaging + finalize its linked appointment → settle.
  bill: async (id: string | number, reminder?: ReminderDraft | null, options?: RequestOptions): Promise<ApiResponse<ModuleBillResult<ImagingRecord>>> =>
    post(`${ENDPOINTS.IMAGING_RECORDS.BY_ID(id)}/bill`, { reminder }, { showError: true, ...options }),
};
