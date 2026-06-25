import React from 'react';
import { Utensils } from 'lucide-react';

export interface FoodProgram {
  specialFood?: string;
  providedByClient?: boolean;
  billable?: boolean;
  ratePerMeal?: number | '';
  mealsPerDay?: number | '';
  feedingTimes?: string;
  notes?: string;
}

interface Props {
  value: FoodProgram;
  onChange: (v: FoodProgram) => void;
  disabled?: boolean;
}

const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

/**
 * Food / feeding program for a boarding or inpatient stay: special food, who
 * provides it (client vs clinic), billable + rate per meal, meals/day + times.
 */
const FoodProgramFields: React.FC<Props> = ({ value, onChange, disabled }) => {
  const set = (patch: Partial<FoodProgram>) => onChange({ ...value, ...patch });
  const clinicProvided = value.providedByClient === false;

  return (
    <section className="bg-slate-50/60 dark:bg-zinc-950/30 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5"><Utensils size={13} /> Food program</p>

      <div>
        <label className={labelCls}>Special / prescription food</label>
        <input className={fieldCls} disabled={disabled} placeholder="e.g. Hill's i/d, raw chicken, owner's kibble" value={value.specialFood ?? ''} onChange={e => set({ specialFood: e.target.value })} />
      </div>

      <div>
        <label className={labelCls}>Provided by</label>
        <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-max">
          {[{ k: true, l: 'Client brings food' }, { k: false, l: 'Clinic provides (billable)' }].map(o => (
            <button key={String(o.k)} type="button" disabled={disabled} onClick={() => set({ providedByClient: o.k, billable: o.k ? false : (value.billable ?? true) })}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${(value.providedByClient ?? true) === o.k ? 'bg-seafoam text-white' : 'text-slate-400'}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {clinicProvided && (
          <div>
            <label className={labelCls}>Rate / meal (KES)</label>
            <input type="number" min="0" className={fieldCls} disabled={disabled} placeholder="e.g. 250" value={value.ratePerMeal ?? ''} onChange={e => set({ ratePerMeal: e.target.value === '' ? '' : Number(e.target.value) })} />
          </div>
        )}
        <div>
          <label className={labelCls}>Meals / day</label>
          <input type="number" min="0" className={fieldCls} disabled={disabled} placeholder="e.g. 2" value={value.mealsPerDay ?? ''} onChange={e => set({ mealsPerDay: e.target.value === '' ? '' : Number(e.target.value) })} />
        </div>
        <div className={clinicProvided ? '' : 'col-span-2'}>
          <label className={labelCls}>Feeding times</label>
          <input className={fieldCls} disabled={disabled} placeholder="e.g. 8am, 1pm, 6pm" value={value.feedingTimes ?? ''} onChange={e => set({ feedingTimes: e.target.value })} />
        </div>
      </div>

      {clinicProvided && (value.ratePerMeal || value.mealsPerDay) ? (
        <p className="text-[10px] text-slate-400">Est. {value.mealsPerDay || 0} meal(s)/day × KES {Number(value.ratePerMeal || 0).toLocaleString()} = <b className="text-pine dark:text-zinc-100">KES {(Number(value.mealsPerDay || 0) * Number(value.ratePerMeal || 0)).toLocaleString()}/day</b> (added to the bill).</p>
      ) : null}
    </section>
  );
};

export default FoodProgramFields;
