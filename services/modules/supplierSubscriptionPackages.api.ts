/**
 * Supplier Subscription Packages API — admin CRUD for the plans suppliers see
 * on their billing screen (supplier_subscription_packages table). Separate from
 * subscriptionPackages.api, which manages the CLINIC plans.
 */

import { get, post, put, del } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export type Region =
  | 'AFRICA' | 'ASIA' | 'LATAM' | 'MIDDLE_EAST'
  | 'EUROPE' | 'OCEANIA' | 'NORTH_AMERICA';

export interface SupplierPackage {
  id: string;
  name: string;
  price: number;        // `amount` column, surfaced as price
  currency: string;     // ISO-4217
  region: Region;
  billingCycle: 'MONTHLY' | 'YEARLY';
  features: string[];
  tier: number;
  maxStaff: number;
  storageGb: number;
  discountPercentage?: number;
  stripePriceId?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSupplierPackagePayload {
  name: string;
  region: Region;
  currency: string;
  price?: number;
  amount?: number;
  billingCycle?: 'MONTHLY' | 'YEARLY';
  features?: string[];
  tier?: number;
  maxStaff?: number;
  storageGb?: number;
  discountPercentage?: number;
  stripePriceId?: string | null;
  isActive?: boolean;
}

const BASE = '/supplier-subscription-packages';

export const supplierSubscriptionPackagesAPI = {
  list: (options?: RequestOptions): Promise<ApiResponse<{ packages: SupplierPackage[] }>> =>
    get(BASE, { cache: false, ...options }),

  getById: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ package: SupplierPackage }>> =>
    get(`${BASE}/${id}`, { cache: false, ...options }),

  create: (data: CreateSupplierPackagePayload, options?: RequestOptions): Promise<ApiResponse<{ package: SupplierPackage }>> =>
    post(BASE, data, { showError: true, ...options }),

  update: (id: string | number, data: Partial<CreateSupplierPackagePayload>, options?: RequestOptions): Promise<ApiResponse<{ package: SupplierPackage }>> =>
    put(`${BASE}/${id}`, data, { showError: true, ...options }),

  delete: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ ok: boolean }>> =>
    del(`${BASE}/${id}`, { showError: true, ...options }),
};
