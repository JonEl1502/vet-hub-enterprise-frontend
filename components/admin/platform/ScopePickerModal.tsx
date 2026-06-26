import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Loader2, ChevronRight } from 'lucide-react';

export interface PickItem {
  id: string;
  name: string;
  sub?: string | null;
  logo?: string | null;
}

/**
 * Generic search-and-select overlay used by the platform dashboard to drill
 * from an aggregate KPI card into a single clinic or supplier. The caller
 * supplies a `loader` (local list or API fetch) and an `onSelect` that wires
 * the chosen entity into scope (selectClinic / setManagedSupplier) and flips
 * the dashboard view.
 */
const ScopePickerModal: React.FC<{
  title: string;
  placeholder?: string;
  loader: () => Promise<PickItem[]>;
  onSelect: (item: PickItem) => void;
  onClose: () => void;
}> = ({ title, placeholder, loader, onSelect, onClose }) => {
  const [items, setItems] = useState<PickItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await loader();
        if (alive) setItems(rows);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // loader identity is stable per open; intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name.toLowerCase().includes(q) || (i.sub || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-5 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-pine shrink-0"><X size={18} /></button>
        </div>

        <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder || 'Search…'}
              className="field-input w-full pl-9"
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="animate-spin" size={20} /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-16 text-sm text-slate-400 dark:text-zinc-500">No matches.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filtered.map(item => (
                <li key={item.id}>
                  <button
                    onClick={() => { onSelect(item); onClose(); }}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
                  >
                    <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-base shrink-0 overflow-hidden">
                      {item.logo || item.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-pine dark:text-zinc-100 truncate">{item.name}</span>
                      {item.sub && <span className="block text-[11px] text-slate-400 dark:text-zinc-500 truncate">{item.sub}</span>}
                    </span>
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScopePickerModal;
