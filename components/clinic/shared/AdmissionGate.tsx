import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { VACCINES, hasVaccineRecorded } from '../../../constants/vaccines';
import { useFeature } from '../../../contexts/PlanAccessContext';
import { Award, Lock } from 'lucide-react';
import GateVaccineRecommend from './GateVaccineRecommend';
import { petsAPI } from '../../../services';

/**
 * THE admission gate — one component, every gate.
 *
 * Boarding, inpatient, grooming and the visit wizard's gate-check step all
 * ask the same two questions before a patient is taken in: what does it weigh,
 * and what is it vaccinated against? They had each grown their own version —
 * the wizard rendered a two-column checkbox grid of its own hardcoded eight
 * vaccines while the admit modals rendered fourteen as chips (user,
 * 2026-08-02: "still not same... make same same"). Rendering them from one
 * component is the only way that stops recurring.
 *
 * ── Prefill is keyed on the PET, never the visit ──────────────────────────
 * Boarding-after-grooming is a SEPARATE VISIT, not an encounter-type change on
 * the same one, so state carried on the visit could never cross. Both inputs
 * therefore derive from the patient:
 *   • weight   — the pet's recorded weight, when it is less than 90 days old
 *   • vaccines — the pet's ADMINISTERED vaccination records
 * That is what makes the gates "prefill each other": open any gate, on any
 * linked visit, and the same answers are already there. Staff edits always
 * win — prefill only fills keys the user has not touched.
 */

export interface AdmissionGateValue {
  intakeWeight: string;
  vaccines: Record<string, boolean>;
  recommended: Record<string, boolean>;
  clientAgreed: boolean;
  /**
   * The client wants a vaccination certificate for what was verified here
   * (user, 2026-08-04). Only meaningful once something is actually ticked —
   * a certificate for nothing is not a thing to claim.
   */
  claimCertificate?: boolean;
}

interface Props {
  value: AdmissionGateValue;
  onChange: (patch: Partial<AdmissionGateValue>) => void;
  /** Drives prefill. Omit to disable it (the gate still works, just empty). */
  petId?: string | number | null;
  /** The pet's recorded weight + when it was last touched, for the weight copy. */
  petWeight?: number | string | null;
  petWeightAt?: string | null;
  /** Hide the weight input where a weight is captured elsewhere on the form. */
  showWeight?: boolean;
  /** `true` marks the card required (amber). The wizard step is advisory. */
  required?: boolean;
  className?: string;
}

const FRESH_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Map a free-text administered-vaccine name onto a canonical key.
 * Most specific first: 'dhppl' contains 'dhpp', 'feline leukemia' contains 'leuk'.
 */
export const vaccineKeyFor = (name: string): string | null => {
  const s = (name || '').toLowerCase();
  if (s.includes('rab')) return 'rabies';
  if (s.includes('dhppl') || s.includes('dhlpp')) return 'dhppl';
  if (s.includes('dhpp')) return 'dhpp';
  if (s.includes('distemper')) return 'distemper';
  if (s.includes('parvo')) return 'parvovirus';
  if (s.includes('bordetella') || s.includes('kennel')) return 'kennelCough';
  if (s.includes('lepto')) return 'leptospirosis';
  if (s.includes('influenza')) return 'canineInfluenza';
  if (s.includes('corona')) return 'coronavirus';
  if (s.includes('lyme')) return 'lyme';
  if (s.includes('fvrcp')) return 'fvrcp';
  if (s.includes('felv') || s.includes('leuk')) return 'felv';
  if (s.includes('fiv') || s.includes('immunodefic')) return 'fiv';
  if (s.includes('chlamydia')) return 'chlamydia';
  if (s.includes('deworm')) return 'deworm';
  return null;
};

/** Administered vaccines from the pet's timeline → { key: most recent ISO date }. */
export async function fetchAdministeredVaccines(petId: number | string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const r: any = await petsAPI.getTimeline(petId as any);
    if (!r?.success) return out;
    const tl: any = r.data?.timeline;
    const entries: any[] = Array.isArray(tl) ? tl : (tl?.entries || []);
    for (const e of entries) {
      if (e.type !== 'vaccination') continue;
      const key = vaccineKeyFor(e.vaccineName || '');
      if (!key) continue;
      if (!out[key] || new Date(e.date).getTime() > new Date(out[key]).getTime()) out[key] = e.date;
    }
  } catch { /* non-fatal — the checklist just starts unticked */ }
  return out;
}

const AdmissionGate: React.FC<Props> = ({
  value, onChange, petId, petWeight, petWeightAt, showWeight = true, required = true, className = '',
}) => {
  // Issuing certificates is a paid capability; the gate itself is not.
  const canCertify = useFeature('capability:vaccination-certificates');
  const [dates, setDates] = React.useState<Record<string, string>>({});
  const [weightCopied, setWeightCopied] = React.useState(false);
  const prefilledFor = React.useRef<string | null>(null);

  // Weight — copy only when the record is fresh, and never over a typed value.
  React.useEffect(() => {
    if (!showWeight || !petId) return;
    const w = parseFloat(String(petWeight ?? ''));
    const fresh = petWeightAt ? (Date.now() - new Date(petWeightAt).getTime()) < FRESH_MS : false;
    if (w > 0 && fresh && !value.intakeWeight) {
      onChange({ intakeWeight: String(w) });
      setWeightCopied(true);
    } else if (!value.intakeWeight) {
      setWeightCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId, petWeight, petWeightAt, showWeight]);

  // Vaccines — from the patient's administered records, once per pet.
  React.useEffect(() => {
    if (!petId || prefilledFor.current === String(petId)) return;
    let alive = true;
    fetchAdministeredVaccines(petId).then(found => {
      if (!alive) return;
      prefilledFor.current = String(petId);
      setDates(found);
      const auto: Record<string, boolean> = {};
      for (const k of Object.keys(found)) auto[k] = true;
      // Staff choices win — auto only fills keys they have not set.
      onChange({ vaccines: { ...auto, ...(value.vaccines || {}) } });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId]);

  const toggle = (k: string) =>
    onChange({ vaccines: { ...(value.vaccines || {}), [k]: !(value.vaccines || {})[k] } });

  const shell = required
    ? 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800';

  return (
    <section className={`${shell} border rounded-2xl p-4 shadow-sm space-y-3 ${className}`}>
      <p className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
        required ? 'text-amber-700 dark:text-amber-400' : 'text-seafoam'
      }`}>
        <ShieldCheck size={13} /> Admission gate{required ? ' — required' : ''}
      </p>

      {showWeight && (
        <div className="max-w-[240px]">
          <label className="field-label">Intake weight (kg){required ? ' *' : ''}</label>
          <input
            type="number" min="0" step="0.1" required={required} className="field-input" placeholder="e.g. 12.4"
            value={value.intakeWeight}
            onChange={e => { onChange({ intakeWeight: e.target.value }); setWeightCopied(false); }}
          />
          {weightCopied && (
            <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-1">
              Copied from record (&lt;3 months old) — confirm on the scale.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="field-label">Vaccination check{required ? ' *' : ''}</label>
        <div className="flex flex-wrap gap-2">
          {VACCINES.map(v => {
            const on = !!(value.vaccines || {})[v.key];
            return (
              <button
                key={v.key} type="button" onClick={() => toggle(v.key)}
                title={dates[v.key] ? `Given ${new Date(dates[v.key]).toLocaleDateString()}` : undefined}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                  on
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                    : 'bg-white dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'
                }`}
              >
                {on ? '✓ ' : ''}{v.label}
                {dates[v.key] && (
                  <span className="ml-1 opacity-60 font-normal">· {new Date(dates[v.key]).toLocaleDateString()}</span>
                )}
              </button>
            );
          })}
        </div>
        {/* Something IS verified — offer the certificate. Gated: issuing
            certificates is a paid capability, and the gate itself stays fully
            usable without it (the tick is what upgrades, not the check). */}
        {hasVaccineRecorded(value.vaccines) && (
          <label className={`mt-2 flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
            canCertify
              ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-pointer'
              : 'border-slate-200 dark:border-zinc-800 opacity-60 cursor-not-allowed'
          }`}>
            <input
              type="checkbox"
              disabled={!canCertify}
              checked={!!value.claimCertificate && canCertify}
              onChange={e => onChange({ claimCertificate: e.target.checked })}
              className="w-3.5 h-3.5 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-pine dark:text-zinc-100">
                {canCertify ? <Award size={12} className="text-emerald-600" /> : <Lock size={12} className="text-slate-400" />}
                Claim a vaccination certificate
              </span>
              <span className="block text-[10px] font-bold text-slate-400 mt-0.5">
                {canCertify
                  ? 'Issues a certificate for the vaccines verified above — printable from the patient\u2019s records.'
                  : 'Available on Pro and Enterprise — upgrade to issue vaccination certificates.'}
              </span>
            </span>
          </label>
        )}

        {!hasVaccineRecorded(value.vaccines) && (
          <GateVaccineRecommend
            recommended={value.recommended || {}}
            onToggle={k => onChange({ recommended: { ...(value.recommended || {}), [k]: !(value.recommended || {})[k] } })}
            clientAgreed={!!value.clientAgreed}
            onAgreed={v => onChange({ clientAgreed: v })}
          />
        )}
      </div>
    </section>
  );
};

export default AdmissionGate;
