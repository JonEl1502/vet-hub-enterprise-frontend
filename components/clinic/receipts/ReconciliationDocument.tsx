import React from 'react';
import { CheckCircle2, FileClock, AlertTriangle, Ban } from 'lucide-react';
import Money from '../../shared/common/Money';
import invoicesAPI from '../../../services/modules/invoices.api';
import type { VisitReconciliation } from '../../../services/modules/clients.api';

/**
 * THE money document for a visit (migration 157, spec §7.9).
 *
 * Which document this is, is not a display choice — it is the state of the
 * receivable, and the server decides:
 *   · balance zero  → a **RECEIPT**, carrying its real receipt number
 *   · balance owing → a **PAYMENT RECONCILIATION** slip, which says outright
 *     that it is not a receipt
 *
 * Why this component exists rather than the hand-built block it replaces: that
 * one rendered "Amount Paid = visit.totalCost" and was gated on `isPaid`. Under
 * 157 both are wrong — a bill can be filled for less than its face value (a
 * discount or a write-off), or part paid, and `totalCost` is not what anyone
 * handed over. Every figure here comes from the server's settlement rows.
 *
 * Prints through the house `printElementAsPdf`, so it carries `domId` and keeps
 * its colours under `print-color-adjust`.
 */

interface Line {
  id: string | number;
  name: string;
  amount: number | null;
  note?: string;
}

interface Props {
  visitId: string | number;
  clinicName: string;
  /** Currency the amounts are stored in. */
  sourceCurrency: string;
  /** Currency to display, for the per-document FX override. */
  targetCurrency: string;
  patient?: { name: string; species?: string; breed?: string } | null;
  client?: { name: string; phone?: string } | null;
  visitRef: string;
  visitDate: string;
  lines?: Line[];
  domId?: string;
  /** Bubbles the resolved state up so the caller can label its tab. */
  onLoaded?: (state: VisitReconciliation | null) => void;
  /**
   * Already-fetched state. Pass it when the caller needs the same data to
   * decide whether to show this document at all (the visit view labels its tab
   * from it) — otherwise both would request the same thing on every open.
   */
  data?: VisitReconciliation | null;
}

const ReconciliationDocument: React.FC<Props> = ({
  visitId, clinicName, sourceCurrency, targetCurrency,
  patient, client, visitRef, visitDate, lines = [], domId = 'receipt-content', onLoaded,
  data: provided,
}) => {
  const [fetched, setFetched] = React.useState<VisitReconciliation | null>(null);
  const [loading, setLoading] = React.useState(!provided);
  const [failed, setFailed] = React.useState(false);
  const data = provided ?? fetched;

  React.useEffect(() => {
    // Caller already has it — don't ask again.
    if (provided) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setFailed(false);
    invoicesAPI
      .reconciliationForVisit(visitId)
      .then((res) => {
        if (!alive) return;
        const r = res?.data?.reconciliation ?? null;
        if (r) setFetched(r); else setFailed(true);
        onLoaded?.(r);
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        onLoaded?.(null);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // `onLoaded` is deliberately not a dependency — callers pass an inline
    // closure, and including it would refetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId, provided]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 space-y-3">
        <div className="h-6 w-40 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-3 w-full bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-3 w-2/3 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" />
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Payment record unavailable
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          The document could not be loaded. The visit and its bill are unaffected.
        </p>
      </div>
    );
  }

  const isReceipt = data.kind === 'RECEIPT_ISSUED' && !!data.receipt;
  const accent = isReceipt ? 'emerald' : 'amber';

  // Tailwind cannot see interpolated class names, so the two palettes are
  // spelled out rather than built from `accent`.
  const head = isReceipt ? 'bg-emerald-600' : 'bg-amber-600';
  const panel = isReceipt
    ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 divide-emerald-100 dark:divide-emerald-900/30'
    : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 divide-amber-100 dark:divide-amber-900/30';
  const label = isReceipt ? 'text-emerald-600' : 'text-amber-600';
  const totalBar = isReceipt
    ? 'bg-emerald-600/10 border-emerald-600'
    : 'bg-amber-600/10 border-amber-600';
  const totalText = isReceipt
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-amber-700 dark:text-amber-400';
  const border = isReceipt
    ? 'border-emerald-200 dark:border-emerald-800/40'
    : 'border-amber-200 dark:border-amber-800/40';

  const amount = (v: number, cls: string) => (
    <Money
      amount={v}
      currency={sourceCurrency}
      target={targetCurrency}
      hideOriginal
      showCode
      primaryClassName={cls}
    />
  );

  return (
    <div id={domId} className={`bg-white dark:bg-zinc-900 border ${border} rounded-xl overflow-hidden shadow-sm`}>
      {/* Header */}
      <div className={`${head} text-white px-5 py-4 flex items-start justify-between gap-3`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isReceipt ? <CheckCircle2 size={16} /> : <FileClock size={16} />}
            <p className="text-lg font-black uppercase tracking-tighter">
              {isReceipt ? 'Receipt' : 'Payment Reconciliation'}
            </p>
          </div>
          {/* The receipt number is the real one from the receipts table; the
              slip's REC- reference is deliberately NOT in that series. */}
          <p className="text-[9px] text-white/70 font-bold mt-1 tracking-wider truncate">
            {isReceipt ? data.receipt!.receiptNumber : data.reference} · Visit #{visitRef} · {visitDate}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black uppercase tracking-tight">{clinicName}</p>
          <p className="text-[9px] text-white/70 mt-0.5 uppercase tracking-wider">
            {isReceipt ? 'Settled in full' : 'Balance outstanding'}
          </p>
        </div>
      </div>

      {/* Patient & client */}
      {(patient || client) && (
        <div className={`grid grid-cols-2 divide-x border-b ${panel}`}>
          <div className="px-4 py-3">
            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${label}`}>Patient</p>
            <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight">{patient?.name ?? '—'}</p>
            <p className="text-[9px] text-slate-400 leading-tight">
              {[patient?.species, patient?.breed].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${label}`}>Client</p>
            <p className="text-xs font-black text-pine dark:text-zinc-100 uppercase leading-tight">{client?.name ?? '—'}</p>
            <p className="text-[9px] text-slate-400 leading-tight">{client?.phone ?? ''}</p>
          </div>
        </div>
      )}

      {/* What was billed */}
      {lines.length > 0 && (
        <div className="p-4 space-y-1.5">
          {lines.map((l) => (
            <div key={l.id} className="flex justify-between items-baseline gap-3 py-1 border-b border-slate-100 dark:border-zinc-800 last:border-0">
              <span className="text-sm font-bold text-pine dark:text-zinc-200">
                {l.name}
                {l.note ? <span className="text-[9px] font-normal text-slate-400"> {l.note}</span> : null}
              </span>
              {l.amount != null
                ? amount(l.amount, 'text-sm font-black text-pine dark:text-zinc-100 font-mono tabular-nums')
                : <span className="text-[9px] text-slate-300">—</span>}
            </div>
          ))}
        </div>
      )}

      {/* The three figures. All present on both documents, so a discount or a
          write-off is visible rather than implied by a single number. */}
      <div className={`px-4 py-3 border-t ${panel} space-y-1`}>
        {Number((data as any).discount) > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</span>
            {amount((data as any).grossAmount ?? data.finalAmount, 'text-sm font-bold text-slate-500 dark:text-zinc-400 font-mono tabular-nums')}
          </div>
        )}
        {Number((data as any).discount) > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Discount applied</span>
            {amount(-Number((data as any).discount), 'text-sm font-black text-emerald-600 font-mono tabular-nums')}
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Final amount</span>
          {amount(data.finalAmount, 'text-sm font-black text-pine dark:text-zinc-100 font-mono tabular-nums')}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {isReceipt ? 'Paid' : 'Paid so far'}
          </span>
          {amount(data.paidSoFar, 'text-sm font-black text-pine dark:text-zinc-100 font-mono tabular-nums')}
        </div>
      </div>

      {/* Balance — the headline on a slip, the confirmation on a receipt. */}
      <div className={`flex justify-between items-center px-4 py-3 border-t-2 ${totalBar}`}>
        <span className={`text-[10px] font-black uppercase tracking-widest ${totalText}`}>
          {isReceipt ? 'Balance' : 'Balance due'}
        </span>
        {amount(data.balance, `text-2xl font-black font-mono tabular-nums tracking-tighter ${totalText}`)}
      </div>

      {/* The point of the slip: it must never read as proof of settlement. */}
      {!isReceipt && (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
          <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
            <span className="uppercase tracking-widest font-black">This is not a receipt.</span>{' '}
            It records what has been paid so far against this visit. A receipt is issued once the
            balance reaches zero.
          </p>
        </div>
      )}

      {/* Every payment that has landed against this receivable. One invoice
          filled by three payments shows all three — the many-to-many is what
          `settlements` has recorded since migration 105. */}
      {data.payments.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">
            {data.payments.length === 1 ? 'Payment received' : `${data.payments.length} payments received`}
          </p>
          <div className="space-y-1">
            {data.payments.map((pm) => (
              <div key={pm.transactionId} className="flex justify-between items-center gap-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 truncate">
                  {new Date(pm.paidAt).toLocaleDateString()} · {String(pm.method).replace('_', ' ')}
                </span>
                {amount(pm.amount, 'text-[11px] font-black text-pine dark:text-zinc-200 font-mono tabular-nums')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* A receipt that was un-issued because its payment was reversed. The row
          survives for audit, so say why rather than letting it look valid. */}
      {isReceipt && data.balance > 0.005 && (
        <div className="flex items-start gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border-t border-rose-200 dark:border-rose-800">
          <Ban size={13} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold text-rose-700 dark:text-rose-400">
            A balance is outstanding again — a payment behind this receipt was reversed.
          </p>
        </div>
      )}
    </div>
  );
};

export default ReconciliationDocument;
