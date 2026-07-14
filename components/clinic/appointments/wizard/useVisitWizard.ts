import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Visit } from '../../../../types';
import { visitsAPI } from '../../../../services';
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
}

export function useVisitWizard(visit: Visit): VisitWizardApi {
  const resolved = resolveEntryPoint(visit);

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
    const hasClinicalContent = (visit.tasks || []).some(t => {
      const c = (t.category || '').toLowerCase();
      return !!c && !MODULE_KWS.some(k => c.includes(k));
    });
    if (!VET_FAMILY.includes(resolved.key) && hasClinicalContent) add('standard');
    if (has(['vaccin'])) add('vaccination');
    if (has(['groom'])) add('grooming');
    if (has(['board']) || visit.boardingStayId) add('boarding');
    if (visit.hospitalizationId && !VET_FAMILY.includes(resolved.key)) add('admission');
    return keys.map(k => ENTRY_POINTS[k]).filter(Boolean);
  }, [visit, resolved.key]);

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
  }, []);

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

  // Entry point can change mid-visit (e.g. Escalate to Emergency flips
  // visitType) — re-sequence the wizard and log it on the journey.
  useEffect(() => {
    if (state.entryKey === entry.key) return;
    setState(s => ({
      ...s,
      entryKey: entry.key,
      currentStep: entry.steps.includes(s.currentStep) ? s.currentStep : entry.steps[0],
      events: [...s.events, { id: newId(), at: new Date().toISOString(), label: `Workflow changed to ${entry.label}`, kind: 'alert', auto: true }],
    }));
  }, [entry.key, entry.label, entry.steps, state.entryKey]);

  const steps = entry.steps;
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

  const setStepData = useCallback((step: WizardStepId, patch: any) => {
    setState(s => ({ ...s, data: { ...s.data, [step]: { ...(s.data[step] || {}), ...patch } } }));
  }, []);

  const completeStep = useCallback((step: WizardStepId) => {
    setState(s => {
      if (s.completed[step]) return s; // already logged
      return {
        ...s,
        completed: { ...s.completed, [step]: new Date().toISOString() },
        events: [...s.events, { id: newId(), at: new Date().toISOString(), label: `${STEP_DEFS[step].label} completed`, kind: 'milestone', auto: true }],
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

  return { entry, steps, state, currentStep: steps[idx] ?? steps[0], goTo, next, prev, setStepData, completeStep, isComplete, emit, events, progress, resetWizard, availableEntries, switchEntry };
}
