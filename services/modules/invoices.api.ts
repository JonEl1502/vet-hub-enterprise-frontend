/**
 * Invoice API — Revenue Cycle P2 (backend migration 101).
 *
 * One invoice per bill, generated from an APPROVED bill. The invoice does not
 * own its line items — it renders the bill's — so it is never edited: a wrong
 * invoice is voided and regenerated.
 */
import { get, post, patch } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export type InvoiceStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'VOID';

export interface InvoiceLine {
  id: string;
  kind: string;
  name: string;
  description?: string | null;
  category?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface Invoice {
  // Split invoicing (170): FULL (whole bill) | CLINICAL | STAY.
  scope?: 'FULL' | 'CLINICAL' | 'STAY' | 'GROOMING';
  id: string;
  number?: string | null;
  billId: string;
  billNumber?: string | null;
  visitId?: string | null;
  clientId?: string | null;
  patientId?: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** Collected on this visit. Derived, never stored. */
  amountPaid: number;
  outstanding: number;
  issuedAt: string;
  dueDate?: string | null;
  notes?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  lines: InvoiceLine[];
}

export interface InvoiceRow {
  id: string;
  number?: string | null;
  billNumber?: string | null;
  visitId?: string | null;
  clientId?: string | null;
  status: InvoiceStatus;
  total: number;
  amountPaid: number;
  outstanding: number;
  issuedAt: string;
  dueDate?: string | null;
}

import type { VisitReconciliation } from './clients.api';

export const invoicesAPI = {
  list: (params?: { status?: string; clientId?: string | number }, options?: RequestOptions): Promise<ApiResponse<{ invoices: InvoiceRow[] }>> => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.clientId) q.set('clientId', String(params.clientId));
    const qs = q.toString();
    return get(`/invoices${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },

  get: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ invoice: Invoice }>> =>
    get(`/invoices/${id}`, { cache: false, ...options }),

  /** This visit's invoice — `invoice` is null when none has been generated. */
  forVisit: (visitId: string | number, options?: RequestOptions): Promise<ApiResponse<{ invoice: Invoice | null }>> =>
    get(`/visits/${visitId}/invoice`, { cache: false, silent: true, ...options }),

  /** Generate from the visit's APPROVED bill. */
  generate: (visitId: string | number, data: { dueDate?: string; scope?: 'FULL' | 'CLINICAL' | 'STAY' | 'GROOMING' } = {}, options?: RequestOptions): Promise<ApiResponse<{ invoice: Invoice }>> =>
    post(`/visits/${visitId}/invoice`, data, { showError: true, ...options }),

  /** Void — the bill returns to APPROVED so it can be corrected and re-issued. */
  void: (id: string | number, reason?: string, options?: RequestOptions): Promise<ApiResponse<{ invoice: Invoice }>> =>
    patch(`/invoices/${id}/void`, { reason }, { showError: true, ...options }),

  /**
   * Apply the discount at the INVOICE step — when the document goes to the
   * client for approval, rather than at collection time (spec §7.6).
   * Additive: the collect-time discount still works. Owner/manager only, and
   * only while the invoice is OPEN with nothing collected against it.
   */
  setDiscount: (
    id: string | number,
    data: { discountType: 'PERCENTAGE' | 'FIXED'; discountValue: number },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ invoice: Invoice }>> =>
    patch(`/invoices/${id}/discount`, data, { showError: true, ...options }),

  /**
   * Receipts raised for a visit's receivable (157). Empty until the bill is
   * FILLED — a part payment issues none.
   */
  receiptsForVisit: (visitId: string | number, options?: RequestOptions): Promise<ApiResponse<{ receipts: VisitReceipt[] }>> =>
    get(`/visits/${visitId}/receipts`, { cache: false, silent: true, ...options }),

  /**
   * The reconciliation slip: final amount / paid so far / balance, plus every
   * payment that has landed. What the front desk hands over while a bill is
   * still part paid.
   */
  reconciliationForVisit: (visitId: string | number, options?: RequestOptions): Promise<ApiResponse<{ reconciliation: VisitReconciliation }>> =>
    get(`/visits/${visitId}/reconciliation`, { cache: false, silent: true, ...options }),
};

/** A receipt as returned by `/visits/:id/receipts`. */
export interface VisitReceipt {
  id: string;
  receiptNumber: string;
  invoiceId: string | null;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  paymentMethod: string;
  issuedAt: string;
  voided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
}

export default invoicesAPI;
