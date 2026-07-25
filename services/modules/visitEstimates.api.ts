/**
 * Pay-first estimate API (backend migration 096).
 *
 * The doctor quotes the planned work, the front office collects against the
 * quote through the normal settle flow, and the clinical record STAYS EDITABLE
 * until the visit is finalized — paying an estimate is deliberately not the
 * same thing as closing the record.
 */
import { get, put, post } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export type EstimateStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'RECONCILED' | 'VOID';
export type EstimateItemKind = 'SERVICE' | 'CONSUMABLE' | 'MEDICATION' | 'OTHER';

export interface EstimateItem {
  id: string;
  kind: EstimateItemKind;
  taskId?: string | null;
  inventoryItemId?: string | null;
  name: string;
  category?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface VisitEstimate {
  id: string;
  clinicId: string;
  visitId: string;
  status: EstimateStatus;
  subtotal: number;
  total: number;
  notes?: string | null;
  issuedAt?: string | null;
  paidAt?: string | null;
  reconciledAt?: string | null;
  // Written once at clinical finalize. deltaAmount > 0 ⇒ the client owes the
  // difference; < 0 ⇒ they overpaid and are owed a credit.
  actualTotal?: number | null;
  amountPaid?: number | null;
  deltaAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  items: EstimateItem[];
}

export interface EstimateItemInput {
  kind?: EstimateItemKind;
  taskId?: string | null;
  inventoryItemId?: string | null;
  name: string;
  category?: string | null;
  quantity?: number;
  unitPrice?: number;
}

export const visitEstimatesAPI = {
  /** The visit's quote — `estimate` is null when none has been drafted. */
  get: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ estimate: VisitEstimate | null }>> =>
    get(`/visits/${visitId}/estimate`, { cache: false, silent: true, ...options }),

  /**
   * Create or refresh the DRAFT. Omit `items` to re-snapshot from the visit's
   * current services + reserved consumables; pass them to save an edited quote.
   */
  save: (
    visitId: number | string,
    data: { items?: EstimateItemInput[]; notes?: string | null },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ estimate: VisitEstimate }>> =>
    put(`/visits/${visitId}/estimate`, data, { showError: true, ...options }),

  /** DRAFT → ISSUED. From here the front office can collect against it. */
  issue: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ estimate: VisitEstimate }>> =>
    post(`/visits/${visitId}/estimate/issue`, {}, { showError: true, ...options }),

  /** Abandon an unpaid quote (a settled one reconciles at finalize instead). */
  void: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ estimate: VisitEstimate }>> =>
    post(`/visits/${visitId}/estimate/void`, {}, { showError: true, ...options }),
};

export default visitEstimatesAPI;
