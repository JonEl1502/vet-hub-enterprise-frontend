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

  /** Current active subscription — proxied through /stripe/info which is the working endpoint */
  getActive: async (clinicId: string): Promise<ApiResponse<{ subscription: ClinicSubscription | null }>> => {
    const res = await get<any>('/stripe/info', { headers: { 'x-clinic-id': clinicId } });
    const sub = res.data?.subscription ?? null;
    if (!sub) return { ...res, data: { subscription: null } };
    const mapped: ClinicSubscription = {
      id: sub.id,
      clinicId,
      packageId: sub.package?.id ?? '',
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
      isActive: sub.isActive,
      autoRenew: sub.autoRenew ?? false,
      amountPaid: sub.amountPaid ?? 0,
      creditApplied: sub.creditApplied ?? 0,
      upgradedFromId: sub.upgradedFromId ?? null,
      stripeSubscriptionId: sub.stripeSubscriptionId ?? null,
      createdAt: sub.startedAt,
      updatedAt: sub.startedAt,
      package: sub.package ? {
        id: sub.package.id,
        name: sub.package.name,
        price: sub.package.price,
        tier: sub.package.tier ?? 0,
        features: sub.package.features ?? [],
        billingCycle: sub.package.billingCycle,
        maxPatients: sub.package.maxPatients ?? -1,
        maxStaff: sub.package.maxStaff ?? -1,
        storageGb: sub.package.storageGb ?? 0,
      } : null,
    };
    return { ...res, data: { subscription: mapped } };
  },

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
