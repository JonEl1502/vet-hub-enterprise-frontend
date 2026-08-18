// Clinic billing settings: base fee per encounter type / visit type, plus a
// walk-in surcharge. Configured in Clinic Management → Billables; consumed by
// the entry-fee seeding when a visit is registered/started service-less.
// UI-ONLY phase: persisted in localStorage; moves to a clinic settings column
// in the API phase.

export interface VisitFeeDef { key: string; label: string; icon: string; hint?: string }

export const VISIT_FEE_DEFS: VisitFeeDef[] = [
  { key: 'VET_VISIT.ROUTINE', label: 'Vet Visit · Routine Consultation', icon: '🩺' },
  { key: 'VET_VISIT.ROUTINE_CHECK', label: 'Vet Visit · Routine Check', icon: '✅' },
  { key: 'VET_VISIT.CONSULTATION', label: 'Vet Visit · Consultation', icon: '💬' },
  { key: 'VET_VISIT.EMERGENCY', label: 'Vet Visit · Emergency', icon: '🚨' },
  { key: 'VET_VISIT.FOLLOW_UP', label: 'Vet Visit · Follow-up', icon: '🔁' },
  // Vaccination is a Vet Visit visit-type (077); the key stays flat for
  // back-compat with saved configs.
  { key: 'VACCINATION', label: 'Vet Visit · Vaccination', icon: '💉' },
  { key: 'GROOMING', label: 'Grooming', icon: '✂️' },
  { key: 'BOARDING', label: 'Boarding', icon: '🏠' },
  { key: 'HOUSE_CALL', label: 'House Call — call-out fee', icon: '🚗', hint: 'Added on top of the visit-type fee' },
  { key: 'HOSPITALIZATION', label: 'Hospitalization/In-Patient — admission fee', icon: '🏥' },
  { key: 'WALK_IN', label: 'Walk-in surcharge', icon: '🚶', hint: 'Added when the visit is a walk-in arrival' },
  { key: 'AFTER_HOURS', label: 'After-hours surcharge', icon: '🌙', hint: 'Added when the visit is outside working hours' },
];

// Fee key for the house-call distance rate (charged per unit of trip distance).
export const HOUSE_CALL_DISTANCE_KEY = 'HOUSE_CALL_PER_DISTANCE';

/**
 * The category every visit-LEVEL fee line is staged under.
 *
 * A surcharge is a property of the VISIT (when it arrived, how it was reached),
 * not work anyone performed on the animal — so it gets its own category rather
 * than borrowing the encounter's. Borrowing had two visible costs:
 *   * staged as 'Consultation' it stapled a "Vet Visit — clinical" chip onto a
 *     plain boarding visit (user, 2026-08-02);
 *   * staged as 'Grooming' the backend auto-created a GROOMING RECORD for it,
 *     so an After-hours surcharge rendered as a full service card with a
 *     difficulty slider, steps and before/after photos (user, 2026-08-11:
 *     "no After-hours surcharge — it should just appear in billing").
 * It still bills exactly as before: the task, its price and its bill line are
 * untouched, they simply group under their own heading.
 *
 * A free-string category, like the existing synthetic 'Grooming Discount' and
 * 'Procedure Adjustment' lines — no catalog row is needed or wanted.
 */
export const VISIT_FEE_CATEGORY = 'Fees & Surcharges';

// Visits created BEFORE the category existed carry their fee lines under
// 'Consultation' / 'Grooming' / 'Boarding', so name is the only signal left.
// Safe to match on: these names are generated here, never typed by a clinic.
const LEGACY_VISIT_FEE_NAME = /surcharge|call-?out|house call travel/i;

/** Is this visit task a visit-level fee line rather than clinical work? */
export const isVisitFeeTask = (t: { name?: string | null; category?: string | null } | null | undefined): boolean => {
  if (!t) return false;
  if ((t.category || '').trim().toLowerCase() === VISIT_FEE_CATEGORY.toLowerCase()) return true;
  return LEGACY_VISIT_FEE_NAME.test(t.name || '');
};

// Per-fee time rates (per hour / per minute) for time-billed encounters, and a
// clinic-wide distance unit for the house-call per-distance rate. Kept in their
// own stores so the base fees map stays a plain key→number.
export type DistanceUnit = 'km' | 'mile';
export interface VisitFeeRate { perHour?: number; perMinute?: number }
export type VisitFeeRatesConfig = Record<string, VisitFeeRate>;
export interface VisitFeeMeta { distanceUnit?: DistanceUnit }

const RATES_KEY = 'vethub.visitFeeRates.v1';
const META_KEY = 'vethub.visitFeeMeta.v1';

export function loadVisitFeeRates(): VisitFeeRatesConfig {
  try { const r = localStorage.getItem(RATES_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
export function saveVisitFeeRates(cfg: VisitFeeRatesConfig) {
  try { localStorage.setItem(RATES_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}
export function loadVisitFeeMeta(): VisitFeeMeta {
  try { const r = localStorage.getItem(META_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
export function saveVisitFeeMeta(m: VisitFeeMeta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* quota */ }
}

export type VisitFeesConfig = Record<string, number>;

const STORAGE_KEY = 'vethub.visitFees.v1';

export function loadVisitFees(): VisitFeesConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VisitFeesConfig) : {};
  } catch { return {}; }
}

export function saveVisitFees(cfg: VisitFeesConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}

// Services a clinic attaches to each encounter/visit-type — the "full
// service" set for that entry. Drives the hypothetical est. total shown in
// Billables (fee + sum of attached service prices). Stored separately so the
// plain fees map above stays untouched; both merge into the clinic's
// visit_fees JSONB ({fees, services}) in the API phase.
export interface FeeService { id: string; name: string; price: number }
export type VisitFeeServicesConfig = Record<string, FeeService[]>;

const SERVICES_KEY = 'vethub.visitFeeServices.v1';

export function loadVisitFeeServices(): VisitFeeServicesConfig {
  try {
    const raw = localStorage.getItem(SERVICES_KEY);
    return raw ? (JSON.parse(raw) as VisitFeeServicesConfig) : {};
  } catch { return {}; }
}

export function saveVisitFeeServices(cfg: VisitFeeServicesConfig) {
  try { localStorage.setItem(SERVICES_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}

// The configured entry fee for an encounter chip (+ visit type for vet
// visits). Hospitalization prefers its admission fee; house calls use the
// visit-type fee (the call-out fee is a separate extra line).
export function entryFeeFor(cfg: VisitFeesConfig, encounterChip: string, visitType?: string | null): number | undefined {
  if (encounterChip === 'HOSPITALIZATION') return cfg['HOSPITALIZATION'] ?? cfg['VET_VISIT.CONSULTATION'];
  if (encounterChip === 'VET_VISIT' || encounterChip === 'HOUSE_CALL') {
    // Vaccination visit type (077): its fee lives under the flat VACCINATION
    // key (back-compat with configs saved when it was a top-level encounter).
    if (visitType === 'VACCINATION') return cfg['VET_VISIT.VACCINATION'] ?? cfg['VACCINATION'];
    return cfg[`VET_VISIT.${visitType || 'CONSULTATION'}`];
  }
  return cfg[encounterChip];
}

/**
 * A SUPPLY — a consumable or product drawn BY some other piece of work.
 *
 * ⚠️ ONE DEFINITION, imported everywhere. This existed as three separate
 * regexes and the divergence cost three bugs in one day (2026-08-18):
 *   · a vaccination grew an undeletable "Vet Visit — clinical" chip, because
 *     the vaccine vial (category `Consumables`) read as independent work;
 *   · a grooming-only visit was asked to split invoices, because its glove
 *     lines read as a second encounter;
 *   · the first approval guard reported 118 of consumables while missing
 *     45,864 of genuinely unbilled work.
 *
 * THE RULE, stated once: a supply is never evidence that work happened. It is
 * always drawn by something else — the vial by the vaccination, the gloves by
 * the groom, the catheter by the inpatient stay. It is still BILLABLE; it is
 * simply not proof of an encounter.
 *
 * ⚠️ Deliberately NOT a `parent_task_id` column. That was the first plan, until
 * the data said otherwise: only 2 of 103 consumable rows on prod carry the
 * `serviceTaskId` link that already exists, and only 1 of 5 pickers passes it —
 * so a parent column would have been null for almost every row and these call
 * sites would still be guessing. The invariant does not need provenance: a
 * supply is a supply whoever drew it.
 */
const SUPPLY_CATEGORY = /consumable|supplies|supply/i;

export const isSupplyTask = (t: { category?: string | null; kind?: string | null } | null | undefined): boolean => {
  if (!t) return false;
  if (String(t.kind || '').toUpperCase() === 'CONSUMABLE') return true;
  return SUPPLY_CATEGORY.test(String(t.category || ''));
};
