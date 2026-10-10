/**
 * The named-animal register (264). Spec: backend/docs/SPEC_FARM_FREE_TIER.md §9
 *
 * User, 2026-08-29: *"for a big farm this is wrong … a record of each animal by
 * name, by breed, by species … even the weight, everything about the animal."*
 *
 * ⚠️ **A farm animal is NOT a pet and is never called one.** Same depth of
 * record, different word, different table — the user was explicit.
 *
 * ⚠️ Counting is not the poor relation here. A group of 900 broilers should
 * stay a number forever; naming is for the animals a farmer makes decisions
 * about one at a time. So this screen never nags a free account to name
 * anything it should not.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Scale, Sparkles, ChevronRight, Loader2, Baby, Milk, X, Tag, Pencil, Utensils, Droplet,
} from 'lucide-react';
import {
  clientPortalAPI, FARM_SPECIES,
  type FarmAnimal, type AnimalSummary, type PortalAnimalGroup, type AnimalFeedingLog, type AnimalProduceRecord,
} from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import CpModal from '../CpModal';
import CpPage from '../CpPage';
import CpPickOrType from '../CpPickOrType';
import { speciesConfig, purposeLabel } from './farmSpecies';
import { WeighForm, ProduceForm } from './AnimalRecordForms';
import FeedFromStoreForm from './FeedFromStoreForm';
import AnimalHero from './AnimalHero';
import AnimalBreeding from './AnimalBreeding';

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  SOLD: 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300',
  DIED: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
  CULLED: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  LOST: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-zinc-400',
};

/** "3y 4m", or "—". Approximate ages say so; a guess must never read as a fact. */
const ageOf = (dob: string | null, approx: boolean) => {
  if (!dob) return null;
  const d = new Date(dob);
  const months = Math.max(0, Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  const y = Math.floor(months / 12);
  const m = months % 12;
  const text = y > 0 ? `${y}y${m ? ` ${m}m` : ''}` : `${m}m`;
  return approx ? `~${text}` : text;
};

interface Props {
  farmId: string;
  groups: PortalAnimalGroup[];
  /**
   * Naming and tracking individual animals is FULL-tier only (reverted
   * 2026-09-27 — see `assertCanNameAnimals` on the backend for why). BASIC
   * sees an upgrade card instead of the register, same treatment as NONE.
   */
  tier: 'NONE' | 'BASIC' | 'FULL';
  onChanged?: () => void;
  onUpgrade?: () => void;
}

const ClientFarmAnimals: React.FC<Props> = ({ farmId, groups, tier, onChanged, onUpgrade }) => {
  const [animals, setAnimals] = useState<FarmAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  // Creating the UNIT itself — a house, a batch, a herd. It lived only on the
  // farm home, which is the wrong place to think of it from: you notice a
  // missing unit while looking at the animals.
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitSpecies, setUnitSpecies] = useState('Poultry');
  const [detail, setDetail] = useState<FarmAnimal | null>(null);
  const [weighing, setWeighing] = useState<FarmAnimal | null>(null);

  /** Daily input/output for whichever animal is open in `detail` (264). */
  const [feedingLogs, setFeedingLogs] = useState<AnimalFeedingLog[]>([]);
  const [produceRecords, setProduceRecords] = useState<AnimalProduceRecord[]>([]);
  const [feeding, setFeeding] = useState<FarmAnimal | null>(null);
  const [producing, setProducing] = useState<FarmAnimal | null>(null);

  const [summary, setSummary] = useState<AnimalSummary | null>(null);

  useEffect(() => {
    if (!detail) { setFeedingLogs([]); setProduceRecords([]); setSummary(null); return; }
    clientPortalAPI.animalSummary(detail.id).then((r) => { if (r.success && r.data) setSummary(r.data); });
    clientPortalAPI.listAnimalFeedingLogs(detail.id).then((r) => { if (r.success && r.data) setFeedingLogs(r.data.logs); });
    clientPortalAPI.listAnimalProduceRecords(detail.id).then((r) => { if (r.success && r.data) setProduceRecords(r.data.records); });
  }, [detail?.id]);

  /**
   * ⚠️ EVERY FACT ON A DETAIL PAGE IS A FACT SOMEONE TYPED, AND TYPOS HAPPEN.
   * "Fresian" for Friesian, a cow entered as a bull, an age guessed before the
   * papers turned up — all of it was read-only, so the only fix was to delete
   * the animal and lose its weights (user, 2026-09-14: *"i wanna edit the
   * animal details"*). Null means "not editing"; a draft means the fields are
   * live.
   */
  const [editing, setEditing] = useState<any | null>(null);

  /** Batch species only — the flock's own facts, not an animal's. */
  const [batch, setBatch] = useState({ count: '', name: '', housing: '' });
  const [form, setForm] = useState<any>({ name: '', species: 'Cattle', breed: '', sex: '', ageMonths: '', tagNumber: '', animalGroupId: '', weightValue: '', purpose: '' });
  // ⚠️ Everything species-specific comes from ONE config, shared with the free
  // tier's herd breakdown — so "layers" means the same thing on both sides of
  // the paywall and the numbers stay comparable when someone upgrades.
  const cfg = speciesConfig(form.species);

  const load = useCallback(() => {
    // Only FULL may list named animals; NONE has no farm, BASIC sees the upsell.
    if (tier !== 'FULL') { setLoading(false); return Promise.resolve(); }
    setLoading(true);
    return clientPortalAPI.listFarmAnimals(farmId, { q: q.trim() || undefined, animalGroupId: groupFilter || undefined })
      .then((r) => { if (r.success && r.data) setAnimals(r.data.animals); })
      .finally(() => setLoading(false));
  }, [farmId, q, groupFilter, tier]);

  useEffect(() => {
    const id = setTimeout(() => { load(); }, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  /**
   * ⚠️ COUNTED, NOT NAMED. A batch species (poultry, fish, bees) has no
   * per-animal row to create — the group IS the record. So this writes a head
   * count, either onto the flock the farmer picked or onto a new one.
   *
   * User, 2026-09-14: *"for chicken we wont have [name / tag / weight] …
   * because its flock."*
   */
  const addBirds = async () => {
    const cfg = speciesConfig(form.species);
    const n = Number(batch.count);
    if (!Number.isFinite(n) || n <= 0) { toast.error(`How many ${cfg.headNoun}?`); return; }
    setSaving(true);
    try {
      let r;
      if (form.animalGroupId) {
        // Topping up an existing flock ADDS — a farmer typing 200 after buying
        // 200 chicks means 200 more, not a flock that is suddenly only 200.
        const g = groups.find((x) => x.id === form.animalGroupId);
        r = await clientPortalAPI.updateAnimalGroup(form.animalGroupId, {
          headCount: (g?.headCount ?? 0) + n,
        });
      } else {
        if (!batch.name.trim()) { toast.error(`Give the ${cfg.groupNoun} a name`); setSaving(false); return; }
        r = await clientPortalAPI.createAnimalGroup(farmId, {
          name: batch.name.trim(), species: form.species.trim(),
          breed: form.breed.trim() || undefined,
          purpose: form.purpose || undefined,
          housing: batch.housing || undefined,
          headCount: n,
        });
      }
      if (r.success) {
        toast.success(`${n} ${cfg.headNoun} added`);
        setAddOpen(false);
        setBatch({ count: '', name: '', housing: '' });
        await load(); onChanged?.();
      }
    } finally { setSaving(false); }
  };

  const add = async () => {
    if (!form.name.trim() || !form.species.trim()) { toast.error('A name and what it is — that is all that is required'); return; }
    setSaving(true);
    try {
      const r = await clientPortalAPI.createFarmAnimal(farmId, {
        name: form.name.trim(), species: form.species.trim(),
        breed: form.breed.trim() || undefined,
        sex: form.sex || undefined,
        /* ⚠️ The column is MONTHS; the box may have asked for weeks. A pullet
           at 18 weeks is 4.1 months, and rounding that to 4 loses the week
           either side of point of lay — which is the number the farmer came
           here for. Send the fraction and let the display round. */
        ageMonths: form.ageMonths === ''
          ? undefined
          : (speciesConfig(form.species).ageUnit === 'weeks'
              ? Number((Number(form.ageMonths) / 4.345).toFixed(2))
              : Number(form.ageMonths)),
        tagNumber: form.tagNumber.trim() || undefined,
        animalGroupId: form.animalGroupId || undefined,
        purpose: form.purpose || undefined,
        weightValue: form.weightValue === '' ? undefined : Number(form.weightValue),
      } as any);
      if (r.success) {
        toast.success(`${form.name.trim()} added`);
        setAddOpen(false);
        setForm({ name: '', species: form.species, breed: '', sex: '', ageMonths: '', tagNumber: '', animalGroupId: form.animalGroupId, weightValue: '', purpose: form.purpose });
        await load(); onChanged?.();
      }
    } finally { setSaving(false); }
  };

  const saveDetails = async () => {
    if (!detail || !editing) return;
    if (!editing.name.trim()) { toast.error('A name is required'); return; }
    setSaving(true);
    try {
      const ecfg = speciesConfig(editing.species);
      const r = await clientPortalAPI.updateFarmAnimal(detail.id, {
        name: editing.name.trim(),
        species: editing.species.trim(),
        breed: editing.breed.trim() || null,
        sex: editing.sex || null,
        tagNumber: editing.tagNumber.trim() || null,
        purpose: editing.purpose || null,
        // Same months-is-the-column rule as the add form: send the fraction so
        // a bird's age in weeks survives the round trip.
        ...(editing.ageMonths === ''
          ? {}
          : { ageMonths: ecfg.ageUnit === 'weeks'
              ? Number((Number(editing.ageMonths) / 4.345).toFixed(2))
              : Number(editing.ageMonths) }),
      } as any);
      if (r.success) {
        toast.success('Updated');
        // Keep the page open on the animal you were looking at — an edit that
        // throws you back to the list makes you find your place again.
        if (r.data?.animal) setDetail(r.data.animal);
        setEditing(null);
        await load(); onChanged?.();
      }
    } finally { setSaving(false); }
  };

  // The forms (AnimalRecordForms) gather and validate; these only send.
  const saveWeight = async (payload: { weightValue: number; weighedOn?: string }) => {
    if (!weighing) return;
    setSaving(true);
    try {
      const r = await clientPortalAPI.recordAnimalWeight(weighing.id, payload);
      if (r.success) {
        toast.success('Weight recorded');
        setWeighing(null);
        await load(); onChanged?.();
      }
    } finally { setSaving(false); }
  };

  const saveFeeding = async (payload: { quantityKg?: number; fedAt?: string; notes?: string }) => {
    if (!feeding) return;
    setSaving(true);
    try {
      const r = await clientPortalAPI.recordAnimalFeeding(feeding.id, payload);
      if (r.success) {
        toast.success('Feeding recorded');
        const id = feeding.id;
        setFeeding(null);
        const logsR = await clientPortalAPI.listAnimalFeedingLogs(id);
        if (logsR.success && logsR.data) setFeedingLogs(logsR.data.logs);
      }
    } finally { setSaving(false); }
  };

  const saveProduce = async (payload: { produce: string; quantity: number; unit: string; recordedOn?: string; notes?: string }) => {
    if (!producing) return;
    setSaving(true);
    try {
      const r = await clientPortalAPI.recordAnimalProduce(producing.id, payload);
      if (r.success) {
        toast.success('Produce recorded');
        const id = producing.id;
        setProducing(null);
        const recR = await clientPortalAPI.listAnimalProduceRecords(id);
        if (recR.success && recR.data) setProduceRecords(recR.data.records);
      }
    } finally { setSaving(false); }
  };

  const addUnit = async () => {
    if (!unitName.trim() || !unitSpecies.trim()) { toast.error('Name it and say what is in it'); return; }
    setSaving(true);
    try {
      const r = await clientPortalAPI.createAnimalGroup(farmId, {
        name: unitName.trim(), species: unitSpecies.trim(),
      });
      if (r.success) {
        toast.success(`${unitName.trim()} added`);
        setUnitOpen(false); setUnitName('');
        onChanged?.();
      }
    } finally { setSaving(false); }
  };

  const openDetail = async (a: FarmAnimal) => {
    const r = await clientPortalAPI.getFarmAnimal(a.id);
    if (r.success && r.data) setDetail(r.data.animal);
  };

  const setFlag = async (a: FarmAnimal, patch: Partial<FarmAnimal>) => {
    const r = await clientPortalAPI.updateFarmAnimal(a.id, patch as any);
    if (r.success && r.data) {
      setDetail(r.data.animal);
      await load(); onChanged?.();
    }
  };

  /**
   * ⚠️ Sections are built from the UNITS, not from the animals.
   *
   * They used to be grouped off `animals`, so a unit with nothing named in it
   * simply did not exist on this screen — a farmer with "Layers — house A" and
   * "Broilers — batch 14" opened Animals and saw an empty page, with no hint
   * that their houses were already set up or where to put a bird. That is the
   * bug the user reported: *"I see poultry unit but in animals I don't see unit
   * A B C."*
   *
   * Every unit now shows with its head count and how many are named, so the
   * gap between "1,200 birds" and "0 named" is visible and has a button on it.
   */
  const sections = useMemo(() => {
    const byGroup = new Map<string, FarmAnimal[]>();
    const loose: FarmAnimal[] = [];
    animals.forEach((a) => {
      if (a.animalGroupId) byGroup.set(a.animalGroupId, [...(byGroup.get(a.animalGroupId) ?? []), a]);
      else loose.push(a);
    });
    const rows = groups
      .filter((g) => !groupFilter || g.id === groupFilter)
      .map((g) => ({ group: g, list: byGroup.get(g.id) ?? [] }));
    if (loose.length && !groupFilter) rows.push({ group: null as any, list: loose });
    // While SEARCHING, empty units are noise — the answer is the matches, and
    // burying three of them under six empty headers is worse than not showing
    // the headers at all.
    return q.trim() ? rows.filter((r) => r.list.length > 0) : rows;
  }, [animals, groups, groupFilter, q]);

  // ── No farm product at all: what the farm side is, not a broken button ────
  if (tier === 'NONE') {
    return (
      <div className="cp-card p-5 sm:p-6">
        <Sparkles size={20} className="cp-accent-text" />
        <p className="mt-2 text-sm font-black text-slate-800 dark:text-zinc-100">
          Turn on the farm side
        </p>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-lg">
          Herds and flocks, what you fed them, what they produced and what it cost — and each
          animal by name when you want that. This account does not have the farm side switched
          on yet.
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 text-[11px] text-slate-600 dark:text-zinc-300">
          {['Herds and flocks with their make-up', 'Name, breed, sex, age and tag number',
            'Feed, treatments and produce recorded', 'Kept, never deleted'].map((f) => (
            <li key={f} className="flex items-start gap-1.5">
              <span className="mt-1 w-1 h-1 rounded-full bg-current shrink-0 opacity-50" />{f}
            </li>
          ))}
        </ul>
        <button className="cp-btn mt-4" onClick={onUpgrade}>See the farm plans</button>
      </div>
    );
  }

  // ── Farm side is on, but naming is a Farmer-plan feature ──────────────────
  if (tier === 'BASIC') {
    return (
      <div className="cp-card p-5 sm:p-6">
        <Sparkles size={20} className="cp-accent-text" />
        <p className="mt-2 text-sm font-black text-slate-800 dark:text-zinc-100">
          Name your animals on the Farmer plan
        </p>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-lg">
          Your herds and flocks stay free either way. Naming an individual animal —
          with its own breed, sex, tag number and weight history — is a Farmer-plan
          feature.
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 text-[11px] text-slate-600 dark:text-zinc-300">
          {['Name, breed, sex, age and tag number', 'Weight history over time',
            'Feeding plans, produce and vet visits', 'Full record history'].map((f) => (
            <li key={f} className="flex items-start gap-1.5">
              <span className="mt-1 w-1 h-1 rounded-full bg-current shrink-0 opacity-50" />{f}
            </li>
          ))}
        </ul>
        <button className="cp-btn mt-4" onClick={onUpgrade}>See the farm plans</button>
      </div>
    );
  }

  /**
   * ⚠️ THESE MUST BE RENDERED BY THE ANIMAL PAGE, not only by the list.
   *
   * The animal is shown by an EARLY RETURN (`if (detail) { return … }`), and the
   * weigh / feed / produce sheets used to sit at the bottom of the component —
   * after it, in the list's return, which never runs while an animal is open.
   * So "+ Record" on Weight, Feeding and Produce set its state and then drew
   * nothing: no sheet, no error, nothing recorded. Found by driving the page in
   * a phone-sized browser (2026-10-10), not by reading it.
   */
  const recordModals = (
    <>
      {/* ── Weigh-in ──────────────────────────────────────────────────────── */}
      {weighing && (
        <CpModal title={`Weigh ${weighing.name}`} onClose={() => setWeighing(null)}>
          <WeighForm animal={weighing} saving={saving} onSubmit={saveWeight} />
        </CpModal>
      )}

      {/* ── Daily feeding ─────────────────────────────────────────────────── */}
      {feeding && (
        <CpModal title={`Feed ${feeding.name}`} onClose={() => setFeeding(null)}>
          <FeedFromStoreForm
            farmId={farmId} groups={groups} animals={animals} isFull animal={feeding}
            onDone={async () => {
              const id = feeding.id;
              setFeeding(null);
              const logsR = await clientPortalAPI.listAnimalFeedingLogs(id);
              if (logsR.success && logsR.data) setFeedingLogs(logsR.data.logs);
            }}
          />
        </CpModal>
      )}

      {/* ── Daily produce ─────────────────────────────────────────────────── */}
      {producing && (
        <CpModal title={`Produce from ${producing.name}`} onClose={() => setProducing(null)}>
          <ProduceForm animal={producing} saving={saving} onSubmit={saveProduce} />
        </CpModal>
      )}
    </>
  );

  /* The animal itself is a page too — it carries species-specific
     production fields and a status change, which is more than a sheet
     should ever hold. */
  if (detail) {
    const dc = speciesConfig(editing?.species ?? detail.species);
    return (
      <>
      <CpPage
        title={detail.name}
        onBack={() => { setEditing(null); setDetail(null); }}
        actions={!editing && (
          <button
            className="text-[10px] font-black uppercase tracking-widest cp-accent-text flex items-center gap-1"
            onClick={() => setEditing({
              name: detail.name,
              species: detail.species ?? 'Cattle',
              breed: detail.breed ?? '',
              sex: detail.sex ?? '',
              tagNumber: detail.tagNumber ?? '',
              purpose: detail.purpose ?? '',
              // Blank rather than a back-computed number: the stored age is a
              // date we derived from an approximation, and reversing it would
              // show a precision that was never there. Empty means "leave it".
              ageMonths: '',
            })}
          >
            <Pencil size={11} /> Edit
          </button>
        )}
      >
        <div className="space-y-3">
          {editing ? (
            /* ⚠️ The SAME fields as the add form, in the same order and the
               same species vocabulary — an edit screen that asks differently
               to the one that created the record is how the two drift. */
            <div className="space-y-3 pb-1">
              <div>
                <label className="cp-label">Name</label>
                <input className="cp-input w-full" value={editing.name} autoFocus
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="cp-label">What is it?</label>
                  <select className="cp-input w-full" value={editing.species}
                    onChange={(e) => setEditing({ ...editing, species: e.target.value })}>
                    {FARM_SPECIES.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="cp-label">Breed</label>
                  <CpPickOrType
                    options={dc.breeds}
                    value={editing.breed}
                    onChange={(v) => setEditing({ ...editing, breed: v })}
                    placeholder="Type the breed"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="cp-label">Sex</label>
                  <select className="cp-input w-full" value={editing.sex}
                    onChange={(e) => setEditing({ ...editing, sex: e.target.value })}>
                    <option value="">Not sure</option>
                    <option value="FEMALE">{dc.femaleLabel}</option>
                    <option value="MALE">{dc.maleLabel}</option>
                  </select>
                </div>
                <div>
                  <label className="cp-label">Tag number</label>
                  <input className="cp-input w-full" placeholder="KE-0412" value={editing.tagNumber}
                    onChange={(e) => setEditing({ ...editing, tagNumber: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="cp-label">Kept for</label>
                  <select className="cp-input w-full" value={editing.purpose}
                    onChange={(e) => setEditing({ ...editing, purpose: e.target.value })}>
                    <option value="">Not sure</option>
                    {dc.purposes.map((pp) => <option key={pp.key} value={pp.key}>{pp.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="cp-label">
                    Age ({dc.ageUnit}) <span className="text-slate-400 font-normal normal-case tracking-normal">— only if it changed</span>
                  </label>
                  <input className="cp-input w-full" type="number" min="0" placeholder={ageOf(detail.dob, detail.dobIsApprox) ?? '—'}
                    value={editing.ageMonths} onChange={(e) => setEditing({ ...editing, ageMonths: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <button className="cp-btn flex-1" onClick={saveDetails} disabled={saving || !editing.name.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="cp-btn-ghost shrink-0" onClick={() => setEditing(null)} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
          <AnimalHero
            animal={detail}
            subtitle={[detail.species, detail.breed,
              detail.sex === 'MALE' ? dc.maleLabel : detail.sex === 'FEMALE' ? dc.femaleLabel : null,
              ageOf(detail.dob, detail.dobIsApprox)].filter(Boolean).join(' · ')}
            chips={(
              <>
                {detail.isPregnant && <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500 text-white flex items-center gap-1"><Baby size={10} />{dc.pregnantLabel}</span>}
                {detail.isLactating && <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-sky-500 text-white flex items-center gap-1"><Milk size={10} />{dc.lactatingLabel}</span>}
                {detail.purpose && <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/20 backdrop-blur text-white">{purposeLabel(detail.purpose)}</span>}
                {detail.status !== 'ACTIVE' && <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500 text-white">{detail.status}</span>}
              </>
            )}
            onChanged={async () => { const r = await clientPortalAPI.getFarmAnimal(detail.id); if (r.success && r.data) { setDetail(r.data.animal); load(); } }}
          />
          )}
          {!editing && detail.dobIsApprox && detail.dob && (
            <p className="text-[10px] text-slate-400">Age is approximate — taken from what you told us, not a birth date.</p>
          )}

          {/* ⚠️ Species-correct, and ABSENT where it makes no sense. A hen is
              never asked whether she is pregnant; she is asked when she came
              into lay, which is the number that predicts her income. */}
          {(() => {
            const dcfg = speciesConfig(detail.species);
            return (
              <>
                <AnimalBreeding
                  animal={detail}
                  cfg={dcfg}
                  onChanged={async (fresh) => {
                    if (fresh) setDetail(fresh);
                    else { const r = await clientPortalAPI.getFarmAnimal(detail.id); if (r.success && r.data) setDetail(r.data.animal); }
                    load(); onChanged?.();
                  }}
                />
                {dcfg.laying && (
                  <div>
                    <label className="cp-label">Laying since</label>
                    <input
                      className="cp-input w-full" type="date"
                      value={detail.layingSince ? String(detail.layingSince).slice(0, 10) : ''}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setFlag(detail, { layingSince: e.target.value || null } as any)}
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      Point of lay — how her laying year is measured.
                    </p>
                  </div>
                )}
              </>
            );
          })()}

          {summary && (
            <div className="grid grid-cols-3 gap-2" data-testid="animal-totals">
              <div className="cp-card p-3 text-center">
                <p className="text-lg font-black tabular-nums text-slate-800 dark:text-zinc-100">{summary.feed.kg30d}<span className="text-[10px] font-bold text-slate-400"> kg</span></p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fed · 30 days</p>
              </div>
              <div className="cp-card p-3 text-center">
                <p className="text-lg font-black tabular-nums text-slate-800 dark:text-zinc-100">{summary.milk.litres30d}<span className="text-[10px] font-bold text-slate-400"> L</span></p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Milk · 30 days</p>
              </div>
              <div className="cp-card p-3 text-center">
                <p className="text-lg font-black tabular-nums text-slate-800 dark:text-zinc-100">{detail.weightValue ?? '—'}<span className="text-[10px] font-bold text-slate-400"> {detail.weightValue != null ? detail.weightUnit : ''}</span></p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Weight</p>
              </div>
            </div>
          )}

          <div className="cp-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Scale size={11} /> Weight
              </p>
              <button className="text-[10px] font-black uppercase tracking-widest cp-accent-text"
                onClick={() => setWeighing(detail)}>
                + Record
              </button>
            </div>
            {detail.weights.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">No weights yet — a single number says little; a trend says everything.</p>
            ) : (
              <div className="mt-2 divide-y divide-slate-100 dark:divide-zinc-800">
                {detail.weights.slice(0, 8).map((w, i, arr) => {
                  const prev = arr[i + 1];
                  const delta = prev ? w.weightValue - prev.weightValue : null;
                  return (
                    <div key={w.id} className="py-1.5 flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {new Date(w.weighedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="font-bold text-slate-700 dark:text-zinc-200 tabular-nums">
                        {w.weightValue}{w.weightUnit}
                        {delta !== null && (
                          <span className={`ml-1.5 text-[10px] font-black ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="cp-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Utensils size={11} /> Feeding
              </p>
              <button className="text-[10px] font-black uppercase tracking-widest cp-accent-text"
                onClick={() => setFeeding(detail)}>
                + Record
              </button>
            </div>
            {feedingLogs.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">No feeding logged yet — today's ration is the first line of a trend.</p>
            ) : (
              <div className="mt-2 divide-y divide-slate-100 dark:divide-zinc-800">
                {feedingLogs.slice(0, 8).map((l) => (
                  <div key={l.id} className="py-1.5 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {new Date(l.fedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}{new Date(l.fedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {l.notes ? ` · ${l.notes}` : ''}
                    </span>
                    <span className="font-bold text-slate-700 dark:text-zinc-200 tabular-nums">
                      {l.quantityKg != null ? `${l.quantityKg}kg` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="cp-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Droplet size={11} /> Produce
              </p>
              <button className="text-[10px] font-black uppercase tracking-widest cp-accent-text"
                onClick={() => setProducing(detail)}>
                + Record
              </button>
            </div>
            {produceRecords.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">No produce logged yet — milk, eggs, wool, whatever this one gives.</p>
            ) : (
              <div className="mt-2 divide-y divide-slate-100 dark:divide-zinc-800">
                {produceRecords.slice(0, 8).map((r) => (
                  <div key={r.id} className="py-1.5 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {new Date(r.recordedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {r.produce ? ` · ${r.produce}` : ''}
                      {r.notes ? ` · ${r.notes}` : ''}
                    </span>
                    <span className="font-bold text-slate-700 dark:text-zinc-200 tabular-nums">
                      {r.quantity}{r.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* An animal that leaves is kept, never deleted — its history is
              what makes the herd readable a year later. */}
          <div>
            <label className="cp-label">Status</label>
            <select className="cp-input w-full" value={detail.status}
              onChange={(e) => setFlag(detail, { status: e.target.value as any })}>
              <option value="ACTIVE">On the farm</option>
              <option value="SOLD">Sold</option>
              <option value="DIED">Died</option>
              <option value="CULLED">Culled</option>
              <option value="LOST">Lost / stolen</option>
            </select>
            <p className="mt-1 text-[10px] text-slate-400">
              An animal that leaves is kept, not deleted — you keep its weights and its history.
            </p>
          </div>
        </div>
      </CpPage>
      {recordModals}
      </>
    );
  }

  /* ⚠️ COUNTED, NOT NAMED — the form changes SHAPE with the species, it does
     not merely relabel. A flock has no name box, no tag number and no weight,
     because a farmer with 900 birds has no answer to any of the three. What
     they do have is a number, a breed, a house and a hatch date. */
  if (addOpen && cfg.identity === 'BATCH') {
    const flocks = groups.filter((g) => speciesConfig(g.species).identity === 'BATCH');
    return (
      <CpPage title={`Add ${cfg.headNoun}`} onBack={() => setAddOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="cp-label">What is it?</label>
            <select className="cp-input w-full" value={form.species}
              onChange={(e) => setForm({ ...form, species: e.target.value })}>
              {FARM_SPECIES.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="cp-label">How many {cfg.headNoun}</label>
              <input className="cp-input w-full" type="number" min="1" placeholder="200" autoFocus
                value={batch.count} onChange={(e) => setBatch({ ...batch, count: e.target.value })} />
            </div>
            <div>
              <label className="cp-label">Breed</label>
              <CpPickOrType
                options={cfg.breeds}
                value={form.breed}
                onChange={(v) => setForm({ ...form, breed: v })}
                placeholder="Type the breed"
              />
            </div>
          </div>
          <div>
            <label className="cp-label">Kept for</label>
            <select className="cp-input w-full" value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              <option value="">Not sure</option>
              {cfg.purposes.map((pp) => <option key={pp.key} value={pp.key}>{pp.label}</option>)}
            </select>
          </div>
          <div>
            <label className="cp-label">
              Which {cfg.groupNoun} <span className="cp-muted font-normal normal-case tracking-normal">— or start a new one</span>
            </label>
            <select className="cp-input w-full" value={form.animalGroupId}
              onChange={(e) => setForm({ ...form, animalGroupId: e.target.value })}>
              <option value="">Start a new {cfg.groupNoun}</option>
              {flocks.map((g) => (
                <option key={g.id} value={g.id}>{g.name} — {g.headCount} {speciesConfig(g.species).headNoun}</option>
              ))}
            </select>
          </div>
          {!form.animalGroupId && (
            <>
              <div>
                <label className="cp-label">Call this {cfg.groupNoun}</label>
                <input className="cp-input w-full" placeholder="March layers"
                  value={batch.name} onChange={(e) => setBatch({ ...batch, name: e.target.value })} />
              </div>
              {cfg.housing.length > 0 && (
                <div>
                  <label className="cp-label">Housing</label>
                  <select className="cp-input w-full" value={batch.housing}
                    onChange={(e) => setBatch({ ...batch, housing: e.target.value })}>
                    <option value="">Not sure</option>
                    {cfg.housing.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          <p className="text-[10px] cp-muted">
            {cfg.headNoun.charAt(0).toUpperCase() + cfg.headNoun.slice(1)} are counted, not named — the {cfg.groupNoun} is the record.
          </p>
          <button className="cp-btn w-full" onClick={addBirds} disabled={saving || !batch.count.trim()}>
            {saving ? 'Adding…' : `Add ${batch.count || ''} ${cfg.headNoun}`.trim()}
          </button>
        </div>
      </CpPage>
    );
  }

  /* ⚠️ A PAGE, NOT A SHEET (CpPage). Eight fields never fitted a sheet
     capped at 92dvh: it opened already scrolled, with the title and the
     Add button never on screen together. */
  if (addOpen) {
    return (
      <CpPage title="Add an animal" onBack={() => setAddOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="cp-label">Name</label>
            <input className="cp-input w-full" placeholder="Nyota" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="cp-label">What is it?</label>
              <select className="cp-input w-full" value={form.species}
                onChange={(e) => setForm({ ...form, species: e.target.value })}>
                {FARM_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="cp-label">Breed</label>
              <CpPickOrType
                options={cfg.breeds}
                value={form.breed}
                onChange={(v) => setForm({ ...form, breed: v })}
                placeholder="Type the breed"
              />
            </div>
          </div>
          <div>
            <label className="cp-label">Kept for</label>
            <select className="cp-input w-full" value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              <option value="">Not sure</option>
              {cfg.purposes.map((pp) => <option key={pp.key} value={pp.key}>{pp.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="cp-label">Sex</label>
              <select className="cp-input w-full" value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                <option value="">Not sure</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
              </select>
            </div>
            <div>
              {/* ⚠️ Age in MONTHS, not a birth date. A cow bought at market has
                  no known birthday, and a required date field just makes
                  someone invent one. The server marks it approximate. */}
              <label className="cp-label">Age (months)</label>
              <input className="cp-input w-full" type="number" min="0" placeholder="—" value={form.ageMonths}
                onChange={(e) => setForm({ ...form, ageMonths: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="cp-label">Tag number</label>
              <input className="cp-input w-full" placeholder="KE-0412" value={form.tagNumber}
                onChange={(e) => setForm({ ...form, tagNumber: e.target.value })} />
            </div>
            <div>
              <label className="cp-label">Weight (kg)</label>
              <input className="cp-input w-full" type="number" min="0" placeholder="—" value={form.weightValue}
                onChange={(e) => setForm({ ...form, weightValue: e.target.value })} />
            </div>
          </div>
          {groups.length > 0 && (
            <div>
              <label className="cp-label">Herd <span className="text-slate-400 font-normal normal-case tracking-normal">— optional</span></label>
              <select className="cp-input w-full" value={form.animalGroupId}
                onChange={(e) => setForm({ ...form, animalGroupId: e.target.value })}>
                <option value="">Not in a herd</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                Herd numbers update themselves from the animals you name.
              </p>
            </div>
          )}
          <button className="cp-btn w-full" onClick={add} disabled={saving || !form.name.trim()}>
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </CpPage>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="cp-input w-full !pl-8"
            placeholder="Name, tag or breed"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {groups.length > 0 && (
          <select className="cp-input" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">All herds</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <button
          className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500"
          onClick={() => setUnitOpen(true)}
        >
          + Unit
        </button>
        <button className="cp-btn shrink-0" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add animal
        </button>
      </div>

      {loading ? (
        <div className="cp-card px-5 py-10 text-center text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin mx-auto" />
        </div>
      ) : sections.length === 0 ? (
        <div className="cp-card px-5 py-10 text-center">
          <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">
            {q.trim() ? 'Nothing matches that' : 'No herds or units yet'}
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {q.trim()
              ? 'Try a name, a tag number or a breed.'
              : 'Set up a unit first — a house, a batch, a herd — then name the animals in it.'}
          </p>
          {!q.trim() && (
            <button className="cp-btn mt-3" onClick={() => setUnitOpen(true)}><Plus size={14} /> Add a unit</button>
          )}
        </div>
      ) : (
        sections.map(({ group, list }) => {
        /* ⚠️ Speak the species' own language. "Herd · 7 head" over a chicken
           house is the single clearest sign a form was written for cattle and
           pointed at everything else. */
        const gcfg = speciesConfig(group?.species);
        const batch = gcfg.identity === 'BATCH';
        return (
          <section key={group?.id ?? 'loose'}>
            <div className="flex items-end justify-between gap-2 mb-1.5 mt-1">
              <div className="min-w-0">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">
                  {group?.name ?? 'Not in a unit'}
                </h4>
                <p className="text-[10px] text-slate-400">
                  {group
                    ? [
                        group.species,
                        `${group.headCount} ${gcfg.headNoun}`,
                        // A batch is not missing its names — it was never
                        // going to have any. "none named yet" reads as a chore
                        // outstanding; for 900 birds it is just wrong.
                        batch ? null : (list.length ? `${list.length} named` : 'none named yet'),
                      ].filter(Boolean).join(' · ')
                    : `${list.length} animal${list.length === 1 ? '' : 's'}`}
                </p>
              </div>
              {group && (
                <button
                  className="shrink-0 text-[10px] font-black uppercase tracking-widest cp-accent-text flex items-center gap-1"
                  onClick={() => { setForm({ ...form, animalGroupId: group.id, species: group.species || form.species }); setAddOpen(true); }}
                >
                  <Plus size={11} /> {batch ? gcfg.headNoun : 'Add'}
                </button>
              )}
            </div>
            {list.length === 0 ? (
              /* ⚠️ An empty unit is shown, not hidden. The whole point is that a
                 farmer can see the house exists and that nothing in it is named
                 yet — that gap is the thing they need to act on. */
              <div className="cp-card px-4 py-3 text-[11px] text-slate-400">
                {group?.headCount
                  ? `${group.headCount} ${gcfg.headNoun} counted here${batch ? '.' : ', none named individually.'}`
                  : 'Nothing here yet.'}
              </div>
            ) : (
            <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {list.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openDetail(a)}
                  className="w-full text-left flex items-center gap-3 px-3.5 sm:px-4 py-2.5 hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors"
                >
                  {a.avatarUrl ? (
                    <img src={a.avatarUrl} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" loading="lazy" />
                  ) : (
                    <span className="w-10 h-10 rounded-xl shrink-0 bg-gradient-to-br from-[#f79b70] to-[#e56a3c] text-white/90 flex items-center justify-center text-sm font-black">
                      {a.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-zinc-100 truncate flex items-center gap-1.5">
                      {a.name}
                      {a.isPregnant && speciesConfig(a.species).pregnancy && <Baby size={11} className="text-amber-500 shrink-0" />}
                      {a.isLactating && speciesConfig(a.species).lactation && <Milk size={11} className="text-sky-500 shrink-0" />}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {[
                        a.species, a.breed, purposeLabel(a.purpose),
                        a.sex === 'MALE' ? '♂' : a.sex === 'FEMALE' ? '♀' : null,
                        ageOf(a.dob, a.dobIsApprox),
                        a.tagNumber ? `#${a.tagNumber}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {a.weightValue != null && (
                    <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-zinc-400 tabular-nums">
                      {a.weightValue}{a.weightUnit}
                    </span>
                  )}
                  {a.status !== 'ACTIVE' && (
                    <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${STATUS_TONE[a.status]}`}>
                      {a.status}
                    </span>
                  )}
                  <ChevronRight size={14} className="shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
            )}
          </section>
        );
        })
      )}

      {/* ── A unit: a house, a batch, a herd ──────────────────────────────── */}
      {unitOpen && (
        <CpModal title="Add a unit" onClose={() => setUnitOpen(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              A unit is however you already split the farm — house A, batch 14, the milking herd.
              Animals go in one, and its numbers add up from them.
            </p>
            <div>
              <label className="cp-label">Call it</label>
              <input className="cp-input w-full" placeholder="Layers — house B"
                value={unitName} onChange={(e) => setUnitName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="cp-label">What is in it?</label>
              <select className="cp-input w-full" value={unitSpecies}
                onChange={(e) => setUnitSpecies(e.target.value)}>
                {FARM_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button className="cp-btn w-full" onClick={addUnit} disabled={saving || !unitName.trim()}>
              {saving ? 'Adding…' : 'Add unit'}
            </button>
          </div>
        </CpModal>
      )}

    </div>
  );
};

export default ClientFarmAnimals;
