import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { supplierStockAPI, toast, type SupplierStockRow, type SupplierSource } from '../../../services';
import Modal from './Modal';

/**
 * Goods in.
 *
 * A batch number and expiry are OPTIONAL per line and prompted for anyway,
 * because for the half of an agrovet's shelf that expires — vaccines,
 * agrochemicals, medicated feed — a receipt without them is a recall you cannot
 * action later.
 */

interface Line {
  supplierProductId: string;
  quantity: string;
  costPrice: string;
  batchNumber: string;
  expiryDate: string;
}

const blank = (): Line => ({ supplierProductId: '', quantity: '', costPrice: '', batchNumber: '', expiryDate: '' });

const ReceiveStockModal: React.FC<{
  branchId: string;
  products: SupplierStockRow[];
  sources: SupplierSource[];
  onClose: () => void;
  onDone: () => void;
}> = ({ branchId, products, sources, onClose, onDone }) => {
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [sourceId, setSourceId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    const items = lines
      .filter((l) => l.supplierProductId && Number(l.quantity) > 0)
      .map((l) => ({
        supplierProductId: l.supplierProductId,
        quantity: Number(l.quantity),
        costPrice: l.costPrice ? Number(l.costPrice) : undefined,
        batchNumber: l.batchNumber.trim() || undefined,
        expiryDate: l.expiryDate || undefined,
      }));
    if (!items.length) return toast.error('Add at least one line with a quantity');

    setBusy(true);
    try {
      await supplierStockAPI.receive({ branchId, sourceId: sourceId || undefined, notes: notes.trim() || undefined, items });
      toast.success(`Received ${items.length} line${items.length === 1 ? '' : 's'}`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Could not receive that stock');
      setBusy(false);
    }
  };

  return (
    <Modal title="Receive stock" onClose={onClose} wide>
      <label className="sup-label">Received from</label>
      <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="sup-input mb-3">
        <option value="">Not recorded</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>{s.name} · {s.type.toLowerCase()}</option>
        ))}
      </select>

      <div className="space-y-2.5">
        {lines.map((l, i) => (
          <div key={i} className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 space-y-2">
            <div className="flex gap-2">
              <select
                value={l.supplierProductId}
                onChange={(e) => set(i, { supplierProductId: e.target.value })}
                className="sup-input flex-1"
              >
                <option value="">Choose a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
              {lines.length > 1 && (
                <button
                  onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                  className="px-2 text-slate-400 hover:text-red-500"
                  aria-label="Remove line"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })}
                     inputMode="decimal" placeholder="Quantity" className="sup-input" />
              <input value={l.costPrice} onChange={(e) => set(i, { costPrice: e.target.value })}
                     inputMode="decimal" placeholder="Unit cost" className="sup-input" />
              <input value={l.batchNumber} onChange={(e) => set(i, { batchNumber: e.target.value })}
                     placeholder="Batch no." className="sup-input" />
              <input value={l.expiryDate} onChange={(e) => set(i, { expiryDate: e.target.value })}
                     type="date" placeholder="Expiry" className="sup-input" />
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setLines((p) => [...p, blank()])} className="sup-btn-ghost mt-2.5">
        <Plus size={14} /> Add another line
      </button>

      <label className="sup-label mt-3">Note (optional)</label>
      <input value={notes} onChange={(e) => setNotes(e.target.value)}
             placeholder="Delivery note number, driver…" className="sup-input" />

      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="sup-btn-ghost flex-1">Cancel</button>
        <button onClick={submit} disabled={busy} className="sup-btn flex-1">
          {busy ? 'Receiving…' : 'Receive'}
        </button>
      </div>
    </Modal>
  );
};

export default ReceiveStockModal;
