import React, { useMemo, useState } from 'react';
import { Siren, Package, X, Search } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import {
  STABILIZATION, billableKey, loadEmergencyBillables, saveEmergencyBillables,
  EmergencyBillablesConfig,
} from '../triage/emergencyBillables';

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
  );
};

export default EmergencyBillablesTab;
