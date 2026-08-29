import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supplierStockAPI, toast, type SupplierStockRow } from '../../../services';
import Modal from './Modal';

/**
 * Counting the shelf.
 *
 * ⚠️ A blank box means NOT COUNTED, and is skipped. It does not mean zero.
 * Treating blanks as zero would let a half-finished count wipe every line
 * nobody reached — which is exactly how a stock take destroys an inventory
 * instead of correcting it. Zero has to be typed.
 */
const StockTakePanel: React.FC<{
  branchId: string;
  products: SupplierStockRow[];
  onClose: () => void;
  onDone: () => void;
}> = ({ branchId, products, onClose, onDone }) => {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      : products;
  }, [products, search]);

  const entered = Object.entries(counts).filter(([, v]) => v.trim() !== '');
  const discrepancies = entered.filter(([id, v]) => {
    const p = products.find((x) => x.id === id);
    return p && Number(v) !== p.quantity;
  });

  const submit = async () => {
    if (!entered.length) return toast.error('Nothing counted yet');
    setBusy(true);
    try {
      const res = await supplierStockAPI.stockTake({
        branchId,
        counts: entered.map(([id, v]) => ({ supplierProductId: id, counted: Number(v) })),
        notes: notes.trim() || undefined,
      });
      const n = res.data.changes.length;
      toast.success(n ? `${n} line${n === 1 ? '' : 's'} corrected` : 'Everything matched');
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the count');
      setBusy(false);
    }
  };

  return (
    <Modal title="Stock take" onClose={onClose} wide>
      <p className="text-[11px] font-bold text-slate-400 mb-3">
        Type what you actually counted. Leave a line blank if you did not reach it —
        blank is skipped, not zero.
      </p>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
               placeholder="Find a product" className="sup-input pl-9" />
      </div>

      <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-[45vh] overflow-y-auto">
        {visible.map((p) => {
          const v = counts[p.id] ?? '';
          const differs = v.trim() !== '' && Number(v) !== p.quantity;
          return (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 border-slate-100 dark:border-zinc-800">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">{p.name}</p>
                <p className="text-[9px] text-slate-400 font-semibold">
                  {p.sku} · system says {p.quantity} {p.unit.toLowerCase()}
                </p>
              </div>
              <input
                value={v}
                onChange={(e) => setCounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                inputMode="decimal"
                placeholder="—"
                className={`w-24 text-center text-xs font-black tabular-nums border rounded-lg px-2 py-1.5 bg-white dark:bg-zinc-900 ${
                  differs ? 'border-amber-400 text-amber-600' : 'border-slate-200 dark:border-zinc-800'
                }`}
              />
            </div>
          );
        })}
      </div>

      <label className="sup-label mt-3">Note (optional)</label>
      <input value={notes} onChange={(e) => setNotes(e.target.value)}
             placeholder="e.g. month-end count" className="sup-input" />

      <div className="flex items-center gap-2 mt-4">
        <p className="text-[11px] font-bold text-slate-400 flex-1">
          {entered.length} counted
          {discrepancies.length > 0 && (
            <span className="text-amber-600"> · {discrepancies.length} differ</span>
          )}
        </p>
        <button onClick={onClose} className="sup-btn-ghost">Cancel</button>
        <button onClick={submit} disabled={busy || !entered.length} className="sup-btn">
          {busy ? 'Saving…' : 'Save count'}
        </button>
      </div>
    </Modal>
  );
};

export default StockTakePanel;
