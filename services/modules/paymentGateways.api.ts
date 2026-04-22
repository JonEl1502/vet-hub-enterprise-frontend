/**
 * Payment Gateways API Module — per-clinic BYOK config for Stripe + Mpesa.
 */

import { get, put, patch, post, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { ApiResponse, RequestOptions } from '../api/types';

export type PaymentProvider = 'STRIPE' | 'MPESA';
export type PaymentGatewayMode = 'BYOK' | 'PLATFORM';

export interface PaymentGatewayConfig {
  id: string;
  clinicId: string;
  provider: PaymentProvider;
  mode: PaymentGatewayMode;
  isTestMode: boolean;
  isActive: boolean;
  displayName?: string | null;
  publicConfig: Record<string, string>;
  hasSecret: Record<string, boolean>;
  maskedSecrets: Record<string, string>;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertGatewayPayload {
  mode?: PaymentGatewayMode;
  isTestMode?: boolean;
  isActive?: boolean;
  displayName?: string;
  publicConfig?: Record<string, string>;
  credentials?: Record<string, string>; // plaintext — the server encrypts at rest
}

export interface GatewayTestResult {
  ok: boolean;
  message: string;
  detail?: Record<string, unknown>;
}

export const paymentGatewaysAPI = {
  list: async (
    clinicId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<PaymentGatewayConfig[]>> => {
    return get(ENDPOINTS.PAYMENT_GATEWAYS.FOR_CLINIC(clinicId), { showError: true, ...options });
  },

  upsert: async (
    clinicId: number | string,
    provider: PaymentProvider,
    payload: UpsertGatewayPayload,
    options?: RequestOptions
  ): Promise<ApiResponse<PaymentGatewayConfig>> => {
    return put(ENDPOINTS.PAYMENT_GATEWAYS.BY_PROVIDER(clinicId, provider), payload, {
      showError: true,
      ...options,
    });
  },

  setActive: async (
    clinicId: number | string,
    provider: PaymentProvider,
    isActive: boolean,
    options?: RequestOptions
  ): Promise<ApiResponse<PaymentGatewayConfig>> => {
    return patch(ENDPOINTS.PAYMENT_GATEWAYS.ACTIVE(clinicId, provider), { isActive }, {
      showError: true,
      ...options,
    });
  },

  remove: async (
    clinicId: number | string,
    provider: PaymentProvider,
    options?: RequestOptions
  ): Promise<ApiResponse<null>> => {
    return del(ENDPOINTS.PAYMENT_GATEWAYS.BY_PROVIDER(clinicId, provider), {
      showError: true,
      ...options,
    });
  },

  test: async (
    clinicId: number | string,
    provider: PaymentProvider,
    options?: RequestOptions
  ): Promise<ApiResponse<GatewayTestResult>> => {
    return post(ENDPOINTS.PAYMENT_GATEWAYS.TEST(clinicId, provider), {}, {
      showError: true,
      ...options,
    });
  },
};
