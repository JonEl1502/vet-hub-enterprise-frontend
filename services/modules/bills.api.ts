/**
 * Bill API — Revenue Cycle P1 (backend migration 100).
 *
 * Everything the encounter produces lands on the bill as lines. The vet
 * reviews and adjusts it at End Encounter, and APPROVING is what locks the
 * clinical record — payment is no longer part of that decision.
 */
import { get, post, patch, del } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export type BillStatus =
  | 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'ISSUED' | 'INVOICED' | 'PAID' | 'RECONCILED' | 'VOID';
export type BillLineKind = 'SERVICE' | 'CONSUMABLE' | 'MEDICATION' | 'OTHER';

export interface BillLine {
  id: string;
  kind: BillLineKind;
  taskId?: string | null;
  inventoryItemId?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface Bill {
  id: string;
  number?: string | null;
  clinicId: string;
  visitId: string;
  patientId?: string | null;
  doctorId?: string | null;
  source: string;
  status: BillStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  isSynthetic: boolean;
  issuedAt?: string | null;
  paidAt?: string | null;
  reconciledAt?: string | null;
  actualTotal?: number | null;
  amountPaid?: number | null;
  deltaAmount?: number | null;
  /** DRAFT / PENDING_REVIEW — lines can still be changed. */
  editable: boolean;
  createdAt: string;
  updatedAt: string;
  lines: BillLine[];
}

export interface BillQueueRow {
  id: string;
  number?: string | null;
  visitId: string;
  status: BillStatus;
  total: number;
  isSynthetic: boolean;
  lineCount: number;
  createdAt: string;
  approvedAt?: string | null;
  patient: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  visitDate?: string | null;
  isPaid: boolean;
}

export interface BillLineInput {
  kind?: BillLineKind;
  taskId?: string | null;
  inventoryItemId?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
}

export const billsAPI = {
  /** The visit's bill — raises a DRAFT from the encounter's charges if none. */
  get: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    get(`/visits/${visitId}/bill`, { cache: false, silent: true, ...options }),

  /** Re-snapshot the lines from the encounter (DRAFT only). */
  refresh: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/refresh`, {}, { showError: true, ...options }),

  addLine: (visitId: number | string, data: BillLineInput, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/lines`, data, { showError: true, ...options }),

  updateLine: (visitId: number | string, lineId: string | number, data: Partial<BillLineInput>, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    patch(`/visits/${visitId}/bill/lines/${lineId}`, data, { showError: true, ...options }),

  removeLine: (visitId: number | string, lineId: string | number, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    del(`/visits/${visitId}/bill/lines/${lineId}`, { showError: true, ...options }),

  /** Header-level discount / notes. */
  updateHeader: (visitId: number | string, data: { discount?: number; notes?: string | null }, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    patch(`/visits/${visitId}/bill`, data, { showError: true, ...options }),

  /** Vet signs off ⇒ the clinical record locks. */
  approve: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/approve`, {}, { showError: true, ...options }),

  /** Explicit, auditable unlock back to DRAFT. */
  reopen: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/reopen`, {}, { showError: true, ...options }),

  /** Pay-first: quote the client before the work is finished. */
  issue: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/issue`, {}, { showError: true, ...options }),

  void: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/void`, {}, { showError: true, ...options }),

  // ── clinic-wide ────────────────────────────────────────────────────────
  /** Reception queue — pending review + approved, awaiting an invoice. */
  list: (status?: string, options?: RequestOptions): Promise<ApiResponse<{ bills: BillQueueRow[] }>> =>
    get(`/bills${status ? `?status=${status}` : ''}`, { cache: false, ...options }),
};

export default billsAPI;
