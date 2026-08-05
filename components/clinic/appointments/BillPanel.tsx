import React from 'react';
import toast from 'react-hot-toast';
import {
  ReceiptText, Loader2, RefreshCw, Trash2, Plus, Search,
  CreditCard, CheckCircle2, AlertTriangle, Lock, Unlock, Send,
} from 'lucide-react';
import { Visit } from '../../../types';
import { billsAPI, invoicesAPI, dialog } from '../../../services';
import servicesAPI, { CatalogService } from '../../../services/modules/services.api';
import { useData } from '../../../contexts/DataContext';
import { Bill, BillLine, BILL_CLIENT_APPROVAL_CHANNELS, BillClientApprovalChannel } from '../../../services/modules/bills.api';
import { useAuth } from '../../../contexts/AuthContext';
import { modulePerms } from '../../../constants/modulePermissions';
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
  /**
   * Arrived here from "approve the bill on the visit to invoice it" on a
   * Financials → Bills row. Pulse the action that actually moves the bill along
   * for 1.5s so the eye lands on it instead of hunting the panel.
   */
  highlightAction?: boolean;
  /** Bump to re-fire the pulse when the page sends you here again. */
  pulseNonce?: number;
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

const BillPanel: React.FC<Props> = ({ visit, currency, onCollect, onChanged, onBillChange, highlightAction, pulseNonce = 0 }) => {
  const { inventory } = useData() as any;
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
  // A split bill produces MORE than one invoice — clinical now, the stay at
  // discharge — but `forVisit` returns a single one, so the panel showed the
  // KES 8 clinical split and silently hid the rest (user, 2026-08-04: "when
  // split invoice show me the invoices").
  const [allInvoices, setAllInvoices] = React.useState<any[]>([]);

  /**
   * PER-ENCOUNTER BILLS (backend 123/125). A visit may hold one bill per
   * encounter — the groom's and the consult's, each closed and invoiced on its
   * own. `encounterId` is which one this panel is showing.
   *
   * NULL means "the visit's primary bill", which is every single-encounter visit
   * (all of prod today) and behaves exactly as before. The selector only appears
   * once there is genuinely more than one bill, so nothing changes for the
   * common case.
   */
  const [bills, setBills] = React.useState<any[]>([]);
  const [encounterId, setEncounterId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const clientId = (visit as any).clientId;
      const [b, inv, list, invList] = await Promise.all([
        billsAPI.get(visit.id, encounterId),
        invoicesAPI.forVisit(visit.id).catch(() => null),
        billsAPI.listForVisit(visit.id).catch(() => null),
        clientId ? invoicesAPI.list({ clientId }).catch(() => null) : Promise.resolve(null),
      ]);
      setAllInvoices(
        invList?.success
          ? (invList.data?.invoices ?? []).filter((r: any) => String(r.visitId) === String(visit.id) && r.status !== 'VOID')
          : [],
      );
      if (b.success && b.data?.bill) setBill(b.data.bill);
      setInvoice(inv?.success ? (inv.data?.invoice ?? null) : null);
      if (list?.success && list.data?.bills) setBills(list.data.bills);
    } catch { /* surfaced by the client */ }
    finally { setLoading(false); }
  }, [visit.id, encounterId]);
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

  // The catalogue is SERVICES only, so searching "glove" found nothing and
  // offered to add it as a free-text Other line at a price typed from memory —
  // even though Gloves is a stocked item with a real price. Consumables are
  // searched alongside services now, as their own group.
  const stockMatches = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return (inventory || [])
      .filter((i: any) => `${i.name} ${i.category ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [inventory, q]);

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
    }, encounterId),
    `${s.name} added`,
  ).then(() => { setQ(''); setAdding(false); });

  /**
   * Add a stocked item as a CONSUMABLE line, carrying its `inventoryItemId` and
   * its real sell price rather than a number typed from memory.
   *
   * ⚠️ This bills the item; it does NOT deduct it. Stock moves when a
   * consumable is logged against the visit (which creates the VisitMedication
   * finalize reads) — a line added straight onto the bill has no such record.
   * Log it on the visit if the stock must move.
   */
  const addFromStock = (item: any) => run(
    () => billsAPI.addLine(visit.id, {
      kind: 'CONSUMABLE',
      inventoryItemId: String(item.id),
      name: item.name,
      category: item.category ?? null,
      quantity: 1,
      unitPrice: Number(item.price ?? 0),
    }, encounterId),
    `${item.name} added`,
  ).then(() => { setQ(''); setAdding(false); });

  const addFreeText = () => {
    const name = q.trim();
    if (!name) return;
    run(
      () => billsAPI.addLine(visit.id, { kind: 'OTHER', name, quantity: 1, unitPrice: Number(newPrice) || 0 }, encounterId),
      `${name} added`,
    ).then(() => { setQ(''); setNewPrice(''); setAdding(false); });
  };

  /**
   * Removing a line also removes the service from the visit — otherwise it
   * stays listed there and "rebuild from visit" brings the charge straight
   * back. If the service already has work on it the API refuses with a message
   * naming exactly what is recorded; we put that in front of the user and only
   * force the delete if they say yes.
   */
  const removeLine = async (l: BillLine) => {
    setBusy(true);
    try {
      apply(await billsAPI.removeLine(visit.id, l.id, undefined, encounterId));
      toast.success('Line removed');
      onChanged?.();
    } catch (e: any) {
      const msg: string = e?.message || '';
      const needsConfirm = e?.status === 409 || /already has work recorded/i.test(msg);
      if (!needsConfirm) { toast.error(msg || 'Something went wrong'); return; }
      const ok = await dialog.confirm({
        title: 'Remove this line?',
        message: msg,
        confirmLabel: 'Delete anyway',
        variant: 'danger',
      });
      if (!ok) return;
      try {
        apply(await billsAPI.removeLine(visit.id, l.id, true, encounterId));
        toast.success('Line removed');
        onChanged?.();
      } catch (e2: any) {
        toast.error(e2?.message || 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  };

  const saveLine = (l: BillLine, patch: { quantity?: number; unitPrice?: number }) =>
    run(() => billsAPI.updateLine(visit.id, l.id, patch, encounterId));

  // 1.5s pulse on the action that moves the bill along, when we were sent here
  // to do exactly that. Ref lives on the actions row so it can be scrolled to.
  const actionsRef = React.useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = React.useState(false);
  React.useEffect(() => {
    if (!highlightAction || loading || !bill) return;
    setPulse(true);
    const t0 = setTimeout(() => actionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    const t1 = setTimeout(() => setPulse(false), 1500);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, [highlightAction, loading, bill?.id, pulseNonce]);
  // Only one of Generate-invoice / Approve is ever rendered (they need opposite
  // bill states), so both may carry it.
  const pulseCls = pulse ? ' ring-4 ring-amber-400 ring-offset-2 dark:ring-offset-zinc-900 animate-pulse' : '';

  if (loading) {
    return <div className="flex items-center gap-2 text-[11px] text-slate-400 py-3"><Loader2 size={13} className="animate-spin" /> Loading bill…</div>;
  }
  if (!bill) return null;

  const meta = STATUS_META[bill.status];
  const editable = bill.editable;
  // §7.4 — THREE RIGHTS, two grants. Raise prepares and hands on; approve signs
  // off and LOCKS the record; someone holding both sees all three buttons,
  // which is the third case and needs no grant of its own.
  const { user } = useAuth();
  const billPerms = modulePerms(user, 'bills');
  const [approvalOpen, setApprovalOpen] = React.useState(false);
  const [approvalChannels, setApprovalChannels] = React.useState<BillClientApprovalChannel[]>([]);
  const [approvalNote, setApprovalNote] = React.useState('');
  const delta = bill.deltaAmount ?? null;

  return (
    <div className="space-y-3">
      {/* ENCOUNTER SELECTOR — only once the visit genuinely holds more than one
          bill. A single-encounter visit (all of prod today) sees nothing new,
          which is the point: this must not add furniture to the common case.
          Each tab is that encounter's OWN bill with its own lines, status and
          invoice — closing and invoicing the groom while the consult keeps
          accruing is the whole reason the model exists. */}
      {bills.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
          {bills.map((b: any) => {
            const sel = String(b.encounterId ?? '') === String(encounterId ?? '')
              || (!encounterId && b.encounter?.isPrimary);
            const label = b.encounter
              ? [b.encounter.encounterType, b.encounter.visitType].filter(Boolean).join(' · ').replace(/_/g, ' ')
              : 'Whole visit';
            return (
              <button
                key={b.id} type="button"
                onClick={() => { setLoading(true); setEncounterId(b.encounterId ?? null); }}
                className={`shrink-0 px-3 py-1.5 rounded-xl border text-left transition-all ${sel
                  ? 'bg-seafoam text-white border-seafoam shadow-sm'
                  : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-500 hover:border-seafoam/50'}`}
              >
                <span className="block text-[10px] font-black uppercase tracking-widest truncate max-w-[160px]">{label}</span>
                <span className={`block text-[9px] font-bold ${sel ? 'text-white/80' : 'text-slate-400'}`}>
                  {currency} {Number(b.total ?? 0).toLocaleString()} · {b.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

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

      {/* A locked bill is a SNAPSHOT. Services added to the visit after it was
          approved (a second procedure application, a late consumable) are NOT
          on it, and nothing said so — prod visit 131 carried 4,751 of tasks
          against a 1,517 invoice (user, 2026-08-04: "is this correct").
          Only warn on a locked bill: while it is editable, the panel already
          re-materializes from the visit on every load. */}
      {!editable && (() => {
        // An ACCRUING stay re-prices its tasks into bill lines (8 days × rate,
        // meals × price), so the visit's task total and the bill legitimately
        // differ — this banner read "carries KES 734,008" against a 21,208 bill
        // on a boarding visit and was simply wrong (user, 2026-08-04). It only
        // speaks for visits where a task IS its bill line, one for one.
        const accruing = (visit.tasks || []).some((t: any) =>
          /board|inpatient|hospital|stay|food/i.test(String(t.category || '') + ' ' + String(t.name || '')));
        if (accruing || (visit as any).boardingStayId || (visit as any).hospitalizationId) return null;
        // Nor when the bill was split: each invoice covers part of it by design.
        if (allInvoices.length > 1 || (invoice?.scope && invoice.scope !== 'FULL')) return null;
        const billTotal = Number(bill.total ?? 0);
        const visitTotal = (visit.tasks || []).reduce((sum: number, t: any) => sum + (Number(t.price) || 0), 0);
        const gap = visitTotal - billTotal;
        if (!(gap > 0.5)) return null;
        return (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20">
            <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
              This visit now carries {currency} {visitTotal.toLocaleString()} of services, but the bill was
              approved at {currency} {billTotal.toLocaleString()} — {currency} {gap.toLocaleString()} was added afterwards
              and is <span className="underline">not billed</span>.{' '}
              {invoice && !invoice.voidedAt && Number(invoice.amountPaid ?? 0) > 0.005
                ? `${invoice.number || 'The invoice'} has already been part-paid, so it cannot be reopened — bill the difference on a new visit or refund first.`
                : 'Reopen the bill to pick it up (its invoice is voided and reissued), or remove what should not be there.'}
            </p>
          </div>
        );
      })()}

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
                        onClick={() => removeLine(l)}
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
              placeholder="Search services and consumables, or type anything to add it as an Other line…"
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-8 pr-2 py-2 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20" />
          </div>

          {/* Two groups, labelled — a service and a stocked item bill differently
              (the stock line carries its inventory id), so which one you picked
              should never be a guess. */}
          {matches.length > 0 && (
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pt-0.5">Services</p>
          )}
          {matches.map(s => (
            <button key={s.id} type="button" disabled={busy} onClick={() => addFromCatalog(s)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800 hover:border-seafoam text-left transition-colors disabled:opacity-40">
              <Plus size={11} className="text-seafoam shrink-0" />
              <span className="flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{s.name}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{s.categoryName}</span>
              <span className="text-[11px] font-black text-pine dark:text-zinc-100 shrink-0">{money(Number(s.priceEffective ?? s.defaultPrice ?? 0), currency)}</span>
            </button>
          ))}

          {stockMatches.length > 0 && (
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 pt-1">Consumables &amp; stock</p>
          )}
          {stockMatches.map((i: any) => (
            <button key={`inv-${i.id}`} type="button" disabled={busy} onClick={() => addFromStock(i)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800 hover:border-seafoam text-left transition-colors disabled:opacity-40">
              <Plus size={11} className="text-amber-500 shrink-0" />
              <span className="flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{i.name}</span>
              {/* On-hand shown because billing an item the shelf hasn't got is
                  worth seeing BEFORE it lands on the client's bill. */}
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                {i.category} · {Number(i.quantity ?? 0)} {i.unit ?? ''}
              </span>
              <span className="text-[11px] font-black text-pine dark:text-zinc-100 shrink-0">{money(Number(i.price ?? 0), currency)}</span>
            </button>
          ))}

          {q.trim().length >= 2 && matches.length === 0 && stockMatches.length === 0 && (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-[11px] text-slate-500 dark:text-zinc-400">
                No service or stock item matches — add "<strong className="text-pine dark:text-zinc-100">{q.trim()}</strong>" as an Other line.
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
      {(() => {
        // Every non-void invoice on this visit, the primary one first. Falls
        // back to the single `forVisit` result when the list is unavailable.
        const rows: any[] = allInvoices.length
          ? allInvoices
          : (invoice && invoice.status !== 'VOID' ? [invoice] : []);
        if (!rows.length) return null;
        return (
          <div className="space-y-1.5">
            {rows.length > 1 && (
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">
                {rows.length} invoices on this visit · {money(rows.reduce((n, r) => n + Number(r.total ?? 0), 0), currency)} total
              </p>
            )}
            {rows.map((iv: any) => (
              <div key={iv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Invoice</span>
                <span className="text-[12px] font-black text-pine dark:text-zinc-100">{iv.number}</span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                  {money(Number(iv.total ?? 0), currency)} · paid {money(Number(iv.amountPaid ?? 0), currency)} ·
                  {' '}<strong className={Number(iv.outstanding ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                    {Number(iv.outstanding ?? 0) > 0 ? `${money(Number(iv.outstanding), currency)} outstanding` : 'settled'}
                  </strong>
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {iv.scope && iv.scope !== 'FULL' && (
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{iv.scope === 'CLINICAL' ? 'Clinical split' : iv.scope === 'GROOMING' ? 'Grooming split' : 'Stay split'}</span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{iv.status}</span>
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Actions */}
      <div ref={actionsRef} className="flex flex-wrap items-center gap-2">
        {bill.status === 'APPROVED' && !invoice && (
          <button type="button" disabled={busy}
            onClick={async () => {
              // Auto-split with a user confirm (user, 2026-08-02): only offered
              // when the visit escalated into an accruing stay — never on
              // transfer visits, and services from one original-clinic visit
              // always stay on one invoice.
              const hasStay = !!((visit as any).boardingStayId || (visit as any).hospitalizationId);
              // Grooming is its own invoice scope too (user, 2026-08-02).
              const STAY_CATS = ['Boarding Stay', 'Inpatient Stay', 'Food Program'];
              const hasGroom = (bill.lines || []).some(l => !STAY_CATS.includes(l.category || '') && /groom/i.test(l.category || ''))
                && (bill.lines || []).some(l => !STAY_CATS.includes(l.category || '') && !/groom/i.test(l.category || ''));
              const isTransfer = (visit as any).visitType === 'CLINICAL_TRANSFER';
              let scope: 'FULL' | 'CLINICAL' = 'FULL';
              if ((hasStay || hasGroom) && !isTransfer) {
                const split = await dialog.confirm({
                  title: 'Split invoices?',
                  message: hasStay
                    ? 'Do you want to split invoices for the encounters of this visit? The clinical work is invoiced now; the boarding/inpatient stay keeps accruing on the open bill and is invoiced at discharge.'
                    : 'Do you want to split invoices for the encounters of this visit? Clinical work and grooming each get their own invoice, payable separately.',
                  confirmLabel: 'Split — invoice clinical now',
                  cancelLabel: 'One invoice for everything',
                  variant: 'info',
                });
                scope = split ? 'CLINICAL' : 'FULL';
              }
              await run(async () => { const r = await invoicesAPI.generate(visit.id, { scope }); setInvoice(r.data?.invoice ?? null); await load(); return null; }, scope === 'CLINICAL' ? 'Clinical invoice generated — the stay keeps accruing' : 'Invoice generated');
            }}
            title="Turn this approved bill into an invoice"
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40${pulseCls}`}>
            <ReceiptText size={11} /> Generate invoice
          </button>
        )}
        {/* The stay's own document — once the clinical split exists. Charges
            keep accruing until discharge; generate this at the end. */}
        {bill.status === 'APPROVED' && invoice && invoice.scope !== 'FULL' && !!((visit as any).boardingStayId || (visit as any).hospitalizationId) && invoice.scope !== 'STAY' && (
          <button type="button" disabled={busy}
            onClick={() => run(async () => { const r = await invoicesAPI.generate(visit.id, { scope: 'STAY' }); setInvoice(r.data?.invoice ?? null); await load(); return null; }, 'Stay invoice generated')}
            title="Invoice the accrued boarding/inpatient stay (do this at discharge)"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40">
            <ReceiptText size={11} /> Invoice the stay
          </button>
        )}
        {/* Grooming's own document — offered while the bill is still open and
            it carries grooming lines not yet on their own invoice. */}
        {bill.status === 'APPROVED' && invoice && invoice.scope !== 'FULL' && invoice.scope !== 'GROOMING'
          && (bill.lines || []).some(l => !['Boarding Stay', 'Inpatient Stay', 'Food Program'].includes(l.category || '') && /groom/i.test(l.category || '')) && (
          <button type="button" disabled={busy}
            onClick={() => run(async () => { const r = await invoicesAPI.generate(visit.id, { scope: 'GROOMING' }); setInvoice(r.data?.invoice ?? null); await load(); return null; }, 'Grooming invoice generated')}
            title="Invoice the grooming work on its own document"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-40">
            <ReceiptText size={11} /> Invoice grooming
          </button>
        )}
        {editable && (
          <>
            <button type="button" onClick={() => run(() => billsAPI.refresh(visit.id, encounterId), 'Rebuilt from the visit')} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 disabled:opacity-40">
              <RefreshCw size={11} /> Rebuild from visit
            </button>
            <button type="button" onClick={() => setAdding(a => !a)} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 disabled:opacity-40">
              <Plus size={11} /> Add item
            </button>
            <button type="button" onClick={() => run(() => billsAPI.issue(visit.id, encounterId), 'Issued — awaiting payment')} disabled={busy || bill.total <= 0}
              title="Pay-first: quote the client now and collect before the work finishes"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-seafoam text-seafoam hover:bg-seafoam/10 disabled:opacity-40">
              <Send size={11} /> Issue for pay-first
            </button>
            {/* §7.4 — RAISE. Shown to anyone who may raise, while the bill is
                still a DRAFT. Hands the bill on WITHOUT locking the record, so
                someone who may prepare but not sign off has a way to finish. */}
            {billPerms.raise && bill.status === 'DRAFT' && (
              <button type="button" onClick={() => run(() => billsAPI.raise(visit.id, null, encounterId), 'Raised for review')} disabled={busy || bill.total < 0}
                title="Send the bill for review — does not lock the clinical record"
                className={`${billPerms.approve ? '' : 'ml-auto '}inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-seafoam text-seafoam hover:bg-seafoam/10 disabled:opacity-40`}>
                <Send size={11} /> Raise for review
              </button>
            )}
            {/* §7.4 — record HOW the client approved. Evidence attached to the
                bill, not a status change, so it stays available on a raised
                bill the client has agreed to but nobody has signed off yet. */}
            {billPerms.raise && (
              <button type="button" onClick={() => setApprovalOpen(o => !o)} disabled={busy}
                title="Record how the client approved this bill"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 disabled:opacity-40">
                <ReceiptText size={11} /> {bill.clientApprovedAt ? 'Client approval ✓' : 'Client approved…'}
              </button>
            )}
            {/* §7.4 — APPROVE. The heavier right: this is the lock point. */}
            {billPerms.approve && (
              <button type="button" onClick={() => run(() => billsAPI.approve(visit.id, encounterId), 'Bill approved')} disabled={busy}
                title="Sign the bill off — this locks the clinical record"
                className={`ml-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-40${pulseCls}`}>
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />} Approve bill
              </button>
            )}
          </>
        )}

        {/* §7.4 — "How the client approved", as the simple checkboxes the user
            asked for. PORTAL reads differently from the rest on purpose: it is
            the client acting themselves, not a channel we reached them on. */}
        {approvalOpen && (
          <div className="basis-full mt-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
              How did the client approve?
            </p>
            <div className="flex flex-wrap gap-2">
              {BILL_CLIENT_APPROVAL_CHANNELS.map(c => {
                const on = approvalChannels.includes(c.id);
                return (
                  <button key={c.id} type="button"
                    onClick={() => setApprovalChannels(prev => on ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${on
                      ? 'bg-seafoam text-white border-seafoam'
                      : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100'}`}>
                    {c.label}
                  </button>
                );
              })}
            </div>
            <input value={approvalNote} onChange={e => setApprovalNote(e.target.value)}
              placeholder="Note (optional) — who you spoke to, what they said"
              className="field-input text-xs" />
            <div className="flex items-center gap-2">
              <button type="button" disabled={busy || !approvalChannels.length}
                onClick={() => run(async () => {
                  const r = await billsAPI.recordClientApproval(visit.id, approvalChannels, approvalNote || null, encounterId);
                  setApprovalOpen(false);
                  return r;
                }, 'Client approval recorded')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-40">
                Record approval
              </button>
              <button type="button" onClick={() => setApprovalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
                Cancel
              </button>
            </div>
            {bill.clientApprovedAt && (
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                Already recorded: {(bill.clientApprovalChannels || []).map(id =>
                  BILL_CLIENT_APPROVAL_CHANNELS.find(c => c.id === id)?.label ?? id).join(', ')}
                {bill.clientApprovalNote ? ` — ${bill.clientApprovalNote}` : ''}
              </p>
            )}
          </div>
        )}

        {/* An issued invoice blocks the reopen — correctly, but the refusal used
            to be a dead end: a toast telling you to void it "on the Bill &
            Invoice tab", which is the tab you are already on (user, 2026-08-04).
            Offer the void here instead, as one confirmed step. An invoice with
            money against it is NOT offered — that is a refund, not an edit. */}
        {!editable && bill.status !== 'PAID' && bill.status !== 'RECONCILED' && (
          <button type="button" disabled={busy}
            onClick={async () => {
              const blocking = invoice && !invoice.voidedAt && Number(invoice.amountPaid ?? 0) <= 0.005 ? invoice : null;
              if (blocking) {
                const ok = await dialog.confirm({
                  title: `Void ${blocking.number || 'the invoice'} to reopen the bill?`,
                  message: 'An issued invoice cannot be edited — it is voided and reissued. Nothing has been paid against this one, so voiding costs nothing: fix the bill, approve it and generate a fresh invoice.',
                  confirmLabel: 'Void & reopen',
                  cancelLabel: 'Cancel',
                  variant: 'danger',
                });
                if (!ok) return;
                await run(async () => {
                  await invoicesAPI.void(blocking.id, 'Voided to reopen the bill for correction');
                  setInvoice(null);
                  return billsAPI.reopen(visit.id);
                }, 'Invoice voided — bill reopened');
                return;
              }
              run(() => billsAPI.reopen(visit.id), 'Bill reopened');
            }}
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
