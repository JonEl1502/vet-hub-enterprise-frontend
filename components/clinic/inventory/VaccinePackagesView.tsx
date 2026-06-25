import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Syringe, Plus, Loader2, Trash2, Search, X, Pencil, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { vaccinePackagesAPI, VaccinePackage, PackagePricingMode, PackagePayload } from '../../../services';

type DraftItem = { inventoryItemId: string; quantity: number; name: string; price: number };
interface Draft {
  id?: string;
  name: string; description: string;
  pricingMode: PackagePricingMode;
  batchCostPrice: string; batchSellPrice: string;
  discount: string;
  items: DraftItem[];
}

const empty: Draft = { name: '', description: '', pricingMode: 'ITEMIZED', batchCostPrice: '', batchSellPrice: '', discount: '', items: [] };

const VaccinePackagesView: React.FC = () => {
  const { inventory } = useData();
  const [packages, setPackages] = useState<VaccinePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await vaccinePackagesAPI.list(true); if (res.success && res.data?.packages) setPackages(res.data.packages); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const matches = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return [] as any[];
    return inventory.filter((i: any) => `${i.name} ${i.sku}`.toLowerCase().includes(q)).slice(0, 6);
  }, [inventory, itemSearch]);

  // Live computed pricing for the draft.
  const draftPricing = useMemo(() => {
    if (!editing) return { sell: 0, after: 0 };
    let sell = 0;
    if (editing.pricingMode === 'BATCH') sell = Number(editing.batchSellPrice) || 0;
    else sell = editing.items.reduce((s, it) => s + it.price * it.quantity, 0);
    const after = Math.max(0, sell - (Number(editing.discount) || 0));
    return { sell, after };
  }, [editing]);

  const startNew = () => { setEditing({ ...empty }); setItemSearch(''); };
  const startEdit = (p: VaccinePackage) => setEditing({
    id: p.id, name: p.name, description: p.description ?? '', pricingMode: p.pricingMode,
    batchCostPrice: p.batchCostPrice != null ? String(p.batchCostPrice) : '',
    batchSellPrice: p.batchSellPrice != null ? String(p.batchSellPrice) : '',
    discount: p.discount ? String(p.discount) : '',
    items: p.items.map(i => ({ inventoryItemId: i.inventoryItemId, quantity: i.quantity, name: i.name ?? '', price: i.price })),
  });

  const addItem = (i: any) => {
    setEditing(d => d && (d.items.some(x => x.inventoryItemId === String(i.id)) ? d : { ...d, items: [...d.items, { inventoryItemId: String(i.id), quantity: 1, name: i.name, price: Number(i.price) || 0 }] }));
    setItemSearch('');
  };
  const setItemQty = (id: string, q: number) => setEditing(d => d && ({ ...d, items: d.items.map(x => x.inventoryItemId === id ? { ...x, quantity: Math.max(1, q) } : x) }));
  const removeItem = (id: string) => setEditing(d => d && ({ ...d, items: d.items.filter(x => x.inventoryItemId !== id) }));

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Name is required'); return; }
    if (!editing.items.length) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const payload: PackagePayload = {
        name: editing.name.trim(), description: editing.description || undefined,
        pricingMode: editing.pricingMode,
        batchCostPrice: editing.batchCostPrice ? Number(editing.batchCostPrice) : null,
        batchSellPrice: editing.batchSellPrice ? Number(editing.batchSellPrice) : null,
        discount: editing.discount ? Number(editing.discount) : 0,
        items: editing.items.map(i => ({ inventoryItemId: i.inventoryItemId, quantity: i.quantity })),
      };
      const res = editing.id ? await vaccinePackagesAPI.update(editing.id, payload) : await vaccinePackagesAPI.create(payload);
      if (res.success) { toast.success(editing.id ? 'Package updated' : 'Package created'); setEditing(null); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to save package'); }
    finally { setSaving(false); }
  };

  const remove = async (p: VaccinePackage) => {
    if (!confirm(`Delete package "${p.name}"?`)) return;
    try { const res = await vaccinePackagesAPI.remove(p.id); if (res.success) { toast.success('Deleted'); await load(); } }
    catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
  };

  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
  const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center"><Syringe size={22} className="text-rose-600 dark:text-rose-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Vaccine Packages</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{packages.length} package{packages.length === 1 ? '' : 's'} · bundle vaccines & set pricing</p>
          </div>
        </div>
        {!editing && <button onClick={startNew} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> New package</button>}
      </div>

      {editing ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{editing.id ? 'Edit package' : 'New package'}</h2>
            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"><X size={18} /></button>
          </div>

          <div><label className={labelCls}>Name *</label><input className={fieldCls} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Puppy starter pack" /></div>
          <div><label className={labelCls}>Description</label><input className={fieldCls} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Rabies + DHPP + Lepto" /></div>

          {/* Item picker */}
          <div>
            <label className={labelCls}>Vaccines / items in this package</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${fieldCls} pl-9`} placeholder="Search inventory to add…" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
              {matches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
                  {matches.map((i: any) => (
                    <button key={i.id} onClick={() => addItem(i)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800">
                      <span className="text-sm font-bold text-pine dark:text-zinc-100 truncate">{i.name}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">KES {Number(i.price).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {editing.items.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {editing.items.map(it => (
                  <div key={it.inventoryItemId} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 dark:bg-zinc-950/40 rounded-lg">
                    <span className="flex-1 min-w-0 text-xs font-bold text-pine dark:text-zinc-100 truncate">{it.name}</span>
                    <input type="number" min={1} value={it.quantity} onChange={e => setItemQty(it.inventoryItemId, Number(e.target.value))} className="w-16 px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md text-sm font-bold text-center text-pine dark:text-zinc-100" />
                    <span className="text-[11px] text-slate-400 w-24 text-right">KES {(it.price * it.quantity).toLocaleString()}</span>
                    <button onClick={() => removeItem(it.inventoryItemId)} className="p-1 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing mode toggle */}
          <div>
            <label className={labelCls}>Pricing</label>
            <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-max">
              {(['ITEMIZED', 'BATCH'] as PackagePricingMode[]).map(m => (
                <button key={m} onClick={() => setEditing({ ...editing, pricingMode: m })}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${editing.pricingMode === m ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>
                  {m === 'ITEMIZED' ? 'Sum of items' : 'Batch price'}
                </button>
              ))}
            </div>
          </div>

          {editing.pricingMode === 'BATCH' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Batch cost price</label><input type="number" min="0" className={fieldCls} value={editing.batchCostPrice} onChange={e => setEditing({ ...editing, batchCostPrice: e.target.value })} /></div>
              <div><label className={labelCls}>Batch sell price</label><input type="number" min="0" className={fieldCls} value={editing.batchSellPrice} onChange={e => setEditing({ ...editing, batchSellPrice: e.target.value })} /></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 items-end">
            <div><label className={labelCls}>Discount (KES)</label><input type="number" min="0" className={fieldCls} value={editing.discount} onChange={e => setEditing({ ...editing, discount: e.target.value })} placeholder="0" /></div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sells for</p>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">KES {draftPricing.after.toLocaleString()}</p>
              {draftPricing.sell !== draftPricing.after && <p className="text-[10px] text-slate-400 line-through">KES {draftPricing.sell.toLocaleString()}</p>}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditing(null)} disabled={saving} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50">Cancel</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-seafoam/90 active:scale-95 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />} {editing.id ? 'Save package' : 'Create package'}
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <Syringe size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-slate-400">No packages yet</p>
          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Bundle vaccines and set batch or itemized pricing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map(p => (
            <div key={p.id} className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm ${!p.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-pine dark:text-zinc-100 truncate">{p.name}</h3>
                  <p className="text-[10px] text-slate-400">{p.pricingMode === 'BATCH' ? 'Batch price' : 'Sum of items'} · {p.items.length} item{p.items.length === 1 ? '' : 's'}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-seafoam"><Pencil size={13} /></button>
                  <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={13} /></button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-2 line-clamp-1">{p.items.map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ')}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-pine dark:text-zinc-100">KES {p.pricing.sellAfterDiscount.toLocaleString()}</span>
                {p.pricing.sell !== p.pricing.sellAfterDiscount && <span className="text-[11px] text-slate-400 line-through">KES {p.pricing.sell.toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VaccinePackagesView;
