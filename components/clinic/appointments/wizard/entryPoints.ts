// Visit Entry Points — the dynamic wizard's core config.
// The entry point derived from (encounterType, visitType, isHouseCall, tasks)
// decides which step sequence the clinical wizard renders and where it
// starts. One config object on purpose: adding a new visit flow later
// (e.g. Dental) is a single entry here plus its assessment step.
import { Visit } from '../../../../types';
import { WizardStepId } from './types';

export interface WizardStepDef {
  id: WizardStepId;
  label: string; // full title inside the step
  short: string; // stepper strip label
  tone?: 'red';  // emergency steps render red in the stepper
}

export const STEP_DEFS: Record<WizardStepId, WizardStepDef> = {
  emergencyTriage:       { id: 'emergencyTriage', label: 'Emergency Triage & Stabilization', short: 'Triage & Stabilization', tone: 'red' },
  vaccinationAssessment: { id: 'vaccinationAssessment', label: 'Vaccination Assessment', short: 'Vaccination' },
  surgicalAssessment:    { id: 'surgicalAssessment', label: 'Surgical Assessment', short: 'Surgical Assessment' },
  admission:             { id: 'admission', label: 'Hospital Admission', short: 'Admission' },
  reviewHistory:         { id: 'reviewHistory', label: 'Follow-up Review', short: 'Review History' },
  visitDetails:          { id: 'visitDetails', label: 'House-call Visit Details', short: 'Visit Details' },
  groomingAssessment:    { id: 'groomingAssessment', label: 'Grooming Assessment', short: 'Assessment' },
  groomingCare:          { id: 'groomingCare', label: 'Grooming — Attending & Report Card', short: 'Attending' },
  boardingAssessment:    { id: 'boardingAssessment', label: 'Boarding Assessment', short: 'Boarding Assessment' },
  history:               { id: 'history', label: 'History', short: 'History' },
  examination:           { id: 'examination', label: 'Physical Examination', short: 'Examination' },
  assessment:            { id: 'assessment', label: 'Assessment', short: 'Assessment' },
  diagnostics:           { id: 'diagnostics', label: 'Diagnostics', short: 'Diagnostics' },
  diagnosis:             { id: 'diagnosis', label: 'Diagnosis', short: 'Diagnosis' },
  treatment:             { id: 'treatment', label: 'Treatment', short: 'Treatment' },
  communication:         { id: 'communication', label: 'Client Communication', short: 'Communication' },
  followUp:              { id: 'followUp', label: 'Follow-up / Care Continuity', short: 'Follow up' },
};

export interface EntryPointDef {
  key: string;
  label: string;
  icon: string;
  steps: WizardStepId[];
}

const CORE: WizardStepId[] = [
  'history', 'examination', 'assessment', 'diagnostics', 'diagnosis',
  'treatment', 'communication', 'followUp',
];

export const ENTRY_POINTS: Record<string, EntryPointDef> = {
  standard:    { key: 'standard', label: 'Standard Consultation', icon: '🩺', steps: CORE },
  emergency:   { key: 'emergency', label: 'Emergency', icon: '🚨', steps: ['emergencyTriage', ...CORE] },
  vaccination: { key: 'vaccination', label: 'Vaccination', icon: '💉', steps: ['vaccinationAssessment', 'examination', 'treatment', 'communication', 'followUp'] },
  surgery:     { key: 'surgery', label: 'Surgery', icon: '🔪', steps: ['surgicalAssessment', 'history', 'examination', 'diagnostics', 'treatment', 'communication', 'followUp'] },
  admission:   { key: 'admission', label: 'Hospital Admission', icon: '🏥', steps: ['admission', ...CORE] },
  followUp:    { key: 'followUp', label: 'Follow-up Review', icon: '🔁', steps: ['reviewHistory', 'examination', 'assessment', 'diagnostics', 'diagnosis', 'treatment', 'communication', 'followUp'] },
  houseCall:   { key: 'houseCall', label: 'House Call', icon: '🏠', steps: ['visitDetails', ...CORE] },
  grooming:    { key: 'grooming', label: 'Grooming', icon: '✂️', steps: ['groomingAssessment', 'groomingCare', 'communication', 'followUp'] },
  boarding:    { key: 'boarding', label: 'Boarding Admission', icon: '🛏️', steps: ['boardingAssessment', 'communication', 'followUp'] },
};

export function resolveEntryPoint(visit: Visit): EntryPointDef {
  switch (visit.encounterType) {
    case 'GROOMING': return ENTRY_POINTS.grooming;
    case 'BOARDING': return ENTRY_POINTS.boarding;
    case 'VACCINATION': return ENTRY_POINTS.vaccination;
  }
  switch (visit.visitType) {
    case 'EMERGENCY': return ENTRY_POINTS.emergency;
    case 'INPATIENT': return ENTRY_POINTS.admission;
    case 'FOLLOW_UP': return ENTRY_POINTS.followUp;
  }
  if (visit.isHouseCall) return ENTRY_POINTS.houseCall;
  // A booked surgery service flips the visit into the surgical flow.
  if ((visit.tasks || []).some(t => (t.category || '').toLowerCase().includes('surg'))) return ENTRY_POINTS.surgery;
  return ENTRY_POINTS.standard;
}
