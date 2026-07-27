/**
 * Species-mismatch warning for vaccines and medicines.
 *
 * The rule, per the product decision: **warn, never gate.** Off-label use is a
 * legitimate clinical judgement — a vet may knowingly give a cattle product to
 * a goat. The job here is to make sure that's a decision, not an accident, so
 * nothing is disabled and nothing is blocked.
 *
 * Empty `itemSpecies` means "no species restriction recorded" (the common case
 * for stock added before migration 099, and for general consumables), so it
 * must NOT warn — a false alarm on every item would train people to ignore the
 * real one.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';

/** Case/whitespace-insensitive so 'Dog' and 'DOG' match. */
const norm = (s: string) => s.trim().toUpperCase();

/**
 * True only when the product records a species list AND the patient's species
 * isn't in it. Unknown patient species → no warning (we can't claim a mismatch
 * we can't establish).
 */
export const isSpeciesMismatch = (
  itemSpecies?: string[] | null,
  petSpecies?: string | null,
): boolean => {
  if (!itemSpecies || itemSpecies.length === 0) return false;
  if (!petSpecies || !petSpecies.trim()) return false;
  return !itemSpecies.some((s) => norm(s) === norm(petSpecies));
};

interface Props {
  itemSpecies?: string[] | null;
  petSpecies?: string | null;
  /** Product name, so the message names what's actually being questioned. */
  itemName?: string;
  /** 'inline' for a compact row inside a picker; 'banner' above a form. */
  variant?: 'inline' | 'banner';
  className?: string;
}

const SpeciesWarning: React.FC<Props> = ({
  itemSpecies, petSpecies, itemName, variant = 'inline', className = '',
}) => {
  if (!isSpeciesMismatch(itemSpecies, petSpecies)) return null;

  const labelled = (itemSpecies ?? []).join(', ');
  const message = itemName
    ? `${itemName} is labelled for ${labelled} — this patient is a ${petSpecies}.`
    : `Labelled for ${labelled} — this patient is a ${petSpecies}.`;

  if (variant === 'banner') {
    return (
      <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 ${className}`}>
        <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Species mismatch</p>
          <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 mt-0.5">
            {message} You can still use it — check the dose.
          </p>
        </div>
      </div>
    );
  }

  return (
    <p
      className={`flex items-start gap-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 ${className}`}
      title={message}
    >
      <AlertTriangle size={10} className="shrink-0 mt-[1px]" />
      <span className="truncate">Labelled for {labelled} · patient is {petSpecies}</span>
    </p>
  );
};

export default SpeciesWarning;
