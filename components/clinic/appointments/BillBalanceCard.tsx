import React from 'react';
import { Receipt, Printer } from 'lucide-react';
import { Visit } from '../../../types';
import { Bill } from '../../../services/modules/bills.api';
import { petsAPI } from '../../../services';
import { useData } from '../../../contexts/DataContext';
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
  /**
   * The unpaid list is per CLIENT, and a client can have several animals — so
   * "#135 · 27/07/2026" alone does not say who the debt is for (user,
   * 2026-08-21). `visit.pet` rides on the list rows, but fall back to the pets
   * store by id: a row whose `pet` the mapper never filled would otherwise
   * render a bare separator.
   */
  const { pets } = useData() as any;

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

  const petNameFor = (a: Visit): string | null =>
    a.pet?.name || (pets || []).find((p: any) => Number(p.id) === Number(a.petId))?.name || null;

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
  // What the VISIT's tasks add up to — the other half of the comparison above.
  // `visit.totalCost` is the pre-bill task sum, which is exactly the figure the
  // client-outstanding total is built from.
  const taskTotal = Number(visit.totalCost || 0);

  /**
   * ONE derivation, both rows (2026-08-23).
   *
   * "Due on this visit" printed a green **Settled** whenever `due <= 0`, with no
   * regard for whether anything had ever been billed — so a visit with a KES 0
   * draft bill claimed to be settled directly above a row reading "Nothing
   * billed yet" (user: *"why is payment status sttled n visit still in bill
   * stage"*). Two rows describing the same fact from two independent
   * expressions is how they came to contradict each other; they now share this.
   *
   * ⚠️ `Settled` is a claim that MONEY WAS COLLECTED. It must never appear
   * merely because a bill totals zero — a reassuring green on a visit nobody
   * has billed is worse than no label, because staff read it and move on.
   */
  /* Bill statuses that are NOT yet a receivable. Taken from the BillStatus
     enum: DRAFT (charges accumulating) and PENDING_REVIEW (vet reviewing).
     Checking only for 'DRAFT' would have called a bill still under review
     "Unpaid". VOID gets its own state — a cancelled bill owes nothing. */
  const billStatus = String(bill?.status || '').toUpperCase();
  const payState: 'unbilled' | 'void' | 'draft' | 'unpaid' | 'part' | 'paid' =
    billStatus === 'VOID' ? 'void'
      : thisVisit <= 0 ? 'unbilled'
        : (!bill || billStatus === 'DRAFT' || billStatus === 'PENDING_REVIEW') ? 'draft'
          : paid <= 0 ? 'unpaid'
            : due > 0 ? 'part'
              : 'paid';

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
        {/* ALWAYS shown, even at zero. Hiding the row when nothing is paid left
            no way to tell "nobody has paid" from "this card doesn't say"
            (user, 2026-08-18). */}
        <InfoRow label="Paid" value={`${currency} ${paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <InfoRow
          label="Due on this visit"
          value={payState === 'unbilled' || payState === 'void'
            ? <span className="text-slate-400 font-black">Nothing due yet</span>
            : due > 0
              ? <span className="text-amber-600 dark:text-amber-400 font-black">{currency} {due.toLocaleString()}</span>
              : <span className="text-emerald-600 dark:text-emerald-400 font-black">Settled</span>}
        />
        {/* Name the state outright rather than making it something you work out
            by comparing three numbers. */}
        <InfoRow
          label="Payment status"
          value={
            payState === 'void'
              ? <span className="text-slate-400 font-black">Bill voided</span>
              : payState === 'unbilled'
              ? <span className="text-slate-400 font-black">Nothing billed yet</span>
              /* A draft bill is not a receivable — nobody owes it until it is
                 approved. Calling it "Unpaid" made a bill still being edited
                 look like a debt the client was ignoring. */
              : payState === 'draft'
                ? <span className="text-slate-400 font-black">Draft bill — {currency} {thisVisit.toLocaleString()}, not yet approved</span>
                : payState === 'unpaid'
                  ? <span className="text-rose-600 dark:text-rose-400 font-black">Unpaid</span>
                  : payState === 'part'
                    ? <span className="text-amber-600 dark:text-amber-400 font-black">Part paid — {currency} {due.toLocaleString()} still due</span>
                    : <span className="text-emerald-600 dark:text-emerald-400 font-black">Paid in full</span>
          }
        />

        {/* ⚠️ THE TWO NUMBERS ON THIS CARD COME FROM DIFFERENT PLACES. "This
            visit" is the BILL total; "client outstanding" is built from the
            visit's task totals. When a bill was snapshotted early and never
            rebuilt they disagree wildly — prod visit 151 showed 3,528 against
            49,517 — and the card gave no hint why (user, 2026-08-18). */}
        {taskTotal > 0 && thisVisit > 0 && taskTotal - thisVisit > 1 && (
          <div className="mt-1.5 px-2.5 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
            <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 leading-relaxed">
              The bill is {currency} {(taskTotal - thisVisit).toLocaleString()} less than the work recorded on this visit
              ({currency} {taskTotal.toLocaleString()}).
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
              Usually a bill raised early — a stay that has run longer since, for instance. Press
              “Rebuild from visit” on the bill to pull the current figures in.
            </p>
          </div>
        )}
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
                <span className="min-w-0 text-[10px] font-bold text-pine dark:text-zinc-100 truncate">
                  #{a.id} · {formatDate(a.date)}
                  {petNameFor(a) && <span className="text-slate-500 dark:text-zinc-400"> · {petNameFor(a)}</span>}
                </span>
                <span className="shrink-0 text-[10px] font-black font-mono text-amber-700 dark:text-amber-400">{(a.totalCost || 0).toLocaleString()}</span>
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
