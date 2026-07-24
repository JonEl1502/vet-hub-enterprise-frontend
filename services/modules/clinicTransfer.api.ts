/**
 * Clinic ownership transfer — owner submits, platform admin approves.
 */
import { get, post } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export interface ClinicTransfer {
  id: string;
  clinicId: string;
  clinicName?: string | null;
  currentOwnerId: string | null;
  newOwnerEmail: string;
  newOwnerId: string | null;
  reason: string | null;
  signedTransferUrl: string | null;
  affidavitUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

export const clinicTransfersAPI = {
  mine: (options?: RequestOptions): Promise<ApiResponse<{ transfers: ClinicTransfer[] }>> =>
    get('/clinic-transfers/me', { ...options }),

  create: (
    data: { newOwnerEmail: string; reason?: string; signedTransferUrl: string; affidavitUrl: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ transfer: ClinicTransfer }>> =>
    post('/clinic-transfers', data, { showError: true, ...options }),

  cancel: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ transfer: ClinicTransfer }>> =>
    post(`/clinic-transfers/${id}/cancel`, undefined, { showError: true, ...options }),

  // ── Admin ──
  adminList: (status?: string, options?: RequestOptions): Promise<ApiResponse<{ transfers: ClinicTransfer[] }>> =>
    get(`/admin/clinic-transfers${status ? `?status=${status}` : ''}`, { ...options }),

  adminApprove: (id: string | number, notes?: string, options?: RequestOptions): Promise<ApiResponse<{ transfer: ClinicTransfer }>> =>
    post(`/admin/clinic-transfers/${id}/approve`, { notes }, { showError: true, ...options }),

  adminReject: (id: string | number, reason?: string, options?: RequestOptions): Promise<ApiResponse<{ transfer: ClinicTransfer }>> =>
    post(`/admin/clinic-transfers/${id}/reject`, { reason }, { showError: true, ...options }),
};

export default clinicTransfersAPI;
