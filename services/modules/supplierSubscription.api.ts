/**
 * Supplier Subscription API Module
 * Uses the direct /supplier-subscriptions endpoints (no Stripe dependency).
 */

import { get, post, del } from '../api/client';
import { ApiResponse } from '../api/types';

export interface SubscriptionPackage {
  id: string;
  name: string;
  price: number;
  tier: number;
  features: string[];
  billingCycle: 'MONTHLY' | 'YEARLY';
  maxPatients: number;
  maxStaff: number;
  storageGb: number;
  stripePriceId?: string | null;
}

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

export const supplierSubscriptionAPI = {
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
    const packages: SubscriptionPackage[] = (res.data?.packages ?? []).map((p: any) => ({
      id: String(p.id),
      name: p.name,
      price: Number(p.price),
      tier: p.tier ?? 0,
      features: p.features ?? [],
      billingCycle: p.billingCycle ?? 'MONTHLY',
      maxPatients: p.maxPatients ?? -1,
      maxStaff: p.maxStaff ?? -1,
      storageGb: p.storageGb ?? 0,
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
