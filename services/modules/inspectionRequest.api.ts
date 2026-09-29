/**
 * Clinic-staff side of "Ask a vet to inspect" (313). Buyer side lives in
 * `marketplace.api.ts` (`requestInspection`/`myInspectionRequests`/
 * `cancelInspectionRequest`) — this is the clinic's own inbox, mounted at
 * /api/v1/inspection-requests, same shape as `livestock.api.ts`'s call-out
 * queue endpoints.
 */
import { get, post } from '../api/client';
import { ApiResponse } from '../api/types';

export interface StaffInspectionRequest {
  id: string;
  listingId: string;
  listingTitle: string | null;
  buyerClientId: string;
  buyerName: string | null;
  sellerClientId: string;
  sellerName: string | null;
  clinicId: string;
  status: 'REQUESTED' | 'ACKNOWLEDGED' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED';
  preferredDate: string | null;
  message: string | null;
  clinicNote: string | null;
  scheduledAt: string | null;
  report: string | null;
  reportFileUrl: string | null;
  attachToListing: boolean;
  handledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const BASE = '/inspection-requests';

export const inspectionRequestAPI = {
  list: (status?: string): Promise<ApiResponse<{ requests: StaffInspectionRequest[] }>> =>
    get(`${BASE}${status ? `?status=${status}` : ''}`),

  acknowledge: (id: string): Promise<ApiResponse<{ request: StaffInspectionRequest }>> =>
    post(`${BASE}/${id}/acknowledge`, {}),

  accept: (id: string, scheduledAt?: string): Promise<ApiResponse<{ request: StaffInspectionRequest }>> =>
    post(`${BASE}/${id}/accept`, { scheduledAt }),

  decline: (id: string, reason?: string): Promise<ApiResponse<{ request: StaffInspectionRequest }>> =>
    post(`${BASE}/${id}/decline`, { reason }),

  complete: (
    id: string,
    data: { report: string; reportFileUrl?: string; attachToListing?: boolean },
  ): Promise<ApiResponse<{ request: StaffInspectionRequest }>> =>
    post(`${BASE}/${id}/complete`, data),
};

export default inspectionRequestAPI;
