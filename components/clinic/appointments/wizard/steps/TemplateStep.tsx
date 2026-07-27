import React from 'react';
import { StepProps } from '../types';
import { Section, L, Seg, CheckGrid, ListEditor } from '../fields';
import { FormField, LayoutStage, PlacedField } from '../../../../../services';

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

const TemplateStep: React.FC<Props> = ({ stage, fields, data, setData, staff, emit, pet }) => {
  const d = data || {};

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
        control = (
          <select className="field-select" value={value ?? ''} onChange={e => set(e.target.value)}>
            <option value="">—</option>
            {asStrings(def.options).map(o => <option key={o}>{o}</option>)}
          </select>
        );
        break;
      case 'seg':
        control = <Seg options={asStrings(def.options)} value={value} onChange={set} />;
        break;
      case 'checks':
        control = (
          <CheckGrid
            items={asItems(def.options)}
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
        // Catalog-backed pickers are gated on the plan and not built yet (P5);
        // fall back to text so a clinic that placed one still captures
        // something rather than losing the answer entirely.
        control = <input className="field-input" placeholder={def.helpText || ''} value={value ?? ''} onChange={e => set(e.target.value)} />;
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

  const sections = (stage.sections || []).filter(sec => (sec.fields || []).length > 0);

  if (!sections.length) {
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
