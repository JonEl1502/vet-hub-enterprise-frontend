/**
 * Payment Gateways API Module — per-owner BYOK config (Stripe + Mpesa + Pesapal).
 *
 * The backend supports two ownership scopes:
 *   - 'clinic'   → /api/v1/clinics/:clinicId/payment-gateways
 *   - 'supplier' → /api/v1/suppliers/:supplierId/payment-gateways
 *
 * The original `paymentGatewaysAPI` keeps the clinic-only signature so existing
 * call sites (PaymentGatewaysTab in ClinicWallet etc) don't have to change.
 * Supplier callers use `supplierPaymentGatewaysAPI`.
 */

import { get, put, patch, post, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { ApiResponse, RequestOptions } from '../api/types';

export type PaymentProvider = 'STRIPE' | 'MPESA' | 'PESAPAL';
export type PaymentGatewayMode = 'BYOK' | 'PLATFORM';

export interface PaymentGatewayConfig {
  id: string;
  clinicId: string | null;
  supplierId: string | null;
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

export const supplierPaymentGatewaysAPI = {
  list: async (
    supplierId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<PaymentGatewayConfig[]>> => {
    return get(ENDPOINTS.PAYMENT_GATEWAYS.FOR_SUPPLIER(supplierId), { showError: true, ...options });
  },

  upsert: async (
    supplierId: number | string,
    provider: PaymentProvider,
    payload: UpsertGatewayPayload,
    options?: RequestOptions
  ): Promise<ApiResponse<PaymentGatewayConfig>> => {
    return put(ENDPOINTS.PAYMENT_GATEWAYS.SUPPLIER_BY_PROVIDER(supplierId, provider), payload, {
      showError: true,
      ...options,
    });
  },

  setActive: async (
    supplierId: number | string,
    provider: PaymentProvider,
    isActive: boolean,
    options?: RequestOptions
  ): Promise<ApiResponse<PaymentGatewayConfig>> => {
    return patch(ENDPOINTS.PAYMENT_GATEWAYS.SUPPLIER_ACTIVE(supplierId, provider), { isActive }, {
      showError: true,
      ...options,
    });
  },

  remove: async (
    supplierId: number | string,
    provider: PaymentProvider,
    options?: RequestOptions
  ): Promise<ApiResponse<null>> => {
    return del(ENDPOINTS.PAYMENT_GATEWAYS.SUPPLIER_BY_PROVIDER(supplierId, provider), {
      showError: true,
      ...options,
    });
  },

  test: async (
    supplierId: number | string,
    provider: PaymentProvider,
    options?: RequestOptions
  ): Promise<ApiResponse<GatewayTestResult>> => {
    return post(ENDPOINTS.PAYMENT_GATEWAYS.SUPPLIER_TEST(supplierId, provider), {}, {
      showError: true,
      ...options,
    });
  },
};
