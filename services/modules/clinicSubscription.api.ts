/**
 * Clinic Subscription API Module
 * Calls the in-house /clinic-subscriptions endpoints (not Stripe).
 */

import { get, post, del } from '../api/client';
import { ApiResponse } from '../api/types';

export interface SubscriptionPackageSummary {
  id: string;
  name: string;
  price: number;
  tier: number;
  features: string[];
  billingCycle: 'MONTHLY' | 'YEARLY';
  maxPatients: number;
  maxStaff: number;
  storageGb: number;
}

export interface ClinicSubscription {
  id: string;
  clinicId: string;
  packageId: string;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
  autoRenew: boolean;
  amountPaid: number;
  creditApplied: number;
  upgradedFromId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
  package: SubscriptionPackageSummary | null;
}

export interface UpgradePreview {
  currentPackage: string | null;
  daysElapsed: number;
  amountSpent: number;
  creditAvailable: number;
  newPackage: {
    id: string;
    name: string;
    price: number;
    tier: number;
  };
  amountDue: number;
}

export const clinicSubscriptionAPI = {
  /** All subscription history for a clinic, newest first */
  getAll: async (clinicId: string): Promise<ApiResponse<{ subscriptions: ClinicSubscription[] }>> =>
    get(`/clinic-subscriptions/${clinicId}`, { headers: { 'x-clinic-id': clinicId } }),

  /** Current active subscription (null if none) */
  getActive: async (clinicId: string): Promise<ApiResponse<{ subscription: ClinicSubscription | null }>> =>
    get(`/clinic-subscriptions/${clinicId}/active`, { headers: { 'x-clinic-id': clinicId } }),

  /** Preview proration before committing an upgrade */
  previewUpgrade: async (clinicId: string, newPackageId: string): Promise<ApiResponse<{ preview: UpgradePreview }>> =>
    get(`/clinic-subscriptions/${clinicId}/preview-upgrade/${newPackageId}`, { headers: { 'x-clinic-id': clinicId } }),

  /** Subscribe / upgrade to a package */
  subscribe: async (
    clinicId: string,
    payload: { packageId: string; autoRenew?: boolean },
  ): Promise<ApiResponse<{ subscription: ClinicSubscription }>> =>
    post(`/clinic-subscriptions/${clinicId}/subscribe`, payload, { headers: { 'x-clinic-id': clinicId } }),

  /** Cancel a subscription */
  cancel: async (clinicId: string, subscriptionId: string): Promise<ApiResponse<{ subscription: ClinicSubscription }>> =>
    del(`/clinic-subscriptions/${clinicId}/${subscriptionId}`, { headers: { 'x-clinic-id': clinicId } }),
};
