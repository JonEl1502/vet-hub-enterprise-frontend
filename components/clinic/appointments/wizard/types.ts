import { Visit, Pet, Client } from '../../../../types';

// ── Patient Journey ────────────────────────────────────────────────
// Every meaningful action during a visit lands here as a timestamped
// event. UI-ONLY phase: events live in localStorage per visit; the
// backend `visit_events` table replaces the store when APIs are wired.
export type JourneyKind = 'milestone' | 'action' | 'alert' | 'billing' | 'info';

export interface JourneyEvent {
  id: string;
  at: string; // ISO
  label: string;
  kind: JourneyKind;
  auto?: boolean; // emitted by the system rather than typed by staff
}

// ── Wizard steps ───────────────────────────────────────────────────
export type WizardStepId =
  // entry steps (one per Visit Entry Point)
  | 'emergencyTriage'
  | 'vaccinationAssessment'
  | 'dewormingAssessment'
  | 'surgicalAssessment'
  | 'admission'
  // follow-up visits open on the PRIOR visit's plan & outcome (what the
  // patient was told to come back for), before reviewing progress
  | 'priorPlan'
  | 'reviewHistory'
  | 'visitDetails'
  | 'groomingAssessment'
  | 'groomingCare'
  | 'boardingAssessment'
  // vet check — mandatory pre-care check on grooming & boarding flows (077)
  | 'vetCheck'
  // core clinical flow
  | 'history'
  | 'examination'
  | 'assessment'
  | 'diagnostics'
  | 'diagnosis'
  | 'treatment'
  | 'communication'
  | 'followUp'
  // A clinic-built workflow (backend 136) contributes its OWN stage keys, which
  // are arbitrary slugs. `string & {}` widens the union to accept them while
  // keeping editor autocomplete for the built-in ids above.
  | (string & {});

export interface StaffOpt { id: number | string; name: string }

// Props every step component receives from the wizard shell.
export interface StepProps {
  visit: Visit;
  pet: Pet;
  client?: Client;
  staff: StaffOpt[];
  currency: string;
  data: any; // this step's slice of the wizard data
  setData: (patch: any) => void; // shallow-merges into the slice
  emit: (label: string, kind?: JourneyKind, auto?: boolean) => void;
  goServices?: () => void; // jump to the Categories & Services tab
  addService?: () => void; // open the Add Services modal in place
  openModule?: (category: string) => void; // open the service's module full page for this visit
  // Remove a service line from the visit — available until the bill is paid
  // (anything added is deletable before payment; server enforces the lock).
  deleteTask?: (taskId: number) => void;
  refreshVisit?: () => void; // re-fetch the visit after real writes (consumables…)
  /**
   * When a clinic-built workflow governs THIS stage, the set of field
   * suffixes it kept (`mentation`, `sys.eyes`, `notes`…). A built-in step
   * must render only these.
   *
   * `undefined` means no template governs the stage — show everything. That is
   * the permanent floor: the built-in flow with no template behaves exactly as
   * it always has.
   *
   * This exists because a template used to be purely ADDITIVE over a built-in
   * step: a clinic could add questions to Examination but never remove the
   * Systemic Examination card, because the whole hardcoded component was
   * rendered and only custom fields appended.
   */
  visibleFields?: Set<string>;
  // Emergency triage wiring — the parent owns the stabilize gate + handoff.
  onTriageStatusChange?: (rec: any) => void;
  onTriageDischarged?: () => void;
}

// Persisted wizard state (localStorage, keyed by visit id).
export interface WizardPersist {
  entryKey: string;
  // Manual workflow switch (multi-encounter visits): when staff switch the
  // active flow (e.g. boarding visit → vet-visit clinical flow), the chosen
  // entry key persists here and wins over the auto-resolved one. Emergency
  // still overrides everything.
  entryKeyOverride?: string;
  startedAt: string;
  currentStep: WizardStepId;
  completed: Partial<Record<WizardStepId, string>>; // stepId -> ISO completed at
  data: Partial<Record<WizardStepId, any>>;
  events: JourneyEvent[];
}
