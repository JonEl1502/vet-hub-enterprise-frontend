import React from 'react';
import toast from 'react-hot-toast';
import {
  Receipt, FileText, CreditCard, Loader2, CheckCircle2, Ban, AlertTriangle, Link2, Trash2,
} from 'lucide-react';
import { clientsAPI, transactionsAPI } from '../../../services';
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
}

const METHODS = ['CASH', 'M_PESA', 'CARD', 'BANK_TRANSFER'];

const money = (n: number, c: string) =>
  `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const ClientPaymentsTab: React.FC<Props> = ({ clientId, currency, canCollect, onViewVisit, onChanged }) => {
  const { user } = useAuth();
  // Permanent deletion is owner/manager/admin only — mirrors the server's
  // role gate on DELETE /transactions/:id so the button isn't offered to
  // someone who would just get a 403.
  const canDelete = ['SUPER_ADMIN', 'MERCHANT_ADMIN', 'CLINIC_OWNER', 'CLINIC_MANAGER'].includes(String(user?.role));
  const [sub, setSub] = React.useState<'invoices' | 'payments' | 'receipts'>('invoices');
  const [data, setData] = React.useState<ClientBilling | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [method, setMethod] = React.useState('CASH');
  const [busy, setBusy] = React.useState(false);
  // Allocation (backend P3). Blank `tendered` means "settle the selection in
  // full", which is what this tab did before there was a choice.
  const [tendered, setTendered] = React.useState('');
  const [allocMode, setAllocMode] = React.useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manual, setManual] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientsAPI.getBilling(clientId);
      if (res.success && res.data) setData(res.data);
    } catch { /* surfaced by the client */ }
    finally { setLoading(false); }
  }, [clientId]);
  React.useEffect(() => { load(); }, [load]);

  const invoices = data?.invoices ?? [];
  const open = invoices.filter(i => !i.isPaid);
  const selectable = open.filter(i => i.collectable);
  const selectedTotal = open.filter(i => selected.has(i.visitId)).reduce((s, i) => s + i.total, 0);

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
      const apply = round2(Math.min(inv.total, left));
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
        {(data?.outstanding ?? 0) > 0 && (
          <div className="text-right">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Outstanding</p>
            <p className="text-lg font-black font-mono text-amber-600">{money(data!.outstanding, currency)}</p>
          </div>
        )}
      </div>

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

          <div className="space-y-1.5">
            {invoices.map(inv => {
              const picked = selected.has(inv.visitId);
              return (
                <div key={inv.visitId}
                  className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                    picked ? 'border-seafoam bg-seafoam/5' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                  }`}>
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
                  <span className="shrink-0 w-28 text-right text-sm font-black font-mono text-pine dark:text-zinc-100">{money(inv.total, currency)}</span>

                  {/* What this invoice gets out of the payment being taken. */}
                  {picked && isShort && (
                    allocMode === 'MANUAL' ? (
                      <input
                        type="number" min={0} max={inv.total} step="0.01" inputMode="decimal"
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
                  {r.coveredVisitIds.length > 1 ? ` · ${r.coveredVisitIds.length} invoices` : ''}
                </p>
              </div>
              {r.discount > 0 && (
                <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-emerald-600">−{money(r.discount, currency)}</span>
              )}
              {r.voided && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">Voided</span>
              )}
              <span className={`shrink-0 w-28 text-right text-sm font-black font-mono ${r.voided ? 'text-slate-400' : 'text-pine dark:text-zinc-100'}`}>
                {money(r.total, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientPaymentsTab;
