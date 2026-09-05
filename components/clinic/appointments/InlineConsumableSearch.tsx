import React from 'react';
import { Search, Package, Loader2, Globe } from 'lucide-react';
import { consumablesAPI, toast } from '../../../services';
import { useData } from '../../../contexts/DataContext';
import GlobalCatalogPicker from '../shared/GlobalCatalogPicker';

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
  /** The catalog fallback (287) — what "no match" offers instead of a full stop. */
  const [catalogFor, setCatalogFor] = React.useState<string | null>(null);
  React.useEffect(() => { ensureInventory?.(); }, [ensureInventory]);

  /**
   * Close on an outside click (user, 2026-08-18).
   *
   * The list rendered purely off `matches.length`, which is derived from the
   * query — so the ONLY way to dismiss it was to clear the text. It sat over
   * the running bill covering the lines underneath.
   *
   * ⚠️ `mousedown`, not `click`, and the option buttons use `onMouseDown` too —
   * a `click` listener here would fire after the option's own handler and race
   * it. Closing on mousedown while the target is inside the box is guarded by
   * the `contains` check, so picking an item still works.
   */
  const boxRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!q) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setQ('');
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [q]);

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
    <div className="relative" ref={boxRef}>
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
      {/* NOT a dead end any more (287). "No inventory match" used to be the
          whole answer, and the only way on was to leave the visit and create the
          product by hand — so in practice the item went unbilled. */}
      {q.trim().length >= 2 && matches.length === 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[10px] font-bold text-slate-400">Not on your shelf.</p>
          <button type="button" onMouseDown={() => setCatalogFor(q.trim())}
            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-seafoam hover:text-pine transition-colors">
            <Globe size={11} /> Search the catalog
          </button>
        </div>
      )}
      {catalogFor && (
        <GlobalCatalogPicker
          initialQuery={catalogFor}
          visitId={visitId}
          currency={currency}
          onAdded={() => { setQ(''); onAdded?.(); }}
          onClose={() => setCatalogFor(null)}
        />
      )}
    </div>
  );
};

export default InlineConsumableSearch;
