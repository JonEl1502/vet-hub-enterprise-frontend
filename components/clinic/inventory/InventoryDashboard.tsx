import { SoftTile, SoftTone } from '../../shared/stats/ColorTiles';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, ClipboardList, Clock, PackageCheck, RefreshCw, Truck, Wallet } from 'lucide-react';
import { inventoryAPI } from '../../../services';
import { InventoryDashboard as Dash } from '../../../services/modules/inventory.api';

// The inventory control-center overview: value, consumption, stock health,
// procurement, supplier payable, alerts, and recent movements (ERP P1).
const MOVEMENT_META: Record<string, { label: string; up: boolean }> = {
  RESTOCKED: { label: 'Received', up: true },
  RETURNED: { label: 'Returned', up: true },
  USED_IN_APPOINTMENT: { label: 'Dispensed', up: false },
  SOLD: { label: 'Sold', up: false },
  ADJUSTED: { label: 'Adjusted', up: false },
  EXPIRED: { label: 'Expired', up: false },
  DAMAGED: { label: 'Damaged', up: false },
};

// Coloured like the supplier dashboard (user, 2026-11-21). The tile's tone
// comes from what it means; `action` puts a small link in its corner.
const TONE_OF: Record<string, SoftTone> = {
  'bg-emerald-500/10 text-emerald-600': 'pine',
  'bg-indigo-500/10 text-indigo-500': 'indigo',
  'bg-amber-500/10 text-amber-600': 'amber',
  'bg-rose-500/10 text-rose-600': 'rose',
};
const Stat: React.FC<{ label: string; value: React.ReactNode; icon: React.ComponentType<any>; tone?: string; color?: SoftTone; action?: { label: string; onClick: () => void } }> = ({ label, value, icon, tone, color, action }) => (
  <SoftTile
    label={label} value={value} icon={icon}
    tone={color ?? (tone ? TONE_OF[tone] : undefined) ?? 'sky'}
    action={action ? (
      <button type="button" onClick={action.onClick}
        className="px-2.5 py-1 rounded-lg bg-white/70 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-300 text-[9px] font-black uppercase tracking-widest hover:bg-white transition-colors active:scale-95">
        {action.label}
      </button>
    ) : undefined}
  />
);

const InventoryDashboard: React.FC<{ currency?: string; refreshKey?: number; onViewProducts?: () => void }> = ({ currency = 'KES', refreshKey, onViewProducts }) => {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  /** 218 — which supplier each reorder row is aimed at. Keyed by item id;
   *  absent means "the item's default", so nothing needs pre-populating. */
  const [pickedSupplier, setPickedSupplier] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    inventoryAPI.getDashboard({ cache: false })
      .then(r => { if (r.success && r.data) setData(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [refreshKey]);

  const money = (n: number) => `${currency} ${Number(n || 0).toLocaleString()}`;

  if (loading && !data) {
    return <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[88px] rounded-2xl bg-slate-100 dark:bg-zinc-800/60 animate-pulse" />)}</div>;
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2"><Boxes size={14} className="text-seafoam" /> Inventory Dashboard</h2>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-1 text-slate-400 hover:text-seafoam" title="Refresh"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={() => setCollapsed(c => !c)} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam">{collapsed ? 'Show' : 'Hide'}</button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Three groups, three to a row (user, 2026-11-22: "use grid 3 …
              declutter them, they are too crowded"). Ten tiles in one 5-wide
              block read as a wall; grouped, each row answers one question. */}
          <div className="space-y-5">
            <section>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-0.5">Stock</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Stat label="Products" value={data.productsCount.toLocaleString()} icon={Boxes}
                  action={onViewProducts ? { label: 'View', onClick: onViewProducts } : undefined} />
                <Stat label="Inventory value" value={money(data.inventoryValue)} icon={Wallet} tone="bg-emerald-500/10 text-emerald-600" />
                <Stat label="Today's consumption" value={money(data.todaysConsumption)} icon={ArrowDownRight} tone="bg-indigo-500/10 text-indigo-500" />
              </div>
            </section>
            <section>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-0.5">Purchasing</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Stat label="Supplier payable" value={money(data.supplierPayable)} icon={ClipboardList} tone="bg-amber-500/10 text-amber-600" />
                <Stat label="Pending POs" value={data.pendingPOs} icon={ClipboardList} color="violet" />
                <Stat label="Awaiting deliveries" value={data.awaitingDeliveries} icon={Truck} color="teal" />
              </div>
            </section>
            <section>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-0.5">Alerts</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Low stock" value={data.lowStock} icon={AlertTriangle} tone="bg-amber-500/10 text-amber-600" />
                <Stat label="Out of stock" value={data.outOfStock} icon={AlertTriangle} tone="bg-rose-500/10 text-rose-600" />
                <Stat label="Expired" value={data.expired} icon={Clock} tone="bg-rose-500/10 text-rose-600" />
                <Stat label="Expiring this month" value={data.expiringThisMonth} icon={Clock} tone="bg-amber-500/10 text-amber-600" />
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Alerts */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><AlertTriangle size={12} className="text-amber-500" /> Alerts</p>
              {data.alerts.length === 0 ? (
                <p className="text-[11px] text-slate-400 font-medium py-2">All clear — no alerts.</p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                  {data.alerts.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${a.severity === 'danger' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'}`}>
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" /> <span className="min-w-0">{a.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><PackageCheck size={12} className="text-seafoam" /> Recent activity</p>
              {data.recentActivity.length === 0 ? (
                <p className="text-[11px] text-slate-400 font-medium py-2">No recent stock movements.</p>
              ) : (
                <div className="space-y-1 max-h-44 overflow-y-auto custom-scrollbar">
                  {data.recentActivity.map(m => {
                    const meta = MOVEMENT_META[m.type] || { label: m.type, up: m.quantity >= 0 };
                    const up = m.quantity >= 0;
                    return (
                      <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-[11px]">
                        {up ? <ArrowUpRight size={13} className="text-emerald-500 shrink-0" /> : <ArrowDownRight size={13} className="text-rose-500 shrink-0" />}
                        <span className="font-black text-pine dark:text-zinc-100 truncate flex-1 min-w-0">{m.item}</span>
                        <span className="text-slate-400 shrink-0">{meta.label}</span>
                        <span className={`font-black shrink-0 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>{up ? '+' : ''}{m.quantity} {m.unit}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Suggested reorders — what to buy, ranked by spend (ERP P3). */}
          {data.reorderSuggestions && data.reorderSuggestions.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><ClipboardList size={12} className="text-seafoam" /> Suggested reorders ({data.reorderSuggestions.length})</p>
              <div className="overflow-x-auto">
                <div className="min-w-[520px]">
                  <div className="grid grid-cols-12 gap-2 px-2 py-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="col-span-4">Product</span><span className="col-span-2 text-right">On hand</span><span className="col-span-2 text-right">Order</span><span className="col-span-2 text-right">Est. cost</span><span className="col-span-2">Supplier</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-50 dark:divide-zinc-800/60">
                    {data.reorderSuggestions.map(s => (
                      <div key={s.id} className="grid grid-cols-12 gap-2 px-2 py-1.5 text-[11px] items-center">
                        <span className="col-span-4 font-black text-pine dark:text-zinc-100 truncate">{s.name}</span>
                        <span className={`col-span-2 text-right font-bold ${s.currentQty <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>{s.currentQty} {s.unit}</span>
                        <span className="col-span-2 text-right font-black text-seafoam">+{s.recommendedQty}</span>
                        {(() => {
                          const picked = pickedSupplier[s.id] ?? s.supplierId;
                          const opt = ((s as any).supplierOptions ?? []).find((o: any) => String(o.supplierId) === String(picked));
                          const cost = opt?.costPrice != null
                            ? Math.round(opt.costPrice * s.recommendedQty)
                            : s.estimatedCost;
                          return (
                            <span className="col-span-2 text-right font-bold text-slate-500 dark:text-zinc-400" title={opt?.costPrice != null ? `${money(opt.costPrice)} per ${s.unit} from ${opt.supplierName ?? 'this supplier'}` : 'Using the item cost price — this supplier has no price on file'}>
                              {money(cost)}
                            </span>
                          );
                        })()}
                        {/* 218 — pick the supplier per row. A product with
                            alternatives becomes a dropdown; a single-source one
                            stays plain text rather than a select with one
                            option. Est. cost follows THAT supplier's price when
                            they have one on file, so switching supplier shows
                            what it actually costs. */}
                        <span className="col-span-2 min-w-0">
                          {(s as any).supplierOptions && (s as any).supplierOptions.length > 1 ? (
                            <select
                              value={pickedSupplier[s.id] ?? (s.supplierId ?? '')}
                              onChange={e => setPickedSupplier(p => ({ ...p, [s.id]: e.target.value }))}
                              title="Which supplier to order this from"
                              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md px-1.5 py-1 text-[10px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                            >
                              {(s as any).supplierOptions.map((o: any) => (
                                <option key={o.supplierId} value={o.supplierId}>
                                  {o.supplierName ?? 'Supplier'}{o.isDefault ? ' (default)' : ''}
                                  {o.costPrice != null ? ` — ${money(o.costPrice)}` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-400 truncate block">{s.supplierName || '—'}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InventoryDashboard;
