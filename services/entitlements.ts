/**
 * Subscription entitlements — the single place that answers
 * "does this clinic's plan include X?".
 *
 * The backend is the source of truth (`GET /clinic-subscriptions/:id/access`
 * → `{ state, featureKeys }`); everything here is the client-side reflection
 * of that answer. Keep the key strings in lockstep with `FEATURE_CATALOG`
 * (services/modules/subscriptionPackages.api.ts) and with the tier seeding in
 * backend migration 107.
 *
 * Three access states:
 *   TRIAL  → featureKeys is ['*'] (everything)
 *   ACTIVE → the package's own featureKeys
 *   LOCKED → [] (only ALWAYS_VIEWS, so the clinic can still reach Billing)
 */

export type PlanState = 'TRIAL' | 'ACTIVE' | 'LOCKED';

export interface PlanAccess {
  state: PlanState | string;
  featureKeys: string[];
  packageName?: string | null;
  tier?: number | null;
  graceFullAccessUntil?: string | null;
}

/**
 * Views that are reachable on ANY plan, including LOCKED. A locked clinic must
 * still be able to pay, manage staff, and handle an emergency.
 */
export const ALWAYS_VIEWS = new Set([
  'settings',
  'staff',
  'staff-profile',
  'broadcasts',
  'import-data',
  'billing',
  'emergency',
]);

/**
 * view id (sidebar / router) → required feature key.
 * A view absent from this map requires no key and is always allowed.
 * Sub-views (detail/form routes) map to their parent module's key so that
 * deep-linking can't bypass the gate.
 */
export const VIEW_KEY: Record<string, string> = {
  // Core
  dashboard: 'view:dashboard',
  reminders: 'view:reminders',
  'appointment-bookings': 'view:appointment-bookings',
  appointments: 'view:appointments',
  'new-appointment': 'view:appointments',
  'appointment-detail': 'view:appointments',
  'view-appointment': 'view:appointments',
  clients: 'view:clients',
  'client-profile': 'view:clients',
  'register-client': 'view:clients',
  patients: 'view:patients',
  'pet-profile': 'view:patients',
  'register-pet': 'view:patients',

  // Clinical modules
  laboratory: 'view:laboratory',
  imaging: 'view:imaging',
  surgery: 'view:surgery',
  inpatient: 'view:inpatient',
  boarding: 'view:boarding',
  grooming: 'view:grooming',

  // Retail / dispensing
  petshop: 'view:petshop',
  pharmacy: 'view:pharmacy',

  // Inventory & procurement
  inventory: 'view:inventory',
  procedures: 'view:procedures',
  'vaccine-packages': 'view:vaccine-packages',
  'service-bundles': 'view:service-bundles',
  'purchase-orders': 'view:purchase-orders',
  'purchase-order-detail': 'view:purchase-orders',
  'purchase-order-form': 'view:purchase-orders',
  suppliers: 'view:suppliers',
  'supplier-detail': 'view:suppliers',

  // Partners & finance
  referrals: 'view:partners',
  finance: 'view:financial-overview',
  'financial-overview': 'view:financial-overview',
  'b2b-stats': 'view:b2b-stats',
  transactions: 'view:transactions',
  'financial-core': 'view:financial-core',

  // Add-on
  ai: 'view:ai-tools',
};

/**
 * Human copy for a locked feature — the heading/blurb shown by `<UpgradeGate>`
 * and the page-level lock screen. `plan` names the lowest tier that grants it,
 * so the prompt can say "on the Pro plan" instead of something generic.
 *
 * Keep `plan` in sync with the tier seeding in backend migration 107. It is
 * copy only — never an access decision.
 */
export const FEATURE_COPY: Record<string, { label: string; plan: string; blurb?: string }> = {
  // Pro modules
  'view:laboratory': { label: 'Laboratory', plan: 'Pro', blurb: 'Run and record in-house lab work.' },
  'view:imaging': { label: 'Imaging', plan: 'Pro', blurb: 'Store and report on radiographs and scans.' },
  'view:grooming': { label: 'Grooming', plan: 'Pro', blurb: 'Book and bill grooming appointments.' },
  'view:boarding': { label: 'Boarding', plan: 'Pro', blurb: 'Manage kennel bookings and stays.' },

  // Enterprise modules
  'view:surgery': { label: 'Surgery', plan: 'Enterprise', blurb: 'Theatre scheduling and surgical records.' },
  'view:inpatient': { label: 'Inpatient', plan: 'Enterprise', blurb: 'Admissions, wards, and treatment sheets.' },

  // Capabilities
  'capability:attachments': {
    label: 'Image & file upload',
    plan: 'Pro',
    blurb: 'Attach scans, photos, and documents to clinical records.',
  },
  'capability:exports': {
    label: 'Data export',
    plan: 'Pro',
    blurb: 'Download your records and reports as CSV or PDF.',
  },
  'capability:client-portal': {
    label: 'Client portal',
    plan: 'Pro',
    blurb: 'Let pet owners view records and book online.',
  },

  // Add-on
  'view:ai-tools': {
    label: 'AI assist',
    plan: 'AI Assist add-on',
    blurb: 'Draft notes, summarise visits, and query your records.',
  },
  'service:ai-diagnostics': { label: 'AI diagnostics', plan: 'AI Assist add-on' },

  // Multi-clinic
  'service:multi-clinic': { label: 'Multi-clinic', plan: 'Enterprise', blurb: 'Run branches under one account.' },
};

/**
 * Does this access state grant `featureKey`?
 * `access == null` means "not loaded yet" and fails OPEN — we never flash a
 * lock screen at someone whose plan simply hasn't arrived over the wire.
 */
export function hasFeature(access: PlanAccess | null, featureKey: string): boolean {
  if (!access) return true;
  if (access.state === 'TRIAL') return true;
  if (access.state === 'LOCKED') return false;
  return access.featureKeys.includes('*') || access.featureKeys.includes(featureKey);
}

/** Does this access state allow navigating to `view`? */
export function allowsView(access: PlanAccess | null, view: string): boolean {
  if (!access) return true;
  if (ALWAYS_VIEWS.has(view)) return true;
  if (access.state === 'TRIAL') return true;
  if (access.state === 'LOCKED') return false;
  const key = VIEW_KEY[view];
  if (!key) return true; // unmapped view needs no entitlement
  return hasFeature(access, key);
}

/** Copy for a locked key, with a sane fallback for keys with no entry. */
export function featureCopy(featureKey: string): { label: string; plan: string; blurb?: string } {
  return (
    FEATURE_COPY[featureKey] ?? {
      label: featureKey.split(':')[1]?.replace(/-/g, ' ') || 'This feature',
      plan: 'a higher',
    }
  );
}
