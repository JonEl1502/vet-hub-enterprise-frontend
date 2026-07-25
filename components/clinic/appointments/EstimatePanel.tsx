import React from 'react';
import toast from 'react-hot-toast';
import {
  ReceiptText, Loader2, RefreshCw, Send, Trash2, Plus,
  CreditCard, CheckCircle2, AlertTriangle, Lock, Unlock,
} from 'lucide-react';
import { Visit } from '../../../types';
import { visitEstimatesAPI } from '../../../services';
import { VisitEstimate, EstimateItem, EstimateItemInput } from '../../../services/modules/visitEstimates.api';

/**
 * Pay-first estimate (backend migration 096).
 *
 * The doctor quotes the planned work, the front office collects against that
 * quote, and — the point of the whole flow — the clinical record STAYS OPEN
 * afterwards. Paying an estimate is not the same as closing the visit: the
 * record locks at finalize, where the quote is reconciled against what the
 * visit actually came to.
 */

interface Props {
  visit: Visit;
  currency: string;
  /** Opens the existing Settle Bill modal — pay-first collects through it. */
  onCollect?: () => void;
  /** Re-fetch the visit after an estimate action changes its billing state. */
  onChanged?: () => void;
}

const money = (n: number, currency: string) =>
  `${currency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT:      { label: 'Draft',            cls: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300' },
  ISSUED:     { label: 'Awaiting payment', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  PAID:       { label: 'Paid up front',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  RECONCILED: { label: 'Reconciled',       cls: 'bg-seafoam/15 text-seafoam' },
  VOID:       { label: 'Void',             cls: 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500' },
};

const KIND_LABEL: Record<string, string> = {
  SERVICE: 'Service', CONSUMABLE: 'Consumable', MEDICATION: 'Medication', OTHER: 'Other',
};

const EstimatePanel: React.FC<Props> = ({ visit, currency, onCollect, onChanged }) => {
  const [estimate, setEstimate] = React.useState<VisitEstimate | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  // Local line edits while the quote is still a DRAFT.
  const [draftItems, setDraftItems] = React.useState<EstimateItem[] | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await visitEstimatesAPI.get(visit.id);
      setEstimate(res.success ? (res.data?.estimate ?? null) : null);
    } catch { setEstimate(null); }
    finally { setLoading(false); }
  }, [visit.id]);

  React.useEffect(() => { load(); }, [load]);

  const items = draftItems ?? estimate?.items ?? [];
  const isDraft = !estimate || estimate.status === 'DRAFT' || estimate.status === 'VOID';
  const draftTotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);
  const dirty = !!draftItems;

  const toInput = (list: EstimateItem[]): EstimateItemInput[] => list.map(i => ({
    kind: i.kind, taskId: i.taskId ?? null, inventoryItemId: i.inventoryItemId ?? null,
    name: i.name, category: i.category ?? null, quantity: Number(i.quantity) || 1, unitPrice: Number(i.unitPrice) || 0,
  }));

  // Re-snapshot from the visit's current services + reserved consumables.
  const rebuild = async () => {
    setBusy(true);
    try {
      const res = await visitEstimatesAPI.save(visit.id, {});
      if (res.success && res.data?.estimate) { setEstimate(res.data.estimate); setDraftItems(null); }
      toast.success('Estimate built from the visit’s current services');
    } catch { /* surfaced by the client */ }
    finally { setBusy(false); }
  };

  const saveDraft = async () => {
    if (!draftItems) return;
    setBusy(true);
    try {
      const res = await visitEstimatesAPI.save(visit.id, { items: toInput(draftItems) });
      if (res.success && res.data?.estimate) { setEstimate(res.data.estimate); setDraftItems(null); }
      toast.success('Estimate saved');
    } catch { /* surfaced by the client */ }
    finally { setBusy(false); }
  };

  const issue = async () => {
    setBusy(true);
    try {
      if (draftItems) await visitEstimatesAPI.save(visit.id, { items: toInput(draftItems) });
      const res = await visitEstimatesAPI.issue(visit.id);
      if (res.success && res.data?.estimate) { setEstimate(res.data.estimate); setDraftItems(null); }
      toast.success('Estimate issued — the front office can now collect');
      onChanged?.();
    } catch { /* surfaced by the client */ }
    finally { setBusy(false); }
  };

  const voidEstimate = async () => {
    setBusy(true);
    try {
      const res = await visitEstimatesAPI.void(visit.id);
      if (res.success && res.data?.estimate) { setEstimate(res.data.estimate); setDraftItems(null); }
      onChanged?.();
    } catch { /* surfaced by the client */ }
    finally { setBusy(false); }
  };

  const patchLine = (idx: number, patch: Partial<EstimateItem>) =>
    setDraftItems((items.map((it, i) => i === idx ? { ...it, ...patch } : it)));
  const removeLine = (idx: number) => setDraftItems(items.filter((_, i) => i !== idx));
  const addLine = () => setDraftItems([...items, {
    id: `new-${Date.now()}`, kind: 'OTHER', name: '', category: null, quantity: 1, unitPrice: 0, lineTotal: 0,
  } as EstimateItem]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-slate-400 py-3">
        <Loader2 size={13} className="animate-spin" /> Loading estimate…
      </div>
    );
  }

  const meta = estimate ? STATUS_META[estimate.status] : null;
  const delta = estimate?.deltaAmount ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <ReceiptText size={17} className="text-seafoam shrink-0" />
          <div className="min-w-0">
            <h4 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Estimate</h4>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
              Quote the planned work, collect up front — the record stays editable until finalize
            </p>
          </div>
        </div>
        {meta && (
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${meta.cls}`}>
            {meta.label}
          </span>
        )}
      </div>

      {/* Lock state — the whole reason this flow exists. */}
      {visit.prepaid && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20">
          <Unlock size={14} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
            Paid up front — the clinical record is still open. It locks when you finalize the visit,
            and the estimate is reconciled against the final bill then.
          </p>
        </div>
      )}

      {!estimate && (
        <div className="px-3 py-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 text-center">
          <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-2">
            No estimate yet. Build one from the services already on this visit.
          </p>
          <button type="button" onClick={rebuild} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-40 transition-all">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Build estimate
          </button>
        </div>
      )}

      {estimate && (
        <>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-zinc-950">
                  <tr className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-2 py-2 w-20">Kind</th>
                    <th className="px-2 py-2 w-16 text-right">Qty</th>
                    <th className="px-2 py-2 w-24 text-right">Unit</th>
                    <th className="px-3 py-2 w-28 text-right">Line</th>
                    {isDraft && <th className="px-2 py-2 w-8" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {items.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-3 text-[11px] text-slate-400">No lines on this quote yet.</td></tr>
                  )}
                  {items.map((it, idx) => (
                    <tr key={it.id} className="text-[11px]">
                      <td className="px-3 py-1.5">
                        {isDraft ? (
                          <input className="field-input !py-1 !text-[11px]" value={it.name}
                            placeholder="Line description"
                            onChange={e => patchLine(idx, { name: e.target.value })} />
                        ) : (
                          <span className="font-bold text-pine dark:text-zinc-100">{it.name}</span>
                        )}
                        {it.category && !isDraft && (
                          <span className="block text-[9px] font-bold text-slate-400">{it.category}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                        {KIND_LABEL[it.kind] ?? it.kind}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {isDraft ? (
                          <input type="number" min={0} step="0.001" className="field-input !py-1 !text-[11px] text-right"
                            value={it.quantity}
                            onChange={e => patchLine(idx, { quantity: Number(e.target.value) })} />
                        ) : it.quantity}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {isDraft ? (
                          <input type="number" min={0} step="0.01" className="field-input !py-1 !text-[11px] text-right"
                            value={it.unitPrice}
                            onChange={e => patchLine(idx, { unitPrice: Number(e.target.value) })} />
                        ) : money(it.unitPrice, currency)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-black text-pine dark:text-zinc-100">
                        {money(Number(it.quantity || 0) * Number(it.unitPrice || 0), currency)}
                      </td>
                      {isDraft && (
                        <td className="px-2 py-1.5">
                          <button type="button" onClick={() => removeLine(idx)} title="Remove line"
                            className="p-1 rounded text-slate-400 hover:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-zinc-950">
                  <tr className="text-[11px]">
                    <td colSpan={isDraft ? 4 : 3} className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Quoted total
                    </td>
                    <td colSpan={2} className="px-3 py-2 text-right text-sm font-black text-pine dark:text-zinc-100">
                      {money(isDraft ? draftTotal : estimate.total, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Reconciliation outcome, written at finalize. */}
          {estimate.status === 'RECONCILED' && delta != null && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border ${
              Math.abs(delta) < 0.005
                ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20'
                : 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20'
            }`}>
              {Math.abs(delta) < 0.005
                ? <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                : <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />}
              <div className="text-[11px] font-bold">
                <p className="text-pine dark:text-zinc-100">
                  Quoted {money(estimate.total, currency)} · actual {money(estimate.actualTotal ?? 0, currency)} ·
                  {' '}collected {money(estimate.amountPaid ?? 0, currency)}
                </p>
                <p className={Math.abs(delta) < 0.005 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}>
                  {Math.abs(delta) < 0.005
                    ? 'Settled exactly — nothing outstanding.'
                    : delta > 0
                      ? `Client owes ${money(delta, currency)} — collect it on the bill.`
                      : `Client overpaid by ${money(Math.abs(delta), currency)} — refund or credit is owed.`}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {isDraft && (
              <>
                <button type="button" onClick={rebuild} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 disabled:opacity-40 transition-all">
                  <RefreshCw size={11} /> Rebuild from visit
                </button>
                <button type="button" onClick={addLine} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 disabled:opacity-40 transition-all">
                  <Plus size={11} /> Add line
                </button>
                {dirty && (
                  <button type="button" onClick={saveDraft} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white dark:bg-zinc-900 border border-seafoam text-seafoam hover:bg-seafoam/10 disabled:opacity-40 transition-all">
                    {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Save draft
                  </button>
                )}
                <button type="button" onClick={issue} disabled={busy || draftTotal <= 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-40 transition-all">
                  {busy ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Issue to client
                </button>
              </>
            )}

            {estimate.status === 'ISSUED' && (
              <>
                <button type="button" onClick={onCollect} disabled={busy || !onCollect}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-40 transition-all">
                  <CreditCard size={11} /> Collect {money(estimate.total, currency)}
                </button>
                <button type="button" onClick={voidEstimate} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 transition-all">
                  <Trash2 size={11} /> Void
                </button>
              </>
            )}

            {estimate.status === 'PAID' && (
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <Lock size={11} /> Reconciles when you finalize the visit
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EstimatePanel;
