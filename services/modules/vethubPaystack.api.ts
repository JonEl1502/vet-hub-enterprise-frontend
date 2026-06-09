/**
 * VetHub-level (centralized) Paystack subscription payment API client.
 *
 * Paystack hosts the checkout page (card + mobile money / M-Pesa + bank), so
 * the flow is a redirect rather than an in-app STK modal:
 *   1. initiate() → returns { authorizationUrl, reference }
 *   2. We send the user to authorizationUrl.
 *   3. Paystack redirects back to the app; we poll getStatus(reference) until
 *      the webhook flips the attempt to SUCCESS/FAILED.
 *
 * Amounts come from the package / billing-options table (priced server-side),
 * so the caller only passes which package + cycle, plus the payer's email
 * (Paystack requires one).
 */
import { get, post } from '../api/client';
import { ApiResponse } from '../api/types';

export type PaystackAttemptStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface PaystackInitiateResult {
  attemptId: string;
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amount: number;
  currency: string;
  quote?: {
    basePriceUsd: number;
    priceAfterDiscountUsd: number;
    creditAppliedUsd: number;
    effectivePriceUsd: number;
    changeKind: string;
  };
}

export interface PaystackStatus {
  reference: string;
  paystackTransactionId?: string | null;
  authorizationUrl?: string | null;
  status: PaystackAttemptStatus;
  resultCode?: string | null;
  resultDesc?: string | null;
  amount: number;
  currency: string;
  channel?: string | null;
  package: { id: string; name: string; amount: number; currency: string } | null;
  settledAt?: string | null;
}

export const vethubPaystackAPI = {
  initiate: (
    clinicId: string,
    args: {
      packageId: string | number;
      billingOptionId?: string | number;
      cycle?: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';
      email: string;
      phone?: string;
    }
  ): Promise<ApiResponse<PaystackInitiateResult>> =>
    post('/subscriptions/paystack/initiate', args, { headers: { 'x-clinic-id': clinicId } }),

  getStatus: (
    clinicId: string,
    reference: string
  ): Promise<ApiResponse<PaystackStatus>> =>
    get(`/subscriptions/paystack/status/${encodeURIComponent(reference)}`, {
      headers: { 'x-clinic-id': clinicId },
      cache: false,
    }),
};
