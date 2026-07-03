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
  | 'surgicalAssessment'
  | 'admission'
  | 'reviewHistory'
  | 'visitDetails'
  | 'groomingAssessment'
  | 'boardingAssessment'
  // core clinical flow
  | 'history'
  | 'examination'
  | 'assessment'
  | 'diagnostics'
  | 'diagnosis'
  | 'treatment'
  | 'communication'
  | 'followUp';

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
}

// Persisted wizard state (localStorage, keyed by visit id).
export interface WizardPersist {
  entryKey: string;
  startedAt: string;
  currentStep: WizardStepId;
  completed: Partial<Record<WizardStepId, string>>; // stepId -> ISO completed at
  data: Partial<Record<WizardStepId, any>>;
  events: JourneyEvent[];
}
