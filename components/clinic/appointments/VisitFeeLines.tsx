import React from 'react';
import { Receipt, Trash2, Loader2, Check, Pencil } from 'lucide-react';
import { billsAPI, toast } from '../../../services';
import { Bill, BillLine } from '../../../services/modules/bills.api';

/**
 * Service charges on this visit — injection / administration / prescription
 * fees added alongside a dispensed item, editable and removable here.
 *
 * These come from the item's own `metadata.fees`, which the product form and
 * the CSV importer have always written but **nothing ever charged** (user,
 * 2026-08-03: "if it has injection fee administration then show here, allow to
 * edit n delete"). Each fee is its OWN bill line precisely so it can be
 * repriced or waived without touching the product it came with.
 */

interface Props {
  visitId: number | string;
  currency: string;
  /** Bumped by the parent after a dispense, so newly-added fees appear. */
  refreshKey?: number;
  onChanged?: () => void;
}

const FEE_HINT = /fee|charge/i;

const VisitFeeLines: React.FC<Props> = ({ visitId, currency, refreshKey = 0, onChanged }) => {
  const [bill, setBill] = React.useState<Bill | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draftPrice, setDraftPrice] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    // ⚠️ GET /visits/:id/bill RAISES a draft bill as a side effect. That is
    // acceptable here — the fee lines we render only exist on a bill anyway.
    billsAPI.get(visitId, { silent: true } as any)
      .then((r: any) => { if (r?.success && r.data?.bill) setBill(r.data.bill); })
      .catch(() => { /* panel just hides */ })
      .finally(() => setLoading(false));
  }, [visitId]);

  React.useEffect(() => { load(); }, [load, refreshKey]);

  const fees: BillLine[] = (bill?.lines || []).filter(
    l => String(l.category || '') === 'Fees' || FEE_HINT.test(String(l.name || '')));

  if (loading || fees.length === 0) return null;
  const locked = !bill?.editable;

  const save = async (line: BillLine) => {
    const price = Number(draftPrice);
    if (!Number.isFinite(price) || price < 0) { toast.error('Enter a valid amount'); return; }
    setBusyId(line.id);
    try {
      const r = await billsAPI.updateLine(visitId, line.id, { unitPrice: price } as any);
      if (r.success && r.data?.bill) { setBill(r.data.bill); setEditing(null); onChanged?.(); toast.success('Fee updated'); }
    } catch (e: any) { toast.error(e?.message || 'Could not update the fee'); }
    finally { setBusyId(null); }
  };

  const remove = async (line: BillLine) => {
    setBusyId(line.id);
    try {
      const r = await billsAPI.removeLine(visitId, line.id, true);
      if (r.success) { toast.success('Fee removed'); load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Could not remove the fee'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-2 mb-3">
        <Receipt size={14} className="text-seafoam" />
        <div className="min-w-0">
          <h4 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Service charges</h4>
          <p className="text-[10px] font-bold text-slate-400">
            {locked ? 'Locked — the bill is approved' : 'From the items dispensed — edit or remove any of them'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {fees.map(line => {
          const isEditing = editing === line.id;
          const busy = busyId === line.id;
          return (
            <div key={line.id} className="flex flex-wrap items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-100 dark:border-zinc-800">
              <span className="min-w-0 flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{line.name}</span>

              {isEditing ? (
                <>
                  <input
                    type="number" min={0} step="0.01" autoFocus value={draftPrice}
                    onChange={e => setDraftPrice(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') save(line); if (e.key === 'Escape') setEditing(null); }}
                    className="w-24 px-2 py-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] font-black font-mono text-right text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  />
                  <button type="button" disabled={busy} onClick={() => save(line)}
                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50">
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  </button>
                </>
              ) : (
                <span className="shrink-0 text-[11px] font-black tabular-nums text-pine dark:text-zinc-100">
                  {currency} {Number(line.lineTotal ?? line.unitPrice).toLocaleString()}
                </span>
              )}

              {!locked && !isEditing && (
                <>
                  <button type="button" title="Edit the amount"
                    onClick={() => { setEditing(line.id); setDraftPrice(String(line.unitPrice ?? 0)); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-seafoam hover:bg-seafoam/10">
                    <Pencil size={12} />
                  </button>
                  <button type="button" title="Remove this charge" disabled={busy} onClick={() => remove(line)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50">
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VisitFeeLines;
