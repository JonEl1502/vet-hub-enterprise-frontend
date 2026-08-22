import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layers, Plus, Loader2, Trash2, Search, X, Pencil, ArrowLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { serviceBundlesAPI, ServiceBundle, BundlePricingMode, BundlePayload } from '../../../services';
import servicesAPI, { CatalogService } from '../../../services/modules/services.api';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { useAuth } from '../../../contexts/AuthContext';
import { modulePerms } from '../../../constants/modulePermissions';

type DraftItem = { serviceId: string; quantity: number; name: string; price: number };
interface Draft {
  id?: string;
  name: string; description: string;
  pricingMode: BundlePricingMode;
  batchPrice: string;
  discount: string;
  items: DraftItem[];
}

const empty: Draft = { name: '', description: '', pricingMode: 'ITEMIZED', batchPrice: '', discount: '', items: [] };

const ServiceBundlesView: React.FC = () => {
  // Grouped page permissions (user, 2026-08-04) — mirrored on the API.
  const { user } = useAuth();
  const pkg = modulePerms(user, 'packages');
  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const [bundles, setBundles] = useState<ServiceBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [svcSearch, setSvcSearch] = useState('');
  // Detail page — the card is the summary; this is the full service
  // breakdown and how the pricing mode reaches the final figure.
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([serviceBundlesAPI.list(true), servicesAPI.catalog().catch(() => [])]);
      if (b.success && b.data?.bundles) setBundles(b.data.bundles);
      setCatalog(c);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const detail = useMemo(
    () => (detailId ? bundles.find(b => b.id === detailId) ?? null : null),
    [detailId, bundles],
  );

  const matches = useMemo(() => {
    const q = svcSearch.trim().toLowerCase();
    if (!q) return [] as CatalogService[];
    return catalog.filter(s => `${s.name} ${s.categoryName}`.toLowerCase().includes(q)).slice(0, 6);
  }, [catalog, svcSearch]);

  const draftPricing = useMemo(() => {
    if (!editing) return { sell: 0, after: 0 };
    let sell = 0;
    if (editing.pricingMode === 'BATCH') sell = Number(editing.batchPrice) || 0;
    else sell = editing.items.reduce((s, it) => s + it.price * it.quantity, 0);
    const after = Math.max(0, sell - (Number(editing.discount) || 0));
    return { sell, after };
  }, [editing]);

  const startNew = () => { setEditing({ ...empty }); setSvcSearch(''); };
  const startEdit = (b: ServiceBundle) => setEditing({
    id: b.id, name: b.name, description: b.description ?? '', pricingMode: b.pricingMode,
    batchPrice: b.batchPrice != null ? String(b.batchPrice) : '',
    discount: b.discount ? String(b.discount) : '',
    items: b.items.map(i => ({ serviceId: i.serviceId, quantity: i.quantity, name: i.name ?? '', price: i.price })),
  });

  const addItem = (s: CatalogService) => {
    setEditing(d => d && (d.items.some(x => x.serviceId === String(s.id)) ? d : { ...d, items: [...d.items, { serviceId: String(s.id), quantity: 1, name: s.name, price: Number(s.priceEffective ?? s.defaultPrice ?? 0) }] }));
    setSvcSearch('');
  };
  const setQty = (id: string, q: number) => setEditing(d => d && ({ ...d, items: d.items.map(x => x.serviceId === id ? { ...x, quantity: Math.max(1, q) } : x) }));
  const removeItem = (id: string) => setEditing(d => d && ({ ...d, items: d.items.filter(x => x.serviceId !== id) }));

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Name is required'); return; }
    if (!editing.items.length) { toast.error('Add at least one service'); return; }
    setSaving(true);
    try {
      const payload: BundlePayload = {
        name: editing.name.trim(), description: editing.description || undefined,
        pricingMode: editing.pricingMode,
        batchPrice: editing.batchPrice ? Number(editing.batchPrice) : null,
        discount: editing.discount ? Number(editing.discount) : 0,
        items: editing.items.map(i => ({ serviceId: i.serviceId, quantity: i.quantity })),
      };
      const res = editing.id ? await serviceBundlesAPI.update(editing.id, payload) : await serviceBundlesAPI.create(payload);
      if (res.success) {
        // Optimistically reflect the saved bundle so it shows immediately
        // (the create/update endpoint returns the full transformed bundle),
        // then refresh in the background to reconcile.
        const saved = res.data?.bundle;
        if (saved) setBundles(prev => editing.id ? prev.map(b => b.id === saved.id ? saved : b) : [saved, ...prev.filter(b => b.id !== saved.id)]);
        toast.success(editing.id ? 'Bundle updated' : 'Bundle created');
        setEditing(null);
        load();
      } else {
        toast.error((res as any)?.message || 'Failed to save bundle');
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to save bundle'); }
    finally { setSaving(false); }
  };

  const remove = async (b: ServiceBundle) => {
    if (!confirm(`Delete bundle "${b.name}"?`)) return;
    try { const res = await serviceBundlesAPI.remove(b.id); if (res.success) { toast.success('Deleted'); await load(); } }
    catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
  };

  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
  const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center"><Layers size={22} className="text-violet-600 dark:text-violet-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Service Bundles</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{bundles.length} bundle{bundles.length === 1 ? '' : 's'} · group services & set pricing</p>
          </div>
        </div>
        {!editing && !detailId && pkg.create && <button onClick={startNew} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> New bundle</button>}
      </div>

      {editing ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{editing.id ? 'Edit bundle' : 'New bundle'}</h2>
            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-6 gap-y-5 items-start">
          <div className="lg:col-span-3 space-y-5">
          <div><label className={labelCls}>Name *</label><input className={fieldCls} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Full groom + nails" /></div>
          <div><label className={labelCls}>Description</label><input className={fieldCls} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="What's included" /></div>

          <div>
            <label className={labelCls}>Services in this bundle</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${fieldCls} pl-9`} placeholder="Search services to add…" value={svcSearch} onChange={e => setSvcSearch(e.target.value)} />
              {matches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
                  {matches.map(s => (
                    <button key={s.id} onClick={() => addItem(s)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800">
                      <span className="text-sm font-bold text-pine dark:text-zinc-100 truncate">{s.name} <span className="text-slate-400 font-medium text-[10px]">{s.categoryName}</span></span>
                      <span className="text-[11px] text-slate-400 shrink-0">KES {Number(s.priceEffective ?? s.defaultPrice ?? 0).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {editing.items.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {editing.items.map(it => (
                  <div key={it.serviceId} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 dark:bg-zinc-950/40 rounded-lg">
                    <span className="flex-1 min-w-0 text-xs font-bold text-pine dark:text-zinc-100 truncate">{it.name}</span>
                    <input type="number" min={1} value={it.quantity} onChange={e => setQty(it.serviceId, Number(e.target.value))} className="w-16 px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md text-sm font-bold text-center text-pine dark:text-zinc-100" />
                    <span className="text-[11px] text-slate-400 w-24 text-right">KES {(it.price * it.quantity).toLocaleString()}</span>
                    <button onClick={() => removeItem(it.serviceId)} className="p-1 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          </div>

          <div className="lg:col-span-2 space-y-5 lg:bg-slate-50/70 lg:dark:bg-zinc-950/40 lg:border lg:border-slate-200 lg:dark:border-zinc-800 lg:rounded-2xl lg:p-4">
          <div>
            <label className={labelCls}>Pricing</label>
            <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-max">
              {(['ITEMIZED', 'BATCH'] as BundlePricingMode[]).map(m => (
                <button key={m} onClick={() => setEditing({ ...editing, pricingMode: m })}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${editing.pricingMode === m ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>
                  {m === 'ITEMIZED' ? 'Sum of services' : 'Bundle price'}
                </button>
              ))}
            </div>
          </div>

          {editing.pricingMode === 'BATCH' && (
            <div><label className={labelCls}>Bundle price (KES)</label><input type="number" min="0" className={fieldCls} value={editing.batchPrice} onChange={e => setEditing({ ...editing, batchPrice: e.target.value })} /></div>
          )}

          <div><label className={labelCls}>Discount (KES)</label><input type="number" min="0" className={fieldCls} value={editing.discount} onChange={e => setEditing({ ...editing, discount: e.target.value })} placeholder="0" /></div>

          <div className="pt-1 border-t border-slate-200 dark:border-zinc-800">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-3">Sells for</p>
            <p className="text-3xl font-black text-pine dark:text-zinc-100 leading-tight">KES {draftPricing.after.toLocaleString()}</p>
            {draftPricing.sell !== draftPricing.after && <p className="text-[10px] text-slate-400 line-through">KES {draftPricing.sell.toLocaleString()}</p>}
          </div>
          </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditing(null)} disabled={saving} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50">Cancel</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-seafoam/90 active:scale-95 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />} {editing.id ? 'Save bundle' : 'Create bundle'}
            </button>
          </div>
        </div>
      ) : detail ? (
        /* ── Detail page ─────────────────────────────────────────────
           Everything the card has to leave out: each service, its
           quantity and unit price, and how the pricing mode arrives at
           the figure the client is actually charged. */
        <div className="space-y-4">
          <button
            onClick={() => setDetailId(null)}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-colors"
          >
            <ArrowLeft size={13} /> All bundles
          </button>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">{detail.name}</h2>
                  {!detail.isActive && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider">Inactive</span>
                  )}
                </div>
                {detail.description && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{detail.description}</p>}
              </div>
              <div className="flex gap-2">
                {pkg.edit && (
                  <button onClick={() => startEdit(detail)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800">
                    <Pencil size={12} /> Edit
                  </button>
                )}
                {pkg.delete && (
                  <button onClick={async () => { await remove(detail); setDetailId(null); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/40 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-6 gap-y-5 p-5 md:p-6">
              <div className="lg:col-span-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                  Services ({detail.items.length})
                </p>
                {detail.items.length === 0 ? (
                  <p className="text-xs text-slate-400">No services in this bundle.</p>
                ) : (
                  <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-zinc-950/40">
                        <tr>
                          <th className="px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Service</th>
                          <th className="px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 text-center w-16">Qty</th>
                          <th className="px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 text-right w-28">Unit</th>
                          <th className="px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 text-right w-28">Line</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map(i => (
                          <tr key={i.serviceId} className="border-t border-slate-100 dark:border-zinc-800">
                            <td className="px-3 py-2 text-xs font-bold text-pine dark:text-zinc-100">{i.name}</td>
                            <td className="px-3 py-2 text-xs text-slate-500 text-center">{i.quantity}</td>
                            <td className="px-3 py-2 text-xs text-slate-500 text-right">{Number(i.price).toLocaleString()}</td>
                            <td className="px-3 py-2 text-xs font-bold text-pine dark:text-zinc-100 text-right">{(Number(i.price) * i.quantity).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 bg-slate-50/70 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 self-start">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-3">Pricing</p>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-zinc-400">Mode</dt>
                    <dd className="font-bold text-pine dark:text-zinc-100">{detail.pricingMode === 'BATCH' ? 'Bundle price' : 'Sum of services'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-zinc-400">Subtotal</dt>
                    <dd className="font-bold text-pine dark:text-zinc-100">KES {detail.pricing.sell.toLocaleString()}</dd>
                  </div>
                  {detail.pricing.sell !== detail.pricing.sellAfterDiscount && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500 dark:text-zinc-400">Discount</dt>
                      <dd className="font-bold text-emerald-600 dark:text-emerald-400">
                        &minus; KES {(detail.pricing.sell - detail.pricing.sellAfterDiscount).toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sells for</p>
                  <p className="text-3xl font-black text-pine dark:text-zinc-100 leading-tight">KES {detail.pricing.sellAfterDiscount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="py-16"><LoadingSpinner size="lg" message="Loading bundles..." /></div>
      ) : bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <Layers size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-slate-400">No bundles yet</p>
          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Group services and set batch or itemized pricing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {bundles.map(b => (
            <button
              key={b.id}
              onClick={() => setDetailId(b.id)}
              className={`group text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-seafoam/50 hover:-translate-y-0.5 transition-all flex flex-col ${!b.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-pine dark:text-zinc-100 truncate group-hover:text-seafoam transition-colors">{b.name}</h3>
                  {b.description && <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{b.description}</p>}
                </div>
                <ChevronRight size={16} className="shrink-0 mt-1 text-slate-300 dark:text-zinc-600 group-hover:text-seafoam group-hover:translate-x-0.5 transition-all" />
              </div>

              <div className="flex flex-wrap gap-1.5 my-3">
                <span className="px-2 py-0.5 rounded-md bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-wider">
                  {b.items.length} service{b.items.length === 1 ? '' : 's'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase tracking-wider">
                  {b.pricingMode === 'BATCH' ? 'Bundle price' : 'Sum of services'}
                </span>
                {!b.isActive && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider">Inactive</span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 flex-1">
                {b.items.slice(0, 3).map(i => `${i.name}${i.quantity > 1 ? ` \u00d7${i.quantity}` : ''}`).join(' · ')}
                {b.items.length > 3 && ` · +${b.items.length - 3} more`}
              </p>

              <div className="flex items-baseline gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-xl font-black text-pine dark:text-zinc-100">KES {b.pricing.sellAfterDiscount.toLocaleString()}</span>
                {b.pricing.sell !== b.pricing.sellAfterDiscount && <span className="text-[11px] text-slate-400 line-through">KES {b.pricing.sell.toLocaleString()}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServiceBundlesView;
