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
  Plus, Search, Scale, Sparkles, ChevronRight, Loader2, Baby, Milk, X, Tag,
} from 'lucide-react';
import {
  clientPortalAPI, FARM_SPECIES,
  type FarmAnimal, type PortalAnimalGroup,
} from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import CpModal from '../CpModal';
import { speciesConfig, purposeLabel } from './farmSpecies';

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
  /** 'FULL' unlocks naming. 'BASIC' sees the pitch instead. */
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
  const [detail, setDetail] = useState<FarmAnimal | null>(null);
  const [weighing, setWeighing] = useState<FarmAnimal | null>(null);
  const [weightVal, setWeightVal] = useState('');

  const [form, setForm] = useState<any>({ name: '', species: 'Cattle', breed: '', sex: '', ageMonths: '', tagNumber: '', animalGroupId: '', weightValue: '', purpose: '' });
  // ⚠️ Everything species-specific comes from ONE config, shared with the free
  // tier's herd breakdown — so "layers" means the same thing on both sides of
  // the paywall and the numbers stay comparable when someone upgrades.
  const cfg = speciesConfig(form.species);

  const load = useCallback(() => {
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

  const add = async () => {
    if (!form.name.trim() || !form.species.trim()) { toast.error('A name and what it is — that is all that is required'); return; }
    setSaving(true);
    try {
      const r = await clientPortalAPI.createFarmAnimal(farmId, {
        name: form.name.trim(), species: form.species.trim(),
        breed: form.breed.trim() || undefined,
        sex: form.sex || undefined,
        ageMonths: form.ageMonths === '' ? undefined : Number(form.ageMonths),
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

  const saveWeight = async () => {
    if (!weighing || weightVal === '') return;
    setSaving(true);
    try {
      const r = await clientPortalAPI.recordAnimalWeight(weighing.id, { weightValue: Number(weightVal) });
      if (r.success) {
        toast.success('Weight recorded');
        setWeighing(null); setWeightVal('');
        await load(); onChanged?.();
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

  const grouped = useMemo(() => {
    const m = new Map<string, FarmAnimal[]>();
    animals.forEach((a) => {
      const k = a.animalGroupName ?? 'Not in a herd';
      m.set(k, [...(m.get(k) ?? []), a]);
    });
    return [...m.entries()];
  }, [animals]);

  // ── The free tier: what naming buys, not a broken button ──────────────────
  if (tier !== 'FULL') {
    return (
      <div className="cp-card p-5 sm:p-6">
        <Sparkles size={20} className="cp-accent-text" />
        <p className="mt-2 text-sm font-black text-slate-800 dark:text-zinc-100">
          Name your animals, one by one
        </p>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-lg">
          Counting works for a flock of layers. It does not work for a dairy cow — she has a name, a
          breed, a weight that should be going up, a calving date and a history. On the Farmer plan
          each animal gets its own record.
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 text-[11px] text-slate-600 dark:text-zinc-300">
          {['Name, breed, sex, age and tag number', 'Weight recorded over time, not once',
            'Pregnant and milking tracked per animal', 'Sold, died or culled — kept, never deleted'].map((f) => (
            <li key={f} className="flex items-start gap-1.5">
              <span className="mt-1 w-1 h-1 rounded-full bg-current shrink-0 opacity-50" />{f}
            </li>
          ))}
        </ul>
        <button className="cp-btn mt-4" onClick={onUpgrade}>See the Farmer plan</button>
        <p className="mt-2 text-[10px] text-slate-400">
          Your herd counts stay exactly as they are.
        </p>
      </div>
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
        <button className="cp-btn shrink-0" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add animal
        </button>
      </div>

      {loading ? (
        <div className="cp-card px-5 py-10 text-center text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin mx-auto" />
        </div>
      ) : animals.length === 0 ? (
        <div className="cp-card px-5 py-10 text-center">
          <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">No animals named yet</p>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Start with the ones you make decisions about — the milkers, the breeding stock. A flock
            can stay a number.
          </p>
          <button className="cp-btn mt-3" onClick={() => setAddOpen(true)}><Plus size={14} /> Add the first</button>
        </div>
      ) : (
        grouped.map(([groupName, list]) => (
          <section key={groupName}>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 mt-1">
              {groupName} <span className="text-slate-300">{list.length}</span>
            </h4>
            <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {list.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openDetail(a)}
                  className="w-full text-left flex items-center gap-3 px-3.5 sm:px-4 py-2.5 hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors"
                >
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
          </section>
        ))
      )}

      {/* ── Add ───────────────────────────────────────────────────────────── */}
      {addOpen && (
        <CpModal title="Add an animal" onClose={() => setAddOpen(false)}>
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
                <input className="cp-input w-full" placeholder="Friesian" value={form.breed}
                  onChange={(e) => setForm({ ...form, breed: e.target.value })} />
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
        </CpModal>
      )}

      {/* ── One animal ────────────────────────────────────────────────────── */}
      {detail && (
        <CpModal title={detail.name} onClose={() => setDetail(null)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              {[detail.species, detail.breed, detail.sex === 'MALE' ? 'Male' : detail.sex === 'FEMALE' ? 'Female' : null,
                ageOf(detail.dob, detail.dobIsApprox)].filter(Boolean).join(' · ')}
              {detail.tagNumber && <span className="ml-1 inline-flex items-center gap-0.5"><Tag size={10} />{detail.tagNumber}</span>}
            </p>
            {detail.dobIsApprox && detail.dob && (
              <p className="text-[10px] text-slate-400">Age is approximate — taken from what you told us, not a birth date.</p>
            )}

            {/* ⚠️ Species-correct, and ABSENT where it makes no sense. A hen is
                never asked whether she is pregnant; she is asked when she came
                into lay, which is the number that predicts her income. */}
            {(() => {
              const dcfg = speciesConfig(detail.species);
              return (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {dcfg.pregnancy && (
                      <button
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${detail.isPregnant ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700'}`}
                        onClick={() => setFlag(detail, { isPregnant: !detail.isPregnant })}
                      >
                        <Baby size={11} className="inline mr-1" />{dcfg.pregnantLabel}
                      </button>
                    )}
                    {dcfg.lactation && (
                      <button
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${detail.isLactating ? 'bg-sky-500 text-white border-sky-500' : 'bg-white dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700'}`}
                        onClick={() => setFlag(detail, { isLactating: !detail.isLactating })}
                      >
                        <Milk size={11} className="inline mr-1" />{dcfg.lactatingLabel}
                      </button>
                    )}
                    {detail.purpose && (
                      <span className="px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                        {purposeLabel(detail.purpose)}
                      </span>
                    )}
                  </div>
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

            <div className="cp-card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                  <Scale size={11} /> Weight
                </p>
                <button className="text-[10px] font-black uppercase tracking-widest cp-accent-text"
                  onClick={() => { setWeighing(detail); setWeightVal(''); }}>
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
        </CpModal>
      )}

      {/* ── Weigh-in ──────────────────────────────────────────────────────── */}
      {weighing && (
        <CpModal title={`Weigh ${weighing.name}`} onClose={() => setWeighing(null)}>
          <div className="space-y-3">
            <div>
              <label className="cp-label">Weight (kg)</label>
              <input className="cp-input w-full" type="number" min="0" step="0.1" autoFocus
                value={weightVal} onChange={(e) => setWeightVal(e.target.value)} />
            </div>
            {weighing.weightValue != null && (
              <p className="text-[11px] text-slate-500">
                Last recorded {weighing.weightValue}{weighing.weightUnit}
                {weighing.weighedOn && ` on ${new Date(weighing.weighedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}.
              </p>
            )}
            <button className="cp-btn w-full" onClick={saveWeight} disabled={saving || weightVal === ''}>
              {saving ? 'Saving…' : 'Record'}
            </button>
          </div>
        </CpModal>
      )}
    </div>
  );
};

export default ClientFarmAnimals;
