import React, { useMemo, useRef, useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';

interface Props {
  /** Called with the picked service and the category it belongs to. */
  onAdd: (svc: { id: number; name: string; defaultPrice?: number | null }, categoryName: string) => void;
  /** Names already on the visit (lowercased match) — shown as added, not re-addable. */
  addedNames?: Set<string>;
  currency?: string;
  placeholder?: string;
  /**
   * Category names to bias the list toward when the box is empty (e.g. the
   * diagnostics panel shows Laboratory / Imaging first). Typing searches
   * EVERYTHING regardless — a service lands in its own category wherever it is
   * added from, which is the point: imaging adds imaging, surgery adds surgery.
   */
  suggestCategories?: string[];
  disabled?: boolean;
}

const MAX_RESULTS = 8;

/**
 * A small inline service search (user, 2026-07-29, replacing the right-side
 * "Add Services" drawer for in-panel adds).
 *
 * The drawer made adding one lab test a full-screen context switch through a
 * category catalogue. Here the user types, sees matches, clicks one, and it is
 * on the visit — the panel they were already looking at never leaves the
 * screen. The drawer still exists for browsing the whole catalogue by category;
 * this is the fast path, not a replacement for browsing.
 */
const InlineServiceSearch: React.FC<Props> = ({
  onAdd, addedNames, currency = 'KES', placeholder = 'Search a service to add…', suggestCategories, disabled,
}) => {
  const { categories, services } = useReferenceData();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const catName = (categoryId: number) => categories.find(c => c.id === categoryId)?.name || 'General';

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) {
      // Empty box: show the suggested categories' services so the control is
      // useful before a single keystroke.
      if (!suggestCategories?.length) return [];
      const wanted = suggestCategories.map(c => c.toLowerCase());
      return services
        .filter(s => wanted.some(w => catName(s.categoryId).toLowerCase().includes(w)))
        .slice(0, MAX_RESULTS);
    }
    return services
      .filter(s => s.name.toLowerCase().includes(query) || catName(s.categoryId).toLowerCase().includes(query))
      .slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, services, categories, suggestCategories]);

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

      {open && (results.length > 0 || q.trim()) && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl">
          {results.length === 0 ? (
            <p className="text-[10px] font-bold text-slate-400 text-center py-3">Nothing matches “{q.trim()}”.</p>
          ) : results.map(svc => {
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
        </div>
      )}
    </div>
  );
};

export default InlineServiceSearch;
