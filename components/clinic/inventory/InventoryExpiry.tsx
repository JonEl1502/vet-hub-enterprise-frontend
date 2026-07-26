import React, { useEffect, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { inventoryAPI } from '../../../services';
import { InventoryExpiry as Exp, ExpiryRow } from '../../../services/modules/inventory.api';

// Expiry centre (ERP P4): expired + expiring 30/60/90-day buckets.
const InventoryExpiry: React.FC<{ currency?: string }> = ({ currency = 'KES' }) => {
  const [data, setData] = useState<Exp | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'expired' | 'in30' | 'in60' | 'in90'>('expired');

  const load = () => {
    setLoading(true);
    inventoryAPI.getExpiry({ cache: false }).then(r => { if (r.success && r.data) setData(r.data); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { if (open && !data) load(); }, [open]);

  const money = (n: number) => `${currency} ${Number(n || 0).toLocaleString()}`;
  const rows: ExpiryRow[] = data ? (data as any)[tab] : [];
  const TABS: { k: typeof tab; label: string; tone: string }[] = [
    { k: 'expired', label: 'Expired', tone: 'text-rose-600' },
    { k: 'in30', label: '≤ 30 days', tone: 'text-amber-600' },
    { k: 'in60', label: '≤ 60 days', tone: 'text-amber-500' },
    { k: 'in90', label: '≤ 90 days', tone: 'text-slate-500' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2"><Clock size={14} className="text-seafoam" /> Expiry Centre</h2>
        <div className="flex items-center gap-2">
          {open && <button onClick={load} className="p-1 text-slate-400 hover:text-seafoam" title="Refresh"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /></button>}
          <button onClick={() => setOpen(o => !o)} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam">{open ? 'Hide' : 'Show'}</button>
        </div>
      </div>

      {open && (loading && !data ? (
        <div className="h-32 rounded-xl bg-slate-100 dark:bg-zinc-800/60 animate-pulse" />
      ) : data ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {TABS.map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${tab === t.k ? 'border-seafoam bg-seafoam/10 text-seafoam' : 'border-slate-200 dark:border-zinc-800 text-slate-500 hover:border-seafoam'}`}>
                {t.label} <span className="opacity-70">({data.counts[t.k]})</span>
              </button>
            ))}
            <span className="ml-auto text-[10px] font-bold text-slate-400 self-center">Expired value {money(data.expiredValue)} · expiring {money(data.expiringValue)}</span>
          </div>
          {rows.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-3 text-center">Nothing in this bucket.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-12 gap-2 px-2 py-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  <span className="col-span-4">Product</span><span className="col-span-2">Batch</span><span className="col-span-2">Expires</span><span className="col-span-1 text-right">Qty</span><span className="col-span-1 text-right">Value</span><span className="col-span-2">Supplier</span>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-50 dark:divide-zinc-800/60">
                  {rows.map(r => (
                    <div key={r.id} className="grid grid-cols-12 gap-2 px-2 py-1.5 text-[11px] items-center">
                      <span className="col-span-4 font-black text-pine dark:text-zinc-100 truncate">{r.name}</span>
                      <span className="col-span-2 text-slate-400 truncate">{r.batchNumber || '—'}</span>
                      <span className={`col-span-2 font-bold ${tab === 'expired' ? 'text-rose-600' : 'text-amber-600'}`}>{new Date(r.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                      <span className="col-span-1 text-right font-bold text-pine dark:text-zinc-100">{r.qty} {r.unit}</span>
                      <span className="col-span-1 text-right font-bold text-slate-500 dark:text-zinc-400">{money(r.value)}</span>
                      <span className="col-span-2 text-slate-400 truncate">{r.supplierName || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null)}
    </div>
  );
};

export default InventoryExpiry;
