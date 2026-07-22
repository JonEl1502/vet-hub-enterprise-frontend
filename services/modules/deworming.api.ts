import { get, post, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type DewormingStatus = 'SCHEDULED' | 'ADMINISTERED';

export interface DewormingRecord {
  id: string;
  petId: string;
  clinicId: string;
  appointmentId: string | null;
  taskId: string | null;
  productName: string;
  activeIngredient: string | null;
  wormType: string | null;
  batchNumber: string | null;
  inventoryItemId: string | null;
  stockDeductedAt: string | null;
  doseGiven: string | null;
  weightKg: number | null;
  route: string | null;
  administeredById: string | null;
  administeredByName: string | null;
  dewormedAt: string | null;
  nextDueAt: string | null;
  notes: string | null;
  status: DewormingStatus;
  pet?: { id: string; name: string; species: string; breed: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface DewormingPayload {
  petId: string | number;
  appointmentId?: string | number;
  taskId?: string | number;
  productName: string;
  activeIngredient?: string;
  wormType?: string;
  batchNumber?: string;
  inventoryItemId?: string | number | null;
  doseGiven?: string;
  weightKg?: number;
  route?: string;
  nextDueAt?: string | null;
  notes?: string;
}

export const dewormingAPI = {
  list: (params: { petId?: string | number; appointmentId?: string | number } = {}, options?: RequestOptions): Promise<ApiResponse<{ records: DewormingRecord[] }>> => {
    const q = new URLSearchParams();
    if (params.petId != null) q.set('petId', String(params.petId));
    if (params.appointmentId != null) q.set('appointmentId', String(params.appointmentId));
    const qs = q.toString();
    return get(`${ENDPOINTS.DEWORMING_RECORDS.BASE}${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },
  getById: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ record: DewormingRecord }>> =>
    get(ENDPOINTS.DEWORMING_RECORDS.BY_ID(id), { cache: false, ...options }),
  create: (data: DewormingPayload, options?: RequestOptions): Promise<ApiResponse<{ record: DewormingRecord }>> =>
    post(ENDPOINTS.DEWORMING_RECORDS.BASE, data, { showError: true, ...options }),
  update: (id: string | number, data: Partial<DewormingPayload>, options?: RequestOptions): Promise<ApiResponse<{ record: DewormingRecord }>> =>
    patch(ENDPOINTS.DEWORMING_RECORDS.BY_ID(id), data, { showError: true, ...options }),
  administer: (id: string | number, data: { inventoryItemId?: string | number; nextDueAt?: string | null; weightKg?: number; doseGiven?: string }, options?: RequestOptions): Promise<ApiResponse<{ record: DewormingRecord }>> =>
    post(ENDPOINTS.DEWORMING_RECORDS.ADMINISTER(id), data, { showError: true, ...options }),
  remove: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(ENDPOINTS.DEWORMING_RECORDS.BY_ID(id), { showError: true, ...options }),
};
