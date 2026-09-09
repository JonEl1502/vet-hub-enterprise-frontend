/**
 * Unified subscription payment-history API. One endpoint returns the
 * clinic's attempts across every VetHub-level gateway (Mpesa, Pesapal,
 * Lipana, Paystack) so the billing screen can render a single timeline.
 */
import { get } from '../api/client';
import { ApiResponse } from '../api/types';

export type PaymentChannel = 'MPESA' | 'PESAPAL' | 'LIPANA' | 'PAYSTACK';

export type PaymentHistoryStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface PaymentHistoryRow {
  id: string;
  channel: PaymentChannel;
  reference: string;          // user-facing identifier (merchant ref / checkout id / etc.)
  transactionId: string | null;
  amount: number;
  currency: string;
  amountUsd: number;
  status: PaymentHistoryStatus;
  resultDesc: string | null;
  packageId: string;
  packageName: string;
  packageCurrency: string;
  packagePrice: number;
  /**
   * 288 — every package this ONE charge bought, when it bought more than one.
   * A plan card can bundle Community Access into the same payment, so the
   * receipt and the invoice itemise rather than naming the plan alone.
   * NULL for an ordinary single-package purchase — the documents fall back to
   * their one-line rendering.
   */
  lineItems: PaymentLineItem[] | null;
  createdAt: string;
  settledAt: string | null;
}

export interface PaymentLineItem {
  packageId: string;
  name: string;
  kind: 'PLAN' | 'ADDON';
  cycle: string;
  amount: number;
  currency: string;
}

export const subscriptionPaymentHistoryAPI = {
  list: (
    clinicId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<ApiResponse<{ rows: PaymentHistoryRow[]; total: number }>> => {
    const params = new URLSearchParams();
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return get(`/subscriptions/payment-history${qs ? `?${qs}` : ''}`, {
      headers: { 'x-clinic-id': clinicId },
      cache: false,
    });
  },

  /**
   * The same statement for a SUPPLIER (225).
   *
   * A separate call rather than an audience flag on `list`, because the header
   * is the whole difference and mixing them invites sending both — which the
   * server resolves supplier-first, but silently, and a caller reading this
   * code could not tell which one it would get.
   */
  listForSupplier: (
    supplierId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<ApiResponse<{ rows: PaymentHistoryRow[]; total: number }>> => {
    const params = new URLSearchParams();
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return get(`/subscriptions/payment-history${qs ? `?${qs}` : ''}`, {
      headers: { 'x-supplier-id': supplierId },
      cache: false,
    });
  },
};
