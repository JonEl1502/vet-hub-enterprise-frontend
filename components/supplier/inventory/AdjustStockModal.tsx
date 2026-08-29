import React, { useState } from 'react';
import { supplierStockAPI, toast, type SupplierStockRow, type StockMovementType } from '../../../services';
import Modal from './Modal';

/**
 * Correcting a count.
 *
 * ⚠️ The REASON CODE is a real field, not decoration. Damage, expiry and a
 * plain miscount are three different business events, and a waste report has
 * nothing to group by if they all land as ADJUSTED.
 */
const REASONS: { type: StockMovementType; label: string; hint: string; sign: -1 | 0 }[] = [
  { type: 'DAMAGED', label: 'Damaged', hint: 'Broken, spoiled, water damage', sign: -1 },
  { type: 'EXPIRED', label: 'Expired', hint: 'Past its date, taken off the shelf', sign: -1 },
  { type: 'RETURNED', label: 'Returned to source', hint: 'Sent back upstream', sign: -1 },
  { type: 'ADJUSTED', label: 'Miscount', hint: 'The shelf and the system disagree', sign: 0 },
];

const AdjustStockModal: React.FC<{
  branchId: string;
  product: SupplierStockRow;
  onClose: () => void;
  onDone: () => void;
}> = ({ branchId, product, onClose, onDone }) => {
  const [type, setType] = useState<StockMovementType>('DAMAGED');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const chosen = REASONS.find((r) => r.type === type)!;
  const n = Number(amount) || 0;
  // Damage, expiry and returns only ever go DOWN; a miscount goes either way,
  // so it is the one case where the sign is the operator's to type.
  const delta = chosen.sign === -1 ? -Math.abs(n) : n;
  const after = product.quantity + delta;

  const submit = async () => {
    if (!n) return toast.error('How many?');
    if (!reason.trim()) return toast.error('Say what happened');
    setBusy(true);
    try {
      await supplierStockAPI.adjust({
        branchId, supplierProductId: product.id, delta,
        reason: reason.trim(), movementType: type,
      });
      toast.success('Stock adjusted');
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Could not adjust that stock');
      setBusy(false);
    }
  };

  return (
    <Modal title={`Adjust — ${product.name}`} onClose={onClose}>
      <p className="text-[11px] font-bold text-slate-400 mb-3">
        {product.quantity} {product.unit.toLowerCase()} on the shelf now
      </p>

      <label className="sup-label">What happened</label>
      <div className="grid grid-cols-2 gap-2">
        {REASONS.map((r) => (
          <button
            key={r.type}
            onClick={() => setType(r.type)}
            className={`text-left p-2.5 rounded-xl border transition-all ${
              type === r.type
                ? 'border-seafoam bg-seafoam/5'
                : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
            }`}
          >
            <p className="text-[11px] font-black text-pine dark:text-zinc-100">{r.label}</p>
            <p className="text-[9px] text-slate-400 font-semibold leading-tight mt-0.5">{r.hint}</p>
          </button>
        ))}
      </div>

      <label className="sup-label mt-3">
        {chosen.sign === -1 ? 'How many to remove' : 'Change (use − to reduce)'}
      </label>
      <input value={amount} onChange={(e) => setAmount(e.target.value)}
             inputMode="decimal" placeholder="0" className="sup-input" />

      {!!n && (
        <p className={`text-[11px] font-bold mt-1 ${after < 0 ? 'text-red-500' : 'text-slate-400'}`}>
          {after < 0
            ? `That would take the shelf below zero (${after})`
            : `${product.quantity} → ${after} ${product.unit.toLowerCase()}`}
        </p>
      )}

      <label className="sup-label mt-3">Reason</label>
      <input value={reason} onChange={(e) => setReason(e.target.value)}
             placeholder="e.g. two bags split in the store" className="sup-input" />
      <p className="text-[10px] text-slate-400 mt-1">
        Kept on the ledger against this change. An unexplained adjustment is the one that
        starts an argument at stock take.
      </p>

      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="sup-btn-ghost flex-1">Cancel</button>
        <button onClick={submit} disabled={busy || after < 0} className="sup-btn flex-1">
          {busy ? 'Saving…' : 'Adjust stock'}
        </button>
      </div>
    </Modal>
  );
};

export default AdjustStockModal;
