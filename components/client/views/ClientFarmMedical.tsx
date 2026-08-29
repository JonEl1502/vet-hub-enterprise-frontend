/**
 * MEDICAL — the health side of a farm (user, 2026-08-29).
 *
 * Three things in one place: what was BOUGHT to treat animals, WHO it came from
 * and who has been out to the farm, and the clinic connection itself.
 *
 * ⚠️ The contact list is built from what the farmer has ALREADY RECORDED, never
 * from a directory. The user was explicit: *"it's not necessarily the one they
 * are attached to — this is just a list of the ones they have interacted
 * with."* An agrovet they bought one dewormer from belongs here even though
 * VetHub has no relationship with it at all.
 *
 * This is also where "Visits" went. It was pulled out of the main farm menu
 * because it opened a pet booking screen; a farm visit is a medical event and
 * belongs beside the treatments it produces.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope, Building2, Phone, Mail, Search, Loader2, Sparkles, X, MapPin, Siren, ShieldCheck,
  Plus, AlertTriangle, Trash2,
} from 'lucide-react';
import {
  clientPortalAPI, TREATMENT_KINDS, TREATMENT_ROUTES, ADMINISTERED_BY,
  type PortalFarm, type FarmMedical, type PortalClinic, type PortalHoldings,
  type PortalAnimalGroup, type FarmAnimal,
} from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import CpModal from '../CpModal';

const KES = (n: number) => `KES ${Math.round(n).toLocaleString('en-KE')}`;
const day = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const ClientFarmMedical: React.FC = () => {
  const [farms, setFarms] = useState<PortalFarm[]>([]);
  const [activeId, setActiveId] = useState('');
  const [data, setData] = useState<FarmMedical | null>(null);
  const [holdings, setHoldings] = useState<PortalHoldings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  // Clinic connect
  const [connectOpen, setConnectOpen] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<PortalClinic[]>([]);
  const [filtered, setFiltered] = useState(0);
  const [searching, setSearching] = useState(false);

  // Recording a treatment
  const [txOpen, setTxOpen] = useState(false);
  const [groups, setGroups] = useState<PortalAnimalGroup[]>([]);
  const [animals, setAnimals] = useState<FarmAnimal[]>([]);
  const [tx, setTx] = useState<any>({
    scope: 'GROUP', kind: 'TREATMENT', product: '', animalGroupId: '', farmAnimalId: '',
    treatedCount: '', dose: '', route: '', batchNo: '', reason: '',
    administeredBy: 'OWNER', administeredName: '',
    withdrawalMeatDays: '', withdrawalMilkDays: '', amount: '', vendorName: '',
    treatedOn: new Date().toISOString().slice(0, 10),
  });

  const isFull = holdings?.farmTier === 'FULL';

  useEffect(() => {
    Promise.all([
      clientPortalAPI.getMyFarms({ showError: false }),
      clientPortalAPI.getHoldings({ showError: false }),
    ]).then(([f, h]) => {
      if (f.success && f.data?.farms) {
        setFarms(f.data.farms);
        if (f.data.farms.length) setActiveId((id) => id || f.data!.farms[0].id);
      }
      if (h.success && h.data) setHoldings(h.data);
    }).finally(() => setLoading(false));
  }, []);

  const load = useCallback((farmId: string) => {
    if (!farmId) return;
    clientPortalAPI.farmMedical(farmId).then((r) => { if (r.success && r.data) setData(r.data); });
  }, []);
  useEffect(() => { load(activeId); }, [activeId, load]);

  // Targets for the scope picker. Animals only exist on the paid tier, and the
  // picker simply does not offer ANIMAL scope without them.
  useEffect(() => {
    if (!activeId) return;
    clientPortalAPI.getFarmDetail(activeId, { showError: false })
      .then((r) => { if (r.success && r.data) setGroups(r.data.animalGroups); });
    if (isFull) {
      clientPortalAPI.listFarmAnimals(activeId)
        .then((r) => { if (r.success && r.data) setAnimals(r.data.animals); });
    }
  }, [activeId, isFull]);

  const saveTreatment = async () => {
    if (!tx.product.trim()) { toast.error('What was given?'); return; }
    if (tx.scope === 'GROUP' && !tx.animalGroupId) { toast.error('Which herd or flock?'); return; }
    if (tx.scope === 'ANIMAL' && !tx.farmAnimalId) { toast.error('Which animal?'); return; }
    setSaving(true);
    try {
      const r = await clientPortalAPI.createFarmTreatment(activeId, {
        scope: tx.scope, kind: tx.kind, product: tx.product.trim(),
        animalGroupId: tx.scope === 'GROUP' ? tx.animalGroupId : undefined,
        farmAnimalId: tx.scope === 'ANIMAL' ? tx.farmAnimalId : undefined,
        treatedCount: tx.treatedCount === '' ? null : Number(tx.treatedCount),
        treatedOn: tx.treatedOn,
        dose: tx.dose.trim() || undefined,
        route: tx.route || undefined,
        batchNo: tx.batchNo.trim() || undefined,
        reason: tx.reason.trim() || undefined,
        administeredBy: tx.administeredBy,
        administeredName: tx.administeredName.trim() || undefined,
        withdrawalMeatDays: tx.withdrawalMeatDays === '' ? null : Number(tx.withdrawalMeatDays),
        withdrawalMilkDays: tx.withdrawalMilkDays === '' ? null : Number(tx.withdrawalMilkDays),
        amount: tx.amount === '' ? null : Number(tx.amount),
        vendorName: tx.vendorName.trim() || undefined,
      });
      if (r.success) {
        toast.success('Treatment recorded');
        setTxOpen(false);
        setTx({ ...tx, product: '', dose: '', batchNo: '', reason: '', amount: '', treatedCount: '' });
        load(activeId);
      }
    } finally { setSaving(false); }
  };

  const removeTreatment = async (id: string) => {
    const r = await clientPortalAPI.deleteFarmTreatment(id);
    if (r.success) load(activeId);
  };

  /**
   * Scope picker options. ⚠️ ANIMAL is offered only when named animals exist —
   * a poultry keeper who has never named a bird should not be shown a scope
   * whose target list is empty.
   */
  const scopeOptions = [
    { key: 'ANIMAL', label: 'One animal', hide: animals.length === 0 },
    { key: 'GROUP', label: 'A herd / flock', hide: groups.length === 0 },
    { key: 'FARM', label: 'The whole farm', hide: false },
  ].filter((s) => !s.hide);

  useEffect(() => {
    if (!connectOpen) return;
    const term = q.trim();
    if (term.length < 2) { setOpts([]); setFiltered(0); return; }
    setSearching(true);
    const id = setTimeout(() => {
      clientPortalAPI.farmClinicOptions(term)
        .then((r) => { if (r.success && r.data) { setOpts(r.data.clinics); setFiltered(r.data.filtered); } })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(id);
  }, [q, connectOpen]);

  /**
   * ⚠️ The free tier gets the PITCH, not a search box that ends in a 403.
   * Connecting a clinic is what makes visits and shared records work, and both
   * are paid — so offering the search would be handing out the door to a room
   * they cannot enter.
   */
  const openConnect = () => {
    if (!isFull) { setPitchOpen(true); return; }
    setConnectOpen(true); setQ('');
  };

  const connect = async (clinicId: string | null) => {
    setSaving(true);
    try {
      const r = await clientPortalAPI.setFarmClinic(activeId, clinicId);
      if (r.success) {
        toast.success(clinicId ? 'Clinic connected' : 'Clinic removed');
        setConnectOpen(false); setQ(''); setOpts([]);
        load(activeId);
      }
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="cp-card px-5 py-12 text-center"><Loader2 size={16} className="animate-spin mx-auto text-slate-400" /></div>;
  }
  if (farms.length === 0) {
    return (
      <div className="cp-card px-5 py-12 text-center">
        <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Add your farm first</p>
        <button className="cp-btn mt-3" onClick={() => navigate('/client/farm')}>Go to My Farm</button>
      </div>
    );
  }

  const active = farms.find((f) => f.id === activeId);
  const clinics = (data?.contacts ?? []).filter((c) => c.kind === 'CLINIC');
  const agrovets = (data?.contacts ?? []).filter((c) => c.kind === 'AGROVET');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-slate-800 dark:text-zinc-100">Medical</h2>
        {active && (
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <MapPin size={11} /> {active.name}
          </p>
        )}
      </div>

      {farms.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {farms.map((f) => (
            <button key={f.id} onClick={() => setActiveId(f.id)}
              className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap ${
                f.id === activeId ? 'bg-pine text-white shadow' : 'bg-white dark:bg-zinc-900 text-slate-500 border border-slate-200 dark:border-zinc-800'}`}>
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* ⚠️ FIRST on the page, deliberately. Residues turn up in 5–16% of milk
          sampled from Kenyan smallholder dairies, so this is the single most
          useful thing the screen can say — and it is asked while the vehicle is
          waiting at the gate, not at leisure. */}
      {(data?.withholding.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-400/10 dark:border-amber-400/30 p-4">
          <p className="text-sm font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle size={15} /> Do not sell yet
          </p>
          <div className="mt-2 space-y-1.5">
            {data!.withholding.map((w) => (
              <p key={w.id} className="text-[11px] text-amber-800 dark:text-amber-200 leading-snug">
                <strong>{w.farmAnimalName ?? w.animalGroupName ?? 'The farm'}</strong> — {w.product}.
                {w.milkHeld && w.milkSafeOn && <> Milk safe from <strong>{day(w.milkSafeOn)}</strong>.</>}
                {w.meatHeld && w.meatSafeOn && <> Meat safe from <strong>{day(w.meatSafeOn)}</strong>.</>}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* ── Your clinic ─────────────────────────────────────────────────── */}
        <section className="min-w-0 lg:col-start-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Your clinic</h3>
          <div className="cp-card p-4">
            {data?.linkedClinicId && clinics.find((c) => c.linked) ? (
              <>
                <p className="text-sm font-black text-slate-800 dark:text-zinc-100">
                  {clinics.find((c) => c.linked)!.name}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Connected — they can see this farm.</p>
                <div className="mt-3 flex gap-2">
                  <button className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500"
                    onClick={openConnect}>Change</button>
                  <button className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-600"
                    onClick={() => connect(null)} disabled={saving}>Remove</button>
                </div>
              </>
            ) : (
              <>
                <Building2 size={18} className="cp-accent-text" />
                <p className="mt-2 text-sm font-black text-slate-800 dark:text-zinc-100">No clinic connected</p>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  A connected clinic can see this farm's animals and records, and come out when
                  something needs a vet.
                </p>
                <button className="cp-btn mt-3 w-full" onClick={openConnect}>
                  <Building2 size={14} /> Connect a clinic
                </button>
              </>
            )}
          </div>

          {isFull && (
            <button className="cp-card p-3.5 mt-2 w-full text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.03]"
              onClick={() => navigate('/client/farm')}>
              <Siren size={15} className="cp-accent-text shrink-0" />
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Request a farm visit</span>
            </button>
          )}
        </section>

        {/* ── What was actually given ─────────────────────────────────────── */}
        <section className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Stethoscope size={13} /> Treatment records
            </h3>
            <button className="text-[10px] font-black uppercase tracking-widest cp-accent-text flex items-center gap-1"
              onClick={() => setTxOpen(true)}>
              <Plus size={11} /> Record
            </button>
          </div>
          {(data?.clinical.length ?? 0) === 0 ? (
            <div className="cp-card px-5 py-8 text-center">
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                Record what you gave, to whom, and how long before the milk or meat is safe. Chickens
                are treated as a flock; a cow can be treated on her own, with her herd, or with the
                whole farm — you pick.
              </p>
              <button className="cp-btn mt-3" onClick={() => setTxOpen(true)}><Plus size={14} /> Record a treatment</button>
            </div>
          ) : (
            <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {data!.clinical.map((c) => (
                <div key={c.id} className="group flex items-baseline gap-3 px-3.5 sm:px-4 py-2">
                  <span className="shrink-0 w-[76px] text-[10px] font-bold uppercase tracking-wider text-slate-400 tabular-nums">
                    {new Date(c.treatedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-zinc-100 truncate">
                      {c.product}
                      {(c.milkHeld || c.meatHeld) && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase tracking-wider">
                          holding
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {[
                        c.scope === 'FARM' ? 'Whole farm'
                          : c.scope === 'GROUP' ? c.animalGroupName
                          : c.farmAnimalName,
                        c.treatedCount ? `${c.treatedCount} head` : null,
                        TREATMENT_KINDS.find((k) => k.key === c.kind)?.label,
                        c.dose,
                        c.batchNo ? `batch ${c.batchNo}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button className="shrink-0 p-1 text-transparent group-hover:text-slate-300 hover:!text-rose-500"
                    onClick={() => removeTreatment(c.id)} title="Remove this record">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Treatments bought ───────────────────────────────────────────── */}
        <section className="min-w-0 lg:col-start-1 lg:row-start-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
              What it cost
            </h3>
            {!!data?.spentOnHealth && (
              <span className="text-[11px] font-black text-slate-600 dark:text-zinc-300">{KES(data.spentOnHealth)}</span>
            )}
          </div>
          {(data?.treatments.length ?? 0) === 0 ? (
            <div className="cp-card px-5 py-8 text-center">
              <p className="text-xs text-slate-500">
                Nothing recorded yet. Anything you log under <strong>Treatment</strong> on the farm
                page — medicine, dewormer, spray — shows up here with where you bought it.
              </p>
            </div>
          ) : (
            <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {data!.treatments.map((e) => (
                <div key={e.id} className="flex items-baseline gap-3 px-3.5 sm:px-4 py-2">
                  <span className="shrink-0 w-[76px] text-[10px] font-bold uppercase tracking-wider text-slate-400 tabular-nums">
                    {new Date(e.entryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-zinc-100 truncate">{e.item}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {[e.quantity != null ? `${e.quantity}${e.unit ? ` ${e.unit.toLowerCase()}` : ''}` : null,
                        e.animalGroupName, e.vendorSupplierName || e.vendorName].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-black text-slate-600 dark:text-zinc-300 tabular-nums">
                    {KES(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Who you have dealt with ─────────────────────────────────────── */}
        <section className="min-w-0 lg:col-start-1 lg:row-start-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
            Who you have dealt with
          </h3>
          {clinics.length === 0 && agrovets.length === 0 ? (
            <div className="cp-card px-5 py-8 text-center text-xs text-slate-500">
              Every agrovet or clinic you record a purchase or a visit against is listed here, with
              their contact — so you never have to hunt for the number again.
            </div>
          ) : (
            <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {[...clinics, ...agrovets].map((c) => (
                <div key={`${c.kind}-${c.id ?? c.name}`} className="px-3.5 sm:px-4 py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-zinc-100 truncate flex items-center gap-1.5">
                      {c.name}
                      {c.linked && <ShieldCheck size={11} className="text-emerald-600 shrink-0" />}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {[
                        c.kind === 'CLINIC' ? (c.linked ? 'Your clinic' : 'Clinic') : 'Agrovet',
                        c.times ? `${c.times} purchase${c.times === 1 ? '' : 's'}` : null,
                        c.spent ? KES(c.spent) : null,
                        c.lastAt ? `last ${day(c.lastAt)}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="p-1.5 rounded-lg text-slate-400 hover:text-pine hover:bg-slate-100 dark:hover:bg-white/10" title={c.phone}>
                        <Phone size={13} />
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="p-1.5 rounded-lg text-slate-400 hover:text-pine hover:bg-slate-100 dark:hover:bg-white/10" title={c.email}>
                        <Mail size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {agrovets.some((a) => !a.onVetHub) && (
            <p className="mt-2 text-[10px] text-slate-400">
              Shops with no phone number here are ones you typed in yourself — add them to a record
              again and we will keep matching.
            </p>
          )}
        </section>
      </div>

      {/* ── Record a treatment ───────────────────────────────────────────── */}
      {txOpen && (
        <CpModal title="Record a treatment" onClose={() => setTxOpen(false)}>
          <div className="space-y-3">
            {/* ⚠️ SCOPE FIRST, and chosen rather than inferred. "I dosed the
                whole flock" and "I injected this cow" are different facts, and
                guessing from which id happens to be filled would quietly turn
                900 birds into one. */}
            <div>
              <label className="cp-label">What was treated?</label>
              <div className="flex flex-wrap gap-1.5">
                {scopeOptions.map((s) => (
                  <button key={s.key} type="button"
                    onClick={() => setTx({ ...tx, scope: s.key })}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                      tx.scope === s.key ? 'bg-pine text-white border-pine'
                        : 'bg-white dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {tx.scope === 'GROUP' && (
              <div>
                <label className="cp-label">Which herd or flock</label>
                <select className="cp-input w-full" value={tx.animalGroupId}
                  onChange={(e) => {
                    const g = groups.find((x) => x.id === e.target.value);
                    // Pre-fill the head count from the unit: a flock dose covers
                    // the flock, and retyping 1,200 is how the field gets left blank.
                    setTx({ ...tx, animalGroupId: e.target.value, treatedCount: g ? String(g.headCount) : tx.treatedCount });
                  }}>
                  <option value="">Choose…</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.headCount})</option>)}
                </select>
              </div>
            )}

            {tx.scope === 'ANIMAL' && (
              <div>
                <label className="cp-label">Which animal</label>
                <select className="cp-input w-full" value={tx.farmAnimalId}
                  onChange={(e) => setTx({ ...tx, farmAnimalId: e.target.value, treatedCount: '1' })}>
                  <option value="">Choose…</option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.tagNumber ? ` · ${a.tagNumber}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="cp-label">Kind</label>
                <select className="cp-input w-full" value={tx.kind}
                  onChange={(e) => setTx({ ...tx, kind: e.target.value })}>
                  {TREATMENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
              </div>
              <div>
                <label className="cp-label">How many head</label>
                <input className="cp-input w-full" type="number" min="1" placeholder="—"
                  value={tx.treatedCount} onChange={(e) => setTx({ ...tx, treatedCount: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="cp-label">What was given?</label>
              <input className="cp-input w-full" placeholder="Oxytetracycline 10%"
                value={tx.product} onChange={(e) => setTx({ ...tx, product: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="cp-label">Dose</label>
                <input className="cp-input w-full" placeholder="20 ml"
                  value={tx.dose} onChange={(e) => setTx({ ...tx, dose: e.target.value })} />
              </div>
              <div>
                {/* The field farmers skip unless it sits beside the product —
                    and it is what a residue trace-back actually runs on. */}
                <label className="cp-label">Batch no.</label>
                <input className="cp-input w-full" placeholder="on the bottle"
                  value={tx.batchNo} onChange={(e) => setTx({ ...tx, batchNo: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="cp-label">How was it given</label>
                <select className="cp-input w-full" value={tx.route}
                  onChange={(e) => setTx({ ...tx, route: e.target.value })}>
                  <option value="">Not sure</option>
                  {TREATMENT_ROUTES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="cp-label">Who gave it</label>
                <select className="cp-input w-full" value={tx.administeredBy}
                  onChange={(e) => setTx({ ...tx, administeredBy: e.target.value })}>
                  {ADMINISTERED_BY.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </div>
            </div>

            {/* ⚠️ The reason this screen exists. Residues turn up in 5–16% of
                milk sampled from Kenyan smallholder dairies — almost always
                because nobody wrote down when it would be safe again. */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-400/10 dark:border-amber-400/25 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-300">
                Withdrawal — read the bottle
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-amber-800 dark:text-amber-300">Milk (days)</label>
                  <input className="cp-input w-full" type="number" min="0" placeholder="0"
                    value={tx.withdrawalMilkDays}
                    onChange={(e) => setTx({ ...tx, withdrawalMilkDays: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-amber-800 dark:text-amber-300">Meat (days)</label>
                  <input className="cp-input w-full" type="number" min="0" placeholder="0"
                    value={tx.withdrawalMeatDays}
                    onChange={(e) => setTx({ ...tx, withdrawalMeatDays: e.target.value })} />
                </div>
              </div>
              <p className="mt-1.5 text-[10px] text-amber-700 dark:text-amber-300/80">
                We work out the safe date and warn you until it passes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="cp-label">When</label>
                <input className="cp-input w-full" type="date" value={tx.treatedOn}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setTx({ ...tx, treatedOn: e.target.value })} />
              </div>
              <div>
                <label className="cp-label">Cost (KES)</label>
                <input className="cp-input w-full" type="number" min="0" placeholder="—"
                  value={tx.amount} onChange={(e) => setTx({ ...tx, amount: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="cp-label">Why <span className="text-slate-400 font-normal normal-case tracking-normal">— optional</span></label>
              <input className="cp-input w-full" placeholder="Mastitis, left quarter"
                value={tx.reason} onChange={(e) => setTx({ ...tx, reason: e.target.value })} />
            </div>

            <button className="cp-btn w-full" onClick={saveTreatment} disabled={saving || !tx.product.trim()}>
              {saving ? 'Saving…' : 'Record it'}
            </button>
          </div>
        </CpModal>
      )}

      {/* ── Free tier: the sweet nudge, not a dead end ────────────────────── */}
      {pitchOpen && (
        <CpModal title="Get a vet on your side" onClose={() => setPitchOpen(false)}>
          <div className="space-y-3">
            <Sparkles size={22} className="cp-accent-text" />
            <p className="text-sm font-black text-slate-800 dark:text-zinc-100 leading-snug">
              Join the VetHub community and a clinic is one tap away.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              On the Farmer plan you connect to a clinic near you, and they can see your animals
              before they arrive — so a sick goat gets the right visit, not a guess. Ask for a farm
              visit from your phone and they confirm the time.
            </p>
            <ul className="grid gap-1.5 text-[11px] text-slate-600 dark:text-zinc-300">
              {['Connect to any clinic that serves farms',
                'Request farm visits, tracked to done',
                'Your animals and records, shared with them',
                'Feeding plans and your full history'].map((f) => (
                <li key={f} className="flex items-start gap-1.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-current shrink-0 opacity-50" />{f}
                </li>
              ))}
            </ul>
            <div className="cp-card p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Farmer plan</p>
                <p className="text-lg font-black text-slate-800 dark:text-zinc-100 leading-tight">
                  KES 1,500<span className="text-xs font-bold text-slate-400">/mo</span>
                </p>
              </div>
              <button className="cp-btn shrink-0" onClick={() => { setPitchOpen(false); navigate('/client/plan'); }}>
                Subscribe
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Everything you have already recorded stays free, and stays yours.
            </p>
          </div>
        </CpModal>
      )}

      {/* ── Paid: pick a clinic ──────────────────────────────────────────── */}
      {connectOpen && (
        <CpModal title="Connect a clinic" onClose={() => setConnectOpen(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              Only clinics that offer farm services can be connected — otherwise they would not be
              able to open your records.
            </p>
            <div>
              <label className="cp-label flex items-center gap-1"><Search size={11} /> Find a clinic</label>
              <input className="cp-input w-full" placeholder="Clinic name or town" value={q}
                onChange={(e) => setQ(e.target.value)} autoFocus />
            </div>
            {searching && <p className="text-[11px] text-slate-400">Searching…</p>}
            {opts.length > 0 && (
              <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
                {opts.map((c) => (
                  <button key={c.id} className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                    onClick={() => connect(c.id)} disabled={saving}>
                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {[c.city, c.phone].filter(Boolean).join(' · ') || 'Offers farm services'}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {q.trim().length >= 2 && !searching && opts.length === 0 && (
              <p className="text-xs text-slate-500">No clinic here offers farm services yet.</p>
            )}
            {filtered > 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
                {filtered} other {filtered === 1 ? 'clinic matches' : 'clinics match'} but {filtered === 1 ? 'does' : 'do'} not
                offer farm services on VetHub yet. Ask them to add Farms to their plan.
              </p>
            )}
          </div>
        </CpModal>
      )}
    </div>
  );
};

export default ClientFarmMedical;
