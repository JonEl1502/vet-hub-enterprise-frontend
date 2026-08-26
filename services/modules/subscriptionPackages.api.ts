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
  features: string[];        // human-readable card bullets
  featureKeys?: string[];    // machine gating keys (view:* / service:*) — the access gate reads this
  tier: number;
  maxPatients: number;
  maxClients?: number;
  maxStaff: number;
  storageGb: number;
  maxBranches?: number;      // branch clinics this plan may run (0 = none / Enterprise-only)
  maxFarms?: number;         // 231 — farms this plan may hold (0 = UNLIMITED, gated by livestock:farms)
  /**
   * 252 — concurrent signed-in devices per USER on this plan. 0 = UNLIMITED,
   * same convention as maxBranches / maxFarms. Going over evicts the OLDEST
   * session; the new sign-in always wins, so nobody is ever locked out.
   */
  maxDevices?: number;
  /** Add-ons layer OVER a base plan instead of replacing it (AI Assist). */
  isAddon?: boolean;
  isActive: boolean;
  discountPercentage?: number;
  stripePriceId?: string | null;
  // Admin-chosen default billing cycle the customer card opens on.
  featuredCycle?: BillingOptionCycle;
  /** Which account types this package is offered to. Defaults to ['CLINIC']. */
  audiences?: PackageAudience[];
  billingOptions?: BillingOption[];
  createdAt?: string;
  updatedAt?: string;
}

export type BillingOptionCycle = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY' | 'BIENNIAL' | 'TRIENNIAL';
export type PackageAudience = 'CLINIC' | 'SUPPLIER' | 'FREELANCER' | 'CLIENT' | 'LIVESTOCK';

export interface BillingOption {
  id: string;
  cycle: BillingOptionCycle;
  price: number;
  currency: string;
  discountPct: number;
  isActive: boolean;
  sortOrder: number;
}

export interface BillingOptionInput {
  price: number;
  currency?: string;
  discountPct?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreatePackagePayload {
  name: string;
  region: Region;
  currency: string;
  amount?: number;      // backend column — sent verbatim on create/update
  price?: number;       // alias accepted by the backend
  billingCycle: 'MONTHLY' | 'YEARLY';
  features?: string[];
  featureKeys?: string[];
  tier?: number;
  maxPatients?: number;
  maxClients?: number;
  maxStaff?: number;
  storageGb?: number;
  maxBranches?: number;
  maxFarms?: number;
  maxDevices?: number;
  isAddon?: boolean;
  isActive?: boolean;
  discountPercentage?: number;
  stripePriceId?: string | null;
  featuredCycle?: BillingOptionCycle;
  audiences?: PackageAudience[];
}

const BASE = '/subscription-packages';

export const subscriptionPackagesAPI = {
  // Public catalog. Anonymous → just `packages`. With a token → also
  // `currentPackageId` (the caller's active package, for "Current plan" marking).
  list: (options?: RequestOptions): Promise<ApiResponse<{ packages: SubscriptionPackagePlan[]; currentPackageId?: string | null }>> =>
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

  upsertBillingOption: (
    id: string | number,
    cycle: BillingOptionCycle,
    data: BillingOptionInput,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ option: BillingOption }>> =>
    put(`${BASE}/${id}/billing-options/${cycle}`, data, { showError: true, ...options }),

  deleteBillingOption: (
    id: string | number,
    cycle: BillingOptionCycle,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ ok: boolean }>> =>
    del(`${BASE}/${id}/billing-options/${cycle}`, { showError: true, ...options }),
};

/**
 * Catalog of common views + services that admins can attach to a plan.
 * Stored as plain feature strings on the package (no schema change needed).
 * Matching is by exact string equality, so use stable identifiers.
 */
export const FEATURE_CATALOG = {
  views: [
    // ── Core ────────────────────────────────────────────────────
    'view:dashboard',
    'view:patients',
    'view:clients',
    'view:reminders',
    'view:appointment-bookings',
    'view:appointments',          // "Visits"
    'view:emergency',
    // ── Clinical modules ────────────────────────────────────────
    'view:laboratory',
    'view:imaging',
    'view:surgery',
    'view:inpatient',
    'view:boarding',
    'view:grooming',
    // ── Retail / dispensing ─────────────────────────────────────
    'view:petshop',
    'view:pharmacy',
    // ── Inventory & procurement ─────────────────────────────────
    'view:inventory',
    'view:procedures',
    'view:workflows',
    'view:vaccine-packages',
    'view:service-bundles',
    'view:purchase-orders',
    'view:suppliers',
    // ── Partners & finance ──────────────────────────────────────
    'view:partners',
    'view:financial-overview',
    'view:b2b-stats',
    'view:transactions',
    'view:financial-core',
    // ── Clinic management (always granted — see ALWAYS_VIEWS) ───
    'view:staff',
    'view:settings',
    'view:import-data',
    'view:billing',
    // ── Add-on only (never seeded onto a tier) ──────────────────
    'view:ai-tools',
  ],
  /**
   * In-page capabilities — gate a control inside an allowed page rather than
   * the page itself (e.g. the image uploader on a lab result). Rendered by
   * `<UpgradeGate>` as an inline "upgrade" panel when absent.
   */
  capabilities: [
    'capability:attachments',
    'capability:exports',
    'capability:client-portal',
    // Visit workflow builder (136–138). The PAGE and the BUILDER are Pro;
    // publishing to the shared library is Enterprise.
    'capability:workflow-builder',
    'capability:workflow-share',
    // Standing per-patient feeding programs (boarding/inpatient food card).
    // Pro and Enterprise (user, 2026-08-03: "pkg to be available to enterprise
    // too"). It was gated in the UI but granted by NO package, so it was dark
    // on every plan including the one the upsell named.
    'capability:feeding-programs',
    // Issue a vaccination certificate from a verified gate check. Pro and
    // Enterprise (user, 2026-08-04).
    'capability:vaccination-certificates',
  ],
  services: [
    'service:appointment-scheduling',
    'service:medical-records',
    'service:vaccination-tracking',
    'service:medication-tracking',
    'service:inventory-mgmt',
    'service:financial-reports',
    'service:b2b-referrals',
    'service:ai-diagnostics',     // add-on only
    'service:multi-clinic',
    'service:custom-integrations',
    'service:priority-support',
    'service:dedicated-am',
  ],
};

/**
 * Supplier-audience catalog. Suppliers had no gating keys at all before
 * migration 108 — plans carried only free-text marketing bullets, so every
 * seller saw every page regardless of tier.
 */
export const SUPPLIER_FEATURE_CATALOG = {
  views: [
    'supplier:dashboard',
    'supplier:products',
    'supplier:inventory',
    'supplier:orders',
    'supplier:account',
    'supplier:billing',
    'supplier:analytics',
    'supplier:branches',
  ],
  capabilities: [
    'supplier:bulk-import',
    'supplier:clinic-directory',
    'supplier:api-access',
  ],
  services: [
    'supplier:priority-support',
    'supplier:dedicated-am',
  ],
};

/**
 * **Client** (pet-owner) catalog.
 *
 * Unlike the clinic/supplier catalogs — which gate app MODULES — a client plan
 * is a set of SERVICES the owner subscribes to: a wellness membership, a
 * vaccination plan, priority booking, and so on. The keys therefore describe
 * entitlements a clinic honours for that client, plus what the owner can reach
 * in the portal.
 */
export const CLIENT_FEATURE_CATALOG = {
  views: [
    'client:portal',
    'client:records',
    'client:book-online',
    'client:invoices',
  ],
  capabilities: [
    'client:multi-pet',
    'client:priority-booking',
    'client:telehealth',
    'client:home-visit',
    'client:reminders',
  ],
  services: [
    'client:wellness-plan',
    'client:vaccination-plan',
    'client:deworming-plan',
    'client:grooming-plan',
    'client:annual-checkup',
    'client:discount-tier',
  ],
};

/**
 * VetHubCore **Livestock** catalog. Livestock plans are ordinary
 * `clinic_subscription_packages` rows tagged `audiences: ['LIVESTOCK']`, so
 * they reuse the whole billing rail — only the key vocabulary differs.
 */
export const LIVESTOCK_FEATURE_CATALOG = {
  views: [
    'livestock:dashboard',
    'livestock:farms',
    'livestock:animal-groups',
    'livestock:crops',
    'livestock:feeding',
    'livestock:produce',
  ],
  capabilities: [
    'livestock:vet-link',
    'capability:attachments',
    'capability:exports',
  ],
  services: [
    'livestock:agronomy-advice',
    'livestock:herd-health-plan',
    'service:priority-support',
  ],
};

/** Catalog for an audience — drives the admin plan editor's toggle grids. */
export const CATALOG_FOR_AUDIENCE: Record<string, { views: string[]; capabilities: string[]; services: string[] }> = {
  CLINIC: FEATURE_CATALOG,
  SUPPLIER: SUPPLIER_FEATURE_CATALOG,
  CLIENT: CLIENT_FEATURE_CATALOG,
  LIVESTOCK: LIVESTOCK_FEATURE_CATALOG,
};
