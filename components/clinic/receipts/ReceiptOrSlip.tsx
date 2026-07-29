import React from 'react';
import { Receipt, FileClock, AlertTriangle } from 'lucide-react';
import invoicesAPI from '../../../services/modules/invoices.api';
import type { VisitReconciliation } from '../../../services/modules/clients.api';

/**
 * What a visit's money actually looks like right now (migration 157, spec §7.9).
 *
 * There are two documents, and which one exists is not a display choice — it is
 * the model:
 *   · the bill is FILLED  → a RECEIPT, with its number
 *   · the bill is PART PAID → a RECONCILIATION SLIP, which is deliberately NOT a
 *     receipt and says so, because a receipt asserts the bill is settled
 *
 * Both carry the same three figures the user asked for — final amount, paid,
 * balance — so a discount, a write-off or a credit draw is visible rather than
 * hidden behind whichever single total was chosen.
 *
 * The slip is DERIVED server-side from the settlement rows and stores nothing,
 * so it cannot drift from the money after a void.
 */

const money = (n: number, currency: string) =>
  `${currency} ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  visitId: string | number;
  currency: string;
}

const Figure: React.FC<{ label: string; value: string; tone?: 'default' | 'due' | 'good' }> = ({ label, value, tone = 'default' }) => (
  <div className="flex justify-between items-center py-1.5">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <span
      className={`text-sm font-black font-mono ${
        tone === 'due'
          ? 'text-amber-600 dark:text-amber-400'
          : tone === 'good'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-pine dark:text-zinc-100'
      }`}>
      {value}
    </span>
  </div>
);

const ReceiptOrSlip: React.FC<Props> = ({ visitId, currency }) => {
  const [data, setData] = React.useState<VisitReconciliation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    invoicesAPI
      .reconciliationForVisit(visitId)
      .then((res) => {
        if (!alive) return;
        if (res?.data?.reconciliation) setData(res.data.reconciliation);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [visitId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="h-3 w-24 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse mb-3" />
        <div className="h-3 w-full bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" />
      </div>
    );
  }

  // Never block the document on this panel — the rest of the modal is still
  // useful, and a payment surface must degrade rather than take the page down.
  if (failed || !data) return null;

  const isReceipt = data.kind === 'RECEIPT_ISSUED' && !!data.receipt;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isReceipt
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
      }`}>
      <div className="flex items-center gap-2 mb-2">
        {isReceipt ? (
          <Receipt size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : (
          <FileClock size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
        )}
        <p
          className={`text-[10px] font-black uppercase tracking-widest ${
            isReceipt ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
          }`}>
          {isReceipt ? 'Receipt' : 'Payment reconciliation'}
        </p>
        <span className="ml-auto text-[10px] font-black font-mono text-slate-500 dark:text-zinc-400 truncate">
          {isReceipt ? data.receipt!.receiptNumber : data.reference}
        </span>
      </div>

      <div className="divide-y divide-slate-200/70 dark:divide-zinc-800">
        <Figure label="Final amount" value={money(data.finalAmount, currency)} />
        <Figure label={isReceipt ? 'Paid' : 'Paid so far'} value={money(data.paidSoFar, currency)} />
        <Figure
          label="Balance"
          value={money(data.balance, currency)}
          tone={data.balance > 0.005 ? 'due' : 'good'}
        />
      </div>

      {/* The whole point of the slip: it must not be mistaken for proof that
          the bill was settled. Say it outright rather than relying on colour. */}
      {!isReceipt && (
        <div className="mt-3 flex items-start gap-2 pt-3 border-t border-amber-200 dark:border-amber-800">
          <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
            This is not a receipt — the bill is not settled yet. A receipt is issued once the
            balance reaches zero.
          </p>
        </div>
      )}

      {data.payments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-zinc-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
            {data.payments.length === 1 ? 'Payment' : `${data.payments.length} payments`}
          </p>
          <div className="space-y-1">
            {data.payments.map((pm) => (
              <div key={pm.transactionId} className="flex justify-between items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 truncate">
                  {new Date(pm.paidAt).toLocaleDateString()} · {String(pm.method).replace('_', ' ')}
                </span>
                <span className="text-[11px] font-black font-mono text-pine dark:text-zinc-200 shrink-0">
                  {money(pm.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptOrSlip;
