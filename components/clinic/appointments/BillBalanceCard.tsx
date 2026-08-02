import React from 'react';
import { Receipt, Printer } from 'lucide-react';
import { Visit } from '../../../types';
import { Bill } from '../../../services/modules/bills.api';
import { petsAPI } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import { InfoCard, InfoRow } from './PatientRail';
import { ApptStatus } from '../../../types';

/**
 * Bill & Balance — what this visit costs and what the client still owes.
 *
 * Moved off the patient rail and into the Bill & Invoice tab, next to the bill
 * it describes. On the rail it was a card about money sitting in a column about
 * the patient, and it was a SNAPSHOT: it read `visit.totalCost` and a pet
 * snapshot fetched once at mount, so editing a bill line left it quoting a
 * figure that was no longer true. Collapsing it by default only stopped it
 * misleading people; it didn't make it right.
 *
 * Now it reads the SAME `Bill` object `BillPanel` holds, so a line added or a
 * quantity fixed moves this card in the same tick, and the client's outstanding
 * balance is re-read whenever the bill's total or status moves.
 */

interface Props {
  visit: Visit;
  currency: string;
  allAppointments: Visit[];
  /** The live bill from BillPanel. Null until it loads — we fall back then. */
  bill: Bill | null;
  onNavigateToVisit?: (visitId: number) => void;
  /** Jump to the invoice sub-tab. */
  onOpenInvoice?: () => void;
}

const BillBalanceCard: React.FC<Props> = ({
  visit, currency, allAppointments, bill, onNavigateToVisit, onOpenInvoice,
}) => {
  const [snapshotBalance, setSnapshotBalance] = React.useState<number | null>(null);

  // Re-read the client's balance whenever the bill actually moves. Keyed on
  // total+status rather than the object: BillPanel replaces `bill` on every
  // mutation response, and an identity check would refetch on no-op saves.
  const billKey = bill ? `${bill.total}:${bill.status}` : 'none';
  React.useEffect(() => {
    let alive = true;
    petsAPI.getSnapshot(visit.petId)
      .then((r: any) => {
        if (alive && r.success && r.data?.snapshot?.finance) {
          setSnapshotBalance(r.data.snapshot.finance.outstandingBalance ?? null);
        }
      })
      .catch(() => { /* falls back to the local sum below */ });
    return () => { alive = false; };
  }, [visit.petId, billKey]);

  const unpaid = allAppointments
    .filter(a => a.clientId === visit.clientId && !a.isPaid
      && (a.status === ApptStatus.COMPLETED || a.status === ApptStatus.PENDING_PAYMENT))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const outstanding = snapshotBalance ?? unpaid.reduce((s, a) => s + (a.totalCost || 0), 0);

  // The bill is the authority on what this visit costs — `visit.totalCost` is
  // the pre-bill task sum and lags every line edit.
  const thisVisit = bill ? Number(bill.total || 0) : Number(visit.totalCost || 0);
  const paid = bill ? Number(bill.amountPaid || 0) : (visit.isPaid ? Number(visit.totalCost || 0) : 0);
  const due = Math.max(0, thisVisit - paid);

  return (
    <InfoCard
      icon={Receipt}
      title="Bill & Balance"
      defaultOpen
      summary={outstanding > 0
        ? `${currency} ${Number(outstanding).toLocaleString()} outstanding`
        : 'No outstanding balance'}
    >
      <div className="space-y-1.5">
        <InfoRow
          label="This visit"
          value={`${currency} ${thisVisit.toLocaleString()}${bill ? '' : ' (pre-bill)'}`}
        />
        {paid > 0 && <InfoRow label="Paid so far" value={`${currency} ${paid.toLocaleString()}`} />}
        <InfoRow
          label="Due on this visit"
          value={due > 0
            ? <span className="text-amber-600 dark:text-amber-400 font-black">{currency} {due.toLocaleString()}</span>
            : <span className="text-emerald-600 dark:text-emerald-400 font-black">Settled</span>}
        />
        <InfoRow
          label="Client outstanding"
          value={outstanding > 0
            ? <span className="text-amber-600 dark:text-amber-400 font-black">{currency} {Number(outstanding).toLocaleString()}</span>
            : 'None'}
        />

        {unpaid.length > 0 && (
          <div className="border-t border-slate-100 dark:border-zinc-800 pt-1.5 mt-1.5 space-y-1">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Unpaid visits</p>
            {unpaid.slice(0, 5).map(a => (
              <button
                key={a.id}
                onClick={() => onNavigateToVisit?.(a.id)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 hover:border-amber-400 transition-all text-left"
              >
                <span className="text-[10px] font-bold text-pine dark:text-zinc-100">#{a.id} · {formatDate(a.date)}</span>
                <span className="text-[10px] font-black font-mono text-amber-700 dark:text-amber-400">{(a.totalCost || 0).toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}

        {/* Only once the bill is generated (past its editable draft stage) is
            there an invoice or receipt to look at — showing this on a draft
            bill sent people to an empty tab. */}
        {onOpenInvoice && bill && !bill.editable && bill.status !== 'VOID' && (
          <button
            onClick={onOpenInvoice}
            className="w-full mt-1 px-2 py-1.5 rounded-lg bg-seafoam text-white text-[9px] font-black uppercase tracking-widest hover:bg-pine transition-all flex items-center justify-center gap-1.5"
          >
            <Printer size={11} /> Invoice &amp; receipts
          </button>
        )}
      </div>
    </InfoCard>
  );
};

export default BillBalanceCard;
