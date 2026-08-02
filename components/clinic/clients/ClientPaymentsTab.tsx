import React from 'react';
import toast from 'react-hot-toast';
import {
  Receipt, FileText, CreditCard, Loader2, CheckCircle2, Ban, AlertTriangle, Link2, Trash2,
  Search, X,
} from 'lucide-react';
import { clientsAPI, transactionsAPI, invoicesAPI } from '../../../services';
import { printElementAsPdf } from '../shared/printPdf';
import { ClientBilling } from '../../../services/modules/clients.api';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * Client → Payments tab (backend migration 097).
 *
 * Three views over the same money: INVOICES (a visit's own bill — the app has
 * no separate invoice document), PAYMENTS, and RECEIPTS.
 *
 * The point of the tab: tick several outstanding invoices and settle them with
 * ONE payment. That payment is reversible as a unit — voiding it puts every
 * invoice it covered back to unpaid, which is also the fix for voids that used
 * to reverse the money while leaving the bill reading "paid".
 */

interface Props {
  clientId: string | number;
  currency: string;
  canCollect: boolean;
  onViewVisit?: (visitId: number) => void;
  onChanged?: () => void;
  /** Pin the tab to ONE view (and hide the sub-tab bar) — the client profile
   * now has top-level Invoices/Receipts tabs that each reuse this component. */
  only?: 'invoices' | 'payments' | 'receipts';
}

const METHODS = ['CASH', 'M_PESA', 'CARD', 'BANK_TRANSFER'];

const money = (n: number, c: string) =>
  `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const ClientPaymentsTab: React.FC<Props> = ({ clientId, currency, canCollect, onViewVisit, onChanged, only }) => {
  const { user } = useAuth();
  // Permanent deletion is owner/manager/admin only — mirrors the server's
  // role gate on DELETE /transactions/:id so the button isn't offered to
  // someone who would just get a 403.
  const canDelete = ['SUPER_ADMIN', 'MERCHANT_ADMIN', 'CLINIC_OWNER', 'CLINIC_MANAGER'].includes(String(user?.role));
  const [sub, setSub] = React.useState<'invoices' | 'payments' | 'receipts'>(only ?? 'invoices');
  const [data, setData] = React.useState<ClientBilling | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  // Expanded row → inline printable invoice document (user, 2026-08-02).
  const [expandedVisit, setExpandedVisit] = React.useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = React.useState<any | null>(null);
  const [docLoading, setDocLoading] = React.useState(false);
  const toggleExpand = (inv: any) => {
    const next = expandedVisit === inv.visitId ? null : inv.visitId;
    setExpandedVisit(next); setExpandedDoc(null);
    const docId = inv.invoices?.[0]?.id;
    if (next && docId) {
      setDocLoading(true);
      invoicesAPI.get(docId, { silent: true } as any)
        .then(r => { if (r.success && r.data?.invoice) setExpandedDoc(r.data.invoice); })
        .catch(() => {})
        .finally(() => setDocLoading(false));
    }
  };
  const [method, setMethod] = React.useState('CASH');
  const [busy, setBusy] = React.useState(false);
  // Allocation (backend P3). Blank `tendered` means "settle the selection in
  // full", which is what this tab did before there was a choice.
  const [tendered, setTendered] = React.useState('');
  const [allocMode, setAllocMode] = React.useState<'AUTO' | 'MANUAL'>('AUTO');
  const [search, setSearch] = React.useState('');
  const [manual, setManual] = React.useState<Record<string, string>>({});

  // Payment account (user, 2026-08-02): the client's derived credit — money
  // they paid ahead (or overpaid) that the next collection can spend.
  const [credit, setCredit] = React.useState<number>(0);
  const [advanceOpen, setAdvanceOpen] = React.useState(false);
  const [advanceAmt, setAdvanceAmt] = React.useState('');
  const [advanceMethod, setAdvanceMethod] = React.useState('CASH');
  const [advanceBusy, setAdvanceBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [res, cr] = await Promise.all([
        clientsAPI.getBilling(clientId),
        clientsAPI.credit(clientId).catch(() => null),
      ]);
      if (res.success && res.data) setData(res.data);
      if (cr?.success && cr.data) setCredit(Number(cr.data.balance) || 0);
    } catch { /* surfaced by the client */ }
    finally { setLoading(false); }
  }, [clientId]);
  React.useEffect(() => { load(); }, [load]);

  const invoices = data?.invoices ?? [];
  const allOpen = invoices.filter(i => !i.isPaid);

  // Search the invoice list, because a client with two patients wants to pay
  // for one of them. Matches the patient's name/species or the invoice number;
  // a bare number is read as "outstanding at least this much", which is how
  // someone holding cash actually looks for the bill it covers.
  const q = search.trim().toLowerCase();
  const asAmount = q !== '' && !Number.isNaN(Number(q)) ? Number(q) : null;
  const matches = (i: typeof invoices[number]) => !q
    || (asAmount != null && (i.outstanding ?? i.total) >= asAmount)
    || !!i.pet?.name?.toLowerCase().includes(q)
    || !!i.pet?.species?.toLowerCase().includes(q)
    || i.visitId.includes(q);

  const visible = invoices.filter(matches);
  const open = allOpen.filter(matches);
  const selectable = open.filter(i => i.collectable);
  // OUTSTANDING, not `total`. A part-paid invoice owes its remainder, and
  // showing face value here overstated what the client had to hand over —
  // the server has always allocated against the remainder.
  const selectedTotal = allOpen.filter(i => selected.has(i.visitId))
    .reduce((s, i) => s + (i.outstanding ?? i.total), 0);

  const toggle = (visitId: string) =>
    setSelected(s => { const n = new Set(s); n.has(visitId) ? n.delete(visitId) : n.add(visitId); return n; });

  // ── Allocation maths ──────────────────────────────────────────────────────
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Blank means the whole selection; anything else is a short (or typo'd) pay.
  const tenderedNum = tendered.trim() === '' ? selectedTotal : round2(Number(tendered) || 0);
  const isShort = tenderedNum < selectedTotal - 0.005;
  const overTendered = tenderedNum > selectedTotal + 0.005;

  // What AUTO would do, computed here so the split is visible before it is
  // committed rather than being a surprise on the receipt. Mirrors the
  // server's FIFO: oldest invoice first until the money runs out.
  const autoSplit = React.useMemo(() => {
    const picked = open.filter(i => selected.has(i.visitId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let left = tenderedNum;
    const out: Record<string, number> = {};
    for (const inv of picked) {
      if (left <= 0.005) break;
      // Cap on what is still OWED, not face value — on a part-paid invoice the
      // preview otherwise allocates money to a balance that is already cleared.
      const apply = round2(Math.min(inv.outstanding ?? inv.total, left));
      if (apply > 0) { out[inv.visitId] = apply; left = round2(left - apply); }
    }
    return out;
  }, [open, selected, tenderedNum]);

  const manualTotal = round2(
    [...selected].reduce((s, id) => s + (Number(manual[id]) || 0), 0),
  );
  const remaining = round2(tenderedNum - manualTotal);
  // The effective split, whichever mode is active — drives the row previews.
  const effectiveSplit: Record<string, number> = allocMode === 'MANUAL'
    ? Object.fromEntries([...selected].map(id => [id, round2(Number(manual[id]) || 0)]))
    : autoSplit;

  const allocationInvalid =
    overTendered ||
    tenderedNum <= 0 ||
    (allocMode === 'MANUAL' && Math.abs(remaining) > 0.005);

  const collect = async () => {
    if (selected.size === 0 || allocationInvalid) return;
    setBusy(true);
    try {
      const res = await clientsAPI.collect(clientId, {
        visitIds: [...selected],
        paymentMethod: method,
        // Only send these when they actually change the outcome, so a plain
        // full collection stays the same request it always was.
        ...(isShort ? { amountTendered: tenderedNum } : {}),
        ...(allocMode === 'MANUAL'
          ? { allocations: [...selected].map(id => ({ visitId: id, amount: round2(Number(manual[id]) || 0) })).filter(a => a.amount > 0) }
          : {}),
      });
      if (res.success) {
        const settled = res.data?.settledVisitIds?.length ?? selected.size;
        const touched = res.data?.visitIds?.length ?? selected.size;
        toast.success(
          settled === touched
            ? `Collected ${money(res.data?.receipt?.total ?? selectedTotal, currency)} across ${touched} invoice${touched === 1 ? '' : 's'}`
            : `Collected ${money(res.data?.receipt?.total ?? tenderedNum, currency)} — ${settled} of ${touched} settled in full`,
        );
        setSelected(new Set());
        setTendered(''); setManual({}); setAllocMode('AUTO');
        await load();
        onChanged?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Collection failed'); }
    finally { setBusy(false); }
  };

  const recordAdvance = async () => {
    const amount = Number(advanceAmt);
    if (!(amount > 0)) { toast.error('Enter an amount'); return; }
    setAdvanceBusy(true);
    try {
      const res = await clientsAPI.recordAdvance(clientId, { amount, paymentMethod: advanceMethod });
      if (res.success) {
        toast.success(`${money(amount, currency)} added to the payment account`);
        setAdvanceOpen(false); setAdvanceAmt('');
        await load();
        onChanged?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to record the advance'); }
    finally { setAdvanceBusy(false); }
  };

  // Hard delete — for a payment that should never have existed (wrong client,
  // duplicate, wrong amount), where a void would leave a confusing ghost on the
  // statement. Void stays the default for genuine reversals.
  const deletePayment = async (id: string, coveredCount: number) => {
    const reason = prompt(
      `DELETE this payment permanently?\n\nUse Void instead if the payment was real and is being reversed — a void keeps the history.\nDelete only for a mistaken entry (wrong client, duplicate, wrong amount).\n\n${coveredCount} invoice${coveredCount === 1 ? '' : 's'} will go back to unpaid and the wallet credit is reversed.\n\nReason:`,
    );
    if (reason === null) return;
    setBusy(true);
    try {
      const res = await transactionsAPI.remove(id, reason || undefined);
      if (res.success) { toast.success('Payment deleted — invoices reopened'); await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to delete the payment'); }
    finally { setBusy(false); }
  };

  const voidPayment = async (id: string, coveredCount: number) => {
    const reason = prompt(
      `Void this payment?\n\nIt covers ${coveredCount} invoice${coveredCount === 1 ? '' : 's'} — all of them go back to unpaid and the wallet credit is reversed.\n\nReason (optional):`,
    );
    if (reason === null) return; // cancelled
    setBusy(true);
    try {
      const res = await transactionsAPI.void(id, reason || undefined);
      if (res.success) { toast.success('Payment voided — invoices reopened'); await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to void the payment'); }
    finally { setBusy(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-seafoam" /></div>;
  }

  const SUBS = [
    { id: 'invoices' as const, label: 'Invoices', icon: FileText, count: open.length },
    { id: 'payments' as const, label: 'Payments', icon: CreditCard, count: data?.payments.length ?? 0 },
    { id: 'receipts' as const, label: 'Receipts', icon: Receipt, count: data?.receipts.length ?? 0 },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      {/* Outstanding + sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {only ? (
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
            {(() => { const s = SUBS.find(x => x.id === only)!; return (<><s.icon size={12} /> {s.label} <span>({s.count})</span></>); })()}
          </div>
        ) : (
        <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          {SUBS.map(s => (
            <button key={s.id} onClick={() => setSub(s.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                sub === s.id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <s.icon size={12} /> {s.label}
              <span className="text-slate-400">({s.count})</span>
            </button>
          ))}
        </div>
        )}
        <div className="flex items-center gap-4">
          {/* Payment account — prepaid/overpaid money the next collection can
              spend. Clients can pay ahead; this is where it sits. */}
          <div className="text-right">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Payment account</p>
            <p className={`text-lg font-black font-mono ${credit > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{money(credit, currency)}</p>
            {canCollect && (
              <button type="button" onClick={() => setAdvanceOpen(o => !o)}
                className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-pine transition-colors">
                {advanceOpen ? 'Close' : '+ Record advance'}
              </button>
            )}
          </div>
          {(data?.outstanding ?? 0) > 0 && (
            <div className="text-right">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Outstanding</p>
              <p className="text-lg font-black font-mono text-amber-600">{money(data!.outstanding, currency)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Record an advance — money ahead of any bill; lands as spendable credit. */}
      {advanceOpen && canCollect && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Record advance payment</p>
          <input type="number" min={0} value={advanceAmt} onChange={e => setAdvanceAmt(e.target.value)} placeholder="Amount" autoFocus
            className="w-28 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-zinc-950 text-sm font-bold text-pine dark:text-zinc-100 text-right outline-none focus:ring-2 focus:ring-emerald-400/40" />
          <select value={advanceMethod} onChange={e => setAdvanceMethod(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-zinc-950 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 outline-none">
            <option value="CASH">Cash</option>
            <option value="MPESA">M-Pesa</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
          </select>
          <button type="button" onClick={recordAdvance} disabled={advanceBusy}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50">
            {advanceBusy ? 'Recording…' : 'Record'}
          </button>
          <p className="text-[9px] text-emerald-700/70 dark:text-emerald-400/70 basis-full">Sits in the payment account and is drawn automatically (or via "use credit") on the next collection. No invoice needed.</p>
        </div>
      )}

      {/* ── Invoices ── */}
      {sub === 'invoices' && (
        <div className="space-y-3">
          {canCollect && selectable.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <button type="button"
                onClick={() => setSelected(selected.size === selectable.length ? new Set() : new Set(selectable.map(i => i.visitId)))}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 transition-all">
                {selected.size === selectable.length ? 'Clear' : `Select all (${selectable.length})`}
              </button>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam">
                {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
              <span className="text-[10px] font-bold text-slate-400">
                {selected.size} selected · <span className="text-pine dark:text-zinc-100 font-black">{money(selectedTotal, currency)}</span>
              </span>

              {/* Amount tendered — blank settles the selection in full. */}
              <label className="inline-flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Amount</span>
                <input
                  type="number" min={0} step="0.01" inputMode="decimal"
                  value={tendered} onChange={e => setTendered(e.target.value)}
                  placeholder={selectedTotal.toFixed(2)}
                  disabled={selected.size === 0}
                  title="Leave blank to settle the selection in full"
                  className={`w-28 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-950 border rounded-lg text-[10px] font-black font-mono text-right text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam ${
                    overTendered ? 'border-rose-400' : 'border-slate-200 dark:border-zinc-800'
                  }`} />
              </label>

              {/* Only worth choosing a split once the money is short of the total. */}
              {isShort && selected.size > 1 && (
                <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800">
                  {(['AUTO', 'MANUAL'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setAllocMode(m)}
                      title={m === 'AUTO' ? 'Oldest invoice first' : 'Set each invoice by hand'}
                      className={`px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                        allocMode === m ? 'bg-seafoam text-white' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 hover:bg-slate-100'
                      }`}>
                      {m === 'AUTO' ? 'Oldest first' : 'Manual'}
                    </button>
                  ))}
                </div>
              )}

              <button type="button" onClick={collect} disabled={busy || selected.size === 0 || allocationInvalid}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-40 transition-all">
                {busy ? <Loader2 size={11} className="animate-spin" /> : <CreditCard size={11} />} Collect as one payment
              </button>

              {/* Why the button is disabled, or what a short payment will leave behind. */}
              {(overTendered || (allocMode === 'MANUAL' && isShort && Math.abs(remaining) > 0.005) || (isShort && !overTendered)) && (
                <p className={`w-full text-[9px] font-black uppercase tracking-wider ${
                  overTendered || (allocMode === 'MANUAL' && Math.abs(remaining) > 0.005) ? 'text-rose-500' : 'text-amber-600'
                }`}>
                  {overTendered
                    ? `That is more than the ${money(selectedTotal, currency)} selected — client credit isn't supported yet, so select more invoices instead.`
                    : allocMode === 'MANUAL' && Math.abs(remaining) > 0.005
                      ? `${money(Math.abs(remaining), currency)} ${remaining > 0 ? 'still to allocate' : 'over-allocated'}`
                      : `Short payment — ${money(selectedTotal - tenderedNum, currency)} will stay outstanding`}
                </p>
              )}
            </div>
          )}

          {invoices.length === 0 && (
            <div className="py-16 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-3xl opacity-30 uppercase font-black text-[10px] tracking-[0.2em]">
              No invoices
            </div>
          )}

          {/* Find the bill you are holding cash for: by patient (a client with
              two pets pays for one), or by typing an amount to see everything
              owing at least that much. */}
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by patient, visit #, or an amount outstanding…"
              className="w-full pl-8 pr-8 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30 placeholder:text-slate-400"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine">
                <X size={12} />
              </button>
            )}
          </div>
          {search && (
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {visible.length} of {invoices.length} shown
              {selected.size > 0 && ' · selection kept across the search'}
            </p>
          )}

          {/* One or many (user, 2026-08-02): tick rows individually or all at once. */}
          {canCollect && selectable.length > 0 && (
            <div className="flex items-center justify-end gap-2 mb-1.5">
              <button type="button"
                onClick={() => setSelected(prev => prev.size >= selectable.length ? new Set() : new Set(selectable.map(i => i.visitId)))}
                className="px-2.5 py-1 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/20">
                {selected.size >= selectable.length ? 'Clear selection' : `Select all · ${selectable.length}`}
              </button>
            </div>
          )}
          <div className="space-y-1.5">
            {visible.length === 0 && (
              <p className="px-3 py-6 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {invoices.length === 0 ? 'No invoices yet' : 'Nothing matches that search'}
              </p>
            )}
            {visible.map(inv => {
              const picked = selected.has(inv.visitId);
              const partly = !inv.isPaid && (inv.paid ?? 0) > 0;
              const docs = inv.invoices || [];
              const isExpanded = expandedVisit === inv.visitId;
              return (
                <div key={inv.visitId}
                  className={`px-3 py-2.5 rounded-xl border transition-all ${
                    picked ? 'border-seafoam bg-seafoam/5' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                  }`}>
                <div className="flex flex-wrap items-center gap-2">
                  {canCollect && !inv.isPaid && (
                    <input type="checkbox" checked={picked} disabled={!inv.collectable}
                      onChange={() => toggle(inv.visitId)}
                      title={inv.collectable ? 'Include in this collection' : 'Finalize the visit before collecting'}
                      className="w-4 h-4 rounded border-slate-300 text-seafoam focus:ring-seafoam disabled:opacity-30 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">
                      Visit #{inv.visitId}{inv.pet ? ` · ${inv.pet.name}` : ''}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      {fmt(inv.date)} · {String(inv.encounterType ?? '').replace('_', ' ').toLowerCase()}
                    </p>
                  </div>
                  {/* The ACTUAL invoice documents (user, 2026-08-02) — number,
                      split scope, status. Click a row's chevron for the
                      printable view. */}
                  {docs.map(d => (
                    <span key={d.id} className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      <FileText size={9} /> {d.number || `INV #${d.id}`}{d.scope && d.scope !== 'FULL' ? ` · ${String(d.scope).toLowerCase()}` : ''} · {String(d.status).toLowerCase()}
                    </span>
                  ))}
                  {inv.isPaid ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle2 size={9} /> {inv.prepaid ? 'Paid up front' : 'Paid'}
                    </span>
                  ) : !inv.collectable ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                      title="The visit is still open — its total can still change">
                      <AlertTriangle size={9} /> Not finalized
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Unpaid
                    </span>
                  )}
                  <span className="shrink-0 w-28 text-right">
                    <span className="block text-sm font-black font-mono text-pine dark:text-zinc-100">
                      {money(partly ? inv.outstanding : inv.total, currency)}
                    </span>
                    {/* Face value stays visible on a part-paid bill — the big
                        number is what is still owed, which is what you collect. */}
                    {partly && (
                      <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400"
                        title={`${money(inv.paid, currency)} already paid of ${money(inv.total, currency)}`}>
                        of {money(inv.total, currency)}
                      </span>
                    )}
                  </span>

                  {/* Every payment that went against THIS invoice. `settlements`
                      is many-to-many, so an invoice cleared by three payments
                      lists three — a single payment reference would be a lie. */}
                  {(inv.payments?.length ?? 0) > 0 && (
                    <div className="w-full pl-6 pt-1.5 mt-0.5 border-t border-slate-100 dark:border-zinc-800 space-y-0.5">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                        Paid by {inv.payments.length} payment{inv.payments.length === 1 ? '' : 's'}
                      </p>
                      {inv.payments.map(p => (
                        <div key={`${inv.visitId}-${p.id}`} className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 truncate">
                            #{p.id} · {String(p.method || '').replace('_', ' ')} · {fmt(p.date)}
                          </span>
                          <span className="text-[9px] font-black font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                            {money(p.amountApplied, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* What this invoice gets out of the payment being taken. */}
                  {picked && isShort && (
                    allocMode === 'MANUAL' ? (
                      <input
                        type="number" min={0} max={inv.outstanding ?? inv.total} step="0.01" inputMode="decimal"
                        value={manual[inv.visitId] ?? ''}
                        onChange={e => setManual(m => ({ ...m, [inv.visitId]: e.target.value }))}
                        placeholder="0.00"
                        title={`Apply to this invoice (max ${inv.total.toFixed(2)})`}
                        className={`shrink-0 w-24 px-2 py-1 bg-white dark:bg-zinc-950 border rounded-lg text-[10px] font-black font-mono text-right text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam ${
                          (Number(manual[inv.visitId]) || 0) > inv.total + 0.005 ? 'border-rose-400' : 'border-slate-200 dark:border-zinc-800'
                        }`} />
                    ) : (
                      <span className="shrink-0 w-24 text-right text-[10px] font-black font-mono text-seafoam"
                        title="Allocated automatically, oldest invoice first">
                        {money(effectiveSplit[inv.visitId] ?? 0, currency)}
                      </span>
                    )
                  )}
                  {/* A short payment leaves a real balance — say so before it happens. */}
                  {picked && isShort && (effectiveSplit[inv.visitId] ?? 0) < inv.total - 0.005 && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      title="This invoice will keep a balance after the payment">
                      {money(inv.total - (effectiveSplit[inv.visitId] ?? 0), currency)} left
                    </span>
                  )}

                  {onViewVisit && (
                    <button onClick={() => onViewVisit(Number(inv.visitId))}
                      className="shrink-0 text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70">View →</button>
                  )}
                  {docs.length > 0 && (
                    <button onClick={() => toggleExpand(inv)}
                      title={isExpanded ? 'Hide the invoice document' : 'Show the printable invoice'}
                      className="shrink-0 text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700">
                      {isExpanded ? 'Hide invoice ▴' : 'Invoice ▾'}
                    </button>
                  )}
                </div>

                {/* Printable invoice document (user, 2026-08-02) — lines from
                    the bill snapshot behind the invoice, print-ready. */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    {docLoading ? (
                      <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-seafoam" /></div>
                    ) : expandedDoc ? (
                      <div>
                        <div className="flex justify-end mb-1.5">
                          <button onClick={() => printElementAsPdf(`inv-print-${inv.visitId}`, `Invoice ${expandedDoc.number || ''}`, false)}
                            className="px-3 py-1.5 rounded-lg bg-seafoam text-white text-[9px] font-black uppercase tracking-widest hover:bg-pine">🖨 Print / download</button>
                        </div>
                        <div id={`inv-print-${inv.visitId}`} className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                          <div className="bg-pine text-white px-4 py-3 flex items-center justify-between">
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60">Invoice</p>
                              <p className="text-sm font-black">{expandedDoc.number || `INV #${expandedDoc.id}`}</p>
                            </div>
                            <div className="text-right text-[9px] font-bold text-white/70">
                              {inv.pet?.name ? <p>{inv.pet.name}</p> : null}
                              <p>{fmt(expandedDoc.createdAt || inv.date)}</p>
                              {expandedDoc.scope && expandedDoc.scope !== 'FULL' && <p className="uppercase">{String(expandedDoc.scope).toLowerCase()} split</p>}
                            </div>
                          </div>
                          <div className="p-4 bg-white dark:bg-zinc-900">
                            {(expandedDoc.lines || []).map((l: any) => (
                              <div key={l.id} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800 last:border-b-0">
                                <span className="text-xs font-bold text-pine dark:text-zinc-100">{l.name}{l.quantity !== 1 ? ` × ${l.quantity}` : ''}{l.category ? <span className="ml-2 text-[8px] font-black uppercase text-slate-400">{l.category}</span> : null}</span>
                                <span className="text-xs font-black font-mono text-pine dark:text-zinc-100">{money(Number(l.lineTotal), currency)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between items-end pt-2">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total{Number(expandedDoc.discount) > 0 ? ` · discount ${money(Number(expandedDoc.discount), currency)}` : ''}</span>
                              <span className="text-lg font-black font-mono text-pine dark:text-zinc-100">{money(Number(expandedDoc.total), currency)}</span>
                            </div>
                            {Number(expandedDoc.amountPaid) > 0 && (
                              <p className="text-right text-[9px] font-bold text-slate-400 mt-0.5">paid {money(Number(expandedDoc.amountPaid), currency)} · {money(Number(expandedDoc.outstanding ?? (Number(expandedDoc.total) - Number(expandedDoc.amountPaid))), currency)} outstanding</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="py-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Could not load the invoice document.</p>
                    )}
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Payments ── */}
      {sub === 'payments' && (
        <div className="space-y-1.5">
          {(data?.payments.length ?? 0) === 0 && (
            <div className="py-16 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-3xl opacity-30 uppercase font-black text-[10px] tracking-[0.2em]">
              No payments
            </div>
          )}
          {data?.payments.map(p => {
            const voided = p.status === 'VOIDED';
            return (
              <div key={p.id}
                className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border ${
                  voided ? 'border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 opacity-70' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                }`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-black truncate ${voided ? 'text-slate-400 line-through' : 'text-pine dark:text-zinc-100'}`}>
                    Payment #{p.id} · {p.method.replace('_', ' ')}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {fmt(p.settledAt || p.createdAt)}
                    {p.receiptNumber ? ` · ${p.receiptNumber}` : ''}
                    {voided && p.voidReason ? ` · voided: ${p.voidReason}` : ''}
                  </p>
                </div>
                {p.coveredCount > 1 && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-seafoam/15 text-seafoam"
                    title={`Covers visits ${p.coveredVisitIds.join(', ')}`}>
                    <Link2 size={9} /> {p.coveredCount} invoices
                  </span>
                )}
                {voided && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">Voided</span>
                )}
                <span className={`shrink-0 w-28 text-right text-sm font-black font-mono ${voided ? 'text-slate-400' : 'text-emerald-600'}`}>
                  {money(p.amount, currency)}
                </span>
                {canCollect && !voided && p.status === 'SETTLED' && (
                  <button onClick={() => voidPayment(p.id, p.coveredCount)} disabled={busy}
                    title="Void this payment — reverses it but keeps the history"
                    className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-40">
                    <Ban size={13} />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => deletePayment(p.id, p.coveredCount)} disabled={busy}
                    title="Delete this payment permanently — for a mistaken entry. Prefer Void for a real reversal."
                    className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-40">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Receipts ── */}
      {sub === 'receipts' && (
        <div className="space-y-1.5">
          {(data?.receipts.length ?? 0) === 0 && (
            <div className="py-16 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-3xl opacity-30 uppercase font-black text-[10px] tracking-[0.2em]">
              No receipts
            </div>
          )}
          {data?.receipts.map(r => (
            <div key={r.id}
              className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 ${
                r.voided ? 'bg-slate-50/60 dark:bg-zinc-950 opacity-70' : 'bg-white dark:bg-zinc-900'
              }`}>
              <Receipt size={14} className="text-seafoam shrink-0" />
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-black truncate ${r.voided ? 'text-slate-400 line-through' : 'text-pine dark:text-zinc-100'}`}>{r.receiptNumber}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {fmt(r.createdAt)} · {r.paymentMethod.replace('_', ' ')}
                  {/* 157: a receipt is FOR one filled bill. Pre-157 rows have no
                      visitId and were issued per payment, so they keep the old
                      "covers N invoices" wording rather than claiming a bill. */}
                  {r.visitId
                    ? ` · visit #${r.visitId}`
                    : r.coveredVisitIds.length > 1 ? ` · ${r.coveredVisitIds.length} invoices` : ''}
                </p>
              </div>
              {r.discount > 0 && (
                <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-emerald-600">−{money(r.discount, currency)}</span>
              )}
              {r.voided && (
                <span
                  title={r.voidReason || undefined}
                  className="shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                  {r.voidReason ? 'Un-issued' : 'Voided'}
                </span>
              )}
              {/* Final amount / paid / balance — all three on the document, so a
                  discount or write-off is visible rather than implied by a single
                  number. `amountPaid` is absent on pre-157 receipts; those fall
                  back to showing the total alone. */}
              <div className={`shrink-0 w-28 text-right ${r.voided ? 'text-slate-400' : 'text-pine dark:text-zinc-100'}`}>
                <span className="block text-sm font-black font-mono">{money(r.total, currency)}</span>
                {r.amountPaid != null && (
                  <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Paid {money(r.amountPaid, currency)}
                    {(r.balance ?? 0) > 0.005 ? ` · Bal ${money(r.balance!, currency)}` : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientPaymentsTab;
