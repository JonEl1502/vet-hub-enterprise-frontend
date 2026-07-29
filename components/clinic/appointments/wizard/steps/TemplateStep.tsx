import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg, CheckGrid, ListEditor } from '../fields';
import { FormField, LayoutStage, PlacedField, servicesAPI } from '../../../../../services';
import { useData } from '../../../../../contexts/DataContext';

/**
 * Renders one stage of a CLINIC-BUILT workflow (backend migration 136).
 * Spec: backend/docs/DYNAMIC_FORM_BUILDER.md
 *
 * The hand-written steps (HistoryStep, ExaminationStep…) stay exactly as they
 * are and remain the fallback. This renderer only takes over when the visit
 * resolved to a template, and it deliberately writes the SAME data shape:
 *
 *   a field's key is `<stage>.<leaf>`, and its answer is stored at
 *   `data[stageKey][leaf]`
 *
 * so a core field placed in its native stage round-trips into exactly the slot
 * `MedicalReport.tsx` already reads. That is the whole reason reports keep
 * working without being rewritten.
 */

interface Props extends StepProps {
  stage: LayoutStage;
  /** Registry rows for every key this layout places, by key. */
  fields: Record<string, FormField>;
  /**
   * 'all'    — the stage is entirely template-driven (a clinic-invented stage).
   * 'custom' — a BUILT-IN stage the clinic added questions to. The hand-written
   *            step renders above us with its real medication table, reminder
   *            rows and diagnostic pickers intact; we render only what the
   *            clinic added, underneath. Same two-tier split as the medical
   *            report, and it is why a `native` field inside a mixed stage no
   *            longer degrades to a placeholder — the real component is simply
   *            still there, above.
   */
  only?: 'all' | 'custom';
}

const leafOf = (key: string) => key.split('.').pop() || key;

const asStrings = (options: FormField['options']): string[] =>
  Array.isArray(options)
    ? options.map(o => (typeof o === 'string' ? o : o?.label)).filter(Boolean) as string[]
    : [];

const asItems = (options: FormField['options']): { k: string; label: string }[] =>
  Array.isArray(options)
    ? options.map(o => (typeof o === 'string' ? { k: o, label: o } : o)).filter(Boolean) as { k: string; label: string }[]
    : [];

// Grid width. Kept as explicit class strings — Tailwind cannot see through a
// template literal, so `col-span-${n}` would be purged from the build.
const SPAN: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
};

/**
 * Catalog-backed picker for the `lab` / `imaging` / `service` / `product`
 * field types.
 *
 * Stores `{ id, name }` rather than a bare string: the NAME is what a report
 * prints, and the ID is what a later phase needs to turn the answer into a
 * real order or bill line. A free-text fallback would have thrown the id away
 * the moment it was captured.
 *
 * Products come from the clinic's inventory; everything else from the service
 * catalog, narrowed by category so a "lab" field does not offer grooming.
 */
const CatalogPicker: React.FC<{
  kind: 'lab' | 'imaging' | 'service' | 'product';
  value: any;
  onChange: (v: any) => void;
  placeholder?: string;
}> = ({ kind, value, onChange, placeholder }) => {
  const { inventory } = useData();
  const [catalog, setCatalog] = useState<{ id: string; name: string; categoryName?: string }[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (kind === 'product') return; // inventory already lives in DataContext
    let live = true;
    servicesAPI.catalog()
      .then(list => { if (live) setCatalog(list.map(c => ({ id: c.id, name: c.name, categoryName: c.categoryName }))); })
      .catch(() => { /* picker just stays empty — never blocks the consultation */ });
    return () => { live = false; };
  }, [kind]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const source = kind === 'product'
      ? (inventory || []).map(i => ({ id: String(i.id), name: i.name, categoryName: (i as any).category }))
      : catalog.filter(c => {
          if (kind === 'service') return true;
          const cat = (c.categoryName || '').toLowerCase();
          return kind === 'lab' ? cat.includes('lab') : (cat.includes('imag') || cat.includes('radio'));
        });
    if (!needle) return source.slice(0, 8);
    return source.filter(x => x.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [q, kind, catalog, inventory]);

  if (value?.name) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-seafoam/40 bg-seafoam/5">
        <span className="flex-1 text-[12px] font-bold text-pine dark:text-zinc-100 truncate">{value.name}</span>
        <button type="button" onClick={() => onChange(null)} className="text-slate-400 hover:text-red-500">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        className="field-input !pl-8"
        placeholder={placeholder || `Search ${kind === 'product' ? 'products' : kind}…`}
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              onMouseDown={() => { onChange({ id: r.id, name: r.name }); setQ(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-seafoam/5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0"
            >
              <span className="block text-[12px] font-bold text-pine dark:text-zinc-100 truncate">{r.name}</span>
              {r.categoryName && <span className="block text-[9px] text-slate-400 truncate">{r.categoryName}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Resolve every LIVE options source used by this stage (141) — staff, species,
 * breed, product, client, supplier — instead of lists typed into the builder.
 *
 * Resolved once for the stage rather than per field: hooks cannot be called
 * inside a render loop, and two fields sharing a source should not resolve twice.
 *
 * Species and breed come from the clinic's OWN patients rather than a reference
 * endpoint. There is no species/breed API client on the frontend, and a list
 * built from the animals this clinic actually treats is the more useful one
 * anyway — an equine practice should not be scrolling past "Hamster".
 *
 * ⚠️ A source maps to `null` when it cannot be resolved, and the caller falls
 * back to a plain text input. A consultation must never be blocked because a
 * lookup failed.
 */
const useLiveOptions = (
  staff: { id: any; name: string }[] | undefined,
): Record<string, string[] | null> => {
  const { inventory, clients, pets } = useData() as any;

  return useMemo(() => {
    const uniq = (arr: any[]) =>
      arr.filter(v => v != null && String(v).trim())
         .map(v => String(v).trim())
         .filter((v, i, a) => a.indexOf(v) === i)
         .sort((a, b) => a.localeCompare(b));
    const staffNames = (staff || []).map(s => s.name).filter(Boolean);
    return {
      // An empty list is NOT the same as an unresolved one: with no staff
      // loaded yet the field should fall back to text, not show an empty
      // dropdown a vet cannot get past.
      staff: staffNames.length ? staffNames : null,
      product: uniq((inventory || []).map((i: any) => i.name)).length ? uniq((inventory || []).map((i: any) => i.name)) : null,
      client: uniq((clients || []).map((c: any) => c.name)).length ? uniq((clients || []).map((c: any) => c.name)) : null,
      supplier: uniq((inventory || []).map((i: any) => i.supplierName)).length ? uniq((inventory || []).map((i: any) => i.supplierName)) : null,
      species: uniq((pets || []).map((p: any) => p.species)).length ? uniq((pets || []).map((p: any) => p.species)) : null,
      breed: uniq((pets || []).map((p: any) => p.breed)).length ? uniq((pets || []).map((p: any) => p.breed)) : null,
    };
  }, [staff, inventory, clients, pets]);
};

const TemplateStep: React.FC<Props> = ({ stage, fields, data, setData, staff, emit, pet, only = 'all' }) => {
  const d = data || {};

  // Live lists resolved once for the whole stage.
  const liveMap = useLiveOptions(staff);
  const liveFor = (src: string | null | undefined) => (src ? liveMap[src] ?? null : null);

  const renderField = (pf: PlacedField) => {
    const def = fields[pf.fieldKey];
    // A field can vanish from the registry (deactivated) while a template still
    // places it. Skipping is deliberate — never render a broken control, and
    // never lose the answer already stored under its leaf.
    if (!def || def.isActive === false) return null;

    const leaf = leafOf(def.key);
    const value = d[leaf];
    const set = (v: any) => setData({ [leaf]: v });
    const label = def.label + (def.unit ? ` (${def.unit})` : '');

    // A live list (141) replaces the static one. Null = unavailable, and the
    // control degrades to free text below rather than rendering an empty
    // dropdown a vet cannot get past.
    const live = liveFor(def.optionsSource);
    const usingLive = !!def.optionsSource;
    const choices = usingLive ? (live || []) : asStrings(def.options);

    let control: React.ReactNode;
    switch (def.fieldType) {
      case 'textarea':
        control = <textarea className="field-textarea" rows={3} placeholder={def.helpText || ''} value={value ?? ''} onChange={e => set(e.target.value)} />;
        break;
      case 'number':
        control = <input className="field-input" type="number" placeholder={def.helpText || ''} value={value ?? ''} onChange={e => set(e.target.value)} />;
        break;
      case 'date':
        control = <input className="field-input" type="date" value={value ?? ''} onChange={e => set(e.target.value)} />;
        break;
      case 'select':
        control = usingLive && !live
          ? <input className="field-input" placeholder={def.helpText || ''} value={value ?? ''} onChange={e => set(e.target.value)} />
          : (
            <select className="field-select" value={value ?? ''} onChange={e => set(e.target.value)}>
              <option value="">—</option>
              {choices.map(o => <option key={o}>{o}</option>)}
            </select>
          );
        break;
      case 'seg':
        control = usingLive && !live
          ? <input className="field-input" placeholder={def.helpText || ''} value={value ?? ''} onChange={e => set(e.target.value)} />
          : <Seg options={choices} value={value} onChange={set} />;
        break;
      case 'checks':
        control = (
          <CheckGrid
            items={usingLive ? choices.map(o => ({ k: o, label: o })) : asItems(def.options)}
            value={value}
            onToggle={(k, _l, on) => set({ ...(value || {}), [k]: on })}
          />
        );
        break;
      case 'list':
        control = <ListEditor items={Array.isArray(value) ? value : []} onChange={set} placeholder={def.helpText || 'Add an item'} />;
        break;
      case 'staff':
        control = (
          <select className="field-select" value={value ?? ''} onChange={e => set(e.target.value)}>
            <option value="">—</option>
            {(staff || []).map(s => <option key={String(s.id)} value={String(s.id)}>{s.name}</option>)}
          </select>
        );
        break;
      case 'normalAbnormal': {
        // Same shape the hand-written examination step writes: { normal, findings }.
        const v = value || {};
        const abnormal = !!(v.findings && String(v.findings).trim());
        control = (
          <div className={`border rounded-xl p-2.5 space-y-1.5 transition-all ${abnormal ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20' : 'border-slate-200 dark:border-zinc-800'}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{def.label}</p>
              <button
                type="button"
                onClick={() => set({ ...v, normal: !v.normal, findings: v.normal ? v.findings : '' })}
                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border transition-all ${v.normal ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 dark:bg-zinc-950 text-slate-400 border-slate-200 dark:border-zinc-800'}`}
              >
                {v.normal ? '✓ Normal' : 'Normal'}
              </button>
            </div>
            <input
              className="field-input !h-8 text-xs"
              placeholder="Enter findings if abnormal"
              value={v.findings ?? ''}
              onChange={e => set({ ...v, findings: e.target.value, normal: e.target.value ? false : v.normal })}
            />
          </div>
        );
        // Already carries its own label.
        return <div key={def.key} className={SPAN[pf.span || 1]}>{control}</div>;
      }
      case 'native':
        // Built-in blocks (medication table, reminders, diagnostic requests,
        // triage) are rendered by their own components inside the hand-written
        // steps. A clinic can position one, but a generic renderer cannot
        // reproduce it — so say so rather than silently dropping it.
        return (
          <div key={def.key} className={SPAN[pf.span || 3]}>
            <div className="border border-dashed border-slate-300 dark:border-zinc-700 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{def.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Built-in block — opens on the {stage.label} step of the standard flow.
              </p>
            </div>
          </div>
        );
      case 'lab':
      case 'imaging':
      case 'service':
      case 'product':
        control = <CatalogPicker kind={def.fieldType} value={value} onChange={set} placeholder={def.helpText || undefined} />;
        break;
      case 'text':
      default:
        control = <input className="field-input" placeholder={def.helpText || ''} value={value ?? ''} onChange={e => set(e.target.value)}
          onBlur={() => { if (leaf === 'weight' && value) emit?.(`Weight recorded — ${value} kg`, 'action', true); }} />;
    }

    return (
      <L key={def.key} label={label} required={pf.required} className={SPAN[pf.span || 1]}>
        {control}
      </L>
    );
  };

  const keep = (pf: PlacedField) => {
    const def = fields[pf.fieldKey];
    if (!def || def.isActive === false) return false;
    // In 'custom' mode the built-in step above already rendered every core
    // field — including the native blocks — so re-rendering them would double
    // the control and fight over the same stored value.
    return only === 'all' || !def.isCore;
  };

  const sections = (stage.sections || [])
    .map(sec => ({ ...sec, fields: (sec.fields || []).filter(keep) }))
    .filter(sec => sec.fields.length > 0);

  if (!sections.length) {
    // In 'custom' mode this is the normal case — the clinic added nothing to
    // this built-in stage, so there is simply nothing extra to show.
    if (only === 'custom') return null;
    return (
      <p className="text-[11px] text-slate-400 py-6 text-center">
        This stage has no questions yet — add some in Clinic Management → Visit Workflows.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map(sec => (
        <Section key={sec.key} title={sec.label} tone={stage.tone === 'red' ? 'red' : undefined}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {sec.fields.map(renderField)}
          </div>
        </Section>
      ))}
      {pet?.name && sections.length > 3 && (
        <p className="text-[9px] text-slate-400 text-center">Recorded against {pet.name}.</p>
      )}
    </div>
  );
};

export default TemplateStep;
