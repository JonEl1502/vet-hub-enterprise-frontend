/**
 * Supplier Subscription API Module
 * Uses the direct /supplier-subscriptions endpoints (no Stripe dependency).
 */

import { get, post, del } from '../api/client';
import { ApiResponse } from '../api/types';

/**
 * Re-exported from the canonical clinic type so the supplier billing page can
 * feed the SAME PlanCard the clinic page uses. It used to be a narrower local
 * shape, and the mapper below quietly dropped billingOptions / featureKeys /
 * featuredCycle — so every supplier plan rendered as a bare monthly price with
 * no cycle picker (user, 2026-08-22).
 */
export type { SubscriptionPackage } from './stripe.api';
import type { SubscriptionPackage } from './stripe.api';

export interface SupplierSubscription {
  id: string;
  supplierId: string;
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
  package: SubscriptionPackage | null;
}

export interface UpgradePreview {
  currentPackage: string | null;
  daysElapsed: number;
  amountSpent: number;
  creditAvailable: number;
  newPackage: { id: string; name: string; price: number; tier: number };
  amountDue: number;
}

export interface SupplierPlanAccess {
  state: 'TRIAL' | 'ACTIVE' | 'LOCKED';
  featureKeys: string[];        // ['*'] during trial = everything
  packageName: string | null;
  tier: number | null;
  trialEndsAt: string | null;
  expiresAt: string | null;
  maxBranches: number;
}

export const supplierSubscriptionAPI = {
  /** Plan access state + entitled feature keys — drives supplier module gating. */
  getAccess: (supplierId: string): Promise<ApiResponse<SupplierPlanAccess>> =>
    get(`/supplier-subscriptions/${supplierId}/access`, {
      headers: { 'x-supplier-id': supplierId },
      cache: false,
    }),

  /** All subscription history for a supplier, newest first */
  getAll: (supplierId: string): Promise<ApiResponse<{ subscriptions: SupplierSubscription[] }>> =>
    get(`/supplier-subscriptions/${supplierId}`, {
      headers: { 'x-supplier-id': supplierId },
    }),

  /** Current active subscription */
  getActive: (supplierId: string): Promise<ApiResponse<{ subscription: SupplierSubscription | null }>> =>
    get(`/supplier-subscriptions/${supplierId}/active`, {
      headers: { 'x-supplier-id': supplierId },
    }),

  /** Available packages (fetched via stripe/supplier/info which returns packages always) */
  getPackages: async (supplierId: string): Promise<ApiResponse<{ packages: SubscriptionPackage[] }>> => {
    const res = await get<any>('/stripe/supplier/info', {
      headers: { 'x-supplier-id': supplierId },
    });
    // Carry the WHOLE package through. Anything this mapper forgets is
    // invisible on the page no matter what the API sent.
    const packages: SubscriptionPackage[] = (res.data?.packages ?? []).map((p: any) => ({
      id: String(p.id),
      name: p.name,
      price: Number(p.price),
      currency: p.currency ?? 'KES',
      tier: p.tier ?? 0,
      features: p.features ?? [],
      featureKeys: p.featureKeys ?? [],
      isAddon: p.isAddon ?? false,
      billingCycle: p.billingCycle ?? 'MONTHLY',
      featuredCycle: p.featuredCycle ?? 'MONTHLY',
      maxPatients: p.maxPatients ?? -1,
      maxClients: p.maxClients ?? -1,
      maxStaff: p.maxStaff ?? -1,
      storageGb: p.storageGb ?? 0,
      maxBranches: p.maxBranches ?? 0,
      audiences: p.audiences ?? ['SUPPLIER'],
      billingOptions: (p.billingOptions ?? []).map((o: any) => ({
        id: String(o.id),
        cycle: o.cycle,
        price: Number(o.price),
        currency: o.currency ?? p.currency ?? 'KES',
        discountPct: Number(o.discountPct ?? 0),
      })),
      stripePriceId: p.stripePriceId ?? null,
    }));
    return { ...res, data: { packages } };
  },

  /** Preview proration before committing an upgrade */
  previewUpgrade: (supplierId: string, newPackageId: string): Promise<ApiResponse<{ preview: UpgradePreview }>> =>
    get(`/supplier-subscriptions/${supplierId}/preview-upgrade/${newPackageId}`, {
      headers: { 'x-supplier-id': supplierId },
    }),

  /** Subscribe or upgrade to a package */
  subscribe: (
    supplierId: string,
    payload: { packageId: string; autoRenew?: boolean },
  ): Promise<ApiResponse<{ subscription: SupplierSubscription }>> =>
    post(`/supplier-subscriptions/${supplierId}/subscribe`, payload, {
      headers: { 'x-supplier-id': supplierId },
    }),

  /** Cancel a subscription */
  cancel: (supplierId: string, subscriptionId: string): Promise<ApiResponse<{ subscription: SupplierSubscription }>> =>
    del(`/supplier-subscriptions/${supplierId}/${subscriptionId}`, {
      headers: { 'x-supplier-id': supplierId },
    }),
};
