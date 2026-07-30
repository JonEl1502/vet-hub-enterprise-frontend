/**
 * PAYABLES — what the clinic owes its suppliers, and the screen for settling it.
 *
 * The payable chain (migration 159), mirroring the receivable side:
 *   PurchaseOrder → SupplierInvoice → SupplierPayment → allocation
 *
 * The distinction this screen exists to make visible:
 *   · INVOICED — the supplier has billed us. A document exists; it is the payable
 *                and it is what they chase us for.
 *   · GRNI     — goods received, not yet billed. We owe for them, but there is
 *                nothing to pay against yet. Recording their invoice moves the
 *                money from one column to the other; it does not add to it.
 *
 * Every figure is derived server-side, so nothing here reconciles anything — what
 * it renders is the current position by construction.
 */
import React from 'react';
import {
  Truck, Loader2, FileText, PackageCheck, AlertTriangle, Plus, Ban, CircleDollarSign, Clock,
} from 'lucide-react';
import PageHeader from '../../shared/common/PageHeader';
import supplierApAPI, {
  type SupplierApSummaryRow, type SupplierBalance, type SupplierInvoice, type PayableOrder,
} from '../../../services/modules/supplierAp.api';
import { toast } from '../../../services/utils/toast';

interface Props { currency?: string }

const money = (n: number, currency: string) =>
  `${currency} ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const cardCls = 'rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900';
const labelCls = 'text-[10px] font-black uppercase tracking-widest text-slate-400';

const STATUS_TONE: Record<string, string> = {
  OPEN: 'bg-slate-100 dark:bg-zinc-800 text-slate-500',
  PARTIAL: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  PAID: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  VOID: 'bg-rose-100 dark:bg-rose-900/30 text-rose-500',
};

/** One headline figure. */
const Tile: React.FC<{ label: string; value: string; hint?: string; tone?: 'default' | 'warn' | 'due' }> = ({
  label, value, hint, tone = 'default',
}) => (
  <div className={`${cardCls} p-4`}>
    <p className={labelCls}>{label}</p>
    <p className={`mt-1 text-xl font-black font-mono tabular-nums ${
      tone === 'warn' ? 'text-rose-600 dark:text-rose-400'
        : tone === 'due' ? 'text-amber-600 dark:text-amber-400'
          : 'text-pine dark:text-zinc-100'
    }`}>{value}</p>
    {hint && <p className="mt-0.5 text-[10px] font-bold text-slate-400">{hint}</p>}
  </div>
);

const PayablesView: React.FC<Props> = ({ currency = 'KES' }) => {
  const [summary, setSummary] = React.useState<{ total: number; suppliers: SupplierApSummaryRow[] } | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [balance, setBalance] = React.useState<SupplierBalance | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingBalance, setLoadingBalance] = React.useState(false);
  const [showInvoice, setShowInvoice] = React.useState(false);
  const [showPay, setShowPay] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // Set by the "Record invoice" shortcut on a received order, so the modal opens
  // already pointed at that order with its unbilled amount filled in.
  const [prefillOrder, setPrefillOrder] = React.useState<PayableOrder | null>(null);

  const loadSummary = React.useCallback(async () => {
    try {
      const r = await supplierApAPI.summary();
      if (r?.data) setSummary(r.data);
    } catch { /* the panel degrades rather than taking the page down */ }
  }, []);

  const loadBalance = React.useCallback(async (id: string) => {
    setLoadingBalance(true);
    try {
      const r = await supplierApAPI.balance(id);
      if (r?.data) setBalance(r.data);
    } catch {
      setBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  React.useEffect(() => { loadSummary().finally(() => setLoading(false)); }, [loadSummary]);
  React.useEffect(() => { if (selectedId) void loadBalance(selectedId); }, [selectedId, loadBalance]);

  // Both are re-read after any write: the figures are derived, so a stale local
  // copy is the only way this screen could ever lie.
  const refresh = async () => {
    await loadSummary();
    if (selectedId) await loadBalance(selectedId);
  };

  const selectedName = summary?.suppliers.find((s) => s.supplierId === selectedId)?.name
    ?? balance?.invoices[0]?.supplierName
    ?? 'Supplier';

  if (loading) {
    return (
      <div>
        <PageHeader title="Payables" subtitle="What the clinic owes its suppliers" icon={Truck} onBack />
        <div className="h-40 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin" /> Loading payables…
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Payables"
        subtitle="What the clinic owes its suppliers — invoiced, and received but not yet billed"
        icon={Truck}
        onBack
        actions={
          selectedId ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInvoice(true)}
                className="h-10 px-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:border-seafoam">
                <Plus size={12} /> Record invoice
              </button>
              <button
                onClick={() => setShowPay(true)}
                disabled={!balance || balance.outstanding <= 0.005}
                title={balance && balance.outstanding <= 0.005 ? 'Nothing outstanding with this supplier' : undefined}
                className="h-10 px-4 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <CircleDollarSign size={12} /> Pay supplier
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Headline position */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Tile label="Total owed" value={money(summary?.total ?? 0, currency)} hint={`${summary?.suppliers.length ?? 0} supplier(s)`} />
        <Tile label="Invoiced" value={money(balance?.invoiced ?? 0, currency)} hint={selectedId ? 'this supplier — billed, unpaid' : 'select a supplier'} />
        <Tile label="Received, not billed" value={money(balance?.grni ?? 0, currency)} hint={selectedId ? 'no invoice to pay against yet' : 'select a supplier'} tone="due" />
        <Tile label="Overdue" value={money(balance?.overdue ?? 0, currency)} hint={selectedId ? 'past the due date' : 'select a supplier'} tone={(balance?.overdue ?? 0) > 0 ? 'warn' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Who we owe */}
        <div className={`${cardCls} p-3 lg:col-span-1`}>
          <p className={`${labelCls} mb-2`}>Suppliers owed</p>
          {(summary?.suppliers.length ?? 0) === 0 && (
            <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-700">
              Nothing outstanding
            </p>
          )}
          <div className="space-y-1">
            {summary?.suppliers.map((s) => (
              <button
                key={s.supplierId}
                onClick={() => setSelectedId(s.supplierId)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                  selectedId === s.supplierId
                    ? 'border-seafoam bg-seafoam/5'
                    : 'border-slate-200 dark:border-zinc-800 hover:border-seafoam/40'
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-pine dark:text-zinc-100 truncate">{s.name}</span>
                  <span className="text-xs font-black font-mono tabular-nums text-pine dark:text-zinc-100 shrink-0">
                    {money(s.outstanding, currency)}
                  </span>
                </div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 flex items-center gap-1">
                  <Clock size={9} /> oldest {s.oldestDays}d · {s.openOrders} order(s)
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* The selected supplier's position */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedId && (
            <div className={`${cardCls} p-10 text-center`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Select a supplier to see its invoices and received orders
              </p>
            </div>
          )}

          {selectedId && loadingBalance && (
            <div className={`${cardCls} p-10 flex items-center justify-center gap-2 text-xs text-slate-400`}>
              <Loader2 size={14} className="animate-spin" /> Loading {selectedName}…
            </div>
          )}

          {selectedId && !loadingBalance && balance && (
            <>
              {/* Invoices — the payable proper */}
              <div className={`${cardCls} p-3`}>
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={13} className="text-seafoam" />
                  <p className={labelCls}>Supplier invoices</p>
                  <span className="text-[9px] font-bold text-slate-400">{balance.invoices.length}</span>
                </div>
                {balance.invoices.length === 0 && (
                  <p className="py-6 text-center text-[10px] font-bold text-slate-400">
                    None recorded. Anything received sits under “Received, not yet billed” below until their invoice arrives.
                  </p>
                )}
                <div className="space-y-1">
                  {balance.invoices.map((inv) => (
                    <InvoiceRow key={inv.id} inv={inv} currency={currency} busy={busy}
                      onVoid={async () => {
                        const reason = window.prompt(`Void supplier invoice ${inv.number}? The row and its number are KEPT — give a reason:`);
                        if (reason == null) return;
                        setBusy(true);
                        try {
                          await supplierApAPI.voidInvoice(inv.id, reason);
                          toast.success(`Invoice ${inv.number} voided`);
                          await refresh();
                        } finally { setBusy(false); }
                      }} />
                  ))}
                </div>
              </div>

              {/* GRNI — received, no document yet */}
              <div className={`${cardCls} p-3`}>
                <div className="flex items-center gap-2 mb-2">
                  <PackageCheck size={13} className="text-amber-500" />
                  <p className={labelCls}>Received, not yet billed</p>
                  <span className="text-[9px] font-bold text-slate-400">{balance.orders.length}</span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 mb-2">
                  Goods are in and we owe for them, but no invoice has arrived. Recording one MOVES the money into
                  the list above — it does not add to what is owed.
                </p>
                {balance.orders.length === 0 && (
                  <p className="py-6 text-center text-[10px] font-bold text-slate-400">Everything received has been billed.</p>
                )}
                <div className="space-y-1">
                  {balance.orders.map((o) => (
                    <OrderRow key={o.purchaseOrderId} o={o} currency={currency}
                      onInvoice={() => { setPrefillOrder(o); setShowInvoice(true); }} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showInvoice && selectedId && (
        <RecordInvoiceModal
          supplierId={selectedId}
          supplierName={selectedName}
          currency={currency}
          orders={balance?.orders ?? []}
          prefillOrder={prefillOrder}
          onClose={() => { setShowInvoice(false); setPrefillOrder(null); }}
          onSaved={async () => { setShowInvoice(false); setPrefillOrder(null); await refresh(); }}
        />
      )}

      {showPay && selectedId && balance && (
        <PaySupplierModal
          supplierId={selectedId}
          supplierName={selectedName}
          currency={currency}
          balance={balance}
          onClose={() => setShowPay(false)}
          onSaved={async () => { setShowPay(false); await refresh(); }}
        />
      )}
    </div>
  );
};

export default PayablesView;

/** One invoice line. */
const InvoiceRow: React.FC<{ inv: SupplierInvoice; currency: string; busy: boolean; onVoid: () => void }> = ({
  inv, currency, busy, onVoid,
}) => (
  <div className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border ${
    inv.status === 'VOID'
      ? 'border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 opacity-70'
      : inv.overdue
        ? 'border-rose-200 dark:border-rose-800/50 bg-rose-50/40 dark:bg-rose-900/10'
        : 'border-slate-200 dark:border-zinc-800'
  }`}>
    <div className="min-w-0 flex-1">
      <p className={`text-xs font-black truncate ${inv.status === 'VOID' ? 'text-slate-400 line-through' : 'text-pine dark:text-zinc-100'}`}>
        {inv.number}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {inv.orderNumber ? `${inv.orderNumber} · ` : ''}
        {inv.dueDate ? `due ${new Date(inv.dueDate).toLocaleDateString()}` : 'no due date'}
      </p>
    </div>
    {inv.overdue && inv.status !== 'VOID' && (
      <span className="shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
        <AlertTriangle size={10} /> Overdue
      </span>
    )}
    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${STATUS_TONE[inv.status]}`}>
      {inv.status}
    </span>
    <div className="shrink-0 w-32 text-right">
      <span className="block text-sm font-black font-mono tabular-nums text-pine dark:text-zinc-100">
        {money(inv.outstanding, currency)}
      </span>
      <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">
        of {money(inv.total, currency)}
      </span>
    </div>
    {inv.status !== 'VOID' && inv.amountPaid <= 0.005 && (
      <button
        onClick={onVoid}
        disabled={busy}
        title="Void this invoice — the row and its number are kept for audit"
        className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-rose-500 disabled:opacity-40">
        <Ban size={12} />
      </button>
    )}
  </div>
);

/** One received-but-unbilled order. */
const OrderRow: React.FC<{ o: PayableOrder; currency: string; onInvoice: () => void }> = ({ o, currency, onInvoice }) => (
  <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800">
    <div className="min-w-0 flex-1">
      <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{o.orderNumber ?? `Order #${o.purchaseOrderId}`}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
        received {new Date(o.orderedAt).toLocaleDateString()} · {o.ageDays}d
      </p>
    </div>
    <div className="shrink-0 w-32 text-right">
      <span className="block text-sm font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
        {money(o.outstanding, currency)}
      </span>
      <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">
        of {money(o.receivedValue, currency)}
      </span>
    </div>
    <button
      onClick={onInvoice}
      className="shrink-0 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam">
      Record invoice
    </button>
  </div>
);

/** Record the supplier's invoice. */
const RecordInvoiceModal: React.FC<{
  supplierId: string; supplierName: string; currency: string;
  orders: PayableOrder[]; prefillOrder: PayableOrder | null;
  onClose: () => void; onSaved: () => void;
}> = ({ supplierId, supplierName, currency, orders, prefillOrder, onClose, onSaved }) => {
  const [number, setNumber] = React.useState('');
  const [total, setTotal] = React.useState(prefillOrder ? String(prefillOrder.outstanding) : '');
  const [orderId, setOrderId] = React.useState(prefillOrder?.purchaseOrderId ?? '');
  const [issuedAt, setIssuedAt] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Picking the order defaults the amount to what it still owes — the common
  // case is being billed for exactly what arrived.
  const pickOrder = (id: string) => {
    setOrderId(id);
    const o = orders.find((x) => x.purchaseOrderId === id);
    if (o && !total) setTotal(String(o.outstanding));
  };

  const save = async () => {
    setSaving(true);
    try {
      await supplierApAPI.createInvoice(supplierId, {
        number: number.trim(),
        total: Number(total),
        purchaseOrderId: orderId || null,
        issuedAt: issuedAt || null,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
      });
      toast.success(`Invoice ${number.trim()} recorded`);
      onSaved();
    } catch {
      // The server's message is already surfaced (showError) — a duplicate
      // number in particular must be READ, not retried.
    } finally { setSaving(false); }
  };

  const valid = number.trim().length > 0 && Number(total) > 0;

  return (
    <div className="fixed inset-0 z-[800] bg-pine/90 dark:bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-black uppercase tracking-tight text-pine dark:text-zinc-100">Record supplier invoice</h2>
        <p className="text-[10px] font-black uppercase tracking-widest text-seafoam mt-0.5 mb-4">{supplierName}</p>

        <div className="space-y-3">
          <div>
            <label className="field-label">Their invoice number</label>
            <input className="field-input" value={number} onChange={(e) => setNumber(e.target.value)}
              placeholder="As printed on their document" />
            <p className="mt-1 text-[9px] font-bold text-slate-400">
              The supplier's own number — it is what gets quoted in a dispute. Recording the same one twice is refused.
            </p>
          </div>

          <div>
            <label className="field-label">Against which received order</label>
            <select className="field-select" value={orderId} onChange={(e) => pickOrder(e.target.value)}>
              <option value="">None — ad-hoc invoice (freight, service, no PO)</option>
              {orders.map((o) => (
                <option key={o.purchaseOrderId} value={o.purchaseOrderId}>
                  {o.orderNumber ?? `Order #${o.purchaseOrderId}`} — {money(o.outstanding, currency)} unbilled
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Total ({currency})</label>
              <input className="field-input" type="number" min="0" step="0.01" value={total}
                onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Their invoice date</label>
              <input className="field-input" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="field-label">Due date</label>
            <input className="field-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Notes</label>
            <textarea className="field-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={saving}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Cancel
          </button>
          <button onClick={save} disabled={!valid || saving}
            className="h-10 px-5 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-40">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Record
          </button>
        </div>
      </div>
    </div>
  );
};

/** Pay the supplier. Shows what the money will clear before it is taken. */
const PaySupplierModal: React.FC<{
  supplierId: string; supplierName: string; currency: string;
  balance: SupplierBalance; onClose: () => void; onSaved: () => void;
}> = ({ supplierId, supplierName, currency, balance, onClose, onSaved }) => {
  const [amount, setAmount] = React.useState(String(balance.outstanding));
  const [method, setMethod] = React.useState('BANK_TRANSFER');
  const [reference, setReference] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const amt = Number(amount);

  // Mirror the server's allocation so staff can see where the money lands
  // BEFORE committing: invoices first (a document has arrived and is what the
  // supplier chases), then GRNI, oldest within each. This is a preview only —
  // the server allocates authoritatively.
  const preview = React.useMemo(() => {
    const targets = [
      ...balance.invoices
        .filter((i) => i.status !== 'VOID' && i.outstanding > 0.005)
        .map((i) => ({ label: i.number, kind: 'Invoice', due: i.outstanding, age: new Date(i.dueDate ?? i.issuedAt ?? i.createdAt).getTime() })),
      ...balance.orders
        .filter((o) => o.outstanding > 0.005)
        .map((o) => ({ label: o.orderNumber ?? `Order #${o.purchaseOrderId}`, kind: 'Received', due: o.outstanding, age: new Date(o.orderedAt).getTime() })),
    ].sort((a, b) => a.age - b.age);

    let left = Number.isFinite(amt) ? amt : 0;
    const rows: Array<{ label: string; kind: string; applied: number; leaves: number }> = [];
    for (const t of targets) {
      if (left <= 0.005) break;
      const applied = Math.min(t.due, left);
      rows.push({ label: t.label, kind: t.kind, applied, leaves: t.due - applied });
      left = Math.round((left - applied) * 100) / 100;
    }
    return rows;
  }, [amt, balance]);

  const overpay = amt > balance.outstanding + 0.005;

  const save = async () => {
    setSaving(true);
    try {
      await supplierApAPI.recordPayment(supplierId, {
        amount: amt, paymentMethod: method, reference: reference.trim() || undefined,
      });
      toast.success(`Paid ${money(amt, currency)} to ${supplierName}`);
      onSaved();
    } catch { /* server message already surfaced */ } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[800] bg-pine/90 dark:bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-black uppercase tracking-tight text-pine dark:text-zinc-100">Pay supplier</h2>
        <p className="text-[10px] font-black uppercase tracking-widest text-seafoam mt-0.5 mb-4">
          {supplierName} · {money(balance.outstanding, currency)} outstanding
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Amount ({currency})</label>
            <input className="field-input" type="number" min="0" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Method</label>
            <select className="field-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CASH">Cash</option>
              <option value="M_PESA">M-Pesa</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CARD">Card</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="field-label">Reference</label>
          <input className="field-input" value={reference} onChange={(e) => setReference(e.target.value)}
            placeholder="Bank ref, cheque no., M-Pesa code…" />
        </div>

        {overpay && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
            <AlertTriangle size={13} className="text-rose-500 shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
              That is more than the {money(balance.outstanding, currency)} outstanding. The server will refuse it — a
              genuine supplier credit is a different instrument and needs its own record.
            </p>
          </div>
        )}

        {!overpay && preview.length > 0 && (
          <div className="mt-4">
            <p className={`${labelCls} mb-1.5`}>This will clear</p>
            <div className="space-y-1">
              {preview.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">{r.label}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{r.kind}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-[11px] font-black font-mono tabular-nums text-pine dark:text-zinc-100">
                      {money(r.applied, currency)}
                    </span>
                    {r.leaves > 0.005 && (
                      <span className="block text-[8px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        {money(r.leaves, currency)} left
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] font-bold text-slate-400">
              Invoices are cleared before un-billed goods. The server allocates authoritatively — this is a preview.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={saving}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Cancel
          </button>
          <button onClick={save} disabled={saving || !(amt > 0) || overpay}
            className="h-10 px-5 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-40">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CircleDollarSign size={12} />} Pay
          </button>
        </div>
      </div>
    </div>
  );
};
