/**
 * Receivables — AR ageing, and what the clinic owes its suppliers.
 *
 * Both are DERIVED server-side from receivables and the money applied to them;
 * neither is a stored balance. So there is nothing to refresh or reconcile —
 * a read is always current.
 */
import { get } from '../api/client';
import { ApiResponse } from '../api/types';

export interface AgeingBucket {
  key: string;
  label: string;
  amount: number;
}

export interface AgeingClient {
  clientId: string;
  name: string;
  phone: string | null;
  total: number;
  oldestDays: number;
  current: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

export interface ArAgeing {
  buckets: AgeingBucket[];
  total: number;
  clients: AgeingClient[];
}

export interface SupplierApRow {
  supplierId: string;
  name: string;
  outstanding: number;
  openOrders: number;
  oldestDays: number;
}

export const receivablesAPI = {
  /** Who owes the clinic, and for how long. Aged from the VISIT date. */
  /**
   * Bills / invoices / receipts per day — how far work gets through the revenue
   * cycle. Distinct from the revenue series, which cannot show work that never
   * became money.
   */
  documentFlow: (from?: string, to?: string): Promise<ApiResponse<any>> =>
    get(`/transactions/document-flow${from && to ? `?from=${from}&to=${to}` : ''}`, { cache: false }),

  arAgeing: (): Promise<ApiResponse<ArAgeing>> =>
    get('/transactions/ar-ageing', { cache: false }),

  /** What the clinic owes suppliers — received value less what has been paid. */
  supplierAp: (): Promise<ApiResponse<{ total: number; suppliers: SupplierApRow[] }>> =>
    get('/suppliers/ap/summary', { cache: false }),
};

export default receivablesAPI;
