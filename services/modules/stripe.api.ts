/**
 * Stripe Billing API Module
 */

import { get, post } from '../api/client';
import { ApiResponse } from '../api/types';

export interface SubscriptionPackage {
  id: string;
  name: string;
  price: number;
  billingCycle: 'MONTHLY' | 'YEARLY';
  features: string[];
  maxPatients: number;
  maxStaff: number;
  storageGb: number;
  stripePriceId: string | null;
}

export interface ClinicSubscriptionInfo {
  id: string;
  stripeSubscriptionId: string | null;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
  autoRenew: boolean;
  package: SubscriptionPackage | null;
}

export interface BillingInfo {
  subscription: ClinicSubscriptionInfo | null;
  hasStripeCustomer: boolean;
  packages: SubscriptionPackage[];
}

export const stripeAPI = {
  /** Get current subscription info and available packages */
  getInfo: async (clinicId: string): Promise<ApiResponse<BillingInfo>> => {
    return get('/stripe/info', {
      headers: { 'x-clinic-id': clinicId },
    });
  },

  /** Create a Stripe Checkout Session — returns redirect URL */
  createCheckout: async (clinicId: string, priceId: string): Promise<ApiResponse<{ url: string; sessionId: string }>> => {
    return post('/stripe/checkout', { priceId }, {
      headers: { 'x-clinic-id': clinicId },
    });
  },

  /** Create a Stripe Billing Portal Session — returns redirect URL */
  createPortal: async (clinicId: string): Promise<ApiResponse<{ url: string }>> => {
    return post('/stripe/portal', {}, {
      headers: { 'x-clinic-id': clinicId },
    });
  },

  /** Get the Stripe publishable key */
  getPublishableKey: async (): Promise<ApiResponse<{ publishableKey: string }>> => {
    return get('/stripe/publishable-key');
  },
};
