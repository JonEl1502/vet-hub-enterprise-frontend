import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Skull, RefreshCw } from 'lucide-react';
import { inventoryAPI } from '../../../services';
import { InventoryReports as Rep } from '../../../services/modules/inventory.api';

// Inventory reports (ERP P5): valuation by category + fast/slow/dead stock.
const InventoryReports: React.FC<{ currency?: string }> = ({ currency = 'KES' }) => {
  const [data, setData] = useState<Rep | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = () => {
    setLoading(true);
    inventoryAPI.getReports({ cache: false }).then(r => { if (r.success && r.data) setData(r.data); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { if (open && !data) load(); }, [open]);

  const money = (n: number) => `${currency} ${Number(n || 0).toLocaleString()}`;
  const maxCat = data ? Math.max(1, ...data.byCategory.map(c => c.value)) : 1;

  const List: React.FC<{ title: string; icon: React.ComponentType<any>; tone: string; rows: any[]; metric: (r: any) => string }> = ({ title, icon: Icon, tone, rows, metric }) => (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
      <p className={`text-[9px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ${tone}`}><Icon size={12} /> {title}</p>
      {rows.length === 0 ? <p className="text-[11px] text-slate-400 py-1">None.</p> : (
        <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-2 px-2 py-1 text-[11px]">
              <span className="font-black text-pine dark:text-zinc-100 truncate flex-1 min-w-0">{r.name}</span>
              <span className="text-slate-400 shrink-0">{metric(r)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2"><BarChart3 size={14} className="text-seafoam" /> Inventory Reports</h2>
        <div className="flex items-center gap-2">
          {open && <button onClick={load} className="p-1 text-slate-400 hover:text-seafoam" title="Refresh"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /></button>}
          <button onClick={() => setOpen(o => !o)} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam">{open ? 'Hide' : 'Show'}</button>
        </div>
      </div>

      {open && (loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-slate-100 dark:bg-zinc-800/60 animate-pulse" />)}</div>
      ) : data ? (
        <>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valuation by category</p>
              <p className="text-sm font-black text-pine dark:text-zinc-100">{money(data.totalValue)} <span className="text-[9px] text-slate-400">· {data.itemsCount} items</span></p>
            </div>
            <div className="space-y-1.5">
              {data.byCategory.slice(0, 8).map(c => (
                <div key={c.category} className="flex items-center gap-2 text-[11px]">
                  <span className="w-28 shrink-0 truncate font-bold text-pine dark:text-zinc-100">{c.category}</span>
                  <span className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden"><span className="block h-full bg-seafoam rounded-full" style={{ width: `${Math.round((c.value / maxCat) * 100)}%` }} /></span>
                  <span className="w-24 text-right shrink-0 font-bold text-slate-500 dark:text-zinc-400">{money(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <List title="Fast moving (90d)" icon={TrendingUp} tone="text-emerald-600" rows={data.fastMoving} metric={r => `${r.used90} ${r.unit}`} />
            <List title="Slow moving" icon={TrendingDown} tone="text-amber-600" rows={data.slowMoving} metric={r => money(r.value)} />
            <List title="Dead stock (no move 90d)" icon={Skull} tone="text-rose-600" rows={data.deadStock} metric={r => money(r.value)} />
          </div>
        </>
      ) : null)}
    </div>
  );
};

export default InventoryReports;
