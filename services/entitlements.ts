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
 *   TRIAL  → the trial package's own featureKeys for this persona (audience +
 *            shell). ⭐ 287: NO LONGER ['*'] — a trial is a real, narrower key
 *            set and is enforced here exactly like a paid plan.
 *   ACTIVE → the package's own featureKeys (['*'] only in the long-commitment
 *            grace window, which is a paid perk, not a trial)
 *   LOCKED → [] (only ALWAYS_VIEWS, so the clinic can still reach Billing)
 */

export type PlanState = 'TRIAL' | 'ACTIVE' | 'LOCKED';

export interface PlanAccess {
  state: PlanState | string;
  featureKeys: string[];
  packageName?: string | null;
  tier?: number | null;
  graceFullAccessUntil?: string | null;
  /**
   * When the free trial runs out. Both the clinic and the supplier access
   * endpoints return it; it used to be dropped on the way into context, which
   * is why a supplier on a 40-day demo trial was described as being on a free
   * plan with nothing running out.
   */
  trialEndsAt?: string | null;
  /** Active add-ons layering over the base plan (e.g. AI Assist). */
  addOns?: Array<{ name: string | null; expiresAt: string }>;
  /**
   * When the BASE plan runs out — or ran out. The server has always sent it;
   * the client dropped it, so nothing could say how overdue an account was.
   */
  expiresAt?: string | null;
}

/** Days since the plan lapsed. Null when it has not, or is unknown. */
export function daysOverdue(access: PlanAccess | null): number | null {
  if (!access?.expiresAt) return null;
  const end = new Date(access.expiresAt).getTime();
  if (!Number.isFinite(end) || end > Date.now()) return null;
  return Math.floor((Date.now() - end) / 86_400_000);
}

/**
 * The one-line plan label — "Growth Plan", "Free trial", "Free plan".
 *
 * Shared so the supplier portal and the clinic sidebar cannot drift into
 * describing the same four states differently.
 *
 * ⚠️ LOCKED means two different things and they must not read the same. A
 * supplier who never subscribed is on the FREE plan, which is a normal place to
 * be and should not look like a fault. A supplier whose paid plan lapsed is
 * EXPIRED, and needs to know that rather than being quietly told they are on a
 * free plan they did not choose. The difference is whether a package name came
 * back with the locked state.
 */
export function trialDaysLeft(access: PlanAccess | null): number | null {
  if (!access?.trialEndsAt) return null;
  const ms = new Date(access.trialEndsAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  // Round UP: with 6 hours left a supplier has "1 day", not "0 days", and a
  // countdown that reads zero while access still works is a support ticket.
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function planLabel(access: PlanAccess | null): {
  text: string;
  tone: 'neutral' | 'trial' | 'warn';
} {
  if (!access) return { text: 'Free plan', tone: 'neutral' };

  if (access.state === 'TRIAL') {
    const days = trialDaysLeft(access);
    // An open-ended trial has no countdown worth showing — see
    // OPEN_ENDED_TRIAL_DAYS for why those exist.
    if (days == null || isOpenEndedTrial(days)) return { text: 'Free trial', tone: 'trial' };
    return { text: `Free trial — ${days} day${days === 1 ? '' : 's'} left`, tone: 'trial' };
  }

  if (access.packageName) {
    return access.state === 'LOCKED'
      ? { text: `${access.packageName} — expired`, tone: 'warn' }
      : { text: `${access.packageName} Plan`, tone: 'neutral' };
  }

  return { text: 'Free plan', tone: 'neutral' };
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
  'wa-enquiries',
  'import-data',
  'billing',
  'emergency',
  /**
   * 288 — READING THE COMMUNITY IS FREE, EVEN WHEN LOCKED.
   *
   * `allowsView` returns false for EVERY unmapped view once the state is
   * LOCKED, so a clinic past its trial with no plan lost the Community entry
   * entirely — the one page that explains what Community Access is and sells
   * it. The server has never gated the read (`community.controller`: *"Reads
   * are NOT gated at all"*), and the user's ask was explicit: *"a community
   * available to everyone even though they have not bought it."*
   *
   * Posting is still refused server-side without the add-on; the page shows
   * that refusal as an offer rather than hiding the button.
   */
  'community',
  /**
   * 296 — SCHEDULING IS SPINE (user, 2026-09-10: *"can we make reminders n
   * appointments available to all"*).
   *
   * Any business that keeps an animal has to book it in and be reminded about
   * it. The old split was inconsistent on its own terms: `view:reminders` was
   * on 6 plans of 20 and `view:appointment-bookings` on only 3, so a BOARDING
   * kennel could open Reminders and then have that page's own booking call
   * refused — the screen loaded, then threw "Online appointment booking is on
   * a higher plan" over itself.
   *
   * Both route gates are gone server-side, and 296 puts the keys on every plan
   * so the catalogue stops selling them. Listed here as well so a LOCKED
   * account still reaches them — `allowsView` refuses every unmapped view once
   * a plan lapses.
   */
  'reminders',
  'appointment-bookings',
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
  // 296 — `reminders` and `appointment-bookings` moved to ALWAYS_VIEWS above.
  // Deliberately NOT mapped here any more: a key left in this map would start
  // gating them again the moment ALWAYS_VIEWS is edited.
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
  workflows: 'view:workflows',
  'workflow-builder': 'view:workflows',
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
  // BI dashboard rides the same entitlement as the finance overview.
  'reports-analytics': 'view:financial-overview',
  receivables: 'view:financial-overview',
  expenses: 'view:financial-overview',
  'b2b-stats': 'view:b2b-stats',
  transactions: 'view:transactions',
  'financial-core': 'view:financial-core',

  // Add-on
  ai: 'view:ai-tools',

  // ── Supplier audience ────────────────────────────────────────────────────
  'supplier-dashboard': 'supplier:dashboard',
  'supplier-products': 'supplier:products',
  'supplier-inventory': 'supplier:inventory',
  'supplier-orders': 'supplier:orders',
  'supplier-branches': 'supplier:branches',
  'supplier-analytics': 'supplier:analytics',

  // ── Livestock audience (VetHubCore Livestock) ────────────────────────────
  'livestock-dashboard': 'livestock:dashboard',
  farms: 'livestock:farms',
  'farm-detail': 'livestock:farms',
  'animal-groups': 'livestock:animal-groups',
  'crop-plots': 'livestock:crops',
  feeding: 'livestock:feeding',
  'produce-schedule': 'livestock:produce',
  'farm-visits': 'livestock:farms',
};

/**
 * Views reachable on ANY supplier plan, including LOCKED — a locked supplier
 * must still be able to reach billing to resubscribe.
 */
export const ALWAYS_SUPPLIER_VIEWS = new Set([
  'supplier-management',
  'supplier-billing',
  // The supplier's equivalent of `import-data`, which is always-allowed for the
  // same reason: getting your catalogue IN is the on-ramp, not a paid feature.
  // Without this a supplier on no/expired plan could not see or open the page —
  // the nav entry was silently filtered out (found 2026-08-05 by opening it as
  // a real supplier; the API worked all along, which is why it looked fine).
  'supplier-import',
]);

/** Views reachable on ANY livestock plan, including LOCKED. */
export const ALWAYS_LIVESTOCK_VIEWS = new Set([
  'livestock-settings',
]);

/**
 * Display label for every catalog key — used to build a plan card's "what's
 * included" list straight from `featureKeys`, so the marketing bullets can
 * never drift from what the tier actually grants.
 */
export const KEY_LABEL: Record<string, string> = {
  // Core
  'view:dashboard': 'Dashboard & KPIs',
  'view:patients': 'Patient records',
  'view:clients': 'Client records',
  'view:reminders': 'Reminders',
  'view:appointment-bookings': 'Online appointment booking',
  'view:appointments': 'Visits & consultations',
  'view:emergency': 'Emergency intake',
  // Clinical
  'view:laboratory': 'Laboratory',
  'view:imaging': 'Imaging & radiology',
  'view:surgery': 'Surgery & theatre',
  'view:inpatient': 'Inpatient & wards',
  'view:boarding': 'Boarding',
  'view:grooming': 'Grooming',
  // Retail
  'view:petshop': 'Petshop',
  'view:pharmacy': 'Pharmacy',
  // Inventory & procurement
  'view:inventory': 'Inventory & stock control',
  'view:procedures': 'Procedure recipes',
  'view:vaccine-packages': 'Vaccine packages',
  'view:service-bundles': 'Service bundles',
  'view:purchase-orders': 'Purchase orders',
  'view:suppliers': 'Supplier hub',
  // Partners & finance
  'view:partners': 'Partner clinics & referrals',
  'view:financial-overview': 'Financial overview',
  'view:b2b-stats': 'B2B statistics',
  'view:transactions': 'Transactions',
  'view:financial-core': 'Clinic finance',
  // Clinic management (on every plan — hidden from plan cards as baseline)
  'view:staff': 'Staff directory',
  'view:settings': 'Clinic settings',
  'view:import-data': 'Data import',
  'view:billing': 'Billing & subscription',
  // Add-on
  'view:ai-tools': 'AI assist',
  // Capabilities
  'capability:attachments': 'Image & file attachments',
  'capability:exports': 'CSV / PDF export',
  'capability:client-portal': 'Client portal',
  // Services
  'service:appointment-scheduling': 'Appointment scheduling',
  'service:medical-records': 'Medical records',
  'service:vaccination-tracking': 'Vaccination tracking',
  'service:medication-tracking': 'Medication tracking',
  'service:inventory-mgmt': 'Inventory management',
  'service:financial-reports': 'Financial reports',
  'service:b2b-referrals': 'B2B referrals',
  'service:ai-diagnostics': 'AI diagnostics',
  'service:multi-clinic': 'Multi-clinic / branches',
  'service:custom-integrations': 'Custom integrations',
  'service:priority-support': 'Priority support',
  'service:dedicated-am': 'Dedicated account manager',
  // ── Supplier ─────────────────────────────────────────────────────────────
  'supplier:dashboard': 'Seller dashboard',
  'supplier:products': 'Product listings',
  'supplier:inventory': 'Inventory management',
  'supplier:orders': 'Order management',
  'supplier:account': 'Account & profile',
  'supplier:billing': 'Billing & subscription',
  'supplier:analytics': 'Sales analytics',
  'supplier:bulk-import': 'Bulk order import / export',
  'supplier:clinic-directory': 'Clinic customer directory',
  'supplier:branches': 'Multiple branch locations',
  'supplier:inventory-insights': 'Stockroom dashboard',
  'supplier:api-access': 'API access',
  'supplier:priority-support': 'Priority support',
  'supplier:dedicated-am': 'Dedicated account manager',
  // ── Client (pet owner) — subscribed SERVICES, not app modules ────────────
  'client:portal': 'Client portal access',
  'client:records': 'View pet medical records',
  'client:book-online': 'Book appointments online',
  'client:invoices': 'Invoices & payment history',
  'client:multi-pet': 'Multiple pets on one plan',
  'client:priority-booking': 'Priority booking',
  'client:telehealth': 'Telehealth consults',
  'client:home-visit': 'Home visits',
  'client:reminders': 'Automated care reminders',
  'client:wellness-plan': 'Wellness plan',
  'client:vaccination-plan': 'Vaccination plan',
  'client:deworming-plan': 'Deworming plan',
  'client:grooming-plan': 'Grooming plan',
  'client:annual-checkup': 'Annual health check',
  'client:discount-tier': 'Member discount on services',
  // ── Livestock ────────────────────────────────────────────────────────────
  'livestock:dashboard': 'Farm dashboard',
  'livestock:farms': 'Animal farm',
  'livestock:animal-groups': 'Herds & flocks',
  'livestock:crops': 'Crop farm',
  'livestock:feeding': 'Feeding plans & logs',
  'livestock:produce': 'Produce scheduling',
  'livestock:vet-link': 'Link a clinic or vet officer',
  'livestock:agronomy-advice': 'Agronomy advice',
  'livestock:herd-health-plan': 'Herd health plan',
};

/**
 * Keys every plan carries — listing them on a pricing card is noise, since
 * they never differentiate one tier from another.
 */
export const BASELINE_KEYS = new Set([
  'view:dashboard',
  'view:staff',
  'view:settings',
  'view:import-data',
  'view:billing',
  // Supplier equivalents — on every tier, so listing them differentiates nothing.
  'supplier:dashboard',
  'supplier:account',
  'supplier:billing',
  // Client / livestock equivalents.
  'client:portal',
  'livestock:dashboard',
]);

/**
 * The differentiating entitlements of a package, as display labels, ordered by
 * the catalog order above (so cards read consistently). `['*']` yields null —
 * the caller should show an "everything included" line instead.
 */
/**
 * Which namespace a feature key belongs to. Keys are namespaced by audience
 * (`supplier:` / `livestock:` / `client:`), and everything else is clinic.
 */
const keyAudience = (k: string): 'SUPPLIER' | 'LIVESTOCK' | 'CLIENT' | 'CLINIC' =>
  k.startsWith('supplier:') ? 'SUPPLIER'
    : k.startsWith('livestock:') ? 'LIVESTOCK'
      : k.startsWith('client:') ? 'CLIENT'
        : 'CLINIC';

/**
 * @param audience Show only the capabilities that MEAN something to this
 *   audience. Enterprise legitimately carries the clinic set AND the supplier
 *   set — "enterprise carries full system" — so on a supplier's billing page
 *   its card led with "Patient records · Visits & consultations · Emergency
 *   intake", reading as though an agrovet were buying a veterinary practice
 *   (user, 2026-09-12). The plan is right; the sales copy was answering the
 *   wrong question. Omit to keep every key, which is what every existing
 *   caller does.
 */
export function planHighlights(
  featureKeys: string[] | undefined | null,
  audience?: 'CLINIC' | 'SUPPLIER' | 'LIVESTOCK' | 'CLIENT',
): string[] | null {
  if (!featureKeys || featureKeys.length === 0) return [];
  if (featureKeys.includes('*')) return null;
  const order = Object.keys(KEY_LABEL);
  const scoped = audience
    ? featureKeys.filter((k) => keyAudience(k) === audience)
    : featureKeys;
  /**
   * ⚠️ Never return an EMPTY list where an unfiltered one had content — a plan
   * card with no bullets reads as a plan that does nothing. A package with no
   * keys in this audience falls back to the full set rather than going blank.
   */
  const source = audience && scoped.length === 0 ? featureKeys : scoped;
  return source
    .filter((k) => !BASELINE_KEYS.has(k) && KEY_LABEL[k])
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((k) => KEY_LABEL[k]);
}

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

  'view:workflows': { label: 'Visit Workflows', plan: 'Pro', blurb: 'Build the clinical form your vets fill in — your stages, your questions.' },
  'capability:workflow-builder': {
    label: 'Workflow builder',
    plan: 'Pro',
    blurb: 'Create and customise visit workflows. Without it you can still use the workflows VetHubCore ships.',
  },
  'capability:website-integration': {
    label: 'Website integration',
    plan: 'an add-on',
    blurb: "Let the clinic's own website send appointment requests straight into VetHub Core, and sell your real stock from your catalogue.",
  },
  'capability:vaccination-certificates': {
    label: 'Vaccination certificates',
    plan: 'Pro',
    blurb: 'Issue a certificate for the vaccines verified at the admission gate.',
  },
  'capability:feeding-programs': {
    label: 'Feeding programs',
    plan: 'Pro',
    blurb: 'Save a food, portion and schedule to a patient so the next stay starts pre-filled.',
  },

  // Enterprise modules
  'view:surgery': { label: 'Surgery', plan: 'Enterprise', blurb: 'Theatre scheduling and surgical records.' },
  'capability:workflow-share': {
    label: 'Share workflows',
    plan: 'Enterprise',
    blurb: 'Publish a workflow so other clinics can copy it.',
  },
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

  // Supplier
  'supplier:inventory-insights': {
    label: 'Stockroom dashboard',
    plan: 'Pro',
    blurb: 'Stock value at cost and at sell, the margin held on the shelf, expiry and reorder alerts, and what has moved — across every branch.',
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

  /**
   * ── Livestock ──────────────────────────────────────────────────────────
   * These were missing from FEATURE_COPY entirely, so `featureCopy()` fell
   * through to its last resort — the raw key suffix — and the admin plan editor
   * listed them as **"farms"**, **"crops"**, **"produce"** (user, 2026-08-23).
   * A separate label map further up DID name them; nothing read it here.
   *
   * ⚠️ "Farm records" was ambiguous once crops entered the picture — a farm has
   * both. The two halves are now named for what they hold: **Animal farm** and
   * **Crop farm** (user: *"put animal farm crop farm"*).
   */
  'livestock:dashboard': { label: 'Farm dashboard', plan: 'a higher' },
  'livestock:farms': { label: 'Animal farm', plan: 'a higher', blurb: 'Farm records for the animal side of the business.' },
  'livestock:crops': { label: 'Crop farm', plan: 'a higher', blurb: 'Crop plots, planting and harvest records.' },
  'livestock:animal-groups': { label: 'Herds & flocks', plan: 'a higher' },
  'livestock:feeding': { label: 'Feeding plans & logs', plan: 'a higher' },
  'livestock:produce': { label: 'Produce scheduling', plan: 'a higher' },
  'livestock:vet-link': { label: 'Link a clinic or vet officer', plan: 'a higher' },
  'livestock:agronomy-advice': { label: 'Agronomy advice', plan: 'Estate' },
  'livestock:herd-health-plan': { label: 'Herd health plan', plan: 'Estate' },
};

/**
 * Does this access state grant `featureKey`?
 * `access == null` means "not loaded yet" and fails OPEN — we never flash a
 * lock screen at someone whose plan simply hasn't arrived over the wire.
 */
export function hasFeature(access: PlanAccess | null, featureKey: string): boolean {
  if (!access) return true;
  if (access.state === 'LOCKED') return false;
  /**
   * 287 — TRIAL falls through to the key check like every other state.
   *
   * It used to `return true` here, which meant a trialling org saw the whole
   * app no matter what the backend said. Once trials became per-persona
   * (audience + shell) that short-circuit was the ONLY thing still handing a
   * boarding kennel a veterinary clinic — the narrowed key set arrived over the
   * wire and was then ignored. `'*'` is still honoured below because the
   * long-commitment grace window legitimately grants it to a PAYING account.
   */
  return access.featureKeys.includes('*') || access.featureKeys.includes(featureKey);
}

/** Does this access state allow navigating to `view`? */
/**
 * WHAT A HARD-LOCKED (past-grace) ACCOUNT MAY STILL REACH.
 *
 * "After a week lock to billing only" (user, 2026-09-12). Billing per
 * audience, because a supplier's billing page is a different view id from a
 * clinic's and sending either to the other's is sending them nowhere.
 *
 * `settings` is kept deliberately: it is where an owner fixes the dead card
 * that caused this, and a lockout that hides the fix is a lockout nobody can
 * escape.
 *
 * Emergency is added at call time, from the platform's own switch — see
 * `pastDueAllowEmergency`.
 */
export const PAST_DUE_VIEWS = new Set([
  'billing',
  'subscription-management',
  'supplier-billing',
  'settings',
  'supplier-management',
  'client-plan',
]);

export function allowsView(
  access: PlanAccess | null,
  view: string,
  /**
   * Past-due lockdown. Omitted = no lockdown, which keeps every existing
   * caller behaving exactly as before.
   */
  pastDue?: { hardLocked: boolean; allowEmergency: boolean },
): boolean {
  if (!access) return true;
  /**
   * ⚠️ THE HARD LOCK OUTRANKS `ALWAYS_VIEWS`.
   *
   * It has to: `ALWAYS_VIEWS` is the set a LOCKED account keeps, and the whole
   * point of the past-grace state is that it keeps LESS. Checked before the
   * always-sets rather than after, or `staff`, `import-data` and `community`
   * would sail straight through the lock.
   */
  if (pastDue?.hardLocked) {
    if (view === 'emergency' || view === 'triage') return pastDue.allowEmergency;
    return PAST_DUE_VIEWS.has(view);
  }
  // View ids are unique across audiences (clinic `inventory` vs supplier
  // `supplier-inventory`), so one union of the always-allowed sets is safe.
  if (ALWAYS_VIEWS.has(view) || ALWAYS_SUPPLIER_VIEWS.has(view) || ALWAYS_LIVESTOCK_VIEWS.has(view)) return true;
  // 287 — no TRIAL short-circuit; see hasFeature. A trial navigates exactly
  // what its persona's trial package grants.
  if (access.state === 'LOCKED') return false;
  const key = VIEW_KEY[view];
  if (!key) return true; // unmapped view needs no entitlement
  return hasFeature(access, key);
}

/** Copy for a locked key, with a sane fallback for keys with no entry. */
/**
 * "…is on **a higher** plan" vs "…is on **the Enterprise** plan".
 *
 * `featureCopy().plan` is sometimes a determiner-led phrase ("a higher") and
 * sometimes a bare plan NAME ("Enterprise"), so prefixing a hardcoded "the"
 * produces **"is on the a higher plan"**. UpgradeGate fixed that locally on
 * 2026-08-05; the API interceptor built the same sentence with its own
 * hardcoded "the" and kept shipping the broken copy — which is what the
 * supplier upgrade modal showed on 2026-08-23. One builder, both callers.
 */
export const planPhrase = (plan: string): string =>
  /^(a|an|the)\s/i.test(plan) ? plan : `the ${plan}`;

/** Full sentence used by both the inline gate and the 403 upgrade modal. */
export const upgradeSentence = (copy: { label: string; plan: string }): string =>
  `${copy.label} is on ${planPhrase(copy.plan)} plan.`;

export function featureCopy(featureKey: string): { label: string; plan: string; blurb?: string } {
  return (
    FEATURE_COPY[featureKey] ?? {
      label: featureKey.split(':')[1]?.replace(/-/g, ' ') || 'This feature',
      plan: 'a higher',
    }
  );
}

/**
 * Migration 280 — fill the maps above from the SERVER's module catalog.
 *
 * Every map in this file used to be the only place a module's name, blurb and
 * gated route existed, which meant adding a module took an edit here plus a
 * deploy, and the two repos drifted. Twice, visibly: the seven `livestock:*`
 * keys never reached `FEATURE_COPY` and the admin plan editor listed them as
 * the raw suffixes "farms" / "crops" / "produce"; and `view:community`,
 * `community:participate` and `livestock:basic` are granted by nine prod
 * packages while appearing in no catalog here at all.
 *
 * The maps are KEPT as the fallback floor. This overlays onto them, so:
 *   - a module the server knows about wins, and needs no code here;
 *   - a module only this file knows about still works;
 *   - an unreachable API changes nothing at all.
 *
 * ⚠️ It mutates the exported objects rather than replacing them, because
 * `VIEW_KEY` and `FEATURE_COPY` are imported by reference across the app
 * (`App.tsx`, `PlanFeaturesPanel.tsx`). Rebinding them would leave those
 * consumers holding the old object. Safe to call more than once.
 */
export function hydrateModuleCatalog(
  modules: Array<{
    key: string;
    name: string;
    blurb: string | null;
    routes: string[];
    isBaseline: boolean;
  }>,
): void {
  if (!modules?.length) return;

  for (const m of modules) {
    // `plan` is the upsell phrase ("is on the Pro plan"). The server does not
    // model it — which tier grants a key is a property of the PACKAGE, not the
    // module — so keep whatever this file already said, and fall back to the
    // same vague phrase `featureCopy` uses when it knows nothing.
    const existing = FEATURE_COPY[m.key];
    FEATURE_COPY[m.key] = {
      label: m.name,
      plan: existing?.plan ?? 'a higher',
      ...(m.blurb ? { blurb: m.blurb } : existing?.blurb ? { blurb: existing.blurb } : {}),
    };

    if (!KEY_LABEL[m.key]) KEY_LABEL[m.key] = m.name;
    for (const route of m.routes ?? []) VIEW_KEY[route] = m.key;
    if (m.isBaseline) BASELINE_KEYS.add(m.key);
  }
}

/**
 * Is this "trial" actually open-ended complimentary access?
 *
 * Three prod clinics carry `trial_ends_at = 2099-12-31` — a sentinel someone
 * set deliberately to mean "never expires". The date maths is correct, so the
 * banner rendered it literally: **"Free trial — 26,791 days left."** Seventy-
 * three years reads as a bug in the product, and it buries the one number the
 * banner exists to show for clinics on a real trial.
 *
 * ⚠️ Fixed in DISPLAY, deliberately not in data. The sentinel is intentional
 * (internal and demo clinics), and two of the three are outside the prod-write
 * rule — rewriting their dates to "fix" a label would end their access.
 *
 * Five years is the cut. No trial anyone actually sells runs that long, and the
 * real ones on prod are 15–67 days, so there is no near-miss to worry about.
 */
export const OPEN_ENDED_TRIAL_DAYS = 5 * 365;

export const isOpenEndedTrial = (daysLeft?: number | null): boolean =>
  (daysLeft ?? 0) > OPEN_ENDED_TRIAL_DAYS;
