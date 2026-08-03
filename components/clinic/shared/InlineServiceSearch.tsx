import React, { useMemo, useRef, useState } from 'react';
import { Search, Plus, X, ClipboardList } from 'lucide-react';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';

/** The slice of a procedure template the search needs (full type in procedureTemplates.api). */
export interface SearchableProcedure {
  id: string;
  name: string;
  type?: string | null;
  estimatedTotal?: number;
}

interface Props {
  /** Called with the picked service and the category it belongs to. */
  onAdd: (svc: { id: number; name: string; defaultPrice?: number | null }, categoryName: string) => void;
  /** Names already on the visit (lowercased match) — shown as added, not re-addable. */
  addedNames?: Set<string>;
  currency?: string;
  placeholder?: string;
  /**
   * Deprecated (user, 2026-08-02: "no list before typing") — the empty box now
   * shows nothing for everyone. Kept so existing call sites keep compiling.
   */
  suggestCategories?: string[];
  /**
   * Procedure RECIPES to offer alongside services (user: "procedures + type
   * badge" in the diagnostics search). Picking one calls onAddProcedure — the
   * caller applies the recipe (fees + products land on the bill).
   */
  procedures?: SearchableProcedure[];
  onAddProcedure?: (p: SearchableProcedure) => void;
  disabled?: boolean;
  /** Restrict results to categories matching this pattern — e.g. /groom/i on
   * the grooming report card, where only grooming services make sense. */
  categoryFilter?: RegExp;
}

const MAX_RESULTS = 8;

/**
 * A small inline service search (user, 2026-07-29, replacing the right-side
 * "Add Services" drawer for in-panel adds).
 *
 * The drawer made adding one lab test a full-screen context switch through a
 * category catalogue. Here the user types, sees matches, clicks one, and it is
 * on the visit — the panel they were already looking at never leaves the
 * screen. Nothing lists until the user types (user, 2026-08-02) — the drawer
 * still exists for browsing the whole catalogue by category.
 */
const InlineServiceSearch: React.FC<Props> = ({
  onAdd, addedNames, currency = 'KES', placeholder = 'Search a service to add…', procedures, onAddProcedure, disabled, categoryFilter,
}) => {
  const { categories, services } = useReferenceData();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const catName = (categoryId: number) => categories.find(c => c.id === categoryId)?.name || 'General';

  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!query) return []; // no list before typing (user, 2026-08-02)
    return services
      .filter(s => !categoryFilter || categoryFilter.test(catName(s.categoryId)))
      .filter(s => s.name.toLowerCase().includes(query) || catName(s.categoryId).toLowerCase().includes(query))
      .slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, services, categories, categoryFilter]);

  const procResults = useMemo(() => {
    if (!query || !procedures?.length || !onAddProcedure) return [];
    return procedures
      .filter(p => p.name.toLowerCase().includes(query) || (p.type || '').toLowerCase().includes(query))
      .slice(0, MAX_RESULTS);
  }, [query, procedures, onAddProcedure]);

  if (disabled) return null;

  return (
    <div className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          // A click on a result fires after blur, so give it a beat to land.
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
          placeholder={placeholder}
          className="w-full pl-8 pr-7 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
        />
        {q && (
          <button type="button" onClick={() => { setQ(''); setOpen(true); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine">
            <X size={12} />
          </button>
        )}
      </div>

      {open && !!query && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl">
          {results.length === 0 && procResults.length === 0 ? (
            <p className="text-[10px] font-bold text-slate-400 text-center py-3">Nothing matches “{q.trim()}”.</p>
          ) : (
            <>
              {results.map(svc => {
                const cat = catName(svc.categoryId);
                const already = addedNames?.has(svc.name.trim().toLowerCase());
                return (
                  <button
                    key={svc.id}
                    type="button"
                    disabled={already}
                    onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}
                    onClick={() => {
                      if (already) return;
                      onAdd(svc as any, cat);
                      setQ('');
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-all border-b border-slate-50 dark:border-zinc-800 last:border-0 ${
                      already ? 'opacity-50 cursor-default' : 'hover:bg-seafoam/10'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate uppercase tracking-tight">{svc.name}</span>
                      <span className="block text-[9px] font-bold text-slate-400 truncate">{cat}</span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1.5">
                      <span className="text-seafoam font-black font-mono text-[10px]">
                        {currency} {Number(svc.defaultPrice ?? 0).toLocaleString()}
                      </span>
                      {already
                        ? <span className="text-[8px] font-black uppercase text-emerald-600">On visit</span>
                        : <Plus size={12} className="text-seafoam" />}
                    </span>
                  </button>
                );
              })}
              {/* Procedure recipes — badged with their TYPE so a "rabies" match
                  reads as the Vaccination recipe, not another lab test. */}
              {procResults.map(p => {
                const already = addedNames?.has(p.name.trim().toLowerCase());
                return (
                  <button
                    key={`proc-${p.id}`}
                    type="button"
                    disabled={already}
                    onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}
                    onClick={() => {
                      if (already) return;
                      onAddProcedure!(p);
                      setQ('');
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-all border-b border-slate-50 dark:border-zinc-800 last:border-0 ${
                      already ? 'opacity-50 cursor-default' : 'hover:bg-violet-50 dark:hover:bg-violet-950/20'
                    }`}
                  >
                    <span className="min-w-0 flex items-center gap-2">
                      <ClipboardList size={12} className="text-violet-500 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate uppercase tracking-tight">{p.name}</span>
                        <span className="block text-[9px] font-bold text-slate-400 truncate">Applies the whole recipe to this visit</span>
                      </span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1.5">
                      <span className="inline-flex px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[8px] font-black uppercase tracking-wider">
                        {p.type || 'Procedure'}
                      </span>
                      {p.estimatedTotal != null && (
                        <span className="text-slate-400 font-black font-mono text-[10px]">est. {Number(p.estimatedTotal).toLocaleString()}</span>
                      )}
                      {already
                        ? <span className="text-[8px] font-black uppercase text-emerald-600">On visit</span>
                        : <Plus size={12} className="text-violet-500" />}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default InlineServiceSearch;
