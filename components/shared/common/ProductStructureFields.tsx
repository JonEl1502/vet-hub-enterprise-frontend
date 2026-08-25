import React from 'react';
import { GripVertical, Plus, X } from 'lucide-react';

/**
 * THE shared product structure (migration 155).
 *
 * One structure carries a product through the whole chain:
 *   reference catalog (Drug) → supplier listing (SupplierProduct) → clinic stock
 * so category, subcategories and units are set ONCE and inherited, rather than
 * retyped at every hop and drifting apart.
 *
 * This is the field group for editing it. It is deliberately presentational —
 * no fetching, no save — so the supplier form and (later) the clinic Add-Stock
 * form can render the same controls over their own state.
 *
 * ⚠️ `InventoryView` still has its own inline copy of these controls. That is
 * KNOWN, and not an oversight: it is a ~1,900-line component whose Add-Stock
 * flow works, and refactoring it is a separate, testable change. When it is
 * moved over, delete the inline block — do not leave both live and drifting,
 * which is the exact failure this structure exists to end.
 */

export type MainCategory = 'MEDICINE' | 'CONSUMABLE';

/** Suggestions only — the field accepts anything typed. */
export const SUBCATEGORY_PRESETS: Record<MainCategory, string[]> = {
  MEDICINE: [
    'Antibiotic', 'Antifungal', 'Antiparasitic', 'Anti-inflammatory (NSAID)', 'Analgesic',
    'Corticosteroid', 'Anaesthetic', 'Sedative', 'Vaccine', 'Antiseptic', 'Cardiac',
    'Gastrointestinal', 'Dermatological', 'Ophthalmic', 'Respiratory', 'Hormonal',
    'Fluids & Electrolytes', 'Vitamin / Supplement', 'Dewormer', 'Euthanasia',
  ],
  CONSUMABLE: [
    'Surgical Supplies', 'Syringes & Needles', 'Gloves', 'Cotton & Gauze', 'Bandages & Dressings',
    'Sutures', 'Catheters', 'IV Lines & Giving Sets', 'Diagnostic / Lab', 'Cleaning & Disinfectant',
    'PPE', 'Feeding & Nutrition', 'Grooming', 'Identification (microchips/tags)', 'Office / Stationery',
  ],
};

export interface ProductStructureValue {
  mainCategory: MainCategory;
  subcategories: string[];
}

interface Props {
  value: ProductStructureValue;
  onChange: (next: ProductStructureValue) => void;
  /** Rendered under the main-category buttons — e.g. an SKU regeneration note. */
  hint?: React.ReactNode;
  idPrefix?: string;
}

const labelCls = 'text-[9px] font-black text-seafoam uppercase tracking-widest px-1';
const inputCls =
  'flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm';

const ProductStructureFields: React.FC<Props> = ({ value, onChange, hint, idPrefix = 'psf' }) => {
  const [draft, setDraft] = React.useState('');
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);

  const addSubcat = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    // Case-insensitive dedupe: "Antibiotic" and "antibiotic" are one category,
    // and letting both in makes the ordered path meaningless.
    if (value.subcategories.some((s) => s.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    onChange({ ...value, subcategories: [...value.subcategories, v] });
    setDraft('');
  };

  const removeSubcat = (idx: number) =>
    onChange({ ...value, subcategories: value.subcategories.filter((_, i) => i !== idx) });

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value.subcategories];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ ...value, subcategories: next });
  };

  return (
    <>
      <div className="space-y-1">
        <label className={labelCls}>Main Category *</label>
        <div className="grid grid-cols-2 gap-2">
          {(['MEDICINE', 'CONSUMABLE'] as MainCategory[]).map((mc) => {
            const active = value.mainCategory === mc;
            return (
              <button
                key={mc}
                type="button"
                onClick={() => onChange({ ...value, mainCategory: mc })}
                className={`px-3 py-2.5 rounded-xl border text-sm font-black uppercase tracking-wide transition-all ${
                  active
                    ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine border-pine dark:border-zinc-100 shadow-sm'
                    : 'bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam/50'
                }`}
              >
                {mc === 'MEDICINE' ? 'Medicine' : 'Consumables'}
              </button>
            );
          })}
        </div>
        {hint}
      </div>

      {/* Ordered path — type or pick, unlimited, drag to reorder. */}
      <div className="space-y-1.5">
        <label className={labelCls}>
          Subcategories{' '}
          {/* Its own line on a phone — trailing after the label it wrapped
              mid-sentence under the field it describes. */}
          <span className="block sm:inline text-slate-400 normal-case font-bold">— add as many as you like, drag to reorder</span>
        </label>
        {value.subcategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.subcategories.map((sc, idx) => (
              <div
                key={`${sc}-${idx}`}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIdx !== null) reorder(dragIdx, idx); setDragIdx(null); }}
                onDragEnd={() => setDragIdx(null)}
                title="Drag to reorder"
                className={`flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg border cursor-grab active:cursor-grabbing text-[10px] font-black uppercase tracking-wide transition-all ${
                  dragIdx === idx
                    ? 'bg-seafoam/20 border-seafoam text-seafoam opacity-60'
                    : 'bg-seafoam/10 border-seafoam/30 text-seafoam'
                }`}
              >
                <GripVertical size={11} className="opacity-50 shrink-0" />
                <span className="text-[8px] font-mono opacity-60">{idx + 1}</span>
                {sc}
                <button type="button" onClick={() => removeSubcat(idx)} className="hover:text-red-500 ml-0.5">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* ⚠️ STACKS BELOW `sm` (user, 2026-08-25: "fitting"). Side by side,
            the input's minimum width plus a `shrink-0` 170px button ran past
            the right edge of a 360px screen — the button was half off-screen
            and the form scrolled sideways. */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            list={`${idPrefix}-subcat-presets`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubcat(draft); } }}
            placeholder={value.mainCategory === 'MEDICINE'
              ? 'Choose or type e.g. Antibiotic → Cephalosporin…'
              : 'Choose or type e.g. Surgical Supplies → Sutures…'}
            className={`${inputCls} min-w-0 flex-1`}
          />
          <datalist id={`${idPrefix}-subcat-presets`}>
            {SUBCATEGORY_PRESETS[value.mainCategory]
              .filter((p) => !value.subcategories.some((s) => s.toLowerCase() === p.toLowerCase()))
              .map((p) => <option key={p} value={p} />)}
          </datalist>
          <button
            type="button"
            onClick={() => addSubcat(draft)}
            className="w-full sm:w-auto sm:shrink-0 px-3 py-2.5 bg-seafoam text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Plus size={13} /> Add subcategory
          </button>
        </div>
      </div>
    </>
  );
};

export default ProductStructureFields;
