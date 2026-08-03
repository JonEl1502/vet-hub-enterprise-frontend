import React from 'react';
import { Utensils, Search, Package, X, Sparkles, Lock, Plus, Minus } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { useFeature } from '../../../contexts/PlanAccessContext';

export interface FoodProgram {
  specialFood?: string;
  providedByClient?: boolean;
  billable?: boolean;
  /**
   * Price of ONE meal. Still the contract every consumer reads (the stay
   * estimate multiplies it by meals/day × days) — but when a food is picked
   * from inventory it is now DERIVED as `portion × unit price` instead of
   * typed from memory.
   */
  ratePerMeal?: number | '';
  mealsPerDay?: number | '';
  feedingTimes?: string;
  notes?: string;
  /** Inventory food backing the rate (clinic-provided). */
  inventoryItemId?: string;
  /** Portion per meal, in the item's own unit. */
  portion?: number | '';
  portionUnit?: string;
  /** Save this as a standing feeding program for the patient (paid feature). */
  autoFeedingProgram?: boolean;
}

interface Props {
  value: FoodProgram;
  onChange: (v: FoodProgram) => void;
  disabled?: boolean;
}

const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

const isFood = (i: any) => /food|diet|kibble|feed|nutri/i.test(`${i?.category ?? ''} ${i?.name ?? ''}`);

/** Portions move in tenths of a pack; the chips cover the common fractions. */
const PORTION_STEP = 0.1;
const PORTION_PRESETS = [
  { v: 0.25, l: '¼' }, { v: 0.5, l: '½' }, { v: 0.75, l: '¾' }, { v: 1, l: '1' },
];

/**
 * Pack weight parsed out of the item name ("Hill's Science Diet Adult Dog 2kg"),
 * so a portion of 0.25 can be shown as the 500 g it actually is. Name-derived
 * and therefore best-effort — absent when nothing parses, never guessed.
 */
const packGrams = (name?: string | null): number | null => {
  const m = /(\d+(?:\.\d+)?)\s*(kg|g)\b/i.exec(String(name ?? ''));
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2].toLowerCase() === 'kg' ? n * 1000 : n;
};

/**
 * Food / feeding program for a boarding or inpatient stay.
 *
 * The rate used to be typed from memory ("Rate / meal: e.g. 250"), so the food
 * charge had no relationship to the food actually issued or to stock. Clinic
 * food is now **picked from inventory** with a portion per meal, and the rate
 * is computed from the item's own price (user, 2026-08-03).
 *
 * `ratePerMeal` is deliberately kept as the output so the stay estimate that
 * already multiplies it out (rate × meals/day × days) keeps working untouched —
 * this improves its inputs rather than duplicating the calculation.
 */
const FoodProgramFields: React.FC<Props> = ({ value, onChange, disabled }) => {
  const { inventory, ensureInventory } = useData() as any;
  // Standing per-patient feeding programs are a paid capability; everything
  // else in this card stays available on every plan.
  const canAutoProgram = useFeature('capability:feeding-programs');
  const [q, setQ] = React.useState('');
  React.useEffect(() => { ensureInventory?.(); }, [ensureInventory]);

  const set = (patch: Partial<FoodProgram>) => onChange({ ...value, ...patch });
  const clinicProvided = value.providedByClient === false;

  const picked = React.useMemo(
    () => (inventory || []).find((i: any) => String(i.id) === String(value.inventoryItemId)) || null,
    [inventory, value.inventoryItemId]);

  const matches = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [] as any[];
    return (inventory || []).filter(isFood)
      .filter((i: any) => `${i.name} ${i.category ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [inventory, q]);

  /** Picking a food (or changing the portion) recomputes the meal rate. */
  const applyFood = (item: any, portion: number | '') => {
    const unit = Number(item?.price ?? 0);
    const p = Number(portion || 0);
    set({
      inventoryItemId: item ? String(item.id) : undefined,
      specialFood: item ? item.name : value.specialFood,
      portionUnit: item?.unit,
      portion,
      ratePerMeal: item && p > 0 ? Math.round(unit * p * 100) / 100 : value.ratePerMeal,
    });
  };

  const perDay = Number(value.ratePerMeal || 0) * Number(value.mealsPerDay || 0);
  const pg = packGrams(picked?.name);
  const grams = pg != null && Number(value.portion) > 0 ? Math.round(pg * Number(value.portion)) : null;

  return (
    <section className="bg-slate-50/60 dark:bg-zinc-950/30 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5"><Utensils size={13} /> Food program</p>

      <div>
        <label className={labelCls}>Provided by</label>
        <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-max">
          {[{ k: true, l: 'Client brings food' }, { k: false, l: 'Clinic provides (billable)' }].map(o => (
            <button key={String(o.k)} type="button" disabled={disabled}
              onClick={() => set({ providedByClient: o.k, billable: o.k ? false : (value.billable ?? true) })}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${(value.providedByClient ?? true) === o.k ? 'bg-seafoam text-white' : 'text-slate-400'}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {clinicProvided ? (
        <div className="space-y-1.5">
          <label className={labelCls}>Food (from inventory)</label>
          {picked ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-seafoam/10 border border-seafoam/30">
              <Package size={13} className="text-seafoam shrink-0" />
              <span className="flex-1 min-w-0 text-[12px] font-bold text-pine dark:text-zinc-100 truncate">{picked.name}</span>
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400">
                {picked.quantity} {picked.unit} · {Number(picked.price ?? 0).toLocaleString()}/{picked.unit}
              </span>
              <button type="button" disabled={disabled} title="Pick a different food"
                onClick={() => set({ inventoryItemId: undefined, portionUnit: undefined })}
                className="shrink-0 text-slate-400 hover:text-rose-500"><X size={13} /></button>
            </div>
          ) : (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input className={`${fieldCls} pl-8`} disabled={disabled} placeholder="Search foods in inventory (2+ chars)…"
                value={q} onChange={e => setQ(e.target.value)} />
              {matches.length > 0 && (
                <div className="absolute z-30 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden">
                  {matches.map((i: any) => (
                    <button key={i.id} type="button"
                      onMouseDown={() => { applyFood(i, value.portion ?? ''); setQ(''); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-seafoam/5 transition-all">
                      <Package size={11} className="text-seafoam shrink-0" />
                      <span className="flex-1 min-w-0 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{i.name}</span>
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {Number(i.price ?? 0).toLocaleString()}/{i.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {q.trim().length >= 2 && matches.length === 0 && (
                <p className="mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  No food matching “{q.trim()}” — add it to inventory, or let the client bring food.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className={labelCls}>Special / prescription food</label>
          <input className={fieldCls} disabled={disabled} placeholder="e.g. Hill's i/d, raw chicken, owner's kibble"
            value={value.specialFood ?? ''} onChange={e => set({ specialFood: e.target.value })} />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {clinicProvided && (
          <div>
            <label className={labelCls}>Portion / meal{picked ? ` (${picked.unit})` : ''}</label>
            {/* A meal is a FRACTION of a bag, never a whole one (user,
                2026-08-03), so typing a decimal from scratch was the wrong
                control. Steppers + quarter chips, and the grams are spelled out
                whenever the pack size is in the item name. */}
            <div className="flex items-stretch rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 overflow-hidden">
              <button type="button" disabled={disabled || !picked || !(Number(value.portion) > 0)}
                onClick={() => applyFood(picked, Math.max(0, Math.round((Number(value.portion || 0) - PORTION_STEP) * 100) / 100))}
                title="Less" className="px-2.5 text-slate-500 dark:text-zinc-400 hover:text-seafoam disabled:opacity-30">
                <Minus size={13} />
              </button>
              <input type="number" min="0" step={PORTION_STEP}
                className="flex-1 min-w-0 px-2 py-2.5 bg-transparent text-sm text-center text-pine dark:text-zinc-100 focus:outline-none"
                disabled={disabled || !picked}
                placeholder={picked ? '0.5' : 'Pick a food'}
                value={value.portion ?? ''}
                onChange={e => applyFood(picked, e.target.value === '' ? '' : Number(e.target.value))} />
              <button type="button" disabled={disabled || !picked}
                onClick={() => applyFood(picked, Math.round((Number(value.portion || 0) + PORTION_STEP) * 100) / 100)}
                title="More" className="px-2.5 text-slate-500 dark:text-zinc-400 hover:text-seafoam disabled:opacity-30">
                <Plus size={13} />
              </button>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              {PORTION_PRESETS.map(fr => (
                <button key={fr.v} type="button" disabled={disabled || !picked}
                  onClick={() => applyFood(picked, fr.v)}
                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all disabled:opacity-30 ${
                    Number(value.portion) === fr.v
                      ? 'bg-seafoam text-white border-seafoam'
                      : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:text-seafoam'
                  }`}>
                  {fr.l}
                </button>
              ))}
              {grams != null && (
                <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-slate-400">
                  ≈ {grams.toLocaleString()} g
                </span>
              )}
            </div>
          </div>
        )}
        <div>
          <label className={labelCls}>Meals / day</label>
          <input type="number" min="0" className={fieldCls} disabled={disabled} placeholder="e.g. 2"
            value={value.mealsPerDay ?? ''} onChange={e => set({ mealsPerDay: e.target.value === '' ? '' : Number(e.target.value) })} />
        </div>
        <div className={clinicProvided ? '' : 'col-span-2'}>
          <label className={labelCls}>Feeding times</label>
          <input className={fieldCls} disabled={disabled} placeholder="e.g. 8am, 1pm, 6pm"
            value={value.feedingTimes ?? ''} onChange={e => set({ feedingTimes: e.target.value })} />
        </div>
      </div>

      {clinicProvided && perDay > 0 && (
        <p className="text-[10px] text-slate-400">
          {picked
            ? <>{value.portion} {picked.unit} × {Number(picked.price ?? 0).toLocaleString()} = <b className="text-pine dark:text-zinc-100">{Number(value.ratePerMeal || 0).toLocaleString()}/meal</b>{' '}</>
            : null}
          × {value.mealsPerDay} meal{Number(value.mealsPerDay) === 1 ? '' : 's'}/day
          {' = '}<b className="text-pine dark:text-zinc-100">{perDay.toLocaleString()}/day</b>.
          {' '}The stay estimate multiplies this by the days between check-in and expected checkout.
        </p>
      )}

      <label className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
        canAutoProgram
          ? 'border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 cursor-pointer'
          : 'border-slate-200 dark:border-zinc-800 opacity-60 cursor-not-allowed'
      }`}>
        <input
          type="checkbox" disabled={disabled || !canAutoProgram}
          checked={!!value.autoFeedingProgram && canAutoProgram}
          onChange={e => set({ autoFeedingProgram: e.target.checked })}
          className="w-3.5 h-3.5 mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 shrink-0"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-black text-pine dark:text-zinc-100">
            {canAutoProgram ? <Sparkles size={12} className="text-violet-500" /> : <Lock size={12} className="text-slate-400" />}
            Create a feeding program for this patient
          </span>
          <span className="block text-[10px] font-bold text-slate-400 mt-0.5">
            {canAutoProgram
              ? 'Saves this food, portion and schedule to the patient, so the next stay starts pre-filled.'
              : 'Available on Pro and Enterprise — upgrade to save feeding programs per patient.'}
          </span>
        </span>
      </label>
    </section>
  );
};

export default FoodProgramFields;
