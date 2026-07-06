import React, { useMemo, useState } from 'react';
import { Siren, Package, X, Search, CreditCard, BedDouble } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import {
  STABILIZATION, billableKey, loadEmergencyBillables, saveEmergencyBillables,
  EmergencyBillablesConfig,
} from '../triage/emergencyBillables';
import { VISIT_FEE_DEFS, loadVisitFees, saveVisitFees, VisitFeesConfig, loadVisitFeeServices, saveVisitFeeServices, VisitFeeServicesConfig, loadVisitFeeRates, saveVisitFeeRates, VisitFeeRatesConfig, loadVisitFeeMeta, saveVisitFeeMeta, VisitFeeMeta, DistanceUnit, HOUSE_CALL_DISTANCE_KEY } from '../shared/visitFees';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import DefaultRateEditor from '../shared/DefaultRateEditor';
import WorkingHoursEditor from '../shared/WorkingHoursEditor';

/**
 * Emergency protocol billables — price the stabilization interventions
 * (oxygen cage, IV catheter…) and attach consumables per intervention.
 * During triage, ticking a priced intervention stages its fee as an
 * emergency charge; attached consumables auto-log (deduct stock + bill).
 * UI-ONLY phase: config persists in localStorage; a clinic settings
 * column takes over in the API phase.
 */
const EmergencyBillablesTab: React.FC<{ currency?: string }> = ({ currency = 'KES' }) => {
  const { inventory } = useData();
  const [cfg, setCfg] = useState<EmergencyBillablesConfig>(() => loadEmergencyBillables());
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
      saveEmergencyBillables(next);
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
      <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">Saved automatically on this device — moves to clinic settings (all devices) in the API phase.</p>
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
                    {(b.consumables?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {b.consumables!.map((cn, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-seafoam/10 text-seafoam text-[9px] font-bold">
                            <Package size={9} /> {cn.name}
                            <input
                              type="number" min={0.1} step={0.5} value={cn.qty}
                              onChange={e => update(key, { consumables: b.consumables!.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) || 1 } : x) })}
                              className="w-10 bg-white dark:bg-zinc-900 border border-seafoam/30 rounded px-1 text-[9px] font-black text-center outline-none"
                              title="Quantity logged per tick"
                            />
                            {cn.unit || ''}
                            <button type="button" onClick={() => update(key, { consumables: b.consumables!.filter((_, j) => j !== i) })} className="hover:text-red-500"><X size={9} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    {isOpen && (
                      <div className="space-y-1">
                        <div className="relative">
                          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input autoFocus className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg pl-7 pr-2 py-1.5 text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
                            placeholder="Search inventory (2+ chars)…" value={q} onChange={e => setQ(e.target.value)} />
                        </div>
                        {matches.map((it: any) => (
                          <button key={it.id} type="button"
                            onClick={() => { update(key, { consumables: [...(b.consumables || []), { inventoryItemId: String(it.id), name: it.name, qty: 1, unit: it.unit }] }); setSearchFor(null); setQ(''); }}
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
        Saved automatically on this device. ⚠️ UI phase: the config moves to clinic settings (all devices) when the emergency-billables API lands; priced fees currently stage on the triage panel and are added to the bill at finalize in the API phase — attached consumables bill &amp; deduct immediately.
      </p>
    </div>
    </div>
  );
};

export default EmergencyBillablesTab;
