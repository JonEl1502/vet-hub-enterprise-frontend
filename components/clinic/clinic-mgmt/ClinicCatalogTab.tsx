import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Tags, Layers, Plus, Package, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import servicesAPI, { CatalogService, ServiceProduct } from '../../../services/modules/services.api';
import categoriesAPI, { CatalogCategory } from '../../../services/modules/categories.api';
import { useClinic } from '../../../contexts/ClinicContext';
import { useData } from '../../../contexts/DataContext';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

const SCOPES: { value: 'ALL' | 'GENERAL' | 'CUSTOM'; label: string; hint: string }[] = [
  { value: 'ALL', label: 'All', hint: 'General + custom' },
  { value: 'GENERAL', label: 'General only', hint: 'Approved global catalog' },
  { value: 'CUSTOM', label: 'Custom only', hint: 'Your selected + custom' },
];

/**
 * Per-clinic catalog: list of every approved global service plus this
 * clinic's own custom services, with a toggle for opt-in/out and a
 * price-override field. Saves are per-row, debounced — there's no big
 * "Save All" button.
 */
const ClinicCatalogTab: React.FC = () => {
  const { selectedClinics, updateClinic } = useClinic();
  const { inventory } = useData();
  const clinic = selectedClinics[0] ?? null;
  const scope = ((clinic as any)?.catalogScope ?? 'ALL') as 'ALL' | 'GENERAL' | 'CUSTOM';
  const currency = (clinic as any)?.currency || 'KES';

  // Which service row has its attach-product search open, + the query.
  const [attachFor, setAttachFor] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const [services, setServices] = useState<CatalogService[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const debounceTimers = useRef<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, cats] = await Promise.all([servicesAPI.catalog(), categoriesAPI.catalog().catch(() => [])]);
      setServices(list);
      setCategories(cats);
    } catch (e: any) {
      setError(e?.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  const setScope = async (next: 'ALL' | 'GENERAL' | 'CUSTOM') => {
    if (!clinic) return;
    try { await updateClinic(clinic.id, { catalogScope: next } as any); }
    catch (e: any) { toast.error(e?.message || 'Failed to set scope'); }
  };

  const toggleCategory = async (c: CatalogCategory) => {
    setCategories(prev => prev.map(x => x.id === c.id ? { ...x, enabled: !x.enabled } : x));
    try { await categoriesAPI.setEnabled(c.id, !c.enabled); }
    catch (e: any) { toast.error(e?.message || 'Failed to update'); load(); }
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    setAddingCat(true);
    try { await categoriesAPI.create({ name: newCat.trim() }); setNewCat(''); toast.success('Category added'); await load(); }
    catch (e: any) { toast.error(e?.message || 'Failed to add category'); }
    finally { setAddingCat(false); }
  };

  useEffect(() => {
    load();
    return () => {
      Object.values(debounceTimers.current).forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, CatalogService[]>();
    for (const s of services) {
      const key = s.categoryName || 'Uncategorised';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [services]);

  const setLocal = (id: string, patch: Partial<CatalogService>) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const save = async (id: string, payload: { enabled?: boolean; priceOverride?: number | null; products?: ServiceProduct[] }) => {
    setSavingId(id);
    try {
      const result = await servicesAPI.upsertOverride(id, payload);
      setLocal(id, {
        enabled: result.enabled,
        priceOverride: result.priceOverride,
        priceEffective: result.priceOverride ?? services.find((s) => s.id === id)?.defaultPrice ?? null,
        products: result.products,
      });
      setSavedAt((s) => ({ ...s, [id]: Date.now() }));
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  // ── Attached-product helpers ─────────────────────────────────────────────
  const invById = useMemo(() => {
    const m = new Map<string, any>();
    (inventory || []).forEach((it: any) => m.set(String(it.id), it));
    return m;
  }, [inventory]);

  const invMatches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [] as any[];
    return (inventory || [])
      .filter((it: any) => `${it.name} ${it.category ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [inventory, q]);

  // Product sell/cost math for a service's attached list (owner margin).
  const productMath = (products?: ServiceProduct[]) => {
    let sub = 0, cost = 0;
    for (const p of products || []) {
      const it = invById.get(p.inventoryItemId);
      sub += Number(it?.price ?? 0) * (Number(p.qty) || 0);
      cost += Number(it?.costPrice ?? 0) * (Number(p.qty) || 0);
    }
    return { sub, cost, margin: sub - cost };
  };

  const productsOf = (id: string): ServiceProduct[] => services.find((s) => s.id === id)?.products ?? [];

  const addProduct = (id: string, item: any) => {
    const list = productsOf(id);
    if (list.some((p) => p.inventoryItemId === String(item.id))) { setAttachFor(null); setQ(''); return; }
    const next = [...list, { inventoryItemId: String(item.id), name: item.name, qty: 1, unit: item.unit }];
    setLocal(id, { products: next });
    save(id, { products: next });
    setAttachFor(null); setQ('');
  };

  const removeProduct = (id: string, invId: string) => {
    const next = productsOf(id).filter((p) => p.inventoryItemId !== invId);
    setLocal(id, { products: next });
    save(id, { products: next });
  };

  const setProductQty = (id: string, invId: string, qty: number) => {
    const next = productsOf(id).map((p) => (p.inventoryItemId === invId ? { ...p, qty: qty > 0 ? qty : 1 } : p));
    setLocal(id, { products: next });
    const key = `prod:${id}`;
    if (debounceTimers.current[key]) window.clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = window.setTimeout(() => save(id, { products: next }), 500);
  };

  const onToggle = (id: string, enabled: boolean) => {
    setLocal(id, { enabled });
    if (debounceTimers.current[id]) window.clearTimeout(debounceTimers.current[id]);
    save(id, { enabled });
  };

  const onPriceChange = (id: string, raw: string) => {
    // Empty string clears the override (revert to default).
    const trimmed = raw.trim();
    const next = trimmed === '' ? null : Number(trimmed);
    setLocal(id, { priceOverride: next, priceEffective: next ?? services.find((s) => s.id === id)?.defaultPrice ?? null });
    if (debounceTimers.current[id]) window.clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = window.setTimeout(() => {
      save(id, { priceOverride: next });
    }, 500);
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-4">
      {/* Catalog scope + categories */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-500/20"><Layers size={18} /></div>
          <div>
            <h2 className="section-header">Catalog scope & categories</h2>
            <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5 tracking-widest">Choose which catalog staff pick from, and select your categories.</p>
          </div>
        </div>

        {/* Scope switch */}
        <div className="flex flex-wrap gap-2">
          {SCOPES.map(s => (
            <button key={s.value} onClick={() => setScope(s.value)}
              className={`px-3 py-2 rounded-xl text-left border transition-all ${scope === s.value ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-seafoam'}`}>
              <span className="block text-[10px] font-black uppercase tracking-widest">{s.label}</span>
              <span className={`block text-[9px] ${scope === s.value ? 'text-white/80' : 'text-slate-400'}`}>{s.hint}</span>
            </button>
          ))}
        </div>

        {/* Categories — select / unselect + add custom */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map(c => (
              <button key={c.id} onClick={() => toggleCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${c.enabled ? 'bg-seafoam/10 text-seafoam border-seafoam/40' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}
                title={c.isGlobal ? 'General category' : 'Custom category'}>
                {c.enabled ? '✓ ' : ''}{c.name}{c.isGlobal ? '' : ' ·'}
              </button>
            ))}
            {categories.length === 0 && <span className="text-[11px] text-slate-400">No categories yet.</span>}
          </div>
          <div className="flex items-center gap-2 mt-3 max-w-sm">
            <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCategory(); }} placeholder="Add a custom category…"
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
            <button onClick={addCategory} disabled={addingCat || !newCat.trim()} className="flex items-center gap-1.5 px-3 py-2 bg-pine text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
              {addingCat ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500 text-white rounded-xl shadow-lg shadow-cyan-500/20"><Tags size={18}/></div>
            <div>
              <h2 className="section-header">Service Catalog</h2>
              <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5 tracking-widest">
                Toggle services, set per-clinic prices, and attach medicine/consumables (📦) that auto-bill & deduct stock on the visit.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100 shadow-sm flex items-center gap-1.5"
            title="Refresh catalog"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">{error}</div>
        )}

        {loading && services.length === 0 ? (
          <div className="py-16"><LoadingSpinner message="Loading catalog…" /></div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <div className="px-4 py-2 bg-slate-50 dark:bg-zinc-800/50">
                  <p className="field-label !mb-0">{cat} · {items.length}</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {items.map((s) => {
                    const overridden = s.priceOverride !== null && s.priceOverride !== undefined;
                    const justSaved = savedAt[s.id] && Date.now() - savedAt[s.id] < 1500;
                    const products = s.products ?? [];
                    const isAttachOpen = attachFor === s.id;
                    const math = productMath(products);
                    const basePrice = Number(s.priceEffective ?? s.defaultPrice ?? 0);
                    const billsAt = basePrice + math.sub;
                    return (
                      <div key={s.id} className={products.length > 0 || isAttachOpen ? 'bg-slate-50/40 dark:bg-zinc-800/20' : ''}>
                        <div className="grid grid-cols-12 gap-2 items-center px-4 py-2.5">
                          <div className="col-span-12 sm:col-span-5 min-w-0">
                            <p className={`text-sm font-bold truncate ${s.enabled ? 'text-pine dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-600 line-through'}`}>
                              {s.name}
                            </p>
                            {s.description && (
                              <p className="text-[11px] text-slate-400 truncate">{s.description}</p>
                            )}
                          </div>
                          <div className="col-span-4 sm:col-span-2 text-right text-[11px] font-mono text-slate-400">
                            {currency} {s.defaultPrice != null ? Number(s.defaultPrice).toLocaleString() : '—'}
                            <span className="block text-[8px] uppercase tracking-widest">default</span>
                          </div>
                          <div className="col-span-5 sm:col-span-3">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={s.priceOverride ?? ''}
                              placeholder={s.defaultPrice != null ? `${s.defaultPrice}` : 'price'}
                              onChange={(e) => onPriceChange(s.id, e.target.value)}
                              className={`field-input text-right ${overridden ? 'border-cyan-400' : ''}`}
                              disabled={!s.enabled}
                            />
                          </div>
                          <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                            {/* Attach medicine/consumables (box button) */}
                            <button
                              type="button"
                              onClick={() => { setAttachFor(isAttachOpen ? null : s.id); setQ(''); }}
                              title="Attach medicine / consumables — auto-billed & stock-deducted when this service is added to a visit"
                              className={`relative p-1.5 rounded-lg border transition-all ${(products.length > 0 || isAttachOpen) ? 'bg-seafoam text-white border-seafoam' : 'border-slate-200 dark:border-zinc-700 text-slate-400 hover:border-seafoam hover:text-seafoam'}`}
                            >
                              <Package size={13} />
                              {products.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[8px] font-black flex items-center justify-center">{products.length}</span>
                              )}
                            </button>
                            <label className="inline-flex items-center cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={s.enabled}
                                onChange={(e) => onToggle(s.id, e.target.checked)}
                                className="sr-only peer"
                              />
                              <span className="w-9 h-5 bg-slate-300 dark:bg-zinc-700 rounded-full relative transition-colors peer-checked:bg-seafoam after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
                            </label>
                            {savingId === s.id && <Loader2 size={12} className="animate-spin text-seafoam shrink-0" />}
                            {justSaved && savingId !== s.id && <span className="text-[9px] font-black text-emerald-500 uppercase shrink-0">saved</span>}
                          </div>
                        </div>

                        {/* Attached products panel — chips + search + bills-at/margin */}
                        {(products.length > 0 || isAttachOpen) && (
                          <div className="px-4 pb-3 -mt-0.5 space-y-2">
                            {products.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {products.map((p) => {
                                  const it = invById.get(p.inventoryItemId);
                                  const stock = it ? `${Number(it.quantity)} ${it.unit || ''} in stock` : 'not in this clinic';
                                  return (
                                    <span key={p.inventoryItemId} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full bg-seafoam/10 border border-seafoam/30 text-seafoam text-[10px] font-bold" title={stock}>
                                      <Package size={10} className="shrink-0" />
                                      <span className="truncate max-w-[180px]">{p.name}</span>
                                      <input
                                        type="number" min={0} step="any" value={p.qty}
                                        onChange={(e) => setProductQty(s.id, p.inventoryItemId, Number(e.target.value))}
                                        className="w-11 bg-white dark:bg-zinc-900 border border-seafoam/30 rounded px-1 py-0.5 text-center text-pine dark:text-zinc-100 outline-none"
                                        title="Quantity logged when this service is added"
                                      />
                                      {p.unit || ''}
                                      <button type="button" onClick={() => removeProduct(s.id, p.inventoryItemId)} className="hover:text-red-500 p-0.5"><X size={11} /></button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Bills-at + owner margin — "price updates with the quantity added" */}
                            {products.length > 0 && (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold">
                                <span className="text-slate-400 dark:text-zinc-500">Service {currency} {basePrice.toLocaleString()} + products {currency} {math.sub.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                <span className="text-pine dark:text-zinc-100 font-black">Bills at {currency} {billsAt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                <span className={`${math.margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'} font-black`}>
                                  Product margin {math.margin >= 0 ? '+' : ''}{currency} {math.margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}

                            {/* Inline inventory search */}
                            {isAttachOpen && (
                              <div className="space-y-1 max-w-md">
                                <div className="relative">
                                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input
                                    autoFocus
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search inventory (2+ chars)…"
                                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-8 pr-2 py-1.5 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                                  />
                                </div>
                                {invMatches.map((it: any) => (
                                  <button
                                    key={it.id}
                                    type="button"
                                    onClick={() => addProduct(s.id, it)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800 hover:border-seafoam text-left transition-colors"
                                  >
                                    <Package size={11} className="text-seafoam shrink-0" />
                                    <span className="flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{it.name}</span>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{Number(it.quantity)} {it.unit} in stock</span>
                                  </button>
                                ))}
                                {q.trim().length >= 2 && invMatches.length === 0 && (
                                  <p className="text-[11px] text-slate-400 px-1 py-1">No inventory match. Add it under Products first.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!loading && grouped.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-sm font-bold text-slate-500">No services in the catalog yet.</p>
                <p className="text-xs text-slate-400 mt-1">Run scripts/seed-catalog.js to seed defaults.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicCatalogTab;
