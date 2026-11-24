import React from 'react';
import {
  Syringe, Shield, FlaskConical, Microscope, HeartPulse, Scissors, Bath, Home, BedDouble, Siren,
  Stethoscope, Eye, Ear, Brain, GraduationCap, Cpu, Waves, Dumbbell, Video, Bird, Pill, Heart, Wind,
  ScanLine, PawPrint, Footprints, Utensils, Scale, type LucideIcon,
} from 'lucide-react';

/**
 * A picture for each service card (user, 2026-11-24: "make the cards fun and
 * communicate the name of the service — dental examination can look like a
 * dental examination, X-ray like an X-ray … a dark middle ground before the
 * text"). Matched from the service's NAME first, then its CATEGORY, so a
 * clinic's own custom services get a fitting picture without anyone choosing
 * one. Drawn icons, not hot-linked photos: instant, and the same in light and
 * dark mode.
 */

type ArtIcon = LucideIcon | React.FC<{ size?: number; className?: string; strokeWidth?: number }>;

const Tooth: React.FC<{ size?: number; className?: string; strokeWidth?: number }> = ({ size = 24, className, strokeWidth = 1.6 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 3.5c-2.2 0-3.5 1.8-3.5 4 0 2 .8 3.2 1.3 4.7.6 1.9.6 4.3 1.2 6.4.4 1.5 1 2.4 1.8 2.4 1.4 0 1.5-2.4 2.1-4.4.4-1.2.9-2 2.1-2s1.7.8 2.1 2c.6 2 .7 4.4 2.1 4.4.8 0 1.4-.9 1.8-2.4.6-2.1.6-4.5 1.2-6.4.5-1.5 1.3-2.7 1.3-4.7 0-2.2-1.3-4-3.5-4-1.7 0-2.7 1-5 1s-3.3-1-5-1z" />
  </svg>
);
const Xray: React.FC<{ size?: number; className?: string; strokeWidth?: number }> = ({ size = 24, className, strokeWidth = 1.6 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" className={className}>
    <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" />
    <path d="M12 5v14" />
    <path d="M12 7.5c-2 0-4.5.6-5.5 2M12 7.5c2 0 4.5.6 5.5 2M12 10.5c-2 0-4.5.6-5.5 2M12 10.5c2 0 4.5.6 5.5 2M12 13.5c-1.8 0-4 .5-5 1.8M12 13.5c1.8 0 4 .5 5 1.8M12 16.5c-1.4 0-3 .4-3.8 1.3M12 16.5c1.4 0 3 .4 3.8 1.3" />
  </svg>
);

export interface ServiceArt { from: string; to: string; Icon: ArtIcon }

const RULES: Array<[RegExp, ServiceArt]> = [
  [/dent|teeth|tooth|scal(e|ing)|polish|extract|oral/, { from: '#0f766e', to: '#14b8a6', Icon: Tooth }],
  [/x-?ray|radiograph/, { from: '#1e293b', to: '#475569', Icon: Xray }],
  [/ultra ?sound|scan|imaging|\bct\b|mri|echo/, { from: '#312e81', to: '#6366f1', Icon: ScanLine }],
  [/vaccin|rabies|booster|dhpp|kennel cough|bordetella|lepto/, { from: '#047857', to: '#22c55e', Icon: Syringe }],
  [/deworm|worm|flea|tick|parasit/, { from: '#3f6212', to: '#84cc16', Icon: Shield }],
  [/micro ?scop|cytolog|fecal|faecal|skin scrap/, { from: '#5b21b6', to: '#8b5cf6', Icon: Microscope }],
  [/lab|blood|test|urin|cbc|biochem|panel|culture/, { from: '#6d28d9', to: '#a78bfa', Icon: FlaskConical }],
  [/surg|spay|neuter|castrat|ovariohyst|amput|suture|wound/, { from: '#9f1239', to: '#f43f5e', Icon: HeartPulse }],
  [/sedat|an(a)?esth/, { from: '#3730a3', to: '#818cf8', Icon: Wind }],
  [/bath|shampoo|wash|medicated/, { from: '#0369a1', to: '#38bdf8', Icon: Bath }],
  [/groom|nail|clip|trim|haircut|de-?shed|brush/, { from: '#be185d', to: '#f472b6', Icon: Scissors }],
  [/overnight|night|kennel|cattery/, { from: '#92400e', to: '#f59e0b', Icon: BedDouble }],
  [/board|day care|daycare/, { from: '#b45309', to: '#fbbf24', Icon: Home }],
  [/hospital|inpatient|admission|ward|icu/, { from: '#991b1b', to: '#ef4444', Icon: BedDouble }],
  [/emergenc|critical|trauma|after hours|out of hours/, { from: '#7f1d1d', to: '#dc2626', Icon: Siren }],
  [/eye|ophthal/, { from: '#155e75', to: '#22d3ee', Icon: Eye }],
  [/\bear\b|otic|aural/, { from: '#9a3412', to: '#fb923c', Icon: Ear }],
  [/anxiety|phobia|behavio/, { from: '#9a3412', to: '#fb923c', Icon: Brain }],
  [/train|obedien|socializ|socialis|puppy class/, { from: '#c2410c', to: '#fdba74', Icon: GraduationCap }],
  [/micro ?chip|\bid\b|identif/, { from: '#334155', to: '#64748b', Icon: Cpu }],
  [/hydro|swim/, { from: '#0e7490', to: '#06b6d4', Icon: Waves }],
  [/physio|rehab|therapy|exercise/, { from: '#0f766e', to: '#2dd4bf', Icon: Dumbbell }],
  [/tele|video|online|remote/, { from: '#1d4ed8', to: '#60a5fa', Icon: Video }],
  [/avian|bird|exotic|reptile/, { from: '#15803d', to: '#4ade80', Icon: Bird }],
  [/weigh|weight|obes|diet|nutrition|feed/, { from: '#a16207', to: '#facc15', Icon: Scale }],
  [/food|meal/, { from: '#a16207', to: '#facc15', Icon: Utensils }],
  [/pharm|medic|drug|inject|tablet|prescri/, { from: '#0e7490', to: '#67e8f9', Icon: Pill }],
  [/euthan|cremat|burial|memorial/, { from: '#3f3f46', to: '#71717a', Icon: Heart }],
  [/walk/, { from: '#166534', to: '#4ade80', Icon: Footprints }],
  [/consult|check|exam|wellness|geriatric|health/, { from: '#075985', to: '#0ea5e9', Icon: Stethoscope }],
];

const DEFAULT: ServiceArt = { from: '#14532d', to: '#22c55e', Icon: PawPrint };

/** Name first (most specific), then category. */
export function serviceArt(name?: string | null, category?: string | null): ServiceArt {
  const n = String(name || '').toLowerCase();
  const c = String(category || '').toLowerCase();
  for (const [re, art] of RULES) if (re.test(n)) return art;
  for (const [re, art] of RULES) if (re.test(c)) return art;
  return DEFAULT;
}
