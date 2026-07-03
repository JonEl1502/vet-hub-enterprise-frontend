import { Activity, AlertTriangle, Brain, Droplets, HeartPulse, Stethoscope, Syringe, Wind } from 'lucide-react';

// ── Stabilization protocol groups ─────────────────────────────────
// Single source of truth: the triage panel renders these as intervention
// chips, and Clinic Management prices them (Emergency Billables).
export const STABILIZATION: { key: string; title: string; icon: React.ElementType; checks: { k: string; label: string }[] }[] = [
  { key: 'airway', title: 'Airway', icon: Wind, checks: [
    { k: 'oxygenCage', label: 'Oxygen cage' }, { k: 'flowByO2', label: 'Flow-by O₂' }, { k: 'maskO2', label: 'Mask O₂' }, { k: 'etTube', label: 'ET tube' }, { k: 'tracheostomy', label: 'Tracheostomy' },
  ] },
  { key: 'breathing', title: 'Breathing', icon: Activity, checks: [
    { k: 'thoracocentesis', label: 'Thoracocentesis' }, { k: 'chestDrain', label: 'Chest drain' }, { k: 'mechanicalVent', label: 'Mechanical ventilation' },
  ] },
  { key: 'circulation', title: 'Circulation / Shock', icon: HeartPulse, checks: [
    { k: 'ivCatheter', label: 'IV catheter' }, { k: 'secondIv', label: '2nd IV catheter' }, { k: 'crystalloidBolus', label: 'Crystalloid bolus' }, { k: 'colloid', label: 'Colloid' },
    { k: 'hypertonicSaline', label: 'Hypertonic saline' }, { k: 'transfusion', label: 'Blood transfusion' }, { k: 'plasma', label: 'Plasma' }, { k: 'vasopressors', label: 'Vasopressors' },
  ] },
  { key: 'bleeding', title: 'Bleeding', icon: Droplets, checks: [
    { k: 'directPressure', label: 'Direct pressure' }, { k: 'pressureBandage', label: 'Pressure bandage' }, { k: 'tourniquet', label: 'Tourniquet' }, { k: 'hemostatic', label: 'Hemostatic dressing' },
  ] },
  { key: 'gastrointestinal', title: 'Gastrointestinal', icon: Stethoscope, checks: [
    { k: 'stomachTube', label: 'Stomach tube' }, { k: 'gastricDecompression', label: 'Gastric decompression' }, { k: 'activatedCharcoal', label: 'Activated charcoal' }, { k: 'induceEmesis', label: 'Induce emesis' }, { k: 'enema', label: 'Enema' },
  ] },
  { key: 'urinary', title: 'Urinary', icon: Droplets, checks: [
    { k: 'urinaryCatheter', label: 'Urinary catheter' }, { k: 'cystocentesis', label: 'Cystocentesis' },
  ] },
  { key: 'pain', title: 'Pain', icon: Syringe, checks: [
    { k: 'methadone', label: 'Methadone' }, { k: 'morphine', label: 'Morphine' }, { k: 'fentanyl', label: 'Fentanyl' }, { k: 'ketamineCri', label: 'Ketamine CRI' }, { k: 'nsaid', label: 'NSAID' },
  ] },
  { key: 'seizure', title: 'Seizure control', icon: Brain, checks: [
    { k: 'diazepam', label: 'Diazepam' }, { k: 'midazolam', label: 'Midazolam' }, { k: 'phenobarbital', label: 'Phenobarbital' }, { k: 'propofol', label: 'Propofol' },
  ] },
  { key: 'poisoning', title: 'Poisoning', icon: AlertTriangle, checks: [
    { k: 'decontamination', label: 'Decontamination' }, { k: 'activatedCharcoal', label: 'Activated charcoal' }, { k: 'lipidTherapy', label: 'Lipid therapy' }, { k: 'antidote', label: 'Antidote' },
  ] },
];

// ── Emergency billables config ────────────────────────────────────
// Per intervention: an optional service fee (shown as a staged emergency
// charge during triage) and optional consumables that auto-log (deduct
// stock + bill) the moment the intervention is ticked.
// UI-ONLY phase: persisted in localStorage; moves to a clinic settings
// column in the API phase.
export interface EmergencyBillableConsumable { inventoryItemId: string; name: string; qty: number; unit?: string }
export interface EmergencyBillable { price?: number; consumables?: EmergencyBillableConsumable[] }
export type EmergencyBillablesConfig = Record<string, EmergencyBillable>; // key `${group}:${check}`

export const billableKey = (groupKey: string, checkKey: string) => `${groupKey}:${checkKey}`;

const STORAGE_KEY = 'vethub.emergencyBillables.v1';

export function loadEmergencyBillables(): EmergencyBillablesConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EmergencyBillablesConfig) : {};
  } catch { return {}; }
}

export function saveEmergencyBillables(cfg: EmergencyBillablesConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}
