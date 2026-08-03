// Clinic-wide DEFAULT service charges (per dispense): the flat fees a product
// carries on top of its price — Service, Administration, Injection, Prescription.
//
// Set once in Clinic Management → Billables, beside Default Daily Rates, so a
// clinic doesn't retype the same four numbers on every product. The product form
// pre-fills from these; whatever is saved on the item still wins, and editing a
// product never silently re-inherits (see InventoryView's blank-form defaults).
//
// ⚠️ These are DEFAULTS FOR THE FORM, not a billing source. The charge that is
// actually billed is the one stored on the item's own `metadata.fees` — which is
// read and billed today. Changing a default therefore affects products created
// AFTERWARDS, never ones already saved. That is deliberate: silently re-pricing
// existing stock from a settings screen is exactly the kind of change nobody
// would expect to have made.
//
// UI-ONLY phase: persisted in localStorage, mirroring `visitFees.ts`. Moves to a
// clinic settings column in the API phase, along with the visit fees.

export interface ServiceChargeDef {
  key: 'service' | 'admin' | 'injection' | 'prescription';
  label: string;
  hint: string;
}

export const SERVICE_CHARGE_DEFS: ServiceChargeDef[] = [
  { key: 'service',      label: 'Service Charge',      hint: 'Flat handling fee added when the item is dispensed' },
  { key: 'admin',        label: 'Administration',      hint: 'Charged when a staff member administers it' },
  { key: 'injection',    label: 'Injection Fee',       hint: 'Charged for an injectable, on top of the dose' },
  { key: 'prescription', label: 'Prescription Fee',    hint: 'Charged when the item is dispensed on prescription' },
];

export type ServiceChargesConfig = Partial<Record<ServiceChargeDef['key'], number>>;

const STORAGE_KEY = 'vethub.serviceCharges.v1';

export function loadServiceCharges(): ServiceChargesConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ServiceChargesConfig) : {};
  } catch {
    return {};
  }
}

export function saveServiceCharges(cfg: ServiceChargesConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}

/**
 * The four fee fields a NEW product form should open with, in the shape
 * `itemForm` uses. Only keys the clinic actually set are returned — an unset
 * default stays `undefined` so the field renders as "off" rather than as a
 * deliberate zero, which would bill nothing while looking configured.
 */
export function defaultItemFees(): {
  feeService?: number; feeAdmin?: number; feeInjection?: number; feePrescription?: number;
} {
  const c = loadServiceCharges();
  return {
    feeService: c.service,
    feeAdmin: c.admin,
    feeInjection: c.injection,
    feePrescription: c.prescription,
  };
}
