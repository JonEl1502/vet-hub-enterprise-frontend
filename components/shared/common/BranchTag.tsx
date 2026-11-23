import React from 'react';
import { useClinic } from '../../../contexts/ClinicContext';

/**
 * Which branch a record belongs to — shown ONLY while more than one branch is
 * being viewed (user, 2026-11-23: "when patients or records are mixed up from
 * many branches, show which one is in main and which one is in the other
 * branch … name the branch itself"). With one branch selected everything on
 * screen is that branch, so the tag would be noise.
 *
 * Main = the clinic with no parent. A branch shows its own name, trimmed of
 * the main clinic's name ("Kabi Vets Clinic - Kinoo" → "Kinoo").
 */
const BranchTag: React.FC<{ clinicId?: number | string | null; className?: string }> = ({ clinicId, className = '' }) => {
  const { clinics, selectedClinicIds } = useClinic() as any;
  if (clinicId == null || !Array.isArray(selectedClinicIds) || selectedClinicIds.length < 2) return null;
  const c = (clinics || []).find((x: any) => String(x.id) === String(clinicId));
  if (!c) return null;
  const isMain = !c.parentClinicId;
  const parent = isMain ? null : (clinics || []).find((x: any) => String(x.id) === String(c.parentClinicId));
  let label = String(c.name || 'Branch');
  if (parent?.name && label.toLowerCase().startsWith(String(parent.name).toLowerCase())) {
    label = label.slice(String(parent.name).length).replace(/^[\s\-–—·:]+/, '') || label;
  }
  return (
    <span
      title={c.name}
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border shrink-0 ${
        isMain
          ? 'bg-pine/10 text-pine border-pine/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300'
      } ${className}`}
    >
      {isMain ? 'Main' : label}
    </span>
  );
};

export default BranchTag;
