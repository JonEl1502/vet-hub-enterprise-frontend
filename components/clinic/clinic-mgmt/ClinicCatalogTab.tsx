import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Tags } from 'lucide-react';
import servicesAPI, { CatalogService } from '../../../services/modules/services.api';

/**
 * Per-clinic catalog: list of every approved global service plus this
 * clinic's own custom services, with a toggle for opt-in/out and a
 * price-override field. Saves are per-row, debounced — there's no big
 * "Save All" button.
 */
const ClinicCatalogTab: React.FC = () => {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const debounceTimers = useRef<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await servicesAPI.catalog();
      setServices(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
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

  const save = async (id: string, payload: { enabled?: boolean; priceOverride?: number | null }) => {
    setSavingId(id);
    try {
      const result = await servicesAPI.upsertOverride(id, payload);
      setLocal(id, {
        enabled: result.enabled,
        priceOverride: result.priceOverride,
        priceEffective: result.priceOverride ?? services.find((s) => s.id === id)?.defaultPrice ?? null,
      });
      setSavedAt((s) => ({ ...s, [id]: Date.now() }));
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSavingId(null);
    }
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
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500 text-white rounded-xl shadow-lg shadow-cyan-500/20"><Tags size={18}/></div>
            <div>
              <h2 className="section-header">Service Catalog</h2>
              <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5 tracking-widest">
                Toggle services and set per-clinic prices. Empty price = use default.
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
          <div className="py-16 text-center">
            <Loader2 size={28} className="animate-spin text-seafoam mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading catalog…</p>
          </div>
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
                    return (
                      <div key={s.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5">
                        <div className="col-span-12 sm:col-span-6 min-w-0">
                          <p className={`text-sm font-bold truncate ${s.enabled ? 'text-pine dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-600 line-through'}`}>
                            {s.name}
                          </p>
                          {s.description && (
                            <p className="text-[11px] text-slate-400 truncate">{s.description}</p>
                          )}
                        </div>
                        <div className="col-span-4 sm:col-span-2 text-right text-[11px] font-mono text-slate-400">
                          KES {s.defaultPrice != null ? Number(s.defaultPrice).toLocaleString() : '—'}
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
                        <div className="col-span-3 sm:col-span-1 flex items-center justify-end gap-2">
                          <label className="inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={s.enabled}
                              onChange={(e) => onToggle(s.id, e.target.checked)}
                              className="sr-only peer"
                            />
                            <span className="w-9 h-5 bg-slate-300 dark:bg-zinc-700 rounded-full relative transition-colors peer-checked:bg-seafoam after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
                          </label>
                          {savingId === s.id && <Loader2 size={12} className="animate-spin text-seafoam" />}
                          {justSaved && <span className="text-[10px] font-black text-emerald-500 uppercase">saved</span>}
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
    </div>
  );
};

export default ClinicCatalogTab;
