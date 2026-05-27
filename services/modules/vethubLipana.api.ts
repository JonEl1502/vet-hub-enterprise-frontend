/**
 * VetHub-level (centralized) Lipana subscription payment API client.
 * Mirrors vethubMpesa.api: per-clinic dynamic payment links with attribution
 * (merchantReference) so the webhook can auto-activate the right subscription.
 *
 * The static link stored on a package row (lipanaStaticLinkUrl) is the
 * "Lipana enabled for this tier" gate the UI checks; the actual click flow
 * goes through initiate() below to get a fresh per-clinic redirect URL.
 */
import { get, post } from '../api/client';
import { ApiResponse } from '../api/types';

export type LipanaAttemptStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface LipanaInitiateResult {
  // Discriminator — backend picks STK when caller sends phone, else
  // falls back to the hosted-page link.
  mode: 'STK' | 'HOSTED_LINK';
  attemptId: string;
  merchantReference: string;
  amount: number;
  currency: string;
  quote?: {
    basePriceUsd: number;
    priceAfterDiscountUsd: number;
    creditAppliedUsd: number;
    effectivePriceUsd: number;
    changeKind: string;
  };
  // mode === 'STK' fields
  transactionId?: string;
  checkoutRequestID?: string;
  message?: string;
  // mode === 'HOSTED_LINK' fields
  paymentLinkId?: string;
  paymentLinkSlug?: string;
  redirectUrl?: string;
}

export interface LipanaStatus {
  merchantReference: string;
  transactionId?: string | null;
  paymentLinkId?: string | null;
  paymentLinkUrl?: string | null;
  status: LipanaAttemptStatus;
  resultCode?: number | null;
  resultDesc?: string | null;
  amount: number;
  currency: string;
  package: { id: string; name: string; amount: number; currency: string } | null;
  settledAt?: string | null;
}

export const vethubLipanaAPI = {
  initiate: (
    clinicId: string,
    args: { packageId: string | number; email?: string; phone?: string }
  ): Promise<ApiResponse<LipanaInitiateResult>> =>
    post('/subscriptions/lipana/initiate', args, { headers: { 'x-clinic-id': clinicId } }),

  getStatus: (
    clinicId: string,
    reference: string
  ): Promise<ApiResponse<LipanaStatus>> =>
    get(`/subscriptions/lipana/status/${encodeURIComponent(reference)}`, {
      headers: { 'x-clinic-id': clinicId },
      cache: false,
    }),
};
