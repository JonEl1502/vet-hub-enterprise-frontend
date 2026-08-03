import React from 'react';
import { Search, Package, Loader2 } from 'lucide-react';
import { consumablesAPI, toast } from '../../../services';
import { useData } from '../../../contexts/DataContext';

/**
 * Inline consumable adder for the running-bill rail — the third arm of the
 * Add menu (service | consumable | procedure).
 *
 * Dispenses through `consumablesAPI.log`, the SAME call the Treatment step's
 * medications box uses, so stock moves and the charge lands by one code path
 * rather than two that can drift.
 */

interface Props {
  visitId: number | string;
  currency?: string;
  onAdded?: () => void;
}

const InlineConsumableSearch: React.FC<Props> = ({ visitId, currency = 'KES', onAdded }) => {
  const { inventory, ensureInventory } = useData() as any;
  const [q, setQ] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  React.useEffect(() => { ensureInventory?.(); }, [ensureInventory]);

  const matches = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [] as any[];
    return (inventory || [])
      .filter((it: any) => `${it.name} ${it.category ?? ''} ${it.sku ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [inventory, q]);

  const add = async (it: any) => {
    setBusyId(String(it.id));
    try {
      const r = await consumablesAPI.log(visitId, { inventoryItemId: String(it.id), quantity: 1 });
      if (r.success) { toast.success(`${it.name} added · stock deducted`); setQ(''); onAdded?.(); }
    } catch (e: any) { toast.error(e?.message || 'Could not add the item'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="relative">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        value={q} onChange={e => setQ(e.target.value)} autoFocus
        placeholder="Search inventory (2+ chars)…"
        className="w-full pl-8 pr-2 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
      />
      {matches.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl">
          {matches.map((it: any) => (
            <button
              key={it.id} type="button" disabled={busyId === String(it.id)}
              onMouseDown={() => add(it)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-seafoam/5 transition-all disabled:opacity-50 border-b border-slate-50 dark:border-zinc-800 last:border-0"
            >
              {busyId === String(it.id)
                ? <Loader2 size={11} className="animate-spin text-seafoam shrink-0" />
                : <Package size={11} className="text-seafoam shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{it.name}</span>
                <span className="block text-[9px] font-bold text-slate-400">{it.quantity} {it.unit} in stock</span>
              </span>
              <span className="shrink-0 text-[10px] font-black font-mono text-seafoam">
                {currency} {Number(it.price ?? 0).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
      {q.trim().length >= 2 && matches.length === 0 && (
        <p className="mt-1 text-[10px] font-bold text-slate-400">No inventory match for “{q.trim()}”.</p>
      )}
    </div>
  );
};

export default InlineConsumableSearch;
