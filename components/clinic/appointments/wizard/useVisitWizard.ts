import { useCallback, useEffect, useMemo, useState } from 'react';
import { Visit } from '../../../../types';
import { JourneyEvent, JourneyKind, WizardPersist, WizardStepId } from './types';
import { ENTRY_POINTS, EntryPointDef, resolveEntryPoint, STEP_DEFS } from './entryPoints';

// UI-ONLY phase: the whole wizard (form data + journey events) persists to
// localStorage per visit, so the flow is clickable and survives reloads
// without any backend. When the `visit_events` + ConsultationRecord APIs
// land, this hook is the single seam to swap.

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

  // Reload the draft when navigating between visits without unmounting.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(visit.id));
      setState(raw ? (JSON.parse(raw) as WizardPersist) : freshState(visit, resolved));
    } catch { setState(freshState(visit, resolved)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit.id]);

  // The active entry: a manual switch (multi-encounter visit) wins over the
  // auto-resolved flow — except emergency, which always takes the wheel.
  const entry = (resolved.key !== 'emergency' && state.entryKeyOverride && ENTRY_POINTS[state.entryKeyOverride])
    ? ENTRY_POINTS[state.entryKeyOverride]
    : resolved;

  // Every workflow this visit can run: the resolved flow, the Vet Visit
  // clinical flow (ALWAYS — it's the default clinical surface), plus a flow
  // per encounter present on the visit's services / linked records.
  const availableEntries = useMemo(() => {
    const has = (kws: string[]) => (visit.tasks || []).some(t => kws.some(k => (t.category || '').toLowerCase().includes(k)));
    const keys: string[] = [resolved.key];
    const add = (k: string) => { if (!keys.includes(k)) keys.push(k); };
    add('standard');
    if (has(['vaccin'])) add('vaccination');
    if (has(['groom'])) add('grooming');
    if (has(['board']) || visit.boardingStayId) add('boarding');
    if (has(['surg'])) add('surgery');
    if (visit.hospitalizationId) add('admission');
    return keys.map(k => ENTRY_POINTS[k]).filter(Boolean);
  }, [visit, resolved.key]);

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

  // Persist on every change.
  useEffect(() => {
    try { localStorage.setItem(storageKey(visit.id), JSON.stringify(state)); } catch { /* quota */ }
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
