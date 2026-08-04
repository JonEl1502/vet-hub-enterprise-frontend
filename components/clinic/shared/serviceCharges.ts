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
// PERSISTENCE (migration 177). These live on the CLINIC (`clinics.fee_*`), the
// same way 048 stores the default daily rates. They were briefly held in
// localStorage — which made them browser-scoped rather than clinic-scoped: a
// colleague saw nothing, a second device saw nothing, and the Managing switcher
// didn't change them because the config was never keyed by clinic. With
// `metadata.fees` now billed, two people could create the same product at
// different prices and neither would know.

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

/** Config key → the clinic column that stores it. */
export const CLINIC_FEE_FIELD: Record<ServiceChargeDef['key'], 'feeService' | 'feeAdmin' | 'feeInjection' | 'feePrescription'> = {
  service: 'feeService',
  admin: 'feeAdmin',
  injection: 'feeInjection',
  prescription: 'feePrescription',
};

/** The shape the Billables editor binds to, read off the selected clinic. */
export function chargesFromClinic(clinic: any | null | undefined): ServiceChargesConfig {
  const out: ServiceChargesConfig = {};
  if (!clinic) return out;
  for (const def of SERVICE_CHARGE_DEFS) {
    const v = clinic[CLINIC_FEE_FIELD[def.key]];
    // `!= null`, not truthiness — a deliberate 0 is a real value and must not
    // be dropped back to "unset".
    if (v != null) out[def.key] = Number(v);
  }
  return out;
}

const LEGACY_STORAGE_KEY = 'vethub.serviceCharges.v1';

/**
 * What this browser had stored before 177 moved these to the clinic. Used ONLY
 * to seed the editor when the clinic has nothing set yet, so whoever typed
 * these numbers doesn't lose them and can save them to the clinic in one click.
 * Never read for billing or for the product form.
 */
export function legacyLocalCharges(): ServiceChargesConfig {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ServiceChargesConfig) : {};
  } catch {
    return {};
  }
}

/** Drop the pre-177 browser copy once the values live on the clinic. */
export function clearLegacyLocalCharges() {
  try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * The four fee fields a NEW product form should open with, in the shape
 * `itemForm` uses. Only keys the clinic actually set are returned — an unset
 * default stays `undefined` so the field renders as "off" rather than as a
 * deliberate zero, which would bill nothing while looking configured.
 */
export function defaultItemFees(clinic: any | null | undefined): {
  feeService?: number; feeAdmin?: number; feeInjection?: number; feePrescription?: number;
} {
  const c = chargesFromClinic(clinic);
  return {
    feeService: c.service,
    feeAdmin: c.admin,
    feeInjection: c.injection,
    feePrescription: c.prescription,
  };
}
