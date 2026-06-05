/**
 * Stripe Billing API Module
 */

import { get, post } from '../api/client';
import { ApiResponse } from '../api/types';

export type Region =
  | 'AFRICA' | 'ASIA' | 'LATAM' | 'MIDDLE_EAST'
  | 'EUROPE' | 'OCEANIA' | 'NORTH_AMERICA';

export interface SubscriptionPackage {
  id: string;
  name: string;
  price: number;
  /** ISO-4217 of the price the user will be charged. Defaults to USD when no region row exists. */
  currency?: string;
  tier: number;
  billingCycle: 'MONTHLY' | 'YEARLY';
  features: string[];
  maxPatients: number;
  maxClients?: number;
  maxStaff: number;
  storageGb: number;
  /** Optional — populated only by callers that still need it (e.g. supplier flow); not on the clinic /stripe/info response. */
  stripePriceId?: string | null;
  /** Optional Lipana hosted-pay URL for this tier (e.g. https://lipana.dev/pay/vethub-pro). When set, the billing UI shows a secondary "Pay via Lipana" button. */
  lipanaStaticLinkUrl?: string | null;
  /** Per-cycle pricing variants (Monthly/Quarterly/6mo/Yearly). When present the billing UI shows a cycle selector; the selected option's id+price drive the subscribe flow. */
  billingOptions?: Array<{
    id: string;
    cycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';
    price: number;
    currency: string;
    discountPct: number;
    lipanaStaticLinkUrl: string | null;
  }>;
  /** Admin-chosen "featured" billing cycle — the one the customer sees pre-selected on the plan card. */
  featuredCycle?: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';
  /** Which account types this package is offered to (chips in the admin editor). */
  audiences?: Array<'CLINIC' | 'SUPPLIER' | 'FREELANCER'>;
}

export interface ClinicSubscriptionInfo {
  id: string;
  stripeSubscriptionId: string | null;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
  autoRenew: boolean;
  amountPaid?: number;
  creditApplied?: number;
  upgradedFromId?: string | null;
  // Cancellation state (added migration 033). NULL when sub has never been
  // cancelled. NOW-mode cancellations also flip isActive=false.
  cancellationMode?: 'NOW' | 'END_OF_CYCLE' | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancellationScheduledFor?: string | null;
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';
  package: SubscriptionPackage | null;
}

export interface BillingInfo {
  subscription: ClinicSubscriptionInfo | null;
  hasStripeCustomer: boolean;
  packages: SubscriptionPackage[];
  /** Resolved from the clinic's region column. Drives which price rows packages contain. */
  region?: Region | null;
  countryCode?: string | null;
  dialCode?: string | null;
  // Trial + access state — derived server-side from clinic.trialEndsAt
  // and the active subscription. hasAccess === false when both are gone.
  trialEndsAt?: string | null;
  isInTrial?: boolean;
  trialDaysLeft?: number;
  subscriptionDaysLeft?: number;
  hasAccess?: boolean;
}

export interface SupplierBillingInfo {
  subscription: ClinicSubscriptionInfo | null;
  hasStripeCustomer: boolean;
  packages: SubscriptionPackage[];
}

export const supplierStripeAPI = {
  /** Get current subscription info and available packages for a supplier */
  getInfo: async (supplierId: string): Promise<ApiResponse<SupplierBillingInfo>> => {
    return get('/stripe/supplier/info', {
      headers: { 'x-supplier-id': supplierId },
    });
  },

  /** Create a Stripe Checkout Session for a supplier */
  createCheckout: async (supplierId: string, priceId: string, packageId?: string): Promise<ApiResponse<{ url: string; sessionId: string }>> => {
    return post('/stripe/supplier/checkout', { priceId, packageId }, {
      headers: { 'x-supplier-id': supplierId },
    });
  },

  /** Create a Stripe Billing Portal Session for a supplier */
  createPortal: async (supplierId: string): Promise<ApiResponse<{ url: string }>> => {
    return post('/stripe/supplier/portal', {}, {
      headers: { 'x-supplier-id': supplierId },
    });
  },
};

export const stripeAPI = {
  /** Get current subscription info and available packages */
  getInfo: async (clinicId: string): Promise<ApiResponse<BillingInfo>> => {
    return get('/stripe/info', {
      headers: { 'x-clinic-id': clinicId },
    });
  },

  /** Create a Stripe Checkout Session — returns redirect URL */
  createCheckout: async (clinicId: string, priceId: string, packageId?: string): Promise<ApiResponse<{ url: string; sessionId: string }>> => {
    return post('/stripe/checkout', { priceId, packageId }, {
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

  /** Manually sync subscription from a checkout session ID.
   *  Call this when the user returns from Stripe checkout to provision the
   *  subscription without waiting for the webhook.
   */
  syncSession: async (sessionId: string): Promise<ApiResponse<{ synced: boolean; reason?: string; subscriptionId?: string }>> => {
    return post('/stripe/sync-session', { sessionId });
  },
};
