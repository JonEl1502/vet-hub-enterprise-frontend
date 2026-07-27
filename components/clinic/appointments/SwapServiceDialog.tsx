import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X, Loader2, ArrowRightLeft, AlertTriangle, Package, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { visitsAPI, servicesAPI } from '../../../services';
import { useData } from '../../../contexts/DataContext';

/**
 * Change the item behind a visit line — Bordetella → Rabies — without
 * deleting the line.
 *
 * Deleting and re-adding loses the assigned staff, the price and any note
 * already on the card, which is why vets were reluctant to correct a mistake.
 * The server carries stock, billing, the follow-up date and the species check
 * across; this dialog is just the picker, and it surfaces whatever the server
 * warns about afterwards.
 */

interface Props {
  visitId: number;
  taskId: number;
  currentName: string;
  category: string;
  onClose: () => void;
  onSwapped: () => void;
}

const SwapServiceDialog: React.FC<Props> = ({ visitId, taskId, currentName, category, onClose, onSwapped }) => {
  const { inventory } = useData();
  const [q, setQ] = useState('');
  const [catalog, setCatalog] = useState<{ id: string; name: string; categoryName?: string; priceEffective?: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    servicesAPI.catalog()
      .then(list => { if (live) setCatalog(list.map(c => ({ id: c.id, name: c.name, categoryName: c.categoryName, priceEffective: c.priceEffective }))); })
      .catch(() => { /* inventory alone is still a usable picker */ })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  // Only same-category options are offered: the server refuses a cross-category
  // swap, because the category decides what the line means and which module
  // record hangs off it. Showing them would be offering a dead end.
  const sameCategory = useCallback(
    (c?: string | null) => (c || '').trim().toLowerCase() === (category || '').trim().toLowerCase(),
    [category],
  );

  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const services = catalog
      .filter(c => sameCategory(c.categoryName))
      .map(c => ({ kind: 'service' as const, id: c.id, name: c.name, sub: c.categoryName, price: c.priceEffective ?? null }));
    const products = (inventory || [])
      .filter(i => sameCategory((i as any).category))
      .map(i => ({ kind: 'product' as const, id: String(i.id), name: i.name, sub: (i as any).category, price: Number((i as any).price ?? 0) }));
    const all = [...services, ...products].filter(o => o.name.toLowerCase() !== currentName.toLowerCase());
    if (!needle) return all.slice(0, 20);
    return all.filter(o => o.name.toLowerCase().includes(needle)).slice(0, 20);
  }, [q, catalog, inventory, sameCategory, currentName]);

  const swap = async (opt: { kind: 'service' | 'product'; id: string; name: string; price: number | null }) => {
    setSaving(true);
    try {
      const res = await visitsAPI.swapTaskItem(visitId, taskId, {
        ...(opt.kind === 'service' ? { serviceId: opt.id } : { inventoryItemId: opt.id }),
        ...(opt.price != null ? { price: opt.price } : {}),
      });
      if (res.success) {
        const warnings = res.data?.warnings || [];
        toast.success(`Changed to ${opt.name}`);
        // Warnings are advisory by design — a species mismatch never blocks the
        // swap, and the cleared next-dose date needs a human to re-enter it.
        warnings.forEach(w => toast(w, { icon: '⚠️', duration: 7000 }));
        onSwapped();
        onClose();
      } else {
        toast.error(res.message || 'Could not change the service');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not change the service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2">
          <ArrowRightLeft size={14} className="text-seafoam" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">Change service</p>
            <p className="text-[10px] text-slate-400 truncate">Replacing <strong>{currentName}</strong> · {category}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
          <Search size={13} className="text-slate-400 shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-[12px] font-bold text-pine dark:text-zinc-100 outline-none placeholder:font-medium placeholder:text-slate-400"
            placeholder={`Search ${category.toLowerCase()}…`}
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {(loading || saving) && <Loader2 size={13} className="animate-spin text-slate-400" />}
        </div>

        <div className="max-h-72 overflow-y-auto">
          {options.map(o => (
            <button
              key={`${o.kind}-${o.id}`}
              disabled={saving}
              onClick={() => swap(o)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-slate-100 dark:border-zinc-800/60 last:border-0 hover:bg-seafoam/5 disabled:opacity-50 transition-colors"
            >
              {o.kind === 'product' ? <Package size={12} className="text-slate-400 shrink-0" /> : <Stethoscope size={12} className="text-slate-400 shrink-0" />}
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] font-bold text-pine dark:text-zinc-100 truncate">{o.name}</span>
                {o.sub && <span className="block text-[9px] text-slate-400 truncate">{o.sub}</span>}
              </span>
              {o.price != null && <span className="text-[10px] font-black text-slate-500 shrink-0">{o.price.toLocaleString()}</span>}
            </button>
          ))}
          {!loading && !options.length && (
            <p className="px-3 py-6 text-[11px] text-slate-400 text-center">
              Nothing else in {category}. A line can only be swapped within its own category —
              remove it and add the new one if the category really changes.
            </p>
          )}
        </div>

        <div className="px-3 py-2.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/40">
          <p className="flex items-start gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />
            Staff, notes and any linked record stay on the line. If a dose was already drawn it
            goes back to stock, and the next-dose date is cleared — set it again for the new vaccine.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SwapServiceDialog;
