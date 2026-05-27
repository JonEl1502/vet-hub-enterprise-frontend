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
  createdAt: string;
  settledAt: string | null;
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
};
