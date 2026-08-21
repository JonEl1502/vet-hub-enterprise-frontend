import React from 'react';
import { Visit } from '../../../types';

/**
 * "Transfer / add encounter" — moved OUT of the wizard header and down to the
 * finalize/payment bar (user, 2026-08-02: "let transfer to another visit type
 * happen at the end next to finalize or payment, not here any more").
 *
 * Sitting at the top, beside the workflow chip, it read as a mid-consultation
 * mode switch and invited stacking work onto a visit that was still open. At
 * the end it reads as what it actually is: a HAND-OFF decision taken once this
 * encounter is done — which is also the shape the linked-visits direction
 * needs (see `backend/docs/LINKED_VISITS_ARCHITECTURE.md`), where this becomes
 * "start a linked visit" rather than stacking a row on the same one.
 */

interface Props {
  visit: Visit;
  /** Wizard entries already on this visit — used to grey out what is taken. */
  availableEntries: { key: string }[];
  onAdd: (type: 'VET_VISIT' | 'VACCINATION' | 'GROOMING' | 'BOARDING') => void;
  className?: string;
  /**
   * Short placeholder + tighter padding, for the phone bill bar and the
   * workflow row. A native <select> shows one label at every breakpoint, so a
   * responsive string is impossible — render the compact instance and the full
   * one side by side under `sm:hidden` / `hidden sm:block` instead.
   */
  compact?: boolean;
}

const AddEncounterSelect: React.FC<Props> = ({ visit, availableEntries, onAdd, className = '', compact = false }) => {
  const has = (...kws: string[]) =>
    (visit.tasks || []).some(t => kws.some(k => String(t.category || '').toLowerCase().includes(k)));
  const entryTaken = (...keys: string[]) => availableEntries.some(e => keys.includes(e.key));

  // Hospitalization is NOT here — it has its own 🏥 escalation button.
  const options = [
    {
      value: 'VET_VISIT' as const, label: '🩺 Vet Visit — consultation',
      taken: has('consult')
        || entryTaken('standard', 'houseCall', 'followUp', 'routineCheck', 'surgery', 'admission'),
    },
    {
      value: 'VACCINATION' as const, label: '💉 Vaccination',
      taken: (visit as any).visitType === 'VACCINATION' || has('vaccin', 'immuni') || entryTaken('vaccination'),
    },
    {
      value: 'GROOMING' as const, label: '✂️ Grooming',
      taken: visit.encounterType === 'GROOMING' || has('groom') || entryTaken('grooming'),
    },
    {
      value: 'BOARDING' as const, label: '🏠 Boarding',
      taken: visit.encounterType === 'BOARDING' || has('board') || entryTaken('boarding'),
    },
  ].filter(o => !o.taken);

  if (options.length === 0) return null;

  return (
    <select
      value=""
      onChange={e => { const v = e.target.value as any; if (v) { onAdd(v); e.target.value = ''; } }}
      title="Hand this patient on to another encounter type — its service & fee land on this bill"
      className={`shrink-0 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-black uppercase tracking-widest outline-none cursor-pointer hover:border-seafoam/50 transition-all ${compact ? 'px-2 py-1.5 text-[9px]' : 'px-2.5 py-2.5 text-[10px]'} ${className}`}
    >
      <option value="">{compact ? '＋ Encounter' : '＋ Transfer / add encounter…'}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
};

export default AddEncounterSelect;
