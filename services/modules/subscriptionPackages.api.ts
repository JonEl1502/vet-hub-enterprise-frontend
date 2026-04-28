/**
 * Subscription Packages API Module — admin CRUD for plans + per-plan features.
 */

import { get, post, put, del } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export type Region =
  | 'AFRICA' | 'ASIA' | 'LATAM' | 'MIDDLE_EAST'
  | 'EUROPE' | 'OCEANIA' | 'NORTH_AMERICA';

// Each row is a (plan, region, currency) variant after migration 007.
export interface SubscriptionPackagePlan {
  id: string;
  name: string;
  price: number;        // amount column on the server, surfaced as `price` for compat
  currency: string;     // ISO-4217 — USD, KES, EUR…
  region: Region;
  billingCycle: 'MONTHLY' | 'YEARLY';
  features: string[];
  tier: number;
  maxPatients: number;
  maxStaff: number;
  storageGb: number;
  isActive: boolean;
  stripePriceId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePackagePayload {
  name: string;
  region: Region;
  currency: string;
  amount: number;       // backend column name — sent verbatim on create/update
  billingCycle: 'MONTHLY' | 'YEARLY';
  features?: string[];
  tier?: number;
  maxPatients?: number;
  maxStaff?: number;
  storageGb?: number;
  isActive?: boolean;
  stripePriceId?: string | null;
}

const BASE = '/subscription-packages';

export const subscriptionPackagesAPI = {
  list: (options?: RequestOptions): Promise<ApiResponse<{ packages: SubscriptionPackagePlan[] }>> =>
    get(BASE, { cache: false, ...options }),

  getById: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ package: SubscriptionPackagePlan }>> =>
    get(`${BASE}/${id}`, { cache: false, ...options }),

  create: (data: CreatePackagePayload, options?: RequestOptions): Promise<ApiResponse<{ package: SubscriptionPackagePlan }>> =>
    post(BASE, data, { showError: true, ...options }),

  update: (id: string | number, data: Partial<CreatePackagePayload>, options?: RequestOptions): Promise<ApiResponse<{ package: SubscriptionPackagePlan }>> =>
    put(`${BASE}/${id}`, data, { showError: true, ...options }),

  delete: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ message: string }>> =>
    del(`${BASE}/${id}`, { showError: true, ...options }),

  addFeature: (id: string | number, feature: string, options?: RequestOptions): Promise<ApiResponse<{ package: SubscriptionPackagePlan }>> =>
    post(`${BASE}/${id}/features`, { feature }, { showError: true, ...options }),

  removeFeature: (id: string | number, feature: string, options?: RequestOptions): Promise<ApiResponse<{ package: SubscriptionPackagePlan }>> =>
    del(`${BASE}/${id}/features/${encodeURIComponent(feature)}`, { showError: true, ...options }),
};

/**
 * Catalog of common views + services that admins can attach to a plan.
 * Stored as plain feature strings on the package (no schema change needed).
 * Matching is by exact string equality, so use stable identifiers.
 */
export const FEATURE_CATALOG = {
  views: [
    'view:dashboard',
    'view:appointments',
    'view:clients',
    'view:patients',
    'view:inventory',
    'view:purchase-orders',
    'view:suppliers',
    'view:partners',
    'view:financial-overview',
    'view:b2b-stats',
    'view:transactions',
    'view:financial-core',
    'view:staff',
    'view:settings',
    'view:import-data',
    'view:billing',
    'view:ai-tools',
  ],
  services: [
    'service:appointment-scheduling',
    'service:medical-records',
    'service:vaccination-tracking',
    'service:medication-tracking',
    'service:inventory-mgmt',
    'service:financial-reports',
    'service:b2b-referrals',
    'service:ai-diagnostics',
    'service:multi-clinic',
    'service:custom-integrations',
    'service:priority-support',
    'service:dedicated-am',
  ],
};
