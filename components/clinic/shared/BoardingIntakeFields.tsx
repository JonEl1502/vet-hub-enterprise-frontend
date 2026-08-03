import React from 'react';
import AdmissionGate, { AdmissionGateValue } from './AdmissionGate';
import FoodProgramFields, { FoodProgram } from './FoodProgramFields';

/**
 * THE boarding intake form — one component, both doors.
 *
 * Boarding could be started from the **Admit** page or from **New Visit**, and
 * the two asked different questions: Admit had kennel, daily rate, medication
 * instructions and emergency contact; the wizard had temperament and
 * belongings, and used a different food control entirely. Same service, two
 * intakes, so whichever door staff used decided what got recorded (user,
 * 2026-08-03: "both must be exactly the same from now on").
 *
 * Patient selection is deliberately NOT here — the wizard already has a
 * patient and Admit has to search for one. Everything else is shared.
 */

export interface BoardingIntakeValue {
  gate: AdmissionGateValue;
  expectedPickupAt: string;
  kennel: string;
  dailyRate: string;
  temperament: string;
  food: FoodProgram;
  feedingInstructions: string;
  medicationInstructions: string;
  specialInstructions: string;
  belongings: string;
  emergencyContact: string;
}

export const emptyBoardingIntake = (): BoardingIntakeValue => ({
  gate: { intakeWeight: '', vaccines: {}, recommended: {}, clientAgreed: false },
  expectedPickupAt: '', kennel: '', dailyRate: '', temperament: '',
  food: {}, feedingInstructions: '', medicationInstructions: '',
  specialInstructions: '', belongings: '', emergencyContact: '',
});

const TEMPERAMENTS = ['Calm', 'Nervous', 'Aggressive', 'Unknown'];

interface Props {
  value: BoardingIntakeValue;
  onChange: (patch: Partial<BoardingIntakeValue>) => void;
  petId?: string | number | null;
  petWeight?: number | string | null;
  petWeightAt?: string | null;
  currency?: string;
  /** Admit requires the gate; the wizard step is advisory. */
  required?: boolean;
  /** Admit sets the stay window/kennel; hide where the caller owns them. */
  showStay?: boolean;
}

const BoardingIntakeFields: React.FC<Props> = ({
  value, onChange, petId, petWeight, petWeightAt, currency = 'KES', required = true, showStay = true,
}) => (
  <>
    {showStay && (
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-seafoam">Schedule &amp; kennel</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Expected pickup</label>
            <input type="datetime-local" className="field-input" value={value.expectedPickupAt}
              onChange={e => onChange({ expectedPickupAt: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Kennel / run</label>
            <input className="field-input" placeholder="A1" value={value.kennel}
              onChange={e => onChange({ kennel: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Daily rate ({currency})</label>
            <input type="number" min="0" step="0.01" className="field-input" placeholder="1500" value={value.dailyRate}
              onChange={e => onChange({ dailyRate: e.target.value })} />
          </div>
        </div>
      </section>
    )}

    <AdmissionGate
      petId={petId}
      petWeight={petWeight}
      petWeightAt={petWeightAt}
      required={required}
      value={value.gate}
      onChange={patch => onChange({ gate: { ...value.gate, ...patch } })}
    />

    <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-seafoam">Temperament</p>
      <div className="flex flex-wrap gap-2">
        {TEMPERAMENTS.map(t => (
          <button key={t} type="button" onClick={() => onChange({ temperament: t })}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
              value.temperament === t
                ? 'bg-seafoam text-white border-seafoam'
                : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
            }`}>
            {t}
          </button>
        ))}
      </div>
    </section>

    <FoodProgramFields value={value.food} onChange={f => onChange({ food: f })} />

    <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-seafoam">Care instructions</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="field-label">Feeding instructions</label>
          <textarea className="field-textarea" rows={2} placeholder="2 cups dry AM/PM"
            value={value.feedingInstructions} onChange={e => onChange({ feedingInstructions: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Medication instructions</label>
          <textarea className="field-textarea" rows={2} placeholder="Apoquel 1 tab daily"
            value={value.medicationInstructions} onChange={e => onChange({ medicationInstructions: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Special instructions</label>
          <textarea className="field-textarea" rows={2} placeholder="Anxious; separate from other dogs"
            value={value.specialInstructions} onChange={e => onChange({ specialInstructions: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Belongings</label>
          <textarea className="field-textarea" rows={2} placeholder="Bed, toys, leash…"
            value={value.belongings} onChange={e => onChange({ belongings: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="field-label">Emergency contact</label>
          <input className="field-input" placeholder="Name + phone"
            value={value.emergencyContact} onChange={e => onChange({ emergencyContact: e.target.value })} />
        </div>
      </div>
    </section>
  </>
);

export default BoardingIntakeFields;
