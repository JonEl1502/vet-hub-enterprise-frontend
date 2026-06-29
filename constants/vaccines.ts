/**
 * Canonical vaccine checklist used at the admission gates (boarding, inpatient,
 * grooming). Toggling a chip marks that vaccine as confirmed up-to-date for the
 * patient. Consolidated here so every admit flow shows the same list — add new
 * types in ONE place and they appear everywhere.
 *
 * Admission gate rule: at least one vaccine must be recorded (value === true)
 * before a patient can be admitted (see {@link hasVaccineRecorded}).
 */
export interface VaccineOption {
  key: string;
  label: string;
}

export const VACCINES: VaccineOption[] = [
  // Canine core / common
  { key: 'rabies', label: 'Rabies' },
  { key: 'dhpp', label: 'DHPP' },
  { key: 'dhppl', label: 'DHPPL' },
  { key: 'distemper', label: 'Distemper' },
  { key: 'parvovirus', label: 'Parvovirus' },
  { key: 'kennelCough', label: 'Kennel Cough (Bordetella)' },
  { key: 'leptospirosis', label: 'Leptospirosis' },
  { key: 'canineInfluenza', label: 'Canine Influenza' },
  { key: 'coronavirus', label: 'Coronavirus' },
  { key: 'lyme', label: 'Lyme Disease' },
  // Feline core / common
  { key: 'fvrcp', label: 'FVRCP' },
  { key: 'felv', label: 'Feline Leukemia (FeLV)' },
  { key: 'fiv', label: 'Feline Immunodeficiency (FIV)' },
  { key: 'chlamydia', label: 'Chlamydia (Cats)' },
];

/** True when at least one vaccine is recorded as up-to-date. */
export const hasVaccineRecorded = (vc: Record<string, boolean> | null | undefined): boolean =>
  Object.values(vc || {}).some(Boolean);
