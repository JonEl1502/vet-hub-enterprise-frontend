import React, { useEffect, useMemo, useState } from 'react';
import StayRatesEditor from './StayRatesEditor';
import { Siren, Package, X, Search, CreditCard, BedDouble, Stethoscope } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import {
  STABILIZATION, billableKey, loadEmergencyBillables, saveEmergencyBillables,
  EmergencyBillablesConfig,
} from '../triage/emergencyBillables';
import { VISIT_FEE_DEFS, loadVisitFees, saveVisitFees, VisitFeesConfig, loadVisitFeeServices, saveVisitFeeServices, VisitFeeServicesConfig, loadVisitFeeRates, saveVisitFeeRates, VisitFeeRatesConfig, loadVisitFeeMeta, saveVisitFeeMeta, VisitFeeMeta, DistanceUnit, HOUSE_CALL_DISTANCE_KEY } from '../shared/visitFees';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import DefaultRateEditor from '../shared/DefaultRateEditor';
import LateFeePolicyCard from './LateFeePolicyCard';
import BoardingDayPolicyCard from './BoardingDayPolicyCard';
import { SERVICE_CHARGE_DEFS, chargesFromClinic, legacyLocalCharges, clearLegacyLocalCharges, CLINIC_FEE_FIELD, ServiceChargesConfig, ServiceChargeDef } from '../shared/serviceCharges';
import { useClinic } from '../../../contexts/ClinicContext';
import WorkingHoursEditor from '../shared/WorkingHoursEditor';
import QtyUnitControl, { sellUnitOf } from '../shared/QtyUnitControl';

/**
 * Emergency protocol billables — price the stabilization interventions
 * (oxygen cage, IV catheter…) and attach consumables per intervention.
 * During triage, ticking a priced intervention stages its fee as an
 * emergency charge; attached consumables auto-log (deduct stock + bill).
 * UI-ONLY phase: config persists in localStorage; a clinic settings
 * column takes over in the API phase.
 */
type ServiceChargeKey = ServiceChargeDef['key'];

const EmergencyBillablesTab: React.FC<{ currency?: string; clinicId?: string | number | null }> = ({ currency = 'KES', clinicId }) => {
  const { inventory } = useData();
  const [cfg, setCfg] = useState<EmergencyBillablesConfig>(() => loadEmergencyBillables(clinicId));
  // Reload the per-clinic config when the managed clinic changes.
  useEffect(() => { setCfg(loadEmergencyBillables(clinicId)); }, [clinicId]);
  // Encounter/visit-type entry fees — applied automatically when the type is
  // picked at registration (blank/0 = no charge).
  const [fees, setFees] = useState<VisitFeesConfig>(() => loadVisitFees());
  const setFee = (key: string, v: string) => {
    setFees(prev => {
      const next = { ...prev };
      if (v === '' || Number(v) <= 0) delete next[key]; else next[key] = Number(v);
      saveVisitFees(next);
      return next;
    });
  };
  // Clinic-wide DEFAULT service charges — what a new product's fee fields open
  // with, so the same four numbers aren't retyped per product. Stored on the
  // CLINIC (177), not this browser, so colleagues and other devices see them.
  const { selectedClinics, updateClinic } = useClinic();
  const svcClinic = selectedClinics[0] ?? null;
  const savedCharges = chargesFromClinic(svcClinic);
  // Seed from this browser's pre-177 copy ONLY when the clinic has nothing set,
  // so numbers typed before the move aren't silently lost — they are saved to
  // the clinic on the first edit, which is when the local copy is dropped.
  const hasSaved = Object.keys(savedCharges).length > 0;
  const [svcCharges, setSvcCharges] = useState<ServiceChargesConfig>(
    () => (hasSaved ? savedCharges : legacyLocalCharges()),
  );
  const [svcSaving, setSvcSaving] = useState(false);
  // Track the clinic's own values so switching clinics re-reads them rather
  // than showing the previous clinic's numbers.
  const savedKey = JSON.stringify(savedCharges);
  useEffect(() => {
    if (hasSaved) setSvcCharges(savedCharges);
  }, [savedKey, svcClinic?.id]);

  const setSvcCharge = (key: ServiceChargeKey, v: string) => {
    setSvcCharges(prev => {
      const next = { ...prev };
      if (v === '') delete next[key]; else next[key] = Number(v) || 0;
      return next;
    });
  };

  /** Persist on blur/Enter — one PATCH per field, like DefaultRateEditor. */
  const commitSvcCharge = async (key: ServiceChargeKey, v: string) => {
    if (!svcClinic) return;
    const next = v === '' ? null : Number(v) || 0;
    if ((savedCharges[key] ?? null) === next) return; // nothing changed
    setSvcSaving(true);
    try {
      await updateClinic(svcClinic.id, { [CLINIC_FEE_FIELD[key]]: next } as any);
      clearLegacyLocalCharges();
    } catch { /* updateClinic surfaces its own error */ }
    finally { setSvcSaving(false); }
  };

  // Per-fee time rates (per hour / per minute) + the clinic distance unit.
  const [rates, setRates] = useState<VisitFeeRatesConfig>(() => loadVisitFeeRates());
  const setRate = (key: string, field: 'perHour' | 'perMinute', v: string) => {
    setRates(prev => {
      const cur = { ...(prev[key] || {}) };
      if (v === '' || Number(v) <= 0) delete cur[field]; else cur[field] = Number(v);
      const next = { ...prev };
      if (Object.keys(cur).length === 0) delete next[key]; else next[key] = cur;
      saveVisitFeeRates(next);
      return next;
    });
  };
  const [meta, setMeta] = useState<VisitFeeMeta>(() => loadVisitFeeMeta());
  const setDistanceUnit = (u: DistanceUnit) => { setMeta(m => { const next = { ...m, distanceUnit: u }; saveVisitFeeMeta(next); return next; }); };
  const distanceUnit: DistanceUnit = meta.distanceUnit || 'km';
  // Which fee card's time-rate row is expanded.
  const [rateOpen, setRateOpen] = useState<string | null>(null);
  // Catalog services attached per fee — the hypothetical "full service" set;
  // the card shows fee + Σ(service prices) as the estimated total.
  const { categories: refCategories, services: refServices } = useReferenceData();
  const [feeSvcs, setFeeSvcs] = useState<VisitFeeServicesConfig>(() => loadVisitFeeServices());
  const [svcSearchFor, setSvcSearchFor] = useState<string | null>(null);
  const [svcQ, setSvcQ] = useState('');
  const patchFeeSvcs = (key: string, list: { id: string; name: string; price: number }[]) => {
    setFeeSvcs(prev => {
      const next = { ...prev };
      if (list.length === 0) delete next[key]; else next[key] = list;
      saveVisitFeeServices(next);
      return next;
    });
  };
  const svcMatches = useMemo(() => {
    const needle = svcQ.trim().toLowerCase();
    if (needle.length < 2) return [] as any[];
    const catName = (id: any) => refCategories.find(c => c.id === id)?.name ?? '';
    return refServices
      .filter(s => `${s.name} ${catName(s.categoryId)}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [refServices, refCategories, svcQ]);

  // Which intervention's consumable-search is open, and its query.
  const [searchFor, setSearchFor] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const update = (key: string, patch: any) => {
    setCfg(prev => {
      const next = { ...prev, [key]: { ...(prev[key] || {}), ...patch } };
      saveEmergencyBillables(clinicId, next);
      return next;
    });
  };

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [] as any[];
    return (inventory || [])
      .filter((it: any) => `${it.name} ${it.category ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [inventory, q]);

  // Inventory lookup so we can price each attached consumable (qty × sell price).
  const invById = useMemo(() => {
    const m = new Map<string, any>();
    (inventory || []).forEach((it: any) => m.set(String(it.id), it));
    return m;
  }, [inventory]);
  const consumableAmount = (cn: { inventoryItemId: string; qty: number }) =>
    Number(invById.get(cn.inventoryItemId)?.price ?? 0) * (Number(cn.qty) || 0);

  const pricedCount = Object.values(cfg).filter(b => (b.price ?? 0) > 0 || (b.consumables?.length ?? 0) > 0).length;

  return (
    <div className="space-y-4">
    {/* ── Default daily rates (boarding / in-patient) — clinic-wide, pre-fill
           the admit forms and drive the per-night charge. Set them here once. ── */}
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div className="p-1.5 bg-seafoam text-white rounded-lg shadow-md"><BedDouble size={16} /></div>
        <div className="flex-1">
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Default Daily Rates</h2>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
            Clinic-wide per-night rates. The Boarding &amp; In-patient admit forms pre-fill from these, and the page headers read them here — so the rate isn't retyped each admission.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <DefaultRateEditor field="boardingDayRate" label="Boarding — daily rate" />
        <DefaultRateEditor field="inpatientDayRate" label="In-patient — daily rate" />
      </div>

      {/* By species and size (213). The two flat rates above stay as the final
          fallback, so this section is purely additive — a clinic that ignores it
          is charged exactly as before. */}
      <div className="pt-3 mt-1 border-t border-slate-100 dark:border-zinc-800">
        <h3 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-2">
          Rates by species &amp; size
        </h3>
        <StayRatesEditor currency={currency} />
      </div>
    </div>

    {/* ── What a stay costs, and what running over it costs — one conversation,
           so the three cards sit together. Both policies are enforced
           server-side: computeNights (222) for the day count, computeLateFee
           (190) for the overtime charge. ── */}
    <BoardingDayPolicyCard />
    <LateFeePolicyCard />

    {/* ── Default service charges — the per-dispense fees a NEW product opens
           with, so a clinic sets them once instead of on every product. ── */}
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div className="p-1.5 bg-seafoam text-white rounded-lg shadow-md"><Stethoscope size={16} /></div>
        <div className="flex-1">
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
            Default Service Charges
            {svcSaving && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Saving…</span>}
          </h2>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
            Per-dispense fees a <strong>new</strong> product's form opens with. Leave blank for no default.
            Products already saved keep their own charges — changing a default never re-prices existing stock.
            Saved on the clinic, so the whole team sees the same numbers.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {SERVICE_CHARGE_DEFS.map(def => (
          <div key={def.key} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 space-y-1.5">
            <p className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-wide">{def.label}</p>
            <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-medium leading-tight">{def.hint}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">{currency}</span>
              <input
                type="number" min={0} step="0.01" inputMode="decimal"
                value={svcCharges[def.key] ?? ''}
                onChange={e => setSvcCharge(def.key, e.target.value)}
                onBlur={e => commitSvcCharge(def.key, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="—"
                disabled={!svcClinic}
                className="field-input py-1.5 text-xs font-mono w-full disabled:opacity-50"
              />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* ── Working hours — per-weekday open/close; drives auto after-hours
           detection on the New Visit screen. ── */}
    <WorkingHoursEditor />

    {/* ── Encounter & visit-type entry fees ── */}
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div className="p-1.5 bg-seafoam text-white rounded-lg shadow-md"><CreditCard size={16} /></div>
        <div className="flex-1">
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Encounter &amp; Visit-Type Fees</h2>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
            Charged automatically the moment the type is picked at registration — blank or 0 means no charge. Walk-in and house-call fees are added on top.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
        {VISIT_FEE_DEFS.map(def => {
          const attached = feeSvcs[def.key] || [];
          const estTotal = (fees[def.key] ?? 0) + attached.reduce((s, x) => s + (Number(x.price) || 0), 0);
          return (
          <div key={def.key} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">{def.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{def.label}</p>
                {def.hint && <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{def.hint}</p>}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{currency}</span>
              <input
                type="number" min={0} placeholder="0"
                value={fees[def.key] ?? ''}
                onChange={e => setFee(def.key, e.target.value)}
                className="w-24 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-[12px] font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-seafoam/30 text-right"
              />
            </div>
            {/* Attached catalog services — the hypothetical "full service" set. */}
            <div className="flex flex-wrap items-center gap-1">
              {attached.map(sv => (
                <span key={sv.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[9px] font-bold text-slate-500 dark:text-zinc-400">
                  {sv.name} <span className="text-emerald-600 font-black">{Number(sv.price).toLocaleString()}</span>
                  <button type="button" onClick={() => patchFeeSvcs(def.key, attached.filter(x => x.id !== sv.id))} className="text-slate-400 hover:text-red-500 leading-none">×</button>
                </span>
              ))}
              <button type="button" onClick={() => { setSvcSearchFor(svcSearchFor === def.key ? null : def.key); setSvcQ(''); }}
                className="px-1.5 py-0.5 rounded-md border border-dashed border-seafoam/50 text-seafoam text-[9px] font-black uppercase tracking-wider hover:bg-seafoam/10 transition-all">
                {svcSearchFor === def.key ? '− close' : '＋ service'}
              </button>
              {(attached.length > 0 || (fees[def.key] ?? 0) > 0) && (
                <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-slate-400" title="Fee + all attached services, if the full service were done">
                  Est. full-service&nbsp;<span className="text-emerald-700 dark:text-emerald-400">{currency} {estTotal.toLocaleString()}</span>
                </span>
              )}
            </div>
            {svcSearchFor === def.key && (
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input autoFocus className="w-full pl-7 pr-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
                  placeholder="Search catalog services…" value={svcQ} onChange={e => setSvcQ(e.target.value)} />
                {svcMatches.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg overflow-hidden">
                    {svcMatches.map((s: any) => (
                      <button key={s.id} type="button"
                        onClick={() => {
                          if (!attached.some(x => String(x.id) === String(s.id))) {
                            patchFeeSvcs(def.key, [...attached, { id: String(s.id), name: s.name, price: Number(s.defaultPrice ?? 0) }]);
                          }
                          setSvcQ(''); setSvcSearchFor(null);
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 flex justify-between gap-2">
                        <span className="truncate">{s.name}</span>
                        <span className="text-emerald-600 font-black shrink-0">{currency} {Number(s.defaultPrice ?? 0).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Per-hour / per-minute time rate — for time-billed encounters. */}
            <div>
              <button type="button" onClick={() => setRateOpen(rateOpen === def.key ? null : def.key)}
                className="text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-seafoam transition-colors">
                {rateOpen === def.key ? '− time rate' : '＋ time rate'}
                {(rates[def.key]?.perHour || rates[def.key]?.perMinute) ? (
                  <span className="ml-1 text-seafoam normal-case tracking-normal">
                    ({rates[def.key]?.perHour ? `${currency} ${rates[def.key]!.perHour}/hr` : ''}{rates[def.key]?.perHour && rates[def.key]?.perMinute ? ' · ' : ''}{rates[def.key]?.perMinute ? `${currency} ${rates[def.key]!.perMinute}/min` : ''})
                  </span>
                ) : null}
              </button>
              {rateOpen === def.key && (
                <div className="mt-1 flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Per hour
                    <input type="number" min={0} placeholder="0" value={rates[def.key]?.perHour ?? ''} onChange={e => setRate(def.key, 'perHour', e.target.value)}
                      className="w-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-seafoam/30 text-right" />
                  </label>
                  <label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Per min
                    <input type="number" min={0} placeholder="0" value={rates[def.key]?.perMinute ?? ''} onChange={e => setRate(def.key, 'perMinute', e.target.value)}
                      className="w-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-seafoam/30 text-right" />
                  </label>
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>
      {/* House-call distance rate — charged per unit of trip distance, multiplied
          by the distance entered on the house-call visit. */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800">
        <span className="text-base">📍</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-pine dark:text-zinc-100">House Call — distance rate</p>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Charged per {distanceUnit} of the trip, on top of the call-out fee</p>
        </div>
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{currency} /</span>
        <select value={distanceUnit} onChange={e => setDistanceUnit(e.target.value as DistanceUnit)}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] font-black text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30 cursor-pointer">
          <option value="km">km</option>
          <option value="mile">mile</option>
        </select>
        <input type="number" min={0} placeholder="0" value={fees[HOUSE_CALL_DISTANCE_KEY] ?? ''} onChange={e => setFee(HOUSE_CALL_DISTANCE_KEY, e.target.value)}
          className="w-24 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-[12px] font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-seafoam/30 text-right" />
      </div>
      <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">Saved in this browser only — a colleague on another device will not see these.</p>
    </div>

    {/* ── Emergency protocol billables ── */}
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div className="p-1.5 bg-red-500 text-white rounded-lg shadow-md"><Siren size={16} /></div>
        <div className="flex-1">
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Emergency Protocol Billables</h2>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
            Price stabilization interventions (e.g. oxygen) and attach consumables — ticking the intervention during triage stages the fee and auto-logs the consumables (deducts stock &amp; bills).
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-widest">{pricedCount} configured</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {STABILIZATION.map(group => (
          <div key={group.key} className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase flex items-center gap-1.5">
              <group.icon size={12} className="text-red-500" /> {group.title}
            </p>
            <div className="space-y-1.5">
              {group.checks.map(c => {
                const key = billableKey(group.key, c.k);
                const b = cfg[key] || {};
                const isOpen = searchFor === key;
                return (
                  <div key={c.k} className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{c.label}</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{currency}</span>
                      <input
                        type="number" min={0} placeholder="0"
                        value={b.price ?? ''}
                        onChange={e => update(key, { price: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="w-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-seafoam/30 text-right"
                        title="Service fee staged on the bill when this intervention is ticked (blank = not billed)"
                      />
                      <button
                        type="button"
                        onClick={() => { setSearchFor(isOpen ? null : key); setQ(''); }}
                        title="Attach consumables — auto-logged (stock deducted & billed) when the intervention is ticked"
                        className={`p-1.5 rounded-lg border transition-all ${((b.consumables?.length ?? 0) > 0 || isOpen) ? 'bg-seafoam text-white border-seafoam' : 'border-slate-200 dark:border-zinc-800 text-slate-400 hover:border-seafoam hover:text-seafoam'}`}
                      >
                        <Package size={11} />
                      </button>
                    </div>
                    {(b.consumables?.length ?? 0) > 0 && (() => {
                      const consumablesTotal = (b.consumables || []).reduce((s, cn) => s + consumableAmount(cn), 0);
                      const billsAt = (Number(b.price) || 0) + consumablesTotal;
                      return (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            {b.consumables!.map((cn, i) => {
                              const it = invById.get(cn.inventoryItemId);
                              const amt = consumableAmount(cn);
                              return (
                                <span key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-seafoam/10 text-seafoam text-[9px] font-bold" title={it ? '' : 'Not in this clinic’s inventory — no price'}>
                                  <Package size={9} /> {cn.name}
                                  {it ? (
                                    <QtyUnitControl compact item={it} value={Number(cn.qty) || 1}
                                      onChange={(sellQty) => update(key, { consumables: b.consumables!.map((x, j) => j === i ? { ...x, qty: sellQty } : x) })} />
                                  ) : (
                                    <>
                                      <input
                                        type="number" min={0} step="any" value={cn.qty}
                                        onChange={e => update(key, { consumables: b.consumables!.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) || 1 } : x) })}
                                        className="w-10 bg-white dark:bg-zinc-900 border border-seafoam/30 rounded px-1 text-[9px] font-black text-center outline-none"
                                        title="Quantity logged per tick"
                                      />
                                      {cn.unit || ''}
                                    </>
                                  )}
                                  <span className="text-emerald-600 dark:text-emerald-400 font-black">{currency} {amt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                  <button type="button" onClick={() => update(key, { consumables: b.consumables!.filter((_, j) => j !== i) })} className="hover:text-red-500"><X size={9} /></button>
                                </span>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] font-black uppercase tracking-wider pl-0.5">
                            <span className="text-slate-400">Consumables {currency} {consumablesTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            <span className="text-pine dark:text-zinc-100">Bills at {currency} {billsAt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      );
                    })()}
                    {isOpen && (
                      <div className="space-y-1">
                        <div className="relative">
                          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input autoFocus className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg pl-7 pr-2 py-1.5 text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
                            placeholder="Search inventory (2+ chars)…" value={q} onChange={e => setQ(e.target.value)} />
                        </div>
                        {matches.map((it: any) => (
                          <button key={it.id} type="button"
                            onClick={() => { update(key, { consumables: [...(b.consumables || []), { inventoryItemId: String(it.id), name: it.name, qty: 1, unit: sellUnitOf(it) }] }); setSearchFor(null); setQ(''); }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 hover:border-seafoam text-left transition-all">
                            <Package size={10} className="text-seafoam shrink-0" />
                            <span className="flex-1 text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{it.name}</span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{it.quantity} {it.unit} in stock</span>
                          </button>
                        ))}
                        {q.trim().length >= 2 && matches.length === 0 && <p className="text-[9px] font-bold text-slate-400 px-1">No inventory match.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">
        {/* The warning is real — this config is per-browser — but it used to be
            written for developers ("UI phase", "when the API lands"), which
            means nothing to the person actually pricing an oxygen cage. Say
            what it costs THEM: a colleague on another machine sees none of it. */}
        <strong className="text-amber-600">Saved in this browser only.</strong> A colleague on another
        device or browser will not see these prices — set them again there, until clinic-wide saving
        arrives. Priced interventions are added to the bill when the visit is finalised; attached
        consumables bill and deduct stock immediately.
      </p>
    </div>
    </div>
  );
};

export default EmergencyBillablesTab;
