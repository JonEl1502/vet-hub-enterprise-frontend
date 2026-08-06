/**
 * Revenue Desk API — the READ side of bills + invoices, in one call per tab.
 *
 * Separate from `bills.api` / `invoices.api` on purpose: those are the
 * per-visit documents and their transitions, this is the clinic-wide worklist.
 * Nothing here writes.
 *
 * `stats.byStatus` is counted over the same window and search as `rows` but
 * WITHOUT the status filter — that is what lets the tab bar show a count for
 * the tabs you are not on.
 */
import { get } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';
import type { BillStatus } from './bills.api';
import type { InvoiceStatus } from './invoices.api';

export interface DeskParty { id: string; name: string | null; species?: string | null }

export interface DeskBillRow {
  id: string;
  number?: string | null;
  visitId: string;
  clinicId: string;
  clinicName?: string | null;
  status: BillStatus;
  encounterType?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  lineCount: number;
  isSynthetic: boolean;
  createdAt: string;
  raisedAt?: string | null;
  approvedAt?: string | null;
  clientApprovedAt?: string | null;
  clientApprovalChannels?: string[];
  /** The LIVE invoice raised from this bill (voided ones are excluded). */
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  patient: DeskParty | null;
  client: DeskParty | null;
  visitDate?: string | null;
  isPaid: boolean;
}

export interface DeskInvoiceRow {
  id: string;
  number?: string | null;
  billId: string;
  billNumber?: string | null;
  billStatus?: BillStatus | null;
  scope: string;
  visitId?: string | null;
  clinicId: string;
  clinicName?: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  outstanding: number;
  issuedAt: string;
  dueDate?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  overdue: boolean;
  patient: DeskParty | null;
  client: DeskParty | null;
  visitDate?: string | null;
}

export interface StatusBucket { count: number; amount: number }

export interface DeskBillStats {
  byStatus: Record<string, StatusBucket>;
  totalCount: number;
  totalAmount: number;
  needsActionCount: number;
  needsActionAmount: number;
  awaitingInvoiceCount: number;
  awaitingInvoiceAmount: number;
}

export interface DeskInvoiceStats {
  byStatus: Record<string, StatusBucket>;
  totalCount: number;
  totalAmount: number;
  /** OPEN + PARTIAL in this window. Receivables owns the all-time balance. */
  outstandingAmount: number;
  collectedAmount: number;
  overdueCount: number;
  overdueAmount: number;
}

export interface DeskQuery {
  /** One state, a comma-separated list, or `ALL`. Omitted ⇒ everything. */
  status?: string;
  /** Last N days by created (bills) / issued (invoices). Omitted ⇒ all time. */
  days?: number;
  search?: string;
  limit?: number;
}

const qs = (params?: DeskQuery) => {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.days) q.set('days', String(params.days));
  if (params?.search) q.set('search', params.search);
  if (params?.limit) q.set('limit', String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const revenueDeskAPI = {
  bills: (params?: DeskQuery, options?: RequestOptions): Promise<ApiResponse<{ rows: DeskBillRow[]; stats: DeskBillStats }>> =>
    get(`/revenue-desk/bills${qs(params)}`, { cache: false, ...options }),

  invoices: (params?: DeskQuery, options?: RequestOptions): Promise<ApiResponse<{ rows: DeskInvoiceRow[]; stats: DeskInvoiceStats }>> =>
    get(`/revenue-desk/invoices${qs(params)}`, { cache: false, ...options }),
};

export default revenueDeskAPI;
