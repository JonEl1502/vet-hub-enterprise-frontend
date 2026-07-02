import React, { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, Package, X } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg, CheckGrid } from '../fields';
import EmergencyTriagePanel from '../../../triage/EmergencyTriagePanel';
import { useData } from '../../../../../contexts/DataContext';

// Entry steps for the non-consultation Visit Entry Points. They share one
// config-driven form (fields per step defined below) so adding a new entry
// point stays a config change, matching entryPoints.ts.

type FieldDef =
  | { kind: 'input'; key: string; label: string; placeholder?: string; type?: string; span?: 2 }
  | { kind: 'textarea'; key: string; label: string; placeholder?: string; span?: 2 }
  | { kind: 'seg'; key: string; label: string; options: string[]; span?: 2 }
  | { kind: 'checks'; key: string; label: string; items: { k: string; label: string }[]; span?: 2 }
  | { kind: 'food'; key: string; label: string; span?: 2 };

// Vaccine types pickable wherever a gate check records vaccination status.
const VACCINE_TYPES = [
  { k: 'rabies', label: 'Rabies' },
  { k: 'dhpp', label: 'DHPP / DHLPP' },
  { k: 'parvo', label: 'Parvovirus' },
  { k: 'bordetella', label: 'Bordetella (kennel cough)' },
  { k: 'lepto', label: 'Leptospirosis' },
  { k: 'fvrcp', label: 'FVRCP (cats)' },
  { k: 'felv', label: 'FeLV (cats)' },
  { k: 'deworm', label: 'Deworming up to date' },
];

// Food intake for boarding/admission gate checks: client brings food, or the
// clinic provides it from inventory (searchable). Actual feeding is logged &
// billed via the visit's Consumables once the patient is admitted.
const FoodField: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  const { inventory } = useData();
  const v = value || {};
  const [q, setQ] = useState('');
  const set = (patch: any) => onChange({ ...v, ...patch });
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return (inventory || [])
      .filter(it => `${it.name} ${(it as any).category ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [inventory, q]);
  return (
    <div className="space-y-2">
      <Seg options={['Client-provided', 'From inventory', 'None']} value={v.source}
        onChange={s => set({ source: s, inventoryItemId: undefined, name: s === 'None' ? '' : v.name })} />
      {v.source === 'Client-provided' && (
        <input className="field-input" placeholder="Food name / brand brought by the client"
          value={v.name ?? ''} onChange={e => set({ name: e.target.value })} />
      )}
      {v.source === 'From inventory' && (
        <div className="space-y-1.5">
          {v.inventoryItemId ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-seafoam/10 border border-seafoam/30">
              <Package size={13} className="text-seafoam shrink-0" />
              <span className="flex-1 text-[12px] font-bold text-pine dark:text-zinc-100 truncate">{v.name}</span>
              {v.stock != null && <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{v.stock} {v.unit || ''} in stock</span>}
              <button type="button" onClick={() => set({ inventoryItemId: undefined, name: '', stock: undefined, unit: undefined })} className="text-slate-400 hover:text-red-500"><X size={13} /></button>
            </div>
          ) : (
            <>
              <input className="field-input" placeholder="Search inventory for food (2+ chars)…"
                value={q} onChange={e => setQ(e.target.value)} />
              {results.length > 0 && (
                <div className="border border-slate-200 dark:border-zinc-800 rounded-lg divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden">
                  {results.map((it: any) => (
                    <button key={it.id} type="button"
                      onClick={() => { set({ inventoryItemId: it.id, name: it.name, stock: it.quantity, unit: it.unit }); setQ(''); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left bg-white dark:bg-zinc-900 hover:bg-seafoam/5 transition-all">
                      <Package size={12} className="text-seafoam shrink-0" />
                      <span className="flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{it.name}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{it.category} · {it.quantity} {it.unit}</span>
                    </button>
                  ))}
                </div>
              )}
              {q.trim().length >= 2 && results.length === 0 && (
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">No inventory match — request a purchase or switch to client-provided.</p>
              )}
            </>
          )}
          <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">Feeding is logged &amp; billed from the visit's Consumables once admitted.</p>
        </div>
      )}
    </div>
  );
};

interface EntryFormDef { title: string; intro?: string; fields: FieldDef[] }

const FORMS: Record<string, EntryFormDef> = {
  vaccinationAssessment: {
    title: 'Vaccination Assessment',
    intro: 'Confirm the patient is fit to vaccinate before administering.',
    fields: [
      { kind: 'seg', key: 'healthyToday', label: 'Healthy today', options: ['Yes', 'No', 'Unsure'] },
      { kind: 'input', key: 'temperature', label: 'Temperature (°C)', type: 'number', placeholder: '38.5' },
      { kind: 'input', key: 'weight', label: 'Weight (kg)', type: 'number' },
      { kind: 'seg', key: 'status', label: 'Current vaccine status', options: ['Up to date', 'Overdue', 'Unknown', 'First course'] },
      { kind: 'checks', key: 'vaccinesPlanned', label: 'Vaccines to administer today', items: VACCINE_TYPES, span: 2 },
      { kind: 'checks', key: 'contraindications', label: 'Contraindications', items: [
        { k: 'fever', label: 'Fever' }, { k: 'illness', label: 'Current illness' },
        { k: 'priorReaction', label: 'Previous vaccine reaction' }, { k: 'pregnancy', label: 'Pregnancy' },
        { k: 'immunosuppressed', label: 'Immunosuppressed' }, { k: 'recentSurgery', label: 'Recent surgery' },
      ], span: 2 },
      { kind: 'textarea', key: 'notes', label: 'Notes', placeholder: 'Vaccines planned today, batch considerations…', span: 2 },
    ],
  },
  surgicalAssessment: {
    title: 'Surgical Assessment',
    intro: 'Pre-operative check before theatre.',
    fields: [
      { kind: 'seg', key: 'asa', label: 'ASA grade', options: ['I', 'II', 'III', 'IV', 'V'] },
      { kind: 'seg', key: 'fasted', label: 'Fasting confirmed', options: ['Yes', 'No', 'Unknown'] },
      { kind: 'seg', key: 'anaesthesiaRisk', label: 'Anaesthesia risk', options: ['Low', 'Moderate', 'High'] },
      { kind: 'seg', key: 'consent', label: 'Surgery consent obtained', options: ['Yes', 'No'] },
      { kind: 'checks', key: 'preOp', label: 'Pre-op checklist', items: [
        { k: 'bloodsReviewed', label: 'Pre-anaesthetic bloods reviewed' }, { k: 'ivPlaced', label: 'IV catheter placed' },
        { k: 'premedGiven', label: 'Premedication given' }, { k: 'siteClipped', label: 'Surgical site clipped & prepped' },
        { k: 'weightConfirmed', label: 'Weight confirmed' }, { k: 'historyReviewed', label: 'Anaesthetic history reviewed' },
      ], span: 2 },
      { kind: 'textarea', key: 'notes', label: 'Notes', placeholder: 'Procedure planned, anaesthetic plan, concerns…', span: 2 },
    ],
  },
  admission: {
    title: 'Hospital Admission',
    intro: 'Admission details — the full admit checklist runs from the visit header (Onboard to in-patient).',
    fields: [
      { kind: 'input', key: 'reason', label: 'Reason for admission', placeholder: 'e.g. IV fluids + monitoring', span: 2 },
      { kind: 'input', key: 'ward', label: 'Ward / cage' },
      { kind: 'seg', key: 'code', label: 'Resuscitation code', options: ['Full CPR', 'DNR'] },
      { kind: 'food', key: 'food', label: 'Food', span: 2 },
      { kind: 'textarea', key: 'belongings', label: 'Belongings', placeholder: 'Leash, blanket…' },
      { kind: 'textarea', key: 'feeding', label: 'Feeding instructions' },
      { kind: 'textarea', key: 'medsOnAdmission', label: 'Medications on admission', span: 2 },
      { kind: 'textarea', key: 'notes', label: 'Notes', span: 2 },
    ],
  },
  reviewHistory: {
    title: 'Follow-up Review',
    intro: 'How has the patient progressed since the previous visit?',
    fields: [
      { kind: 'seg', key: 'response', label: 'Response since last visit', options: ['Improved', 'Unchanged', 'Worse'] },
      { kind: 'seg', key: 'compliance', label: 'Treatment compliance', options: ['Full', 'Partial', 'None'] },
      { kind: 'textarea', key: 'ownerReport', label: 'Owner-reported changes', placeholder: 'Appetite, energy, symptoms…', span: 2 },
      { kind: 'textarea', key: 'medsReview', label: 'Medication review', placeholder: 'What is still being given, side effects…', span: 2 },
    ],
  },
  visitDetails: {
    title: 'House-call Visit Details',
    fields: [
      { kind: 'input', key: 'location', label: 'Visit location / address', span: 2 },
      { kind: 'input', key: 'contact', label: 'On-site contact', placeholder: 'Name + phone' },
      { kind: 'input', key: 'arrival', label: 'Arrival time', type: 'time' },
      { kind: 'textarea', key: 'setting', label: 'Setting & constraints', placeholder: 'Handling space, other animals, equipment available…', span: 2 },
      { kind: 'textarea', key: 'notes', label: 'Notes', span: 2 },
    ],
  },
  groomingAssessment: {
    title: 'Grooming Assessment',
    fields: [
      { kind: 'seg', key: 'temperament', label: 'Temperament', options: ['Calm', 'Nervous', 'Aggressive', 'Unknown'] },
      { kind: 'seg', key: 'coat', label: 'Coat condition', options: ['Good', 'Matted', 'Shedding', 'Skin issues'] },
      { kind: 'seg', key: 'vaccStatus', label: 'Vaccination status', options: ['Up to date', 'Overdue', 'Unknown'] },
      { kind: 'checks', key: 'vaccinesVerified', label: 'Vaccines verified', items: VACCINE_TYPES, span: 2 },
      { kind: 'checks', key: 'flags', label: 'Flags', items: [
        { k: 'fleas', label: 'Fleas/ticks seen' }, { k: 'wounds', label: 'Wounds / hotspots' },
        { k: 'earIssues', label: 'Ear issues' }, { k: 'nailIssues', label: 'Overgrown nails' },
      ] },
      { kind: 'textarea', key: 'instructions', label: 'Special instructions', placeholder: 'Style, areas to avoid, owner requests…', span: 2 },
    ],
  },
  boardingAssessment: {
    title: 'Boarding Assessment',
    intro: 'Intake check — the full admit checklist runs from the visit header (Onboard to boarding).',
    fields: [
      { kind: 'seg', key: 'temperament', label: 'Temperament', options: ['Calm', 'Nervous', 'Aggressive', 'Unknown'] },
      { kind: 'seg', key: 'vaccStatus', label: 'Vaccination status', options: ['Up to date', 'Overdue', 'Unknown'] },
      { kind: 'checks', key: 'vaccinesVerified', label: 'Vaccines verified', items: VACCINE_TYPES, span: 2 },
      { kind: 'food', key: 'food', label: 'Food', span: 2 },
      { kind: 'textarea', key: 'feeding', label: 'Feeding schedule', placeholder: 'Amounts, times…' },
      { kind: 'textarea', key: 'belongings', label: 'Belongings', placeholder: 'Bed, toys, leash…' },
      { kind: 'textarea', key: 'specialCare', label: 'Special care notes', placeholder: 'Medication times, anxieties, exercise needs…', span: 2 },
    ],
  },
};

// Standalone gate-check form — same intake forms, usable outside the wizard
// (Register Visit renders it above Date & Time for grooming/boarding/admission).
export const GateCheckForm: React.FC<{ formKey: string; data: any; setData: (patch: any) => void }> = ({ formKey, data, setData }) => {
  const form = FORMS[formKey];
  const d = data || {};
  if (!form) return null;
  return (
    <Section icon={ClipboardList} title={form.title}>
      {form.intro && <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">{form.intro}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {form.fields.map(f => {
          const span = f.span === 2 ? 'md:col-span-2' : '';
          switch (f.kind) {
            case 'input':
              return <L key={f.key} label={f.label} className={span}><input className="field-input" type={f.type || 'text'} placeholder={f.placeholder} value={d[f.key] ?? ''} onChange={e => setData({ [f.key]: e.target.value })} /></L>;
            case 'textarea':
              return <L key={f.key} label={f.label} className={span}><textarea className="field-textarea" rows={2} placeholder={f.placeholder} value={d[f.key] ?? ''} onChange={e => setData({ [f.key]: e.target.value })} /></L>;
            case 'seg':
              return <L key={f.key} label={f.label} className={span}><Seg options={f.options} value={d[f.key]} onChange={v => setData({ [f.key]: v })} /></L>;
            case 'checks':
              return <L key={f.key} label={f.label} className={span}><CheckGrid items={f.items} value={d[f.key]} onToggle={(k, _l, on) => setData({ [f.key]: { ...(d[f.key] || {}), [k]: on } })} /></L>;
            case 'food':
              return <L key={f.key} label={f.label} className={span}><FoodField value={d[f.key]} onChange={nv => setData({ [f.key]: nv })} /></L>;
            default:
              return null;
          }
        })}
      </div>
    </Section>
  );
};

export const GenericEntryStep: React.FC<StepProps & { formKey: string }> = ({ formKey, data, setData }) => (
  <GateCheckForm formKey={formKey} data={data} setData={setData} />
);

// Emergency entry — wraps the existing (already API-backed) triage +
// stabilization panel so the wizard and the standalone Triage tab share
// one clinical surface and one EmergencyTriageRecord.
export const EmergencyEntryStep: React.FC<StepProps> = ({ visit, pet, staff }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
      <AlertTriangle size={13} className="text-red-500 shrink-0" />
      <p className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
        Emergency entry point — stabilize before proceeding to history &amp; examination.
      </p>
    </div>
    <EmergencyTriagePanel
      appointmentId={visit.id}
      petId={pet.id}
      petName={pet.name}
      staff={staff}
    />
  </div>
);
