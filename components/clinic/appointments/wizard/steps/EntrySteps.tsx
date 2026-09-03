import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, Package, X, Lock } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg, CheckGrid } from '../fields';
import EmergencyTriagePanel from '../../../triage/EmergencyTriagePanel';
import GroomingPanel from '../../GroomingPanel';
import BoardingStayPage from '../../../boarding/BoardingStayPage';
import InpatientChartPage from '../../../inpatient/InpatientChartPage';
import { useData } from '../../../../../contexts/DataContext';
import { petsAPI } from '../../../../../services';
import { VACCINES } from '../../../../../constants/vaccines';
import AdmissionGate from '../../../shared/AdmissionGate';
import { inpatientAPI, visitsAPI } from '../../../../../services';
import BoardingIntakeFields, { emptyBoardingIntake } from '../../../shared/BoardingIntakeFields';
import GroomingIntakeFields, { emptyGroomingIntake } from '../../../shared/GroomingIntakeFields';

// Entry steps for the non-consultation Visit Entry Points. They share one
// config-driven form (fields per step defined below) so adding a new entry
// point stays a config change, matching entryPoints.ts.

type FieldDef =
  | { kind: 'input'; key: string; label: string; placeholder?: string; type?: string; span?: 2 }
  | { kind: 'textarea'; key: string; label: string; placeholder?: string; span?: 2 }
  | { kind: 'seg'; key: string; label: string; options: string[]; span?: 2 }
  | { kind: 'checks'; key: string; label: string; items: { k: string; label: string }[]; span?: 2 }
  | { kind: 'gate'; key: string; label: string; span?: 2 }
  | { kind: 'intake'; key: 'boarding' | 'grooming'; label: string; span?: 2 }
  | { kind: 'food'; key: string; label: string; span?: 2 };

// Vaccine types pickable wherever a gate check records vaccination status.
//
// Drawn from the CANONICAL list (`constants/vaccines`) that the boarding,
// inpatient and grooming admission gates already use. This step used to carry
// its own hardcoded eight, so the wizard's gate check silently drifted behind
// the admit modals' fourteen (user, 2026-08-02: "this gate check is behind").
// Deworming is not a vaccine, so it stays appended here rather than polluting
// the shared list.
const VACCINE_TYPES = [
  ...VACCINES.map(v => ({ k: v.key, label: v.label })),
  { k: 'deworm', label: 'Deworming up to date' },
];

// Map an administered vaccine's (free-text) name onto the checklist keys so
// the patient's medical records can auto-tick "Vaccines verified".
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
    /**
     * ⚠️ THE GATE ITSELF LIVES HERE NOW (user, 2026-08-25: "can we have the
     * actual gate check there"). This tab used to show a subset of the
     * admission and a sentence pointing at the visit header for the real
     * checklist — two doors to one record, and the door you were standing at
     * was the one that could not finish the job.
     */
    intro: 'Admission details and the gate check — weight and vaccination status are verified here.',
    fields: [
      { kind: 'gate', key: 'gate', label: 'Admission gate', span: 2 },
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
    intro: 'Exactly the same intake as the Grooming Admit page — one form, either door.',
    fields: [
      { kind: 'intake', key: 'grooming', label: 'Grooming intake', span: 2 },
    ],
  },
  boardingAssessment: {
    title: 'Boarding Assessment',
    intro: 'Exactly the same intake as the Boarding Admit page — one form, either door.',
    fields: [
      { kind: 'intake', key: 'boarding', label: 'Boarding intake', span: 2 },
    ],
  },
  // Mandatory vet check on grooming & boarding flows (077): a vet confirms
  // the patient is fit for the service before care starts.
  vetCheck: {
    title: 'Vet Check',
    intro: 'A vet confirms the patient is fit for this service before care starts.',
    fields: [
      { kind: 'seg', key: 'fit', label: 'Fit for service', options: ['Fit', 'Fit with precautions', 'Not fit'] },
      { kind: 'seg', key: 'condition', label: 'General condition', options: ['Good', 'Fair', 'Poor'] },
      { kind: 'input', key: 'temperature', label: 'Temperature (°C)', type: 'number', placeholder: '38.5' },
      { kind: 'input', key: 'weight', label: 'Weight (kg)', type: 'number' },
      { kind: 'checks', key: 'observations', label: 'Observations', items: [
        { k: 'skinIssues', label: 'Skin issues / wounds' }, { k: 'parasites', label: 'Fleas / ticks seen' },
        { k: 'earEye', label: 'Ear / eye concerns' }, { k: 'lameness', label: 'Lameness / mobility' },
        { k: 'dental', label: 'Dental concerns' }, { k: 'behaviour', label: 'Behavioural concerns' },
      ], span: 2 },
      { kind: 'input', key: 'checkedBy', label: 'Checked by (vet)' },
      { kind: 'textarea', key: 'concerns', label: 'Concerns / precautions', placeholder: 'Anything care staff must know before proceeding…' },
      { kind: 'textarea', key: 'notes', label: 'Notes', span: 2 },
    ],
  },
};

// Standalone gate-check form — same intake forms, usable outside the wizard
// (Register Visit renders it above Date & Time for grooming/boarding/admission).
// When petId is given, "Vaccines verified" auto-ticks from the patient's
// ADMINISTERED vaccination records, each showing its date administered.
export const GateCheckForm: React.FC<{ formKey: string; data: any; setData: (patch: any) => void; petId?: number | string | null; pet?: any; addService?: () => void; flat?: boolean; locked?: boolean; gateSeed?: any }> = ({ formKey, data, setData, petId, pet, addService, flat, locked, gateSeed }) => {
  const form = FORMS[formKey];
  const d = data || {};

  /**
   * Seed a BLANK gate from a sibling intake on the same visit.
   *
   * Boarding, grooming and admission ask the identical questions — the intro
   * literally says "exactly the same intake … one form, either door" — but each
   * keeps its own step namespace, so boarding a patient and then grooming it
   * asked for the intake weight and vaccination check a second time
   * (user, 2026-09-03: "i filled these so they should be prefilled by now").
   *
   * `AdmissionGate` already prefills from the PET record, but only from a FRESH
   * weight and vaccines actually ADMINISTERED — neither of which is what staff
   * verified at this visit's boarding gate, so it had nothing to offer.
   *
   * Only the shared `gate` is copied: the rest of an intake is service-specific
   * (coat condition means nothing to a boarding stay). Only when blank, and
   * only once — a seed must never overwrite what somebody has typed.
   *
   * ⚠️ This hook sits ABOVE the `!form` early return. Below it, a formKey with
   * no FORMS entry would render fewer hooks than the previous pass and React
   * would throw #300.
   */
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current || locked || !gateSeed?.gate) return;
    const mine = d.intake?.gate;
    const alreadyFilled = mine && (String(mine.intakeWeight ?? '').trim() !== ''
      || Object.keys(mine.vaccines || {}).length
      || Object.keys(mine.recommended || {}).length);
    if (alreadyFilled) { seeded.current = true; return; }
    seeded.current = true;
    setData({ intake: { ...(d.intake || {}), gate: { ...(mine || {}), ...gateSeed.gate } } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateSeed, locked]);

  if (!form) return null;

  /**
   * Nudge when the gate is still blank.
   *
   * This step is FIRST for a reason — it is the record of why the animal was
   * admitted, where it is, and whether to resuscitate. An imported visit
   * arrives with all of that empty, because the old system never captured it,
   * and an empty form looks identical to a form somebody deliberately left
   * blank. Say which it is, and name the fields that matter rather than
   * scolding about "required fields" — none of these are required, they are
   * just the ones you regret not having at 2am.
   */
  const KEY_FIELDS: Record<string, { key: string; label: string }[]> = {
    admission: [
      { key: 'reason', label: 'reason for admission' },
      { key: 'ward', label: 'ward / cage' },
      { key: 'code', label: 'resuscitation code' },
    ],
  };
  const missing = (KEY_FIELDS[formKey] || []).filter(f => {
    const v = d[f.key];
    return v == null || String(v).trim() === '';
  });

  return (
    <Section icon={ClipboardList} title={form.title} flat={flat}>
      {form.intro && <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">{form.intro}</p>}
      {missing.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/20">
          <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
            Admission details not recorded yet — please add the{' '}
            {missing.map((f, i) => (
              <span key={f.key}>
                {i > 0 ? (i === missing.length - 1 ? ' and ' : ', ') : ''}
                <strong>{f.label}</strong>
              </span>
            ))}
            . On a visit brought over from another system these are blank because the old records never held them.
          </p>
        </div>
      )}
      {/* ⚠️ Read-only by CONTAINER, not by disabling twelve controls one at a
          time: every field kind here (input, textarea, seg, checks, food,
          intake, gate) would need its own disabled path, and the one that got
          missed would be the editable hole in a locked record. The banner above
          carries the meaning; this just makes it true. */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${locked ? 'pointer-events-none select-none opacity-60' : ''}`} aria-disabled={locked || undefined}>
        {form.fields.map(f => {
          const span = f.span === 2 ? 'md:col-span-2' : '';
          switch (f.kind) {
            case 'input':
              return <L key={f.key} label={f.label} className={span}><input className="field-input" type={f.type || 'text'} placeholder={f.placeholder} value={d[f.key] ?? ''} onChange={e => setData({ [f.key]: e.target.value })} /></L>;
            case 'textarea':
              return <L key={f.key} label={f.label} className={span}><textarea className="field-textarea" rows={2} placeholder={f.placeholder} value={d[f.key] ?? ''} onChange={e => setData({ [f.key]: e.target.value })} /></L>;
            case 'seg':
              return <L key={f.key} label={f.label} className={span}><Seg options={f.options} value={d[f.key]} onChange={v => setData({ [f.key]: v })} /></L>;
            case 'checks': {
              return <L key={f.key} label={f.label} className={span}><CheckGrid items={f.items} value={d[f.key]} onToggle={(k, _l, on) => setData({ [f.key]: { ...(d[f.key] || {}), [k]: on } })} /></L>;
            }
            case 'intake': {
              // THE shared intake — identical to the Admit page for this
              // service. The wizard owns the schedule, so the stay block is
              // hidden on boarding; the gate is advisory here, not blocking.
              const iv = d.intake || (f.key === 'boarding' ? emptyBoardingIntake() : emptyGroomingIntake());
              // Merge against the LATEST step data, not the `iv` captured at
              // render — AdmissionGate prefills weight and vaccines in the same
              // commit, and an object patch built from a stale `iv` made the
              // second overwrite the first (user, 2026-08-06: the grooming gate
              // check was not prefilled). `gate` is re-merged onto the current
              // base so a gate patch composes instead of replacing.
              const patch = (pt: any) => setData((prev: any) => {
                const base = prev?.intake || iv;
                const merged: any = { ...base, ...pt };
                if (pt && pt.gate) merged.gate = { ...(base?.gate || {}), ...pt.gate };
                return { intake: merged };
              });
              return (
                <div key={f.key} className={`${span} space-y-4`}>
                  {f.key === 'boarding' ? (
                    <BoardingIntakeFields
                      flat={flat}
                      value={iv} onChange={patch} required={false} showStay={false}
                      petId={petId ?? null}
                      petWeight={(pet as any)?.weight ?? null}
                      petWeightAt={(pet as any)?.updatedAt ?? null}
                    />
                  ) : (
                    <GroomingIntakeFields
                      value={iv} onChange={patch} required={false}
                      petId={petId ?? null}
                      petWeight={(pet as any)?.weight ?? null}
                      petWeightAt={(pet as any)?.updatedAt ?? null}
                    />
                  )}
                </div>
              );
            }
            case 'gate':
              // THE shared admission gate — identical markup to the boarding /
              // inpatient / grooming admit pages, and pet-keyed prefill so the
              // two fill each other across SEPARATE linked visits.
              return (
                <div key={f.key} className={span}>
                  <AdmissionGate
                    petId={petId ?? null}
                    petWeight={(pet as any)?.weight ?? null}
                    petWeightAt={(pet as any)?.updatedAt ?? null}
                    required={false}
                    value={{
                      intakeWeight: d.intakeWeight ?? '',
                      vaccines: d.vaccinesVerified || {},
                      recommended: d.vaccinesRecommended || {},
                      clientAgreed: !!d.vaccineClientAgreed,
                    }}
                    onChange={patch => setData({
                      ...(patch.intakeWeight !== undefined ? { intakeWeight: patch.intakeWeight } : {}),
                      ...(patch.vaccines !== undefined ? { vaccinesVerified: patch.vaccines } : {}),
                      ...(patch.recommended !== undefined ? { vaccinesRecommended: patch.recommended } : {}),
                      ...(patch.clientAgreed !== undefined ? { vaccineClientAgreed: patch.clientAgreed } : {}),
                    })}
                    // Opens the Add Services drawer so the agreed vaccination
                    // lands on the visit instead of only on the journey log.
                    onAddVaccination={addService}
                  />
                </div>
              );
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

export const GenericEntryStep: React.FC<StepProps & { formKey: string }> = ({ formKey, data, setData, pet, addService, gateSeed }) => (
  <GateCheckForm formKey={formKey} data={data} setData={setData} petId={pet?.id} pet={pet} addService={addService} gateSeed={gateSeed} />
);

// Grooming attending step — embeds the REAL grooming report card (same
// GroomingRecord the Grooming page reads, so the two stay connected):
// intake, before/after photos, groomer notes, and consumables (billable
// & non-billable, deducting stock).
export const GroomingCareStep: React.FC<StepProps> = ({ visit, refreshVisit, emit }) => (
  <GroomingPanel
    appointment={visit}
    onSaved={() => { emit('Grooming report card updated', 'action', true); refreshVisit?.(); }}
      inWizard
  />
);

// Boarding entry step — the shared intake ONLY. The stay itself moved to its
// own "Boarding Stay" step (user, 2026-08-03): admitting a patient and running
// its daily care are different jobs and were competing for one screen.
export const BoardingEntryStep: React.FC<StepProps> = ({ pet, data, setData, gateSeed }) => (
  <GateCheckForm formKey="boardingAssessment" data={data} setData={setData} petId={pet?.id} pet={pet} gateSeed={gateSeed} />
);

// Boarding STAY step — the real boarding page embedded, so care logs, feeding,
// consumables and day sheets are worked here against the same record the
// Boarding page reads. The stay is created by Onboard-to-boarding; this step
// manages it once it exists.
export const BoardingStayStep: React.FC<StepProps> = ({ visit, refreshVisit, emit }) => {
  /**
   * Tabbed, like the Admission step (user, 2026-08-23) — "boarding has its own
   * too, and admission-gated as well". The day sheet is what you come back to
   * every morning; the stay rail is the checkout date and the accruing charge.
   *
   * ⚠️ NO GATE TAB HERE, deliberately — and this is not an oversight.
   * Boarding's gate is already its OWN step (`boardingAssessment`), separated
   * from the stay by the mandatory vet check (077). Rendering it here too would
   * write to the wrong place: the wizard scopes a step's form to
   * `state.data[currentStep]`, so a gate shown on the `boardingStay` step would
   * save into the stay's bucket, not the assessment's — two identical-looking
   * forms silently storing to different keys. Admission can carry its gate as a
   * tab precisely because the gate IS that step.
   */
  const [tab, setTab] = React.useState<'chart' | 'plan'>('chart');
  const stayId = visit?.boardingStayId ? String(visit.boardingStayId) : null;

  const TABS: Array<{ id: typeof tab; label: string }> = [
    { id: 'chart', label: 'Daily sheet & care log' },
    { id: 'plan', label: 'Stay & plan' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-zinc-800 pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
              tab === t.id
                ? 'bg-seafoam text-white border-seafoam shadow-sm'
                : 'bg-white dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:text-seafoam'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {stayId ? (
        <BoardingStayPage
          stayId={stayId}
          embedded
          pane={tab === 'chart' ? 'chart' : 'plan'}
          onBack={() => {}}
          onChanged={() => { emit?.('Boarding stay updated', 'action', true); refreshVisit?.(); }}
        />
      ) : (
        <p className="px-3 py-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
          No boarding stay linked yet — Onboard to boarding from the visit header, and the day sheet (care logs, feeding, consumables) opens here.
        </p>
      )}
    </div>
  );
};

/**
 * Step 1 — the admission GATE only (user, 2026-08-22).
 *
 * The whole in-patient chart used to hang off the bottom of this step: intake
 * form, then a dashed rule, then monitoring, the daily sheet, treatment plan and
 * discharge. One screen carrying two jobs — the ten-second gate you fill at the
 * door, and the chart you return to every day for a week. Scrolling past a
 * finished form to reach today's vitals is the wrong shape for both.
 *
 * The chart is now its own step (see InpatientChartStep), so admission is what
 * step 1 says it is.
 */
export const AdmissionEntryStep: React.FC<StepProps> = ({ pet, data, setData, visit, refreshVisit, emit, gateSeed }) => {
  /**
   * TABS, not three stacked sections (user, 2026-08-22: "okay make them tabs").
   *
   * The gate is a ten-second form you fill once at the door; the daily sheet is
   * what you come back to every day for a week; the stay rail is discharge date,
   * treatment plan and complexity. Stacked, reaching day four's vitals meant
   * scrolling past a finished admission form every time. Tabs let each be the
   * whole screen when it is the one you want.
   */
  const [tab, setTab] = React.useState<'gate' | 'chart' | 'plan'>('gate');
  const hospId = visit?.hospitalizationId ? String(visit.hospitalizationId) : null;

  /**
   * THE ADMISSION GATE LOCKS 24H AFTER ADMISSION — but only once it is actually
   * complete (user, 2026-08-25).
   *
   * ⚠️ The "only once complete" half is the important half. Locking purely on
   * the clock would freeze exactly the record the yellow banner exists for: an
   * imported stay arrives with reason / ward / resuscitation code blank because
   * the old system never held them, and a day later it would lock still blank —
   * so the person who could finally fill them in would need an amendment reason
   * to enter facts that were never recorded in the first place. While the gate
   * is incomplete it stays open; once complete, the clock applies.
   *
   * The lock is not security — it is a record-integrity prompt. Anyone may
   * amend; they just have to say why, and the why is written to the visit
   * journey so the chart carries its own history.
   */
  const [admittedAt, setAmittedAt] = React.useState<string | null>(null);
  const [amending, setAmending] = React.useState(false);
  const [amendReason, setAmendReason] = React.useState('');

  React.useEffect(() => {
    if (!hospId) { setAmittedAt(null); return; }
    let alive = true;
    inpatientAPI.getById(hospId)
      .then((r: any) => { if (alive && r?.success) setAmittedAt(r.data?.hospitalization?.admittedAt ?? null); })
      .catch(() => { /* no stay data → no lock, which fails OPEN on purpose */ });
    return () => { alive = false; };
  }, [hospId]);

  const gateComplete = ['reason', 'ward', 'code'].every(k => {
    const v = (data || {})[k];
    return v != null && String(v).trim() !== '';
  });
  const dayOnePassed = !!admittedAt && (Date.now() - new Date(admittedAt).getTime()) > 24 * 60 * 60 * 1000;
  const locked = gateComplete && dayOnePassed && !amending;

  const startAmend = () => {
    const reason = amendReason.trim();
    if (!reason) return;
    const label = `Admission details amended — ${reason}`;
    /**
     * ⚠️ `visitsAPI.addEvent`, NOT the wizard's `emit`.
     *
     * `emit` stages a line into the wizard's own timeline; it does not reach
     * the server until the step is completed, and a draft that is never
     * finished takes the reason with it. Verified on staging: amending through
     * `emit` left the visit on 12 events with no amendment recorded — which
     * makes the lock theatre, since the whole point is that the reason
     * outlives the edit. This posts immediately.
     *
     * Emitted BEFORE the fields open, so the record carries the reason even if
     * the person then changes nothing. Non-fatal: a failed post must not trap
     * someone out of a record they are entitled to edit, so the unlock happens
     * either way and the failure surfaces in the API layer.
     */
    if (visit?.id != null) {
      visitsAPI.addEvent(visit.id, { label, kind: 'action' }).catch(() => { /* surfaced by the API layer */ });
    }
    emit?.(label, 'action', true);
    setAmending(true);
    setAmendReason('');
  };

  const TABS: Array<{ id: typeof tab; label: string }> = [
    { id: 'gate', label: 'Admission gate' },
    { id: 'chart', label: 'Daily sheet & chart' },
    { id: 'plan', label: 'Stay & plan' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-zinc-800 pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
              tab === t.id
                ? 'bg-seafoam text-white border-seafoam shadow-sm'
                : 'bg-white dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:text-seafoam'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'gate' && (
        <>
          {locked && (
            <div className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 space-y-2">
              <p className="text-[11px] font-bold text-pine dark:text-zinc-200 flex items-start gap-2">
                <Lock size={13} className="text-slate-400 mt-0.5 shrink-0" />
                <span>
                  Locked — admitted {new Date(admittedAt as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
                  The admission record is more than a day old. You can still change it, but the reason is written to the visit journey.
                </span>
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={amendReason}
                  onChange={e => setAmendReason(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); startAmend(); } }}
                  placeholder="Why is this being amended? e.g. ward corrected after transfer"
                  className="field-input flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={startAmend}
                  disabled={!amendReason.trim()}
                  className="w-full sm:w-auto sm:shrink-0 px-4 py-2 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Amend
                </button>
              </div>
            </div>
          )}
          {amending && (
            <p className="px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/20 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
              Amending — the reason is on the visit journey
            </p>
          )}
          <GateCheckForm formKey="admission" data={data} setData={setData} petId={pet?.id} pet={pet} locked={locked} gateSeed={gateSeed} />
        </>
      )}

      {/* Both chart tabs need a stay. Say so plainly rather than rendering an
          empty chart that looks broken. */}
      {tab !== 'gate' && (hospId ? (
        <InpatientChartPage
          hospId={hospId}
          embedded
          pane={tab === 'chart' ? 'chart' : 'plan'}
          onBack={() => {}}
          onChanged={() => { emit?.('Inpatient chart updated', 'action', true); refreshVisit?.(); }}
        />
      ) : (
        <p className="px-3 py-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
          Not hospitalized yet — use Hospitalize / In-Patient on the visit header, and the daily sheet (MAR, fluids, notes) opens here.
        </p>
      ))}
    </div>
  );
};

/**
 * Step 2 — the in-patient chart: MAR, fluids, feeding, nursing and progress
 * notes, discharge. The thing staff come BACK to, given its own page.
 */
export const InpatientChartStep: React.FC<StepProps> = ({ visit, refreshVisit, emit }) => (
  <div className="space-y-4">
    {visit.hospitalizationId ? (
      <InpatientChartPage
        hospId={String(visit.hospitalizationId)}
        embedded
        onBack={() => {}}
        onChanged={() => { emit('Inpatient chart updated', 'action', true); refreshVisit?.(); }}
      />
    ) : (
      <p className="px-3 py-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
        Not hospitalized yet — use Hospitalize / In-Patient on the visit header, and the full chart (MAR, fluids, notes) opens here.
      </p>
    )}
  </div>
);

// Emergency entry — wraps the existing (already API-backed) triage +
// stabilization panel so the wizard and the standalone Triage tab share
// one clinical surface and one EmergencyTriageRecord.
export const EmergencyEntryStep: React.FC<StepProps> = ({ visit, pet, staff, onTriageStatusChange, onTriageDischarged, refreshVisit }) => (
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
      onStatusChange={onTriageStatusChange}
      onDischarged={onTriageDischarged}
      onChargesChanged={refreshVisit}
    />
  </div>
);
