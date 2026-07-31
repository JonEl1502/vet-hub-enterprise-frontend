import React from 'react';
import { Plus, X } from 'lucide-react';

/**
 * A body system's exam result: one Normal tick, or any number of TITLED
 * findings ("Retina: mild degeneration", "Cornea: clear").
 *
 * ── Why titled entries ──────────────────────────────────────────────────────
 * One free-text box per system forced every observation about an eye into a
 * single string, which nothing could search, trend, or carry into the next
 * visit. Findings are now a list, each with a title.
 *
 * ── Why `findings` is still written ─────────────────────────────────────────
 * `MedicalReport` and the clinic-workflow renderer read `s.findings` as a
 * string. Rather than chase every reader, the flattened string is DERIVED from
 * the entries on every edit and kept in place. Old code sees what it always
 * saw; new code reads `entries`. That is also what makes this safe to ship
 * without a migration — wizard state is local, and both shapes coexist.
 *
 * ── Why titles carry a key ──────────────────────────────────────────────────
 * Free-typed titles drift: "Retina", "retina", "Retinal exam" become three
 * different things and every future query across exams misses two of them.
 * Each entry carries a stable `key`; `label` is only what is displayed. Same
 * lesson as the category stable-key drift that caused data loss in 069.
 */
export interface SystemFinding {
  /** Stable slug — never rendered, never edited after creation. */
  key: string;
  /** Display title. Renaming this must not change `key`. */
  label: string;
  text: string;
}

export interface SystemValue {
  normal?: boolean;
  /** Derived from `entries` — kept for every existing reader. */
  findings?: string;
  entries?: SystemFinding[];
}

/** "Pupils / PLR" → "pupils-plr". Deterministic, so the same title always keys the same. */
export const slugifyTitle = (label: string): string =>
  label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'finding';

/**
 * Canonical titles per system, seeded so the chips are useful on day one.
 * Without these the first vet on a fresh clinic faces a blank wall and invents
 * private vocabulary — the drift we are trying to prevent.
 *
 * Keyed by the system SLUG. Labels here are the display defaults.
 */
export const SYSTEM_TITLES: Record<string, string[]> = {
  eyes: ['Conjunctiva', 'Cornea', 'Lens', 'Retina', 'Pupils / PLR', 'Discharge'],
  ears: ['Pinna', 'Ear canal', 'Tympanum', 'Discharge', 'Odour'],
  nose: ['Nasal discharge', 'Airflow', 'Nasal planum'],
  oralcavity: ['Teeth', 'Gums', 'Tongue', 'Mucous membranes', 'CRT', 'Halitosis'],
  cardiovascular: ['Heart sounds', 'Murmur', 'Pulse quality', 'Rhythm'],
  respiratory: ['Lung sounds', 'Cough', 'Breathing effort', 'Trachea'],
  abdomen: ['Palpation', 'Bladder', 'Intestines', 'Liver / spleen', 'Pain response'],
  musculoskeletal: ['Gait', 'Joints', 'Muscle mass', 'Lameness', 'Spine'],
  skincoat: ['Coat quality', 'Lesions', 'Ectoparasites', 'Pruritus', 'Alopecia'],
  neurological: ['Cranial nerves', 'Proprioception', 'Reflexes', 'Mentation', 'Ataxia'],
  reproductive: ['External genitalia', 'Mammary chain', 'Prostate / uterus', 'Discharge'],
  lymphnodes: ['Submandibular', 'Prescapular', 'Popliteal', 'Size / consistency'],
};

/** Titles offered when the system isn't one we ship a list for (clinic-built cards). */
const GENERIC_TITLES = ['Appearance', 'Palpation', 'Symmetry', 'Pain response', 'Other'];

export const titlesFor = (slugOrLabel: string): string[] =>
  SYSTEM_TITLES[slugOrLabel.toLowerCase().replace(/[^a-z]/g, '')] ?? GENERIC_TITLES;

/**
 * Read whatever is stored as a list. A record written before this feature has
 * only the plain string — surface it as one untitled entry so nothing looks
 * lost and the vet can retitle it.
 */
export const toEntries = (v: SystemValue): SystemFinding[] => {
  if (Array.isArray(v.entries)) return v.entries;
  const legacy = (v.findings ?? '').trim();
  return legacy ? [{ key: 'general', label: 'General', text: legacy }] : [];
};

/** The flat string every existing reader still expects. */
export const flatten = (entries: SystemFinding[]): string =>
  entries
    .filter(e => e.text.trim())
    .map(e => (e.label && e.label !== 'General' ? `${e.label}: ${e.text.trim()}` : e.text.trim()))
    .join('; ');

interface Props {
  /** Display name of the system, e.g. "Oral cavity". */
  label: string;
  /** Stable slug used to pick the seeded title list. Falls back to `label`. */
  slug?: string;
  value: SystemValue;
  onChange: (next: SystemValue) => void;
}

const SystemFindingsCard: React.FC<Props> = ({ label, slug, value, onChange }) => {
  const [adding, setAdding] = React.useState(false);
  const [custom, setCustom] = React.useState('');
  const entries = toEntries(value);
  const abnormal = entries.some(e => e.text.trim());

  // Writing entries always rewrites the derived string in the same breath, so
  // the two can never disagree.
  const commit = (next: SystemFinding[], patch: Partial<SystemValue> = {}) =>
    onChange({ ...value, entries: next, findings: flatten(next), ...patch });

  const addTitle = (title: string) => {
    const t = title.trim();
    if (!t) return;
    const key = slugifyTitle(t);
    // Adding a title that is already on the card should focus attention, not
    // create a duplicate row the vet then has to reconcile.
    if (entries.some(e => e.key === key)) { setAdding(false); setCustom(''); return; }
    commit([...entries, { key, label: t, text: '' }], { normal: false });
    setAdding(false);
    setCustom('');
  };

  const used = new Set(entries.map(e => e.key));
  const suggestions = titlesFor(slug || label).filter(t => !used.has(slugifyTitle(t)));

  return (
    <div className={`border rounded-xl p-2.5 space-y-1.5 transition-all ${abnormal ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20' : 'border-slate-200 dark:border-zinc-800'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{label}</p>
        <button
          type="button"
          onClick={() => onChange(value.normal
            ? { ...value, normal: false }
            // Ticking Normal clears the findings — an abnormal note sitting
            // under a Normal tick is a contradiction in the record.
            : { ...value, normal: true, entries: [], findings: '' })}
          className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border transition-all ${value.normal ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 dark:bg-zinc-950 text-slate-400 border-slate-200 dark:border-zinc-800'}`}
        >
          {value.normal ? '✓ Normal' : 'Normal'}
        </button>
      </div>

      {entries.map((e, i) => (
        <div key={e.key} className="flex items-center gap-1.5">
          <span className="shrink-0 px-1.5 py-1 rounded bg-slate-100 dark:bg-zinc-800 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 max-w-[38%] truncate" title={e.label}>
            {e.label}
          </span>
          <input
            className="field-input !h-8 text-xs flex-1"
            placeholder={`${e.label} findings…`}
            value={e.text}
            autoFocus={!e.text && i === entries.length - 1}
            onChange={ev => {
              const next = entries.map((x, xi) => (xi === i ? { ...x, text: ev.target.value } : x));
              commit(next, ev.target.value ? { normal: false } : {});
            }}
          />
          <button
            type="button"
            title={`Remove ${e.label}`}
            onClick={() => commit(entries.filter((_, xi) => xi !== i))}
            className="shrink-0 p-1 rounded text-slate-300 hover:text-rose-500 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex flex-wrap gap-1">
            {suggestions.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => addTitle(t)}
                className="px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[9px] font-bold text-slate-600 dark:text-zinc-300 hover:border-seafoam hover:text-seafoam transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              className="field-input !h-7 text-[11px] flex-1"
              placeholder="Or type a title…"
              value={custom}
              autoFocus
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addTitle(custom); }
                if (e.key === 'Escape') { setAdding(false); setCustom(''); }
              }}
            />
            <button type="button" onClick={() => addTitle(custom)} disabled={!custom.trim()}
              className="px-2 py-1 rounded bg-seafoam text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-40">
              Add
            </button>
            <button type="button" onClick={() => { setAdding(false); setCustom(''); }}
              className="px-1.5 py-1 rounded text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-pine transition-colors"
        >
          <Plus size={11} /> {entries.length ? 'Add another' : 'Add description'}
        </button>
      )}
    </div>
  );
};

export default SystemFindingsCard;
