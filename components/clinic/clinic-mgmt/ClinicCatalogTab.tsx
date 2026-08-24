import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw, Tags, Layers, Plus, Package, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import servicesAPI, { CatalogService, ServiceProduct } from '../../../services/modules/services.api';
import categoriesAPI, { CatalogCategory } from '../../../services/modules/categories.api';
import { useClinic } from '../../../contexts/ClinicContext';
import { useData } from '../../../contexts/DataContext';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import AddServiceModal from '../shared/AddServiceModal';
import ServiceBundlesView from '../inventory/ServiceBundlesView';
import QtyUnitControl, { sellUnitOf, costPerSellUnit } from '../shared/QtyUnitControl';
import { modulePerms } from '../../../constants/modulePermissions';
import { useAuth } from '../../../contexts/AuthContext';

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
  // Grouped page permissions (user, 2026-08-04) — the Services module.
  const { user } = useAuth();
  const svc = modulePerms(user, 'services');
  const { selectedClinics, updateClinic } = useClinic();
  const { inventory } = useData();
  const clinic = selectedClinics[0] ?? null;
  const scope = ((clinic as any)?.catalogScope ?? 'ALL') as 'ALL' | 'GENERAL' | 'CUSTOM';
  const currency = (clinic as any)?.currency || 'KES';

  // Which service the detail panel is open on (user, 2026-08-24: cards that
  // "open to view details"), + the attach-product query.
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const [services, setServices] = useState<CatalogService[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
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

  const save = async (id: string, payload: { enabled?: boolean; priceOverride?: number | null; products?: ServiceProduct[]; workflowScope?: string[] }) => {
    setSavingId(id);
    try {
      const result = await servicesAPI.upsertOverride(id, payload);
      setLocal(id, {
        enabled: result.enabled,
        priceOverride: result.priceOverride,
        priceEffective: result.priceOverride ?? services.find((s) => s.id === id)?.defaultPrice ?? null,
        products: result.products,
        workflowScope: result.workflowScope,
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
      // costPrice is per STOCK unit; qty & price are per SELL unit — convert
      // or a box-cost lands on a pair-qty line (the KES -435 gloves bug).
      cost += (it ? costPerSellUnit(it) : 0) * (Number(p.qty) || 0);
    }
    return { sub, cost, margin: sub - cost };
  };

  const productsOf = (id: string): ServiceProduct[] => services.find((s) => s.id === id)?.products ?? [];

  /** Read live off `services` so a save re-renders the open panel. */
  const detailService = useMemo(
    () => (detailFor ? services.find((s) => s.id === detailFor) ?? null : null),
    [detailFor, services],
  );

  // Esc closes the detail panel — a slide-over that only closes by mouse is a
  // trap for anyone working the catalog from the keyboard.
  useEffect(() => {
    if (!detailFor) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDetailFor(null); setQ(''); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailFor]);

  // ── Workflow-scope helpers ───────────────────────────────────────────────
  // Which workflow areas (category names) a service shows in. [] = general.
  const scopeOf = (id: string): string[] => services.find((s) => s.id === id)?.workflowScope ?? [];
  const toggleScope = (id: string, cat: string) => {
    const cur = scopeOf(id);
    const next = cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat];
    setLocal(id, { workflowScope: next });
    save(id, { workflowScope: next });
  };

  const addProduct = (id: string, item: any) => {
    const list = productsOf(id);
    if (list.some((p) => p.inventoryItemId === String(item.id))) { setQ(''); return; }
    // unit label = SELL unit — qty and price are denominated in it (§0f #8).
    const next = [...list, { inventoryItemId: String(item.id), name: item.name, qty: 1, unit: sellUnitOf(item) }];
    setLocal(id, { products: next });
    save(id, { products: next });
    setQ('');
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
          <div className={`flex items-center gap-2 mt-3 max-w-sm ${svc.create ? '' : 'hidden'}`}>
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100 shadow-sm flex items-center gap-1.5"
              title="Refresh catalog"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
            </button>
            {svc.create && (
              <button
                type="button"
                onClick={() => setShowAddService(true)}
                className="compact-button bg-seafoam hover:bg-seafoam/90 text-white shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Plus size={12} /> Add Service
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">{error}</div>
        )}

        {loading && services.length === 0 ? (
          <div className="py-16"><LoadingSpinner message="Loading catalog…" /></div>
        ) : (
          /* CARDS, NOT ROWS (user, 2026-08-24: "can we use cards n open to view
             details").

             The row packed six controls into a 12-column grid — name, default
             price, override input, attach button, toggle, save state — so the
             two things an owner scans for (is it on, what does it bill at) sat
             beside two things they edit rarely, and the attached products
             expanded INSIDE the list and pushed everything below them down.

             The card carries the scannable half and the ON switch, because
             switching a service on is the one action you want without opening
             anything. Everything you EDIT lives in the detail panel. */
          <div className="p-4 sm:p-5 space-y-5">
            {grouped.map(([cat, items]) => (
              <div key={cat} className="space-y-2">
                <p className="field-label !mb-0">{cat} · {items.length}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {items.map((s) => {
                    const overridden = s.priceOverride !== null && s.priceOverride !== undefined;
                    const justSaved = savedAt[s.id] && Date.now() - savedAt[s.id] < 1500;
                    const products = s.products ?? [];
                    const svcScope = s.workflowScope ?? [];
                    const math = productMath(products);
                    const basePrice = Number(s.priceEffective ?? s.defaultPrice ?? 0);
                    const billsAt = basePrice + math.sub;
                    return (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetailFor(s.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailFor(s.id); } }}
                        title="Open to set the price, attach products and choose where it shows"
                        className={`group text-left rounded-xl border p-3 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-seafoam/40 ${
                          s.enabled
                            ? 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:shadow-md'
                            : 'bg-slate-50/60 dark:bg-zinc-800/20 border-slate-100 dark:border-zinc-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-bold leading-snug ${s.enabled ? 'text-pine dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-600 line-through'}`}>
                              {s.name}
                            </p>
                            {s.description && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">{s.description}</p>
                            )}
                          </div>
                          {/* The switch stays ON the card and does not open it. */}
                          <label className="inline-flex items-center cursor-pointer select-none shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={s.enabled}
                              onChange={(e) => onToggle(s.id, e.target.checked)}
                              className="sr-only peer"
                            />
                            <span className="w-9 h-5 bg-slate-300 dark:bg-zinc-700 rounded-full relative transition-colors peer-checked:bg-seafoam after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
                          </label>
                        </div>

                        <div className="mt-2.5 flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Bills at</p>
                            <p className="text-base font-black font-mono text-pine dark:text-zinc-100 tabular-nums leading-tight">
                              {currency} {billsAt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                            {/* Only say what the card's headline figure hides. */}
                            {(overridden || math.sub > 0) && (
                              <p className="text-[9px] font-bold text-slate-400 truncate">
                                {overridden ? `overridden · default ${currency} ${Number(s.defaultPrice ?? 0).toLocaleString()}` : `service ${currency} ${basePrice.toLocaleString()}`}
                                {math.sub > 0 ? ` + products ${currency} ${math.sub.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {savingId === s.id && <Loader2 size={12} className="animate-spin text-seafoam" />}
                            {justSaved && savingId !== s.id && <span className="text-[9px] font-black text-emerald-500 uppercase">saved</span>}
                            {products.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-seafoam/10 border border-seafoam/30 text-seafoam text-[9px] font-black" title={`${products.length} product${products.length === 1 ? '' : 's'} auto-billed with this service`}>
                                <Package size={10} />{products.length}
                              </span>
                            )}
                            {svcScope.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-600 dark:text-violet-400 text-[9px] font-black" title={`Shows only in: ${svcScope.join(', ')}`}>
                                {svcScope.length} area{svcScope.length === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        </div>
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

      {/* Bundles — the third thing you can create here, same as Clinic
          Settings → Categories & Services. Groups services into a bundled or
          itemized price package. */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20"><Layers size={18} /></div>
          <div>
            <h2 className="section-header">Service Bundles</h2>
            <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5 tracking-widest">Group services into a bundled or itemized price package.</p>
          </div>
        </div>
        <ServiceBundlesView />
      </div>

      {/* ── Service detail (216 UI) ─────────────────────────────────────────
          Everything you EDIT about a service, in one place, instead of six
          controls squeezed into a list row. Opened from a card; a slide-over
          rather than a page so you keep your place in the catalog. */}
      {detailService && createPortal(
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={`${detailService.name} settings`}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => { setDetailFor(null); setQ(''); }} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {(() => {
              const d = detailService;
              const products = d.products ?? [];
              const svcScope = d.workflowScope ?? [];
              const math = productMath(products);
              const overridden = d.priceOverride !== null && d.priceOverride !== undefined;
              const basePrice = Number(d.priceEffective ?? d.defaultPrice ?? 0);
              const billsAt = basePrice + math.sub;
              return (
                <>
                  <header className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-start justify-between gap-3 bg-gradient-to-br from-pine to-pine/90 text-white">
                    <div className="min-w-0">
                      <p className="text-[8px] font-black uppercase tracking-widest text-white/60">{d.categoryName || 'Uncategorised'}</p>
                      <h3 className="text-sm font-black uppercase tracking-tight leading-snug">{d.name}</h3>
                      {d.description && <p className="text-[11px] text-white/70 mt-0.5">{d.description}</p>}
                    </div>
                    <button onClick={() => { setDetailFor(null); setQ(''); }} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all shrink-0"><X size={14} /></button>
                  </header>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
                    {/* Offered here, or not */}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Offered at this clinic</p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">{d.enabled ? 'Staff can add it to a visit.' : 'Hidden from every picker.'}</p>
                      </div>
                      <label className="inline-flex items-center cursor-pointer select-none shrink-0">
                        <input type="checkbox" checked={d.enabled} onChange={(e) => onToggle(d.id, e.target.checked)} className="sr-only peer" />
                        <span className="w-9 h-5 bg-slate-300 dark:bg-zinc-700 rounded-full relative transition-colors peer-checked:bg-seafoam after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
                      </label>
                    </div>

                    {/* Price */}
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Price</p>
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Default</p>
                          <p className="text-sm font-mono font-bold text-slate-400 tabular-nums">
                            {currency} {d.defaultPrice != null ? Number(d.defaultPrice).toLocaleString() : '—'}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="field-label" htmlFor="svc-price-override">This clinic charges</label>
                          <input
                            id="svc-price-override"
                            type="number" min="0" step="any"
                            value={d.priceOverride ?? ''}
                            placeholder={d.defaultPrice != null ? `${d.defaultPrice}` : 'price'}
                            onChange={(e) => onPriceChange(d.id, e.target.value)}
                            className={`field-input text-right ${overridden ? 'border-cyan-400' : ''}`}
                            disabled={!d.enabled}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">Leave it empty to charge the default.</p>
                    </div>

                    {/* Attached products */}
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Medicine &amp; consumables
                        <span className="ml-1.5 font-bold normal-case tracking-normal text-slate-400">— auto-billed and stock-deducted when this service is added</span>
                      </p>
                      {products.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {products.map((pr) => {
                            const it = invById.get(pr.inventoryItemId);
                            const stock = it ? `${Number(it.quantity)} ${it.unit || ''} in stock` : 'not in this clinic';
                            return (
                              <span key={pr.inventoryItemId} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full bg-seafoam/10 border border-seafoam/30 text-seafoam text-[10px] font-bold" title={stock}>
                                <Package size={10} className="shrink-0" />
                                <span className="truncate max-w-[150px]">{pr.name}</span>
                                {it ? (
                                  <QtyUnitControl compact item={it} value={Number(pr.qty) || 1}
                                    onChange={(sellQty) => setProductQty(d.id, pr.inventoryItemId, sellQty)} />
                                ) : (
                                  <>
                                    <input type="number" min={0} step="any" value={pr.qty}
                                      onChange={(e) => setProductQty(d.id, pr.inventoryItemId, Number(e.target.value))}
                                      className="w-11 bg-white dark:bg-zinc-900 border border-seafoam/30 rounded px-1 py-0.5 text-center text-pine dark:text-zinc-100 outline-none" />
                                    {pr.unit || ''}
                                  </>
                                )}
                                <button type="button" onClick={() => removeProduct(d.id, pr.inventoryItemId)} className="hover:text-red-500 p-0.5"><X size={11} /></button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inventory (2+ chars)…"
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-8 pr-2 py-1.5 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20" />
                      </div>
                      {invMatches.map((it: any) => (
                        <button key={it.id} type="button" onClick={() => addProduct(d.id, it)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800 hover:border-seafoam text-left transition-colors">
                          <Package size={11} className="text-seafoam shrink-0" />
                          <span className="flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{it.name}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{Number(it.quantity)} {it.unit} in stock</span>
                        </button>
                      ))}
                      {q.trim().length >= 2 && invMatches.length === 0 && (
                        <p className="text-[11px] text-slate-400 px-1 py-1">No inventory match. Add it under Products first.</p>
                      )}
                    </div>

                    {/* Where it shows */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Shows in workflows {svcScope.length === 0 && <span className="text-seafoam">· General (everywhere)</span>}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(categories.filter((c) => c.enabled).length ? categories.filter((c) => c.enabled) : categories).map((c) => {
                          const on = svcScope.includes(c.name);
                          return (
                            <button key={c.id} type="button" onClick={() => toggleScope(d.id, c.name)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${on ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam'}`}>
                              {on ? '✓ ' : ''}{c.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* What it actually bills — the answer the whole panel adds up to. */}
                  <footer className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bills at</span>
                      <span className="text-lg font-black font-mono text-pine dark:text-zinc-100 tabular-nums">
                        {currency} {billsAt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {math.sub > 0 && (
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-400">Service {currency} {basePrice.toLocaleString()} + products {currency} {math.sub.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        <span className={math.margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                          Product margin {math.margin >= 0 ? '+' : ''}{currency} {math.margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {savingId === d.id && <p className="text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Saving</p>}
                  </footer>
                </>
              );
            })()}
          </aside>
        </div>,
        document.body
      )}

      {showAddService && (
        <AddServiceModal
          categories={categories.map(c => ({ id: c.id, name: c.name }))}
          currency={currency}
          onClose={() => setShowAddService(false)}
          onCreated={() => load()}
        />
      )}
    </div>
  );
};

export default ClinicCatalogTab;
