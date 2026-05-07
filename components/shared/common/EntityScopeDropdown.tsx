import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';

export interface ScopeItem {
  id: string;
  name: string;
  /** Small grey line under the name — e.g. category, email, role. */
  subtitle?: string;
}

interface Props {
  /** Singular label, e.g. "Supplier" or "Freelancer". Used in the trigger
   *  ("All Suppliers (3)" / "Acme Vet Supply") and the search placeholder. */
  label: string;
  items: ScopeItem[];
  loading?: boolean;
  /** localStorage key the selection persists under. The axios interceptor
   *  reads this to attach scope headers (X-Supplier-Ids etc.). */
  storageKey: string;
  /** Optional icon for the trigger button (defaults to none). */
  icon?: React.ReactNode;
  className?: string;
}

const readSelection = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const writeSelection = (key: string, ids: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch {}
};

/**
 * Inline searchable scope dropdown. Pick one entity (or "all") and the
 * page reloads so every open view re-fetches with the new scope headers.
 * Mirrors the sidebar's ClinicSearchDropdown but is page-mountable for
 * supplier / freelancer / future entity scopes.
 */
const EntityScopeDropdown: React.FC<Props> = ({
  label, items, loading = false, storageKey, icon, className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(() => readSelection(storageKey));
  const ref = useRef<HTMLDivElement>(null);

  // Sync selection if external changes touch localStorage (other tabs etc).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setSelectedIds(readSelection(storageKey));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => { if (!isOpen) setQuery(''); }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name?.toLowerCase().includes(q) ||
      (i.subtitle || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  const reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  const isAll = items.length > 0 && selectedIds.length === 0; // empty selection = "all" by interceptor convention
  const isExplicitAll = items.length > 0 && selectedIds.length === items.length;
  const triggerLabel = (isAll || isExplicitAll)
    ? `All ${label.toLowerCase()}s (${items.length})`
    : selectedIds.length === 1
      ? items.find(i => i.id === selectedIds[0])?.name || `Select ${label.toLowerCase()}`
      : `${selectedIds.length} ${label.toLowerCase()}s`;

  const pickSingle = (id: string) => {
    writeSelection(storageKey, [id]);
    setSelectedIds([id]);
    setIsOpen(false);
    reload();
  };

  const clearScope = () => {
    // Empty array = "all" (interceptor sends no header).
    writeSelection(storageKey, []);
    setSelectedIds([]);
    setIsOpen(false);
    reload();
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-seafoam rounded-xl text-left transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon ?? null}
          <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 truncate">
            {triggerLabel}
          </span>
        </div>
        <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-[320px] top-full mt-1 z-[200] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100 dark:border-zinc-800">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}s…`}
                autoFocus
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg pl-7 pr-7 py-1.5 text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30 placeholder:text-slate-400"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* "All" shortcut */}
          <button
            onClick={clearScope}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
              isAll
                ? 'bg-seafoam/10 text-seafoam'
                : 'text-pine dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-widest">All {label.toLowerCase()}s ({items.length})</span>
            {isAll && <Check size={12} />}
          </button>

          {/* List */}
          <div className="max-h-72 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="px-3 py-4 flex items-center justify-center text-slate-400">
                <Loader2 size={14} className="animate-spin mr-2" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Loading…</span>
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                No matches
              </p>
            ) : (
              filtered.map(item => {
                const isSelected = selectedIds.length === 1 && selectedIds[0] === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => pickSingle(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-t border-slate-50 dark:border-zinc-800/50 ${
                      isSelected
                        ? 'bg-seafoam/10'
                        : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-black truncate ${isSelected ? 'text-seafoam' : 'text-pine dark:text-zinc-100'}`}>{item.name}</p>
                      {item.subtitle && (
                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 truncate">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check size={12} className="text-seafoam shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityScopeDropdown;
