/**
 * Visit Jobs API — a visit service outsourced to a partner clinic "for
 * completion", carrying the A↔B agreed price.
 */
import { get, post, patch } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type VisitJobStatus = 'REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED';

export interface VisitJobClinic { id: string; name: string; logo?: string | null; subdomain?: string | null }

export type MovementStage = 'DISPATCHED' | 'RECEIVED' | 'IN_PROGRESS' | 'RESULT_SENT' | 'RETURNED';
export type MovementKind = MovementStage | 'NOTE';
export type MovementItemType = 'PATIENT' | 'SAMPLE' | 'DOCUMENT' | 'IMAGE' | 'OTHER';

export interface VisitJobEvent {
  id: string;
  visitJobId: string;
  kind: MovementKind;
  itemType: MovementItemType | null;
  note: string | null;
  actorClinicId: string;
  actorUserId: string | null;
  actorClinic?: VisitJobClinic;
  createdAt: string;
}

export interface VisitJob {
  id: string;
  visitId: string;
  taskId: string | null;
  category: string;
  serviceName: string | null;
  requesterClinicId: string;
  providerClinicId: string;
  handshakeId: string | null;
  agreedPrice: number;
  currency: string;
  status: VisitJobStatus;
  movementStage: MovementStage | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  requesterClinic?: VisitJobClinic;
  providerClinic?: VisitJobClinic;
}

export interface EligiblePartner {
  handshakeId: string;
  clinicId: string;
  name: string;
  logo?: string | null;
  subdomain?: string | null;
  price: number;
  currency: string;
}

export const visitJobsAPI = {
  /** Partner clinics this clinic can outsource a category to (accepted handshake + agreed price) */
  eligiblePartners: async (category: string, options?: RequestOptions): Promise<ApiResponse<{ partners: EligiblePartner[] }>> =>
    get(`${ENDPOINTS.VISIT_JOBS.ELIGIBLE_PARTNERS}?category=${encodeURIComponent(category)}`, { cache: false, ...options }),

  /** Outsource a visit service to a partner clinic */
  create: async (data: { visitId: string | number; providerClinicId: string | number; category: string; taskId?: string | number; serviceName?: string; note?: string }, options?: RequestOptions): Promise<ApiResponse<{ job: VisitJob }>> =>
    post(ENDPOINTS.VISIT_JOBS.BASE, data, { showError: true, ...options }),

  /** Jobs on one visit */
  listForVisit: async (visitId: string | number, options?: RequestOptions): Promise<ApiResponse<{ jobs: VisitJob[] }>> =>
    get(`${ENDPOINTS.VISIT_JOBS.BASE}?visitId=${visitId}`, { cache: false, ...options }),

  /** Jobs for the active clinic — role 'incoming' (we provide) or 'outgoing' (we requested) */
  listForClinic: async (role: 'incoming' | 'outgoing' | 'all' = 'all', options?: RequestOptions): Promise<ApiResponse<{ jobs: VisitJob[] }>> =>
    get(`${ENDPOINTS.VISIT_JOBS.BASE}?role=${role}`, { cache: false, ...options }),

  /** Update status (provider: accept/decline/complete; requester: cancel) */
  updateStatus: async (id: string | number, status: VisitJobStatus, options?: RequestOptions): Promise<ApiResponse<{ job: VisitJob }>> =>
    patch(ENDPOINTS.VISIT_JOBS.BY_ID(id), { status }, { showError: true, ...options }),

  /** Movement/logistics audit timeline for a job */
  listMovements: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ events: VisitJobEvent[] }>> =>
    get(`${ENDPOINTS.VISIT_JOBS.BY_ID(id)}/movements`, { cache: false, ...options }),

  /** Log a movement event (dispatch/receive/in-progress/result-sent/returned/note) */
  logMovement: async (id: string | number, data: { kind: MovementKind; itemType?: MovementItemType; note?: string }, options?: RequestOptions): Promise<ApiResponse<{ event: VisitJobEvent }>> =>
    post(`${ENDPOINTS.VISIT_JOBS.BY_ID(id)}/movements`, data, { showError: true, ...options }),
};
