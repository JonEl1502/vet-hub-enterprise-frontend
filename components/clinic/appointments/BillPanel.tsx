import React from 'react';
import toast from 'react-hot-toast';
import {
  ReceiptText, Loader2, RefreshCw, Trash2, Plus, Search,
  CreditCard, CheckCircle2, AlertTriangle, Lock, Unlock, Send,
} from 'lucide-react';
import { Visit } from '../../../types';
import { billsAPI, invoicesAPI } from '../../../services';
import servicesAPI, { CatalogService } from '../../../services/modules/services.api';
import { Bill, BillLine } from '../../../services/modules/bills.api';
import { Invoice } from '../../../services/modules/invoices.api';

/**
 * Bill Review — Revenue Cycle P1.
 *
 * Everything the encounter produced is already here as lines. This is where
 * the vet catches what the workflow missed ("we forgot the E-collar"), fixes a
 * quantity, or drops something added by accident — WITHOUT reopening the
 * consultation. Approving is what locks the clinical record; payment no longer
 * has any say in that.
 */

interface Props {
  visit: Visit;
  currency: string;
  /** Opens the existing Settle Bill modal (pay-first collects through it). */
  onCollect?: () => void;
  /** Re-fetch the visit after the bill changes its billing/lock state. */
  onChanged?: () => void;
  /**
   * Publishes the bill this panel is holding, on load and after every edit.
   * `BillBalanceCard` renders from it so the two never disagree — it used to
   * quote `visit.totalCost`, which lags every line change.
   */
  onBillChange?: (bill: Bill | null) => void;
}

const money = (n: number, c: string) =>
  `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT:          { label: 'Draft',            cls: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300' },
  PENDING_REVIEW: { label: 'Pending review',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  APPROVED:       { label: 'Approved',         cls: 'bg-seafoam/15 text-seafoam' },
  ISSUED:         { label: 'Awaiting payment', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  INVOICED:       { label: 'Invoiced',         cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  PAID:           { label: 'Paid',             cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  RECONCILED:     { label: 'Reconciled',       cls: 'bg-seafoam/15 text-seafoam' },
  VOID:           { label: 'Void',             cls: 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500' },
};

const KIND_LABEL: Record<string, string> = {
  SERVICE: 'Service', CONSUMABLE: 'Consumable', MEDICATION: 'Medication', OTHER: 'Other',
};

const BillPanel: React.FC<Props> = ({ visit, currency, onCollect, onChanged, onBillChange }) => {
  const [bill, setBill] = React.useState<Bill | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [qtyDraft, setQtyDraft] = React.useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = React.useState<Record<string, string>>({});

  // Add-line search over the service catalog. Picking a service fills the name
  // and price; typing anything the catalog doesn't have still works and lands
  // as an OTHER line, so a forgotten item is never blocked by the catalog.
  const [q, setQ] = React.useState('');
  const [catalog, setCatalog] = React.useState<CatalogService[]>([]);
  const [newPrice, setNewPrice] = React.useState('');

  const [invoice, setInvoice] = React.useState<Invoice | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [b, inv] = await Promise.all([
        billsAPI.get(visit.id),
        invoicesAPI.forVisit(visit.id).catch(() => null),
      ]);
      if (b.success && b.data?.bill) setBill(b.data.bill);
      setInvoice(inv?.success ? (inv.data?.invoice ?? null) : null);
    } catch { /* surfaced by the client */ }
    finally { setLoading(false); }
  }, [visit.id]);
  React.useEffect(() => { load(); }, [load]);

  // Every path that changes the bill funnels through `setBill` (mount load and
  // `apply` on each mutation response), so one effect keeps subscribers exact
  // without threading a callback through a dozen handlers.
  React.useEffect(() => { onBillChange?.(bill); }, [bill, onBillChange]);

  React.useEffect(() => {
    if (!adding || catalog.length) return;
    servicesAPI.catalog().then(setCatalog).catch(() => setCatalog([]));
  }, [adding, catalog.length]);

  const matches = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return catalog
      .filter(s => s.enabled !== false)
      .filter(s => `${s.name} ${s.categoryName ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [catalog, q]);

  const apply = (res: any) => { if (res?.success && res.data?.bill) setBill(res.data.bill); };
  const run = async (fn: () => Promise<any>, done?: string) => {
    setBusy(true);
    try { const res = await fn(); apply(res); if (done) toast.success(done); onChanged?.(); }
    catch (e: any) { toast.error(e?.message || 'Something went wrong'); }
    finally { setBusy(false); }
  };

  const addFromCatalog = (s: CatalogService) => run(
    () => billsAPI.addLine(visit.id, {
      kind: 'SERVICE', name: s.name, category: s.categoryName ?? null,
      quantity: 1, unitPrice: Number(s.priceEffective ?? s.defaultPrice ?? 0),
    }),
    `${s.name} added`,
  ).then(() => { setQ(''); setAdding(false); });

  const addFreeText = () => {
    const name = q.trim();
    if (!name) return;
    run(
      () => billsAPI.addLine(visit.id, { kind: 'OTHER', name, quantity: 1, unitPrice: Number(newPrice) || 0 }),
      `${name} added`,
    ).then(() => { setQ(''); setNewPrice(''); setAdding(false); });
  };

  const saveLine = (l: BillLine, patch: { quantity?: number; unitPrice?: number }) =>
    run(() => billsAPI.updateLine(visit.id, l.id, patch));

  if (loading) {
    return <div className="flex items-center gap-2 text-[11px] text-slate-400 py-3"><Loader2 size={13} className="animate-spin" /> Loading bill…</div>;
  }
  if (!bill) return null;

  const meta = STATUS_META[bill.status];
  const editable = bill.editable;
  const delta = bill.deltaAmount ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <ReceiptText size={17} className="text-seafoam shrink-0" />
          <div className="min-w-0">
            <h4 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
              Bill {bill.number && <span className="text-slate-400 font-bold normal-case tracking-normal text-[11px]">· {bill.number}</span>}
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
              {editable
                ? 'Add anything the visit missed, fix quantities, then approve'
                : 'Approved — reopen to make changes'}
            </p>
          </div>
        </div>
        {meta && <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${meta.cls}`}>{meta.label}</span>}
      </div>

      {bill.isSynthetic && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20">
          <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
            Backfilled from the visit record — nobody reviewed this at the time of care.
          </p>
        </div>
      )}

      {visit.prepaid && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20">
          <Unlock size={13} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
            Paid up front — the clinical record is still open until the bill is approved.
          </p>
        </div>
      )}

      {/* Lines */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-zinc-950">
              <tr className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-3 py-2">Item</th>
                <th className="px-2 py-2 w-24">Kind</th>
                <th className="px-2 py-2 w-16 text-right">Qty</th>
                <th className="px-2 py-2 w-24 text-right">Unit</th>
                <th className="px-3 py-2 w-28 text-right">Line</th>
                {editable && <th className="px-2 py-2 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {bill.lines.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-[11px] text-slate-400 text-center">No results — nothing has been charged to this visit yet.</td></tr>
              )}
              {bill.lines.map(l => (
                <tr key={l.id} className="text-[11px]">
                  <td className="px-3 py-1.5">
                    <span className="font-bold text-pine dark:text-zinc-100">{l.name}</span>
                    {l.category && <span className="block text-[9px] font-bold text-slate-400">{l.category}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">{KIND_LABEL[l.kind] ?? l.kind}</td>
                  <td className="px-2 py-1.5 text-right">
                    {editable ? (
                      <input type="number" min={0} step="0.001" disabled={busy}
                        className="w-14 px-1.5 py-0.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded text-right text-[11px] font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-seafoam"
                        value={qtyDraft[l.id] ?? String(l.quantity)}
                        onChange={e => setQtyDraft(d => ({ ...d, [l.id]: e.target.value }))}
                        onBlur={() => { const v = Number(qtyDraft[l.id]); setQtyDraft(d => { const { [l.id]: _x, ...r } = d; return r; }); if (Number.isFinite(v) && v > 0 && v !== l.quantity) saveLine(l, { quantity: v }); }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    ) : l.quantity}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {editable ? (
                      <input type="number" min={0} step="0.01" disabled={busy}
                        className="w-20 px-1.5 py-0.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded text-right text-[11px] font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-seafoam"
                        value={priceDraft[l.id] ?? String(l.unitPrice)}
                        onChange={e => setPriceDraft(d => ({ ...d, [l.id]: e.target.value }))}
                        onBlur={() => { const v = Number(priceDraft[l.id]); setPriceDraft(d => { const { [l.id]: _x, ...r } = d; return r; }); if (Number.isFinite(v) && v >= 0 && v !== l.unitPrice) saveLine(l, { unitPrice: v }); }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    ) : money(l.unitPrice, currency)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-black text-pine dark:text-zinc-100">{money(l.lineTotal, currency)}</td>
                  {editable && (
                    <td className="px-2 py-1.5">
                      <button type="button" disabled={busy} title="Remove this line"
                        onClick={() => run(() => billsAPI.removeLine(visit.id, l.id), 'Line removed')}
                        className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-40">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-zinc-950">
              {bill.discount > 0 && (
                <tr className="text-[11px]">
                  <td colSpan={editable ? 4 : 3} className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Discount</td>
                  <td colSpan={2} className="px-3 py-1.5 text-right font-black text-emerald-600">− {money(bill.discount, currency)}</td>
                </tr>
              )}
              <tr className="text-[11px]">
                <td colSpan={editable ? 4 : 3} className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Total</td>
                <td colSpan={2} className="px-3 py-2 text-right text-sm font-black text-pine dark:text-zinc-100">{money(bill.total, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add a line — search the catalog, or just type it */}
      {editable && adding && (
        <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search services, or type anything to add it as an Other line…"
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-8 pr-2 py-2 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20" />
          </div>
          {matches.map(s => (
            <button key={s.id} type="button" disabled={busy} onClick={() => addFromCatalog(s)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800 hover:border-seafoam text-left transition-colors disabled:opacity-40">
              <Plus size={11} className="text-seafoam shrink-0" />
              <span className="flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{s.name}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{s.categoryName}</span>
              <span className="text-[11px] font-black text-pine dark:text-zinc-100 shrink-0">{money(Number(s.priceEffective ?? s.defaultPrice ?? 0), currency)}</span>
            </button>
          ))}
          {q.trim().length >= 2 && matches.length === 0 && (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-[11px] text-slate-500 dark:text-zinc-400">
                No service matches — add "<strong className="text-pine dark:text-zinc-100">{q.trim()}</strong>" as an Other line.
              </p>
              <input type="number" min={0} step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                placeholder="Price"
                className="w-24 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-right text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20" />
              <button type="button" onClick={addFreeText} disabled={busy}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-40">Add</button>
            </div>
          )}
          <button type="button" onClick={() => { setAdding(false); setQ(''); }} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      )}

      {/* Reconciliation outcome (pay-first) */}
      {bill.status === 'RECONCILED' && delta != null && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border ${Math.abs(delta) < 0.005
          ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20'
          : 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20'}`}>
          {Math.abs(delta) < 0.005 ? <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />}
          <div className="text-[11px] font-bold">
            <p className="text-pine dark:text-zinc-100">
              Quoted {money(bill.total, currency)} · actual {money(bill.actualTotal ?? 0, currency)} · collected {money(bill.amountPaid ?? 0, currency)}
            </p>
            <p className={Math.abs(delta) < 0.005 ? 'text-emerald-700' : 'text-amber-800 dark:text-amber-300'}>
              {Math.abs(delta) < 0.005 ? 'Settled exactly.' : delta > 0 ? `Client owes ${money(delta, currency)}.` : `Client overpaid by ${money(Math.abs(delta), currency)}.`}
            </p>
          </div>
        </div>
      )}

      {/* Invoice — the financial document generated from the approved bill.
          It is never edited: wrong invoice ⇒ void, fix the bill, regenerate. */}
      {invoice && invoice.status !== 'VOID' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20">
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Invoice</span>
          <span className="text-[12px] font-black text-pine dark:text-zinc-100">{invoice.number}</span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
            {money(invoice.total, currency)} · paid {money(invoice.amountPaid, currency)} ·
            {' '}<strong className={invoice.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}>
              {invoice.outstanding > 0 ? `${money(invoice.outstanding, currency)} outstanding` : 'settled'}
            </strong>
          </span>
          <span className="ml-auto px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{invoice.status}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {bill.status === 'APPROVED' && !invoice && (
          <button type="button" disabled={busy}
            onClick={() => run(async () => { const r = await invoicesAPI.generate(visit.id); setInvoice(r.data?.invoice ?? null); await load(); return null; }, 'Invoice generated')}
            title="Turn this approved bill into an invoice"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40">
            <ReceiptText size={11} /> Generate invoice
          </button>
        )}
        {editable && (
          <>
            <button type="button" onClick={() => run(() => billsAPI.refresh(visit.id), 'Rebuilt from the visit')} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 disabled:opacity-40">
              <RefreshCw size={11} /> Rebuild from visit
            </button>
            <button type="button" onClick={() => setAdding(a => !a)} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 disabled:opacity-40">
              <Plus size={11} /> Add item
            </button>
            <button type="button" onClick={() => run(() => billsAPI.issue(visit.id), 'Issued — awaiting payment')} disabled={busy || bill.total <= 0}
              title="Pay-first: quote the client now and collect before the work finishes"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-seafoam text-seafoam hover:bg-seafoam/10 disabled:opacity-40">
              <Send size={11} /> Issue for pay-first
            </button>
            <button type="button" onClick={() => run(() => billsAPI.approve(visit.id), 'Bill approved')} disabled={busy}
              title="Sign the bill off — this locks the clinical record"
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-40">
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />} Approve bill
            </button>
          </>
        )}

        {!editable && bill.status !== 'PAID' && bill.status !== 'RECONCILED' && (
          <button type="button" onClick={() => run(() => billsAPI.reopen(visit.id), 'Bill reopened')} disabled={busy}
            title="Unlock the clinical record and edit the bill again"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-seafoam disabled:opacity-40">
            <Unlock size={11} /> Reopen bill
          </button>
        )}

        {bill.status === 'ISSUED' && onCollect && (
          <button type="button" onClick={onCollect} disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-40">
            <CreditCard size={11} /> Collect {money(bill.total, currency)}
          </button>
        )}
      </div>
    </div>
  );
};

export default BillPanel;
