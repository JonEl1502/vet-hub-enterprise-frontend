import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { supplierStockAPI, toast, type SupplierStockRow } from '../../../services';
import Modal from './Modal';

/** Branch to branch. Two ledger movements; one screen. */
const TransferStockModal: React.FC<{
  fromBranchId: string;
  branches: { id: string; name: string }[];
  products: SupplierStockRow[];
  onClose: () => void;
  onDone: () => void;
}> = ({ fromBranchId, branches, products, onClose, onDone }) => {
  const [toBranchId, setToBranchId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const from = branches.find((b) => b.id === fromBranchId);
  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const available = product?.quantity ?? 0;
  const asked = Number(quantity) || 0;
  // Checked here so the cashier sees it before they commit; the server checks
  // it again inside the transaction, which is the one that counts.
  const tooMuch = asked > available;

  const submit = async () => {
    if (!toBranchId) return toast.error('Choose the destination branch');
    if (!productId) return toast.error('Choose a product');
    if (asked <= 0) return toast.error('How many?');
    setBusy(true);
    try {
      const res = await supplierStockAPI.transfer({
        fromBranchId, toBranchId, supplierProductId: productId,
        quantity: asked, notes: notes.trim() || undefined,
      });
      toast.success(`Moved to ${res.data.result.to}`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Could not transfer that stock');
      setBusy(false);
    }
  };

  return (
    <Modal title="Transfer stock" onClose={onClose}>
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-zinc-400 mb-3">
        <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800">{from?.name ?? 'This branch'}</span>
        <ArrowRight size={14} className="text-slate-300" />
        <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} className="sup-input flex-1 !py-1.5">
          <option value="">Choose branch…</option>
          {branches.filter((b) => b.id !== fromBranchId).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <label className="sup-label">Product</label>
      <select value={productId} onChange={(e) => setProductId(e.target.value)} className="sup-input">
        <option value="">Choose a product…</option>
        {products.filter((p) => p.quantity > 0).map((p) => (
          <option key={p.id} value={p.id}>{p.name} — {p.quantity} {p.unit.toLowerCase()}</option>
        ))}
      </select>

      <label className="sup-label mt-3">Quantity</label>
      <input value={quantity} onChange={(e) => setQuantity(e.target.value)}
             inputMode="decimal" placeholder="0" className="sup-input" />
      {product && (
        <p className={`text-[11px] font-bold mt-1 ${tooMuch ? 'text-red-500' : 'text-slate-400'}`}>
          {tooMuch
            ? `Only ${available} ${product.unit.toLowerCase()} at ${from?.name ?? 'this branch'}`
            : `${available} ${product.unit.toLowerCase()} available`}
        </p>
      )}

      <label className="sup-label mt-3">Note (optional)</label>
      <input value={notes} onChange={(e) => setNotes(e.target.value)}
             placeholder="Why it's moving" className="sup-input" />

      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="sup-btn-ghost flex-1">Cancel</button>
        <button onClick={submit} disabled={busy || tooMuch} className="sup-btn flex-1">
          {busy ? 'Moving…' : 'Transfer'}
        </button>
      </div>
    </Modal>
  );
};

export default TransferStockModal;
