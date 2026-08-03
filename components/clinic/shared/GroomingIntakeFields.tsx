import React from 'react';
import AdmissionGate, { AdmissionGateValue } from './AdmissionGate';

/**
 * THE grooming intake form — one component, both doors.
 *
 * Same problem as boarding: the **Admit** modal asked for weight, temperament
 * and instructions; the **New Visit** gate check asked for coat condition and
 * physical flags (fleas, wounds, ears, nails) that Admit never captured. A
 * groom booked through the wrong door lost the findings (user, 2026-08-03:
 * "even grooming for both its pages").
 *
 * Patient selection stays with the caller — the wizard already has one.
 */

export interface GroomingIntakeValue {
  gate: AdmissionGateValue;
  temperament: string;
  coat: string;
  flags: Record<string, boolean>;
  instructions: string;
}

export const emptyGroomingIntake = (): GroomingIntakeValue => ({
  gate: { intakeWeight: '', vaccines: {}, recommended: {}, clientAgreed: false },
  temperament: '', coat: '', flags: {}, instructions: '',
});

const TEMPERAMENTS = ['Calm', 'Nervous', 'Aggressive', 'Unknown'];
const COATS = ['Good', 'Matted', 'Shedding', 'Skin issues'];
const FLAGS: { k: string; label: string }[] = [
  { k: 'fleas', label: 'Fleas / ticks seen' },
  { k: 'wounds', label: 'Wounds / hotspots' },
  { k: 'earIssues', label: 'Ear issues' },
  { k: 'nailIssues', label: 'Overgrown nails' },
];

interface Props {
  value: GroomingIntakeValue;
  onChange: (patch: Partial<GroomingIntakeValue>) => void;
  petId?: string | number | null;
  petWeight?: number | string | null;
  petWeightAt?: string | null;
  required?: boolean;
}

const Chips: React.FC<{ options: string[]; value: string; onPick: (v: string) => void }> = ({ options, value, onPick }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(o => (
      <button key={o} type="button" onClick={() => onPick(o)}
        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
          value === o
            ? 'bg-seafoam text-white border-seafoam'
            : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
        }`}>
        {o}
      </button>
    ))}
  </div>
);

const GroomingIntakeFields: React.FC<Props> = ({
  value, onChange, petId, petWeight, petWeightAt, required = true,
}) => (
  <>
    <AdmissionGate
      petId={petId}
      petWeight={petWeight}
      petWeightAt={petWeightAt}
      required={required}
      value={value.gate}
      onChange={patch => onChange({ gate: { ...value.gate, ...patch } })}
    />

    <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-seafoam">Condition on arrival</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="field-label">Temperament</label>
          <Chips options={TEMPERAMENTS} value={value.temperament} onPick={t => onChange({ temperament: t })} />
        </div>
        <div className="space-y-1.5">
          <label className="field-label">Coat condition</label>
          <Chips options={COATS} value={value.coat} onPick={c => onChange({ coat: c })} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="field-label">Flags</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {FLAGS.map(f => (
            <label key={f.k} className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-100 dark:border-zinc-800 cursor-pointer select-none hover:border-seafoam transition-all">
              <input
                type="checkbox" checked={!!value.flags[f.k]}
                onChange={e => onChange({ flags: { ...value.flags, [f.k]: e.target.checked } })}
                className="w-3.5 h-3.5 rounded border-slate-300 text-seafoam focus:ring-seafoam"
              />
              <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-300">{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label">Special instructions</label>
        <textarea className="field-textarea" rows={2} placeholder="Style, areas to avoid, owner requests…"
          value={value.instructions} onChange={e => onChange({ instructions: e.target.value })} />
      </div>
    </section>
  </>
);

export default GroomingIntakeFields;
