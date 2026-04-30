/**
 * VetHub-level (centralized) Mpesa subscription payment API client.
 * Distinct from the BYOK Mpesa flow used inside appointments.
 */
import { get, post } from '../api/client';
import { ApiResponse } from '../api/types';

export type MpesaAttemptStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface MpesaInitiateResult {
  attemptId: string;
  checkoutRequestId: string;
  merchantRequestId?: string;
  message: string;
  amount: number;
  currency: string;
}

export interface MpesaStatus {
  checkoutRequestId: string;
  status: MpesaAttemptStatus;
  resultCode?: number | null;
  resultDesc?: string | null;
  mpesaReceiptNumber?: string | null;
  amount: number;
  currency: string;
  package: { id: string; name: string; amount: number; currency: string } | null;
  settledAt?: string | null;
}

export const vethubMpesaAPI = {
  initiate: (
    clinicId: string,
    args: { packageId: string | number; phone: string }
  ): Promise<ApiResponse<MpesaInitiateResult>> =>
    post('/subscriptions/mpesa/initiate', args, { headers: { 'x-clinic-id': clinicId } }),

  getStatus: (
    clinicId: string,
    checkoutRequestId: string
  ): Promise<ApiResponse<MpesaStatus>> =>
    get(`/subscriptions/mpesa/status/${encodeURIComponent(checkoutRequestId)}`, {
      headers: { 'x-clinic-id': clinicId },
      cache: false,
    }),
};
