// Clinic billing settings: base fee per encounter type / visit type, plus a
// walk-in surcharge. Configured in Clinic Management → Billables; consumed by
// the entry-fee seeding when a visit is registered/started service-less.
// UI-ONLY phase: persisted in localStorage; moves to a clinic settings column
// in the API phase.

export interface VisitFeeDef { key: string; label: string; icon: string; hint?: string }

export const VISIT_FEE_DEFS: VisitFeeDef[] = [
  { key: 'VET_VISIT.ROUTINE', label: 'Vet Visit · Routine', icon: '🩺' },
  { key: 'VET_VISIT.CONSULTATION', label: 'Vet Visit · Consultation', icon: '🩺' },
  { key: 'VET_VISIT.EMERGENCY', label: 'Vet Visit · Emergency', icon: '🚨' },
  { key: 'VET_VISIT.FOLLOW_UP', label: 'Vet Visit · Follow-up', icon: '🔁' },
  { key: 'VACCINATION', label: 'Vaccination', icon: '💉' },
  { key: 'GROOMING', label: 'Grooming', icon: '✂️' },
  { key: 'BOARDING', label: 'Boarding', icon: '🏠' },
  { key: 'HOUSE_CALL', label: 'House Call — call-out fee', icon: '🚗', hint: 'Added on top of the visit-type fee' },
  { key: 'HOSPITALIZATION', label: 'Hospitalization/In-Patient — admission fee', icon: '🏥' },
  { key: 'WALK_IN', label: 'Walk-in surcharge', icon: '🚶', hint: 'Added when the visit is a walk-in arrival' },
];

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
  if (encounterChip === 'VET_VISIT' || encounterChip === 'HOUSE_CALL') return cfg[`VET_VISIT.${visitType || 'CONSULTATION'}`];
  return cfg[encounterChip];
}
