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

const Stat: React.FC<{ label: string; value: React.ReactNode; icon: React.ComponentType<any>; tone?: string }> = ({ label, value, icon: Icon, tone }) => (
  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 flex items-center gap-3">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone || 'bg-seafoam/10 text-seafoam'}`}><Icon size={16} /></div>
    <div className="min-w-0">
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
      <p className="text-base font-black text-pine dark:text-zinc-100 leading-tight truncate">{value}</p>
    </div>
  </div>
);

const InventoryDashboard: React.FC<{ currency?: string; refreshKey?: number }> = ({ currency = 'KES', refreshKey }) => {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

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
    return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-zinc-800/60 animate-pulse" />)}</div>;
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <Stat label="Products" value={data.productsCount.toLocaleString()} icon={Boxes} />
            <Stat label="Inventory value" value={money(data.inventoryValue)} icon={Wallet} tone="bg-emerald-500/10 text-emerald-600" />
            <Stat label="Today's consumption" value={money(data.todaysConsumption)} icon={ArrowDownRight} tone="bg-indigo-500/10 text-indigo-500" />
            <Stat label="Supplier payable" value={money(data.supplierPayable)} icon={ClipboardList} tone="bg-amber-500/10 text-amber-600" />
            <Stat label="Pending POs" value={data.pendingPOs} icon={ClipboardList} />
            <Stat label="Awaiting deliveries" value={data.awaitingDeliveries} icon={Truck} />
            <Stat label="Low stock" value={data.lowStock} icon={AlertTriangle} tone="bg-amber-500/10 text-amber-600" />
            <Stat label="Out of stock" value={data.outOfStock} icon={AlertTriangle} tone="bg-rose-500/10 text-rose-600" />
            <Stat label="Expired" value={data.expired} icon={Clock} tone="bg-rose-500/10 text-rose-600" />
            <Stat label="Expiring this month" value={data.expiringThisMonth} icon={Clock} tone="bg-amber-500/10 text-amber-600" />
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
        </>
      )}
    </div>
  );
};

export default InventoryDashboard;
