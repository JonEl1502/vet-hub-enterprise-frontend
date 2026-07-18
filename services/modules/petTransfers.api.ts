/**
 * Staff Pet-Transfers API — clinic side of owner-initiated pet transfers.
 * Destination clinic accepts/declines and requests records; origin clinic
 * approves/declines the record share.
 */

import { get, post } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export interface StaffPetTransfer {
  id: string;
  petId: string;
  fromClinicId: string;
  toClinicId: string;
  fromClientId: string;
  toClientId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  recordShareStatus: 'NONE' | 'REQUESTED' | 'APPROVED' | 'DECLINED';
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
  pet?: { id: string; name: string; species: string; breed: string | null; avatarUrl: string | null };
  fromClinic?: { id: string; name: string };
  toClinic?: { id: string; name: string };
}

const BASE = '/pet-transfers';

export const petTransfersAPI = {
  list: (options?: RequestOptions): Promise<ApiResponse<{ incoming: StaffPetTransfer[]; outgoing: StaffPetTransfer[] }>> =>
    get(BASE, { cache: false, ...options }),

  accept: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ transfer: StaffPetTransfer }>> =>
    post(`${BASE}/${id}/accept`, undefined, { showError: true, ...options }),

  decline: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ declined: boolean }>> =>
    post(`${BASE}/${id}/decline`, undefined, { showError: true, ...options }),

  requestRecords: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ transfer: StaffPetTransfer }>> =>
    post(`${BASE}/${id}/request-records`, undefined, { showError: true, ...options }),

  approveRecords: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ transfer: StaffPetTransfer }>> =>
    post(`${BASE}/${id}/approve-records`, undefined, { showError: true, ...options }),

  declineRecords: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ transfer: StaffPetTransfer }>> =>
    post(`${BASE}/${id}/decline-records`, undefined, { showError: true, ...options }),
};

export default petTransfersAPI;
