import React from 'react';
import { Building2 } from 'lucide-react';
import { useClinic } from '../../../contexts/ClinicContext';

/**
 * Small pill that shows which clinic/branch a row belongs to.
 *
 * Renders NOTHING when 0 or 1 clinics are in scope — single-clinic views stay
 * clean. It only appears once the user has multiple clinics selected, so the
 * combined/aggregated lists across the dashboard and record pages can be
 * disambiguated row-by-row. Drop it next to a row's primary label.
 *
 * Pass the row's owning clinic id (entities from DataContext carry `clinicId`;
 * for transactions pass whichever side is "ours" — toId/fromId). An explicit
 * `clinicName` (e.g. entity.clinicName from the API) is used as the label when
 * present, otherwise the name is looked up from the in-scope clinics.
 */
const ScopeClinicBadge: React.FC<{
  clinicId?: string | number | null;
  clinicName?: string | null;
  className?: string;
}> = ({ clinicId, clinicName, className }) => {
  const { selectedClinics } = useClinic();
  if (!selectedClinics || selectedClinics.length <= 1) return null;
  const rec: any = clinicId != null && clinicId !== '' ? selectedClinics.find(c => String(c.id) === String(clinicId)) : undefined;
  const full = clinicName || rec?.name;
  if (!full) return null;
  /**
   * MAIN or the BRANCH's own name (user, 2026-11-23: "show which one is in
   * main and which one is in the other branch … name the branch itself").
   * A branch's name is trimmed of its parent's ("Kabi Vets Clinic - Kinoo" →
   * "Kinoo"); the full name stays in the tooltip.
   */
  let name = full;
  if (rec) {
    if (!rec.parentClinicId) name = 'Main';
    else {
      const parent: any = selectedClinics.find(c => String(c.id) === String(rec.parentClinicId));
      if (parent?.name && full.toLowerCase().startsWith(String(parent.name).toLowerCase())) {
        name = full.slice(String(parent.name).length).replace(/^[\s\-–—·:]+/, '') || full;
      }
    }
  }
  return (
    <span
      title={full}
      className={`inline-flex items-center gap-1 max-w-[160px] px-1.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap ${className || ''}`}
    >
      <Building2 size={9} className="shrink-0" /> <span className="truncate">{name}</span>
    </span>
  );
};

export default ScopeClinicBadge;
