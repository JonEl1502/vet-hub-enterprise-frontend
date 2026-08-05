import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Visit } from '../../../../types';
import { visitsAPI, workflowTemplatesAPI, WorkflowTemplate, FormField, LayoutStage } from '../../../../services';
import type { VisitEncounter } from '../../../../services/modules/appointments.api';
import { JourneyEvent, JourneyKind, WizardPersist, WizardStepId } from './types';
import { ENTRY_POINTS, EntryPointDef, resolveEntryPoint, STEP_DEFS } from './entryPoints';

// The wizard state persists SERVER-SIDE (consultation_records via
// GET/PUT /visits/:id/workflow) so the clinical record follows the visit
// across machines. localStorage stays as the instant-load offline cache;
// a debounced PUT mirrors every change, and on open the fresher of the two
// (server updatedAt vs local savedAt) wins. Journey events ride inside the
// blob (data.__events) so the timeline travels too.

const storageKey = (visitId: number | string) => `vethub.visitWizard.v1.${visitId}`;

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

function freshState(visit: Visit, entry: EntryPointDef): WizardPersist {
  const events: JourneyEvent[] = [
    { id: newId(), at: visit.date, label: `${entry.label} visit created`, kind: 'milestone', auto: true },
  ];
  return {
    entryKey: entry.key,
    startedAt: new Date().toISOString(),
    currentStep: entry.steps[0],
    completed: {},
    data: {},
    events,
  };
}

export interface VisitWizardApi {
  entry: EntryPointDef;
  steps: WizardStepId[];
  // A clinic-built workflow for this visit, if one resolved (backend 136).
  // null means "use the built-in flow" — the permanent fallback.
  template: WorkflowTemplate | null;
  /** Pin this visit to a specific workflow (null = back to automatic). */
  setVisitTemplate: (templateId: string | null) => void;
  templateStages: Record<string, LayoutStage>;
  templateFields: Record<string, FormField>;
  state: WizardPersist;
  currentStep: WizardStepId;
  goTo: (step: WizardStepId) => void;
  next: () => void;
  prev: () => void;
  setStepData: (step: WizardStepId, patch: any) => void;
  completeStep: (step: WizardStepId) => void;
  isComplete: (step: WizardStepId) => boolean;
  emit: (label: string, kind?: JourneyKind, auto?: boolean) => void;
  events: JourneyEvent[];
  progress: number; // % of steps completed
  resetWizard: () => void;
  // Multi-encounter visits: every workflow this visit can run, and the manual
  // switch between them. The Vet Visit clinical flow is ALWAYS offered — it's
  // the default clinical surface many things need.
  availableEntries: EntryPointDef[];
  switchEntry: (key: string) => void;
  // Stacked encounters (172) — the rows behind the chips. Empty when the
  // visit predates 172 or the fetch failed (legacy derivation then applies).
  encounters: VisitEncounter[];
  selectedEncounterId: string | null;
  reloadEncounters: () => Promise<void> | void;
}

/**
 * @param species the PATIENT's species. Passed through to template
 *   resolution: a clinic can restrict a workflow to particular species (a
 *   rabbit vaccination protocol differs from a dog's), and a
 *   species-restricted template can only match when we actually know it.
 */
// Map a visit_encounters ROW (172) to its wizard flow. The VET_VISIT family
// still honours the visit-level variant signals (hospitalization, house call,
// booked surgery) exactly like resolveEntryPoint — an encounter row narrows
// WHICH encounter runs, not how a vet visit varies.
function entryForEncounter(enc: VisitEncounter, visit: Visit): EntryPointDef {
  switch (enc.encounterType) {
    case 'GROOMING': return ENTRY_POINTS.grooming;
    case 'BOARDING': return ENTRY_POINTS.boarding;
    case 'VACCINATION': return ENTRY_POINTS.vaccination; // legacy top-level rows
  }
  switch (enc.visitType) {
    case 'VACCINATION': return ENTRY_POINTS.vaccination;
    case 'DEWORMING': return ENTRY_POINTS.deworming;
    case 'ROUTINE_CHECK': return ENTRY_POINTS.routineCheck;
    case 'EMERGENCY': return ENTRY_POINTS.emergency;
    case 'INPATIENT': return ENTRY_POINTS.admission;
    case 'FOLLOW_UP': return ENTRY_POINTS.followUp;
  }
  if (visit.hospitalizationId) return ENTRY_POINTS.admission;
  if (visit.isHouseCall) return ENTRY_POINTS.houseCall;
  if ((visit.tasks || []).some(t => (t.category || '').toLowerCase().includes('surg'))) return ENTRY_POINTS.surgery;
  return ENTRY_POINTS.standard;
}

export function useVisitWizard(visit: Visit, species?: string | null): VisitWizardApi {
  // ── Stacked encounters (172): the rows are the workflow identity. The
  // legacy shape-derivation stays as the FALLBACK when the list is empty or
  // the fetch fails — without it, a failed fetch blanks the workflow on the
  // path every consultation renders through. Do not remove it.
  const [encounters, setEncounters] = useState<VisitEncounter[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const reloadEncounters = useCallback(() => {
    return visitsAPI.listEncounters(visit.id)
      .then(r => {
        if (r.success && Array.isArray(r.data?.encounters)) setEncounters(r.data!.encounters);
      })
      .catch(() => { /* fallback path stands */ });
  }, [visit.id]);
  useEffect(() => { setEncounters([]); setSelectedEncounterId(null); reloadEncounters(); }, [visit.id, reloadEncounters]);

  // The selected row (default: primary — the list is ordered primary-first).
  const selectedEncounter = useMemo(() => {
    if (!encounters.length) return null;
    return encounters.find(e => e.id === selectedEncounterId) ?? encounters[0];
  }, [encounters, selectedEncounterId]);

  const legacyResolved = resolveEntryPoint(visit);
  const resolved = selectedEncounter ? entryForEncounter(selectedEncounter, visit) : legacyResolved;

  const [state, setState] = useState<WizardPersist>(() => {
    try {
      const raw = localStorage.getItem(storageKey(visit.id));
      if (raw) return JSON.parse(raw) as WizardPersist;
    } catch { /* corrupted draft — start clean */ }
    return freshState(visit, resolved);
  });

  // Reload the local draft when navigating between visits without
  // unmounting, then hydrate from the SERVER record (consultation_records) —
  // whichever is fresher wins (server updatedAt vs the draft's __savedAt).
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(visit.id));
      setState(raw ? (JSON.parse(raw) as WizardPersist) : freshState(visit, resolved));
    } catch { setState(freshState(visit, resolved)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit.id]);
  useEffect(() => {
    const vid = String(visit.id);
    hydratedFor.current = vid;
    visitsAPI.getWorkflow(visit.id).then(res => {
      if (!res.success || !res.data?.workflow || hydratedFor.current !== vid) return;
      const w = res.data.workflow;
      if (w.templateId) setPinnedTemplateId(String(w.templateId));
      const serverAt = new Date(w.updatedAt).getTime();
      let localAt = 0;
      try {
        const raw = localStorage.getItem(storageKey(visit.id));
        localAt = raw ? new Date((JSON.parse(raw) as any).__savedAt || 0).getTime() : 0;
      } catch { /* no local */ }
      if (serverAt <= localAt) return; // this device has the newer draft
      const d: any = w.data || {};
      const { __events, __entryKeyOverride, ...stepData } = d;
      setState(s => ({
        entryKey: w.entryKey,
        entryKeyOverride: __entryKeyOverride,
        startedAt: w.startedAt,
        currentStep: (w.currentStep as WizardStepId) || s.currentStep,
        completed: (w.completed as any) || {},
        data: stepData,
        events: Array.isArray(__events) && __events.length ? __events : s.events,
      }));
    }).catch(() => { /* offline — the local draft stands */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit.id]);

  // Every workflow this visit can run — ONE chip per ENCOUNTER TYPE. All the
  // vet-visit clinical variants (standard / house call / follow-up / routine
  // check / surgery / admission) are the SAME encounter, so they collapse
  // into a single "Vet Visit — clinical" chip (whichever variant resolved);
  // house call etc. never appear as separate switch targets.
  const availableEntries = useMemo(() => {
    // Encounter rows lead when present — one chip per row's flow. They are
    // MERGED with the task-derived entries below, never a replacement: visit
    // 137 (user, 2026-08-02) had legacy grooming+vet chips from TASKS only,
    // and adding its FIRST row (vaccination) made every other chip vanish.
    const fromRows: EntryPointDef[] = [];
    if (encounters.length) {
      const seen = new Set<string>();
      for (const enc of encounters) {
        const e = entryForEncounter(enc, visit);
        if (!seen.has(e.key)) { seen.add(e.key); fromRows.push(e); }
      }
    }
    const VET_FAMILY = ['standard', 'houseCall', 'followUp', 'routineCheck', 'emergency', 'surgery', 'admission'];
    const has = (kws: string[]) => (visit.tasks || []).some(t => kws.some(k => (t.category || '').toLowerCase().includes(k)));
    const keys: string[] = [resolved.key];
    const add = (k: string) => { if (!keys.includes(k)) keys.push(k); };
    // The clinical flow is offered only when the visit actually HAS clinical
    // content: a VET_VISIT encounter (resolved is already in the family) or
    // non-module service categories on the bill (a consultation grafted onto
    // a grooming/boarding visit via Transfer/Add encounter). A grooming-only
    // visit stays grooming-only — its flow already carries the vet check.
    const MODULE_KWS = ['groom', 'board', 'vaccin', 'retail', 'petshop', 'food', 'accessor'];
    // Visit-LEVEL fee lines (after-hours / walk-in surcharge, house-call
    // call-out + travel) are registered under 'Consultation' on legacy visits,
    // but they are properties of the visit, not clinical work — counting them
    // stapled a "Vet Visit — clinical" chip onto a plain boarding visit whose
    // only extra was the after-hours fee (user, 2026-08-02).
    const isVisitFee = (t: any) => /surcharge|call-?out|house call travel/i.test(t.name || '');
    const hasClinicalContent = (visit.tasks || []).some(t => {
      const c = (t.category || '').toLowerCase();
      return !!c && !MODULE_KWS.some(k => c.includes(k)) && !isVisitFee(t);
    });
    if (!VET_FAMILY.includes(resolved.key) && hasClinicalContent) add('standard');
    if (has(['vaccin'])) add('vaccination');
    if (has(['groom'])) add('grooming');
    if (has(['board']) || visit.boardingStayId) add('boarding');
    if (visit.hospitalizationId && !VET_FAMILY.includes(resolved.key)) add('admission');
    const fromTasks = keys.map(k => ENTRY_POINTS[k]).filter(Boolean);
    if (!fromRows.length) return fromTasks;
    // Rows first (their order is the visit's), then any task-derived flow the
    // rows don't cover yet — a legacy visit keeps every chip it had. Vet-family
    // keys collapse to one chip, so dedupe on the family, not the exact key.
    const famOf = (k: string) => (VET_FAMILY.includes(k) ? 'vet' : k);
    const covered = new Set(fromRows.map(e => famOf(e.key)));
    // A merged VET chip needs a real CONSULTATION service — generic "clinical
    // content" matched an After-hours fee and stapled a Vet Visit chip onto a
    // direct vaccination visit (user, 2026-08-02: "just one"). Fee lines are
    // excluded here too: legacy visits carry them under 'Consultation', which
    // walked straight through this guard on a boarding visit.
    const hasConsultTask = (visit.tasks || []).some(t => (t.category || '').toLowerCase().includes('consult') && !isVisitFee(t));
    for (const e of fromTasks) {
      const fam = famOf(e.key);
      if (fam === 'vet' && !hasConsultTask) continue;
      if (!covered.has(fam)) { covered.add(fam); fromRows.push(e); }
    }
    return fromRows;
  }, [visit, resolved.key, encounters]);

  // The active entry: a manual switch (multi-encounter visit) wins over the
  // auto-resolved flow — except emergency, which always takes the wheel. A
  // STALE override (its encounter no longer offered — e.g. its services were
  // deleted, or a grooming-only visit once showed the clinical chip) is
  // ignored so the visit falls back to its real flow.
  const entry = (resolved.key !== 'emergency'
    && state.entryKeyOverride
    && ENTRY_POINTS[state.entryKeyOverride]
    && availableEntries.some(e => e.key === state.entryKeyOverride))
    ? ENTRY_POINTS[state.entryKeyOverride]
    : resolved;

  // Boarding + Grooming on the SAME visit: both flows open with a gate-check
  // assessment sharing the same core fields. Whichever was filled first seeds
  // the other (once — staff edits stand after that), so temperament /
  // vaccination basics are never re-entered.
  useEffect(() => {
    const keys = availableEntries.map(e => e.key);
    if (!keys.includes('boarding') || !keys.includes('grooming')) return;
    const SHARED = ['temperament', 'vaccStatus', 'vaccinesVerified', '_vaccineDates', '_vaccineDatesFor'];
    const touched = (d: any) => !!d && Object.keys(d).some(k => !k.startsWith('_'));
    const a = 'boardingAssessment' as WizardStepId, b = 'groomingAssessment' as WizardStepId;
    const da = state.data[a], db = state.data[b];
    let from: WizardStepId, to: WizardStepId;
    if (touched(da) && !touched(db)) { from = a; to = b; }
    else if (touched(db) && !touched(da)) { from = b; to = a; }
    else return; // neither, or both already filled — nothing to seed
    const src: any = state.data[from] || {};
    const patch: any = {};
    for (const k of SHARED) if (src[k] !== undefined) patch[k] = src[k];
    if (Object.keys(patch).filter(k => !k.startsWith('_')).length === 0) return;
    setState(s => ({
      ...s,
      data: { ...s.data, [to]: { ...(s.data[to] || {}), ...patch } },
      events: [...s.events, { id: newId(), at: new Date().toISOString(), label: `${STEP_DEFS[to].label} pre-filled from ${STEP_DEFS[from].label}`, kind: 'info', auto: true }],
    }));
  }, [state.data, availableEntries]);

  // Manual workflow switch: persists, resumes at the first incomplete step of
  // the target flow (shared steps keep their data/completion), logs the journey.
  const switchEntry = useCallback((key: string) => {
    const target = ENTRY_POINTS[key];
    if (!target) return;
    // Encounter-backed chips: select the ROW whose flow matches, so step
    // resolution follows the encounter identity, not a derived override.
    const row = encounters.find(enc => entryForEncounter(enc, visit).key === key);
    if (row) setSelectedEncounterId(row.id);
    setState(s => {
      if (s.entryKey === target.key && s.entryKeyOverride === key) return s;
      return {
        ...s,
        entryKeyOverride: key,
        entryKey: target.key,
        currentStep: target.steps.find(st => !s.completed[st]) ?? target.steps[0],
        events: [...s.events, { id: newId(), at: new Date().toISOString(), label: `Workflow switched to ${target.label}`, kind: 'milestone', auto: true }],
      };
    });
  }, [encounters, visit]);

  // Persist on every change: localStorage instantly (with a freshness
  // stamp), the server via a debounced PUT — the clinical record follows
  // the visit, not the browser.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    try { localStorage.setItem(storageKey(visit.id), JSON.stringify({ ...state, __savedAt: new Date().toISOString() })); } catch { /* quota */ }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      visitsAPI.saveWorkflow(visit.id, {
        entryKey: state.entryKey,
        startedAt: state.startedAt,
        currentStep: state.currentStep,
        completed: state.completed,
        data: { ...state.data, __events: state.events, __entryKeyOverride: state.entryKeyOverride },
      }).catch(() => { /* offline — localStorage holds it; next change retries */ });
    }, 900);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, visit.id]);

  const emit = useCallback((label: string, kind: JourneyKind = 'action', auto = false) => {
    setState(s => ({ ...s, events: [...s.events, { id: newId(), at: new Date().toISOString(), label, kind, auto }] }));
  }, []);

  // ── Clinic-built workflow (backend 136) ────────────────────────────────
  // Resolved from the visit's shape. A miss (or any error) leaves `template`
  // null and the wizard renders exactly as it always has — that fallback is
  // the whole reason this can ship before every clinic has built anything.
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  // A workflow staff explicitly picked for THIS visit (persisted on the
  // consultation record, 137). It wins over automatic resolution — the whole
  // point is that a vet can override what the visit's shape implies.
  const [pinnedTemplateId, setPinnedTemplateId] = useState<string | null>(null);

  // A workflow chosen at REGISTRATION (ADDITION 2). The visit did not exist
  // when the choice was made, so it was stashed locally against the new id;
  // the first time the wizard opens we adopt it and persist it properly, then
  // drop the stash so it can never override a later change.
  const adoptedPick = useRef(false);
  useEffect(() => {
    if (adoptedPick.current) return;
    let picked: string | null = null;
    try { picked = localStorage.getItem(`vethub.visitWorkflowPick.v1.${visit.id}`); } catch { /* no-op */ }
    if (!picked) return;
    adoptedPick.current = true;
    setPinnedTemplateId(picked);
    try { localStorage.removeItem(`vethub.visitWorkflowPick.v1.${visit.id}`); } catch { /* no-op */ }
  }, [visit.id]);
  useEffect(() => {
    let live = true;
    // An explicit choice short-circuits resolution entirely.
    if (pinnedTemplateId) {
      workflowTemplatesAPI.getById(pinnedTemplateId)
        .then(res => { if (live) setTemplate(res.success ? (res.data?.template ?? null) : null); })
        .catch(() => { /* built-in flow stands */ });
      return () => { live = false; };
    }
    // The selected encounter's own pinned template wins over resolution —
    // that's what the row's templateId is FOR (172).
    if (selectedEncounter?.templateId) {
      workflowTemplatesAPI.getById(selectedEncounter.templateId)
        .then(res => { if (live) setTemplate(res.success ? (res.data?.template ?? null) : null); })
        .catch(() => { /* built-in flow stands */ });
      return () => { live = false; };
    }
    workflowTemplatesAPI
      .resolve({
        // Resolve for the SELECTED ENCOUNTER, not the visit column — this is
        // what stops clinic 3's default Vaccination template hijacking a
        // clinical chip on a VACCINATION-typed visit.
        encounterType: (selectedEncounter?.encounterType as any) ?? visit.encounterType,
        visitType: (selectedEncounter?.visitType as any) ?? visit.visitType,
        species: species ?? null,
        // The entry point THIS hook already resolved. It wins server-side,
        // because it encodes everything a column cannot: the manual workflow
        // switch on a multi-encounter visit, the emergency override,
        // isHouseCall, and a booked surgery service. Resolving independently
        // put the house-call layout on a grooming visit.
        entryKey: entry.key,
      })
      .then(res => {
        if (!live) return;
        setTemplate(res.success ? (res.data?.template ?? null) : null);
      })
      .catch(() => { /* built-in flow stands */ });
    return () => { live = false; };
    // entry.key changes when staff switch workflow — the template must follow.
  }, [visit.id, visit.encounterType, visit.visitType, species, entry.key, pinnedTemplateId, selectedEncounter?.id, selectedEncounter?.templateId]);

  const templateStages = useMemo(() => {
    const out: Record<string, LayoutStage> = {};
    for (const st of template?.stages || []) out[st.key] = st;
    return out;
  }, [template]);

  const templateFields = useMemo(() => {
    const out: Record<string, FormField> = {};
    for (const f of template?.fields || []) out[f.key] = f;
    return out;
  }, [template]);

  // A clinic template, when one resolved, supplies the step sequence; the
  // hardcoded entry point stays the fallback floor. Stage keys are arbitrary
  // slugs, hence the widened WizardStepId.
  const templateStepIds = useMemo(
    () => (template?.stages || []).filter(st => (st.sections || []).length > 0).map(st => st.key as WizardStepId),
    [template],
  );

  // Entry point can change mid-visit (e.g. Escalate to Emergency flips
  // visitType) — re-sequence the wizard and log it on the journey.
  useEffect(() => {
    if (state.entryKey === entry.key) return;
    // A template owns the sequence; only its own `steps` may re-point us.
    if (templateStepIds.length) { setState(s => ({ ...s, entryKey: entry.key })); return; }
    setState(s => ({
      ...s,
      entryKey: entry.key,
      currentStep: entry.steps.includes(s.currentStep) ? s.currentStep : entry.steps[0],
      events: [...s.events, { id: newId(), at: new Date().toISOString(), label: `Workflow changed to ${entry.label}`, kind: 'alert', auto: true }],
    }));
  }, [entry.key, entry.label, entry.steps, state.entryKey, templateStepIds.length]);

  const steps = templateStepIds.length ? templateStepIds : entry.steps;
  const currentStep = steps.includes(state.currentStep) ? state.currentStep : steps[0];
  const idx = steps.indexOf(currentStep);

  const goTo = useCallback((step: WizardStepId) => setState(s => ({ ...s, currentStep: step })), []);
  const next = useCallback(() => {
    setState(s => {
      const i = steps.indexOf(s.currentStep);
      return i < steps.length - 1 ? { ...s, currentStep: steps[i + 1] } : s;
    });
  }, [steps]);
  const prev = useCallback(() => {
    setState(s => {
      const i = steps.indexOf(s.currentStep);
      return i > 0 ? { ...s, currentStep: steps[i - 1] } : s;
    });
  }, [steps]);

  /**
   * `patch` may be an object OR a function of the step's CURRENT data.
   *
   * ⚠️ The object form is only safe when the caller builds the patch from
   * values it owns. A caller that spreads a nested object it captured at
   * render time (`{ intake: { ...iv, ...pt } }`) clobbers any write that
   * landed since — and `AdmissionGate` fires TWO prefill effects in the same
   * commit (weight, then vaccines), so one of them was always lost.
   */
  const setStepData = useCallback((step: WizardStepId, patch: any) => {
    setState(s => {
      const cur = s.data[step] || {};
      const p = typeof patch === 'function' ? patch(cur) : patch;
      return { ...s, data: { ...s.data, [step]: { ...cur, ...p } } };
    });
  }, []);

  // Built-in steps have a STEP_DEFS entry; clinic-built stages do not, so fall
  // back to the template's own label rather than throwing on an undefined.
  const stageLabels = useRef<Record<string, string>>({});
  stageLabels.current = Object.fromEntries(
    Object.values(templateStages).map(st => [st.key, st.label]),
  );
  const stepLabel = (step: WizardStepId) =>
    STEP_DEFS[step]?.label ?? stageLabels.current[step] ?? String(step);

  const completeStep = useCallback((step: WizardStepId) => {
    setState(s => {
      if (s.completed[step]) return s; // already logged
      return {
        ...s,
        completed: { ...s.completed, [step]: new Date().toISOString() },
        events: [...s.events, { id: newId(), at: new Date().toISOString(), label: `${stepLabel(step)} completed`, kind: 'milestone', auto: true }],
      };
    });
  }, []);

  const isComplete = useCallback((step: WizardStepId) => !!state.completed[step], [state.completed]);

  const resetWizard = useCallback(() => {
    try { localStorage.removeItem(storageKey(visit.id)); } catch { /* noop */ }
    setState(freshState(visit, resolved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit, resolved]);

  const events = useMemo(
    () => [...state.events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
    [state.events]
  );

  const progress = Math.round((steps.filter(s => state.completed[s]).length / steps.length) * 100);

  const setVisitTemplate = useCallback((templateId: string | null) => {
    setPinnedTemplateId(templateId);
    if (!templateId) setTemplate(null);
    // Persist alongside the rest of the wizard state so the choice survives a
    // reload and follows the visit to another machine.
    visitsAPI.saveWorkflow(visit.id, {
      entryKey: state.entryKey,
      startedAt: state.startedAt,
      currentStep: String(state.currentStep),
      completed: state.completed,
      data: state.data,
      templateId,
    }).catch(() => { /* offline — the local pin still applies */ });
  }, [visit.id, state.entryKey, state.startedAt, state.currentStep, state.completed, state.data]);

  return { entry, steps, template, setVisitTemplate, templateStages, templateFields, state, currentStep: steps[idx] ?? steps[0], goTo, next, prev, setStepData, completeStep, isComplete, emit, events, progress, resetWizard, availableEntries, switchEntry, encounters, selectedEncounterId: selectedEncounter?.id ?? null, reloadEncounters };
}
