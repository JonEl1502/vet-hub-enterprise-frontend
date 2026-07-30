/**
 * ACCOUNTS PAYABLE — what the clinic owes its suppliers.
 *
 * The chain mirrors the receivable side (migration 159):
 *   PurchaseOrder → SupplierInvoice → SupplierPayment → allocation
 *   Visit/Bill    → Invoice         → Transaction     → Settlement
 *
 * Two components make up a balance, and they never overlap:
 *   · INVOICED — the supplier has billed us; the invoice is the payable.
 *   · GRNI     — goods received, not yet billed. A real accrual: we owe for
 *                them, but no document has arrived to pay against.
 * An order with a live invoice is represented BY that invoice, so the same
 * money is never counted as both a received value and an invoice total.
 *
 * Every figure is DERIVED server-side from the allocation rows. Nothing here is
 * a stored balance — `suppliers.outstanding_balance` was, and reached 0.00
 * against 428k of received goods on prod.
 */
import { get, post, patch } from '../api/client';
import { ApiResponse } from '../api/types';

export interface PayableOrder {
  purchaseOrderId: string;
  orderNumber: string | null;
  orderedAt: string;
  receivedValue: number;
  paid: number;
  outstanding: number;
  ageDays: number;
}

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  supplierName: string | null;
  purchaseOrderId: string | null;
  orderNumber: string | null;
  /** THE SUPPLIER'S own number, as printed on their document. */
  number: string;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'VOID';
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  amountPaid: number;
  outstanding: number;
  issuedAt: string | null;
  dueDate: string | null;
  /** Derived on read — never a stored flag, so it can't go stale at midnight. */
  overdue: boolean;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
}

export interface SupplierBalance {
  supplierId: string;
  receivedValue: number;
  paid: number;
  /** invoiced + grni */
  outstanding: number;
  /** Billed by the supplier and still unpaid. */
  invoiced: number;
  /** Received but not yet billed — nothing to pay against yet. */
  grni: number;
  overdue: number;
  openOrders: number;
  openInvoices: number;
  oldestDays: number;
  orders: PayableOrder[];
  invoices: SupplierInvoice[];
}

export interface SupplierApSummaryRow {
  supplierId: string;
  name: string;
  outstanding: number;
  openOrders: number;
  oldestDays: number;
}

export const supplierApAPI = {
  /** Every supplier the clinic owes, worst first. */
  summary: (): Promise<ApiResponse<{ total: number; suppliers: SupplierApSummaryRow[] }>> =>
    get('/suppliers/ap/summary', { cache: false }),

  /** One supplier's full position — invoices AND un-invoiced (GRNI) orders. */
  balance: (supplierId: string | number): Promise<ApiResponse<SupplierBalance>> =>
    get(`/suppliers/${supplierId}/ap`, { cache: false }),

  listInvoices: (
    params: { supplierId?: string | number; status?: string; overdue?: boolean } = {},
  ): Promise<ApiResponse<{ invoices: SupplierInvoice[] }>> => {
    const q = new URLSearchParams();
    if (params.supplierId) q.set('supplierId', String(params.supplierId));
    if (params.status) q.set('status', params.status);
    if (params.overdue) q.set('overdue', 'true');
    const qs = q.toString();
    return get(`/suppliers/ap/invoices${qs ? `?${qs}` : ''}`, { cache: false });
  },

  /**
   * Record an invoice the supplier has billed us.
   * ⚠️ A duplicate number for the same supplier is REFUSED by the server —
   * paying one supplier invoice twice is the classic A/P loss. Surface the
   * message; do not retry.
   */
  createInvoice: (
    supplierId: string | number,
    data: {
      number: string;
      total: number;
      subtotal?: number;
      tax?: number;
      currency?: string;
      purchaseOrderId?: string | null;
      issuedAt?: string | null;
      dueDate?: string | null;
      notes?: string | null;
    },
  ): Promise<ApiResponse<{ invoice: SupplierInvoice }>> =>
    post(`/suppliers/${supplierId}/ap/invoices`, data, { showError: true }),

  /** Void, never delete — the number and the reason survive. */
  voidInvoice: (invoiceId: string | number, reason?: string): Promise<ApiResponse<{ invoice: SupplierInvoice }>> =>
    patch(`/suppliers/ap/invoices/${invoiceId}/void`, { reason }, { showError: true }),

  /**
   * Pay a supplier. Allocation is oldest-first across invoices then GRNI unless
   * a manual split is given.
   */
  recordPayment: (
    supplierId: string | number,
    data: {
      amount: number;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
      paidAt?: string;
      allocations?: Array<{ purchaseOrderId?: string; supplierInvoiceId?: string; amount: number }>;
    },
  ): Promise<ApiResponse<any>> =>
    post(`/suppliers/${supplierId}/ap/payments`, data, { showError: true }),

  /** Soft-delete a payment. Its allocations stop counting immediately. */
  voidPayment: (paymentId: string | number, reason?: string): Promise<ApiResponse<any>> =>
    patch(`/suppliers/ap/payments/${paymentId}/void`, { reason }, { showError: true }),
};

export default supplierApAPI;
