import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, PawPrint, ShieldCheck } from 'lucide-react';
import CpModal from './CpModal';
import { clientPortalAPI, PortalFarm, FarmAnimal, FarmTreatment } from '../../services/modules/clientPortal.api';

/**
 * "Pick from My Farm" (redesign brief §2) — prefill species/breed/sex/age/
 * weight from a real animal record instead of retyping it, and pull its
 * vaccination/deworming history in as verified tags rather than a claim the
 * seller has to type out by hand. Manual entry stays the fallback: closing
 * this without picking changes nothing.
 */
export interface FarmPrefill {
  farmId: string;
  species: string;
  breed: string;
  sex: string;
  ageMonths: string;
  weightKg: string;
  verifiedHealthTags: string[];
}

const monthsSince = (iso: string | null): number | null => {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  return Math.max(0, Math.round((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
};

/** Verified means recent — a dip three years ago is not a health fact today. */
const RECENCY_MONTHS = 12;

const PickFromFarmModal: React.FC<{
  farms: PortalFarm[];
  onClose: () => void;
  onPick: (prefill: FarmPrefill) => void;
}> = ({ farms, onClose, onPick }) => {
  const [farmId, setFarmId] = useState(farms[0]?.id ?? '');
  const [animals, setAnimals] = useState<FarmAnimal[]>([]);
  const [treatments, setTreatments] = useState<FarmTreatment[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!farmId) return;
    setLoading(true);
    Promise.all([
      clientPortalAPI.listFarmAnimals(farmId, {}, { silent: true }),
      clientPortalAPI.farmMedical(farmId, { silent: true }),
    ]).then(([a, m]) => {
      if (a.success && a.data) setAnimals(a.data.animals.filter((an) => an.status === 'ACTIVE'));
      if (m.success && m.data) setTreatments(m.data.clinical ?? []);
      setLoading(false);
    });
  }, [farmId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return animals;
    return animals.filter((a) =>
      [a.name, a.species, a.breed, a.tagNumber].filter(Boolean).some((v) => v!.toLowerCase().includes(term)));
  }, [animals, q]);

  const pick = (animal: FarmAnimal) => {
    const own = treatments.filter((t) => t.farmAnimalId === animal.id);
    const verified: string[] = [];
    const recentOfKind = (kind: string) => own.some((t) => t.kind === kind && (monthsSince(t.treatedOn) ?? 999) <= RECENCY_MONTHS);
    if (recentOfKind('VACCINATION')) verified.push('VACCINATED');
    if (recentOfKind('DEWORMING')) verified.push('DEWORMED');
    if (animal.isPregnant) verified.push('IN_CALF');
    if (animal.isLactating) verified.push('MILKING');

    onPick({
      farmId,
      species: animal.species,
      breed: animal.breed || '',
      sex: animal.sex || '',
      ageMonths: monthsSince(animal.dob) != null ? String(monthsSince(animal.dob)) : '',
      weightKg: animal.weightValue != null && animal.weightUnit === 'kg' ? String(animal.weightValue) : '',
      verifiedHealthTags: verified,
    });
  };

  return (
    <CpModal title="Pick from My Farm" onClose={onClose} maxWidth="28rem">
      <div className="space-y-3">
        {farms.length > 1 && (
          <select className="cp-input w-full" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
            {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 cp-muted" />
          <input className="cp-input w-full pl-8" placeholder="Search your animals"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin cp-accent-text" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm cp-muted text-center py-6">
            {animals.length === 0 ? 'No named animals on this farm yet.' : 'Nothing matches that search.'}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => pick(a)}
                className="w-full text-left cp-card p-3 flex items-center gap-3 hover:opacity-90 transition-opacity"
              >
                <span className="cp-icon-chip" style={{ background: 'var(--cp-surface-2)', color: 'var(--cp-seafoam)' }}>
                  <PawPrint className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{a.name}</div>
                  <div className="text-[11px] cp-muted truncate">
                    {[a.species, a.breed].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {treatments.some((t) => t.farmAnimalId === a.id) && (
                  <ShieldCheck className="w-4 h-4 shrink-0 cp-accent-text" aria-label="Has verified health records" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </CpModal>
  );
};

export default PickFromFarmModal;
