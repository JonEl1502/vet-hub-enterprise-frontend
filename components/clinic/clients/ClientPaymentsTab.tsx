import React from 'react';
import toast from 'react-hot-toast';
import {
  Receipt, FileText, CreditCard, Loader2, CheckCircle2, Ban, AlertTriangle, Link2, Trash2,
  Search, X, Wallet, Tag,
} from 'lucide-react';
import { clientsAPI, transactionsAPI, invoicesAPI, dialog, clientDiscountsAPI } from '../../../services';
import type { InvoiceRow } from '../../../services/modules/invoices.api';
import { printElementAsPdf } from '../shared/printPdf';
import { ClientBilling } from '../../../services/modules/clients.api';
import { useAuth } from '../../../contexts/AuthContext';
import { isSettled } from './ClientAccountHub';
import RevenueStatusChip from '../shared/RevenueStatusChip';
import ReconciliationDocument from '../receipts/ReconciliationDocument';
import { useClinic } from '../../../contexts/ClinicContext';

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
  /**
   * Open the visit from a money row. Wired to `onOpenVisitBill`, so it lands on
   * the VISIT WORKFLOW with the **Bill tab** open — not the read-only details
   * view (user, 2026-08-06). Someone clicking through from an invoice or a
   * receipt is going there to look at the money, so start them on it.
   */
  onViewVisit?: (visitId: number) => void;
  onChanged?: () => void;
  /** Pin the tab to ONE view (and hide the sub-tab bar) — the client profile
   * now has top-level Invoices/Receipts tabs that each reuse this component. */
  only?: 'invoices' | 'payments' | 'receipts';
  /**
   * Switch to another account tab (Invoices / Receipts) — supplied by the
   * parent, which owns the tab state.
   */
  onGoTab?: (tab: string) => void;
  /**
   * Glow the payment(s) that settled THIS invoice, and scroll to the first.
   *
   * Set when arriving from "Money has already been collected against this
   * invoice" — that error named the blocker and left the user to find it, and a
   * client with a page of payments gives no clue which one is in the way
   * (user, 2026-08-20: "glow the borders of the payment where this invoice is").
   */
  highlightInvoiceId?: string | number | null;
  /**
   * "Open this visit's invoice when you load." Set by a cross-tab jump from a
   * payment's INV reference; the row scrolls into view and expands itself.
   */
  focusVisitId?: string | null;
  /** "Open this receipt when you load" — set by a jump from its payment row. */
  focusReceiptNumber?: string | null;
  /**
   * Narrow every list to ONE patient — the Patient → Financials tab reuses this
   * over the OWNER's billing payload. Bills are matched by their pet; payments
   * and receipts by the visits they cover. Collection still settles against the
   * client's account, so a payment raised here can only cover this pet's bills.
   */
  petId?: string | number;
  /** For the invoice/receipt document header — the client it is addressed to. */
  clientName?: string;
  clientPhone?: string;
}

const METHODS = ['CASH', 'M_PESA', 'CARD', 'BANK_TRANSFER'];

const money = (n: number, c: string) =>
  `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const ClientPaymentsTab: React.FC<Props> = ({ clientId, currency, canCollect, onViewVisit, onChanged, only, petId, clientName, clientPhone, onGoTab, focusVisitId, focusReceiptNumber, highlightInvoiceId }) => {
  const { user } = useAuth();
  // Scrolls the glowed payment into view — a client can have a page of them.
  const highlightRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!highlightInvoiceId) return;
    const t = setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    return () => clearTimeout(t);
  }, [highlightInvoiceId]);
  // Permanent deletion is owner/manager/admin only — mirrors the server's
  // role gate on DELETE /transactions/:id so the button isn't offered to
  // someone who would just get a 403.
  const canDelete = ['SUPER_ADMIN', 'MERCHANT_ADMIN', 'CLINIC_OWNER', 'CLINIC_MANAGER'].includes(String(user?.role));
  const [sub, setSub] = React.useState<'invoices' | 'payments' | 'receipts'>(only ?? 'invoices');
  const [data, setData] = React.useState<ClientBilling | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  // Per-row "Settle" (user, 2026-08-02): picking one invoice and jumping
  // straight to the collect bar, instead of hunting for its checkbox. It
  // REUSES the collect flow rather than opening a second payment path —
  // method, credit and allocation all stay in one place.
  const collectBarRef = React.useRef<HTMLDivElement>(null);
  const settleOne = (visitId: string) => {
    setSelected(new Set([visitId]));
    // The bar only mounts once something is selectable; let it paint first.
    requestAnimationFrame(() => {
      collectBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };
  // Expanded row → inline printable invoice document (user, 2026-08-02).
  /**
   * MANY invoices open at once (user, 2026-08-18). Opening one used to close
   * the last, which makes comparing two invoices — the actual reason you open
   * them side by side — impossible.
   */
  const [expandedVisits, setExpandedVisits] = React.useState<Set<string>>(new Set());
  // Receipts open in place too (user, 2026-08-04) — a receipt row that only
  // shows a number and a total is not the document anyone is looking for.
  const [expandedReceipt, setExpandedReceipt] = React.useState<string | null>(null);
  /**
   * Line items for the open receipt, from the INVOICE (`/visits/:id/invoice`)
   * rather than the bill — reading the bill materializes a draft as a side
   * effect, and the invoice is the document the receipt is against anyway.
   */
  const [receiptLines, setReceiptLines] = React.useState<{ id: string; name: string; amount: number | null }[]>([]);
  const { selectedClinics } = useClinic();
  const clinicName = selectedClinics[0]?.name ?? '';
  // One fetched document per visit, kept so re-opening is instant and so two
  // open invoices cannot overwrite each other's contents.
  const [docsByVisit, setDocsByVisit] = React.useState<Record<string, any>>({});
  const [loadingVisits, setLoadingVisits] = React.useState<Set<string>>(new Set());

  const toggleExpand = (inv: any) => {
    const id = String(inv.visitId);
    const opening = !expandedVisits.has(id);
    setExpandedVisits(prev => {
      const n = new Set(prev);
      opening ? n.add(id) : n.delete(id);
      return n;
    });
    const docId = inv.invoices?.[0]?.id;
    // Fetch once. A document already in hand is re-shown, not re-requested.
    if (opening && docId && !docsByVisit[id]) {
      setLoadingVisits(prev => new Set(prev).add(id));
      invoicesAPI.get(docId, { silent: true } as any)
        .then(r => { if (r.success && r.data?.invoice) setDocsByVisit(prev => ({ ...prev, [id]: r.data.invoice })); })
        .catch(() => {})
        .finally(() => setLoadingVisits(prev => { const n = new Set(prev); n.delete(id); return n; }));
    }
  };
  const [method, setMethod] = React.useState('CASH');
  const [busy, setBusy] = React.useState(false);
  // Allocation (backend P3). Blank `tendered` means "settle the selection in
  // full", which is what this tab did before there was a choice.
  const [tendered, setTendered] = React.useState('');
  // Spend the client's payment-account credit on this collection (drawn
  // before cash, oldest invoice first — server `useCredit`).
  /**
   * ON BY DEFAULT (user, 2026-08-13). Credit is the client's own money, already
   * in the clinic's hands — asking for cash while holding it is how the balance
   * grew. Flipped on as soon as a balance is known; staff can still switch it
   * off for a client deliberately holding credit back.
   */
  const [applyCredit, setApplyCredit] = React.useState(false);
  const [allocMode, setAllocMode] = React.useState<'AUTO' | 'MANUAL'>('AUTO');
  /**
   * How AUTO orders the invoices when the money is short (user, 2026-08-04:
   * "auto (oldest first) … or just add option oldest/highest amount, lowest
   * amt, most recent"). OLDEST is the server's own default, so it is the only
   * one that ships no `allocations` — the rest are computed here and sent
   * explicitly.
   */
  const [allocOrder, setAllocOrder] = React.useState<'OLDEST' | 'NEWEST' | 'HIGHEST' | 'LOWEST'>('OLDEST');
  const [search, setSearch] = React.useState('');
  // The payer's own reference (M-Pesa code, cheque no.). Optional, and stored
  // on the transaction's metadata so a repeated code cannot fail the payment.
  const [reference, setReference] = React.useState('');
  /**
   * Active discounts on this client. The collect flow could ALWAYS send a
   * discount, but nothing told the front desk one existed — so a client with a
   * standing 8% was charged full price unless someone remembered (user,
   * 2026-08-04). Applying one fills `discountType`/`discountValue`.
   */
  const [activeDiscounts, setActiveDiscounts] = React.useState<any[]>([]);
  const [appliedDiscount, setAppliedDiscount] = React.useState<any | null>(null);
  /**
   * What the collection actually did — kept on screen instead of a toast that
   * vanishes (user, 2026-08-04). Read straight from the server's response, so
   * it reports the allocation that HAPPENED, not the one the UI predicted.
   */
  const [posted, setPosted] = React.useState<null | {
    amount: number; receiptNumber?: string; creditAfter: number;
    allocations: { visitId: string; invoiceId: string | null; amountApplied: number; outstandingAfter: number }[];
  }>(null);
  /** Payment row expanded to its settlement breakdown — the manager audit view. */
  const [openPayment, setOpenPayment] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState<Record<string, string>>({});

  // Payment account (user, 2026-08-02): the client's derived credit — money
  // they paid ahead (or overpaid) that the next collection can spend.
  const [credit, setCredit] = React.useState<number>(0);
  const [advanceOpen, setAdvanceOpen] = React.useState(false);
  const [advanceAmt, setAdvanceAmt] = React.useState('');
  const [advanceMethod, setAdvanceMethod] = React.useState('CASH');
  const [advanceBusy, setAdvanceBusy] = React.useState(false);

  /**
   * Invoice DOCUMENTS for this client. The billing payload carries the visit's
   * bills and only a stub of each invoice ({id, number, scope, status, total}),
   * with no due date — so "overdue" was not computable from it at all. This
   * list has `dueDate`, `status` and `outstanding` per invoice, which is what
   * the counters and the overdue badge read (user, 2026-08-04).
   */
  const [invoiceDocs, setInvoiceDocs] = React.useState<InvoiceRow[]>([]);

  React.useEffect(() => {
    const r = receipts.find(x => String(x.id) === String(expandedReceipt));
    if (!expandedReceipt || !r?.visitId) { setReceiptLines([]); return; }
    let alive = true;
    invoicesAPI.forVisit(r.visitId, { silent: true } as any)
      .then(res => {
        if (!alive) return;
        const lines = res?.data?.invoice?.lines ?? [];
        setReceiptLines(lines.map((l: any) => ({
          id: String(l.id),
          name: `${l.name}${Number(l.quantity) > 1 ? ` ×${l.quantity}` : ''}`,
          amount: Number(l.lineTotal ?? 0),
        })));
      })
      .catch(() => setReceiptLines([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedReceipt]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [res, cr, iv] = await Promise.all([
        clientsAPI.getBilling(clientId),
        clientsAPI.credit(clientId).catch(() => null),
        invoicesAPI.list({ clientId }, { silent: true } as any).catch(() => null),
      ]);
      clientDiscountsAPI.getActive(Number(clientId))
        .then(r => setActiveDiscounts(r?.data?.discounts ?? []))
        .catch(() => setActiveDiscounts([]));
      if (res.success && res.data) setData(res.data);
      if (cr?.success && cr.data) {
        const bal = Number(cr.data.balance) || 0;
        setCredit(bal);
        setApplyCredit(bal > 0.005);
      }
      if (iv?.success && iv.data?.invoices) setInvoiceDocs(iv.data.invoices);
    } catch { /* surfaced by the client */ }
    finally { setLoading(false); }
  }, [clientId]);

  /**
   * visitId → its LIVE invoice document, for due dates, status and the amount.
   *
   * ⚠️ VOIDED INVOICES WERE WINNING. This kept the last document it saw per
   * visit and filtered nothing, so prod visit #159 — which carries a voided
   * INV-…026 for 2,300 and a live INV-…027 for 22,367 — displayed **2,300**
   * beside a chip naming …027, because the chip is built from
   * `getClientBilling` (which excludes VOID) and this map was not. One row
   * quoting two different invoices (user, 2026-08-13: "2,300.00 not matching").
   *
   * A voided document is not what anyone owes. On a SPLIT bill several live
   * invoices share a visit, so the newest is kept for dates/status and
   * `docTotalByVisit` below sums them for the amount — quoting one half of a
   * split as though it were the whole visit is the same class of error.
   */
  const liveDocsByVisit = React.useMemo(() => {
    const m = new Map<string, InvoiceRow[]>();
    for (const d of invoiceDocs) {
      if (!d.visitId || String((d as any).status).toUpperCase() === 'VOID') continue;
      const k = String(d.visitId);
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return m;
  }, [invoiceDocs]);

  const docByVisit = React.useMemo(() => {
    const m = new Map<string, InvoiceRow>();
    for (const [k, docs] of liveDocsByVisit) {
      const newest = [...docs].sort((a, b) =>
        new Date((b as any).issuedAt ?? 0).getTime() - new Date((a as any).issuedAt ?? 0).getTime())[0];
      if (newest) m.set(k, newest);
    }
    return m;
  }, [liveDocsByVisit]);

  /** Every live document on a visit, summed — a split bill is not one invoice. */
  const docTotalByVisit = React.useMemo(() => {
    const m = new Map<string, { total: number; outstanding: number; count: number }>();
    for (const [k, docs] of liveDocsByVisit) {
      m.set(k, {
        total: docs.reduce((s, d) => s + Number((d as any).total ?? 0), 0),
        outstanding: docs.reduce((s, d) => s + Number((d as any).outstanding ?? 0), 0),
        count: docs.length,
      });
    }
    return m;
  }, [liveDocsByVisit]);

  // Overdue = money still owed PAST a due date someone actually set. An invoice
  // with no due date is never overdue — the app does not invent payment terms.
  const startOfToday = React.useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const isOverdue = React.useCallback((visitId: string) => {
    const d = docByVisit.get(String(visitId));
    if (!d?.dueDate) return false;
    return Number(d.outstanding) > 0.005 && new Date(d.dueDate).getTime() < startOfToday;
  }, [docByVisit, startOfToday]);
  React.useEffect(() => { load(); }, [load]);

  // Patient scope: bills belong to a pet directly, payments and receipts only
  // through the visits they cover.
  const petKey = petId != null ? String(petId) : null;
  const invoices = petKey
    ? (data?.invoices ?? []).filter(i => String(i.pet?.id ?? '') === petKey)
    : (data?.invoices ?? []);
  const petVisitIds = React.useMemo(
    () => new Set(invoices.map(i => String(i.visitId))),
    [invoices],
  );
  const payments = petKey
    ? (data?.payments ?? []).filter(p => (p.coveredVisitIds ?? []).some(v => petVisitIds.has(String(v))))
    : (data?.payments ?? []);
  const receipts = petKey
    ? (data?.receipts ?? []).filter(r =>
        (r.visitId && petVisitIds.has(String(r.visitId)))
        || (r.coveredVisitIds ?? []).some(v => petVisitIds.has(String(v))))
    : (data?.receipts ?? []);

  /**
   * Arrived from a payment's receipt link. Open that receipt and scroll to it —
   * same contract as the invoice jump, and for the same reason: the right tab
   * at the wrong scroll position is still a hunt.
   *
   * Matched on the RECEIPT NUMBER rather than the id, because that is what the
   * payment row shows and therefore what the user just clicked.
   */
  const focusedReceiptRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!focusReceiptNumber || !receipts.length) return;
    if (focusedReceiptRef.current === focusReceiptNumber) return;
    const r = receipts.find(x => String(x.receiptNumber) === String(focusReceiptNumber));
    if (!r) return;
    focusedReceiptRef.current = focusReceiptNumber;
    setExpandedReceipt(String(r.id));
    setTimeout(() => {
      document.getElementById(`rcp-row-${focusReceiptNumber}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReceiptNumber, receipts.length]);
  /**
   * An INVOICE only exists once the visit is finalized and billed — the invoice
   * comes AFTER (user, 2026-08-03: "dont ever show an invoice if not finalized
   * and billed"). An open visit still accruing work is not a document the
   * client can be shown or asked to pay; it appeared here only as a row badged
   * "Not finalized", which invited exactly that.
   *
   * `collectable` is the server's own "this visit is finalized" signal, so the
   * list and the collect flow agree by construction.
   */
  /**
   * The INVOICES view lists invoice DOCUMENTS only (user, 2026-08-03: "on visit
   * created dont show shit in invoices tab till bill generates it"). A visit
   * that has only accrued charges is a BILL and lives on the Bills tab, where
   * its invoice is generated; it appears here the moment that happens.
   */
  const invoiceable = only === 'invoices'
    ? invoices.filter(i => (i.invoices?.length ?? 0) > 0)
    : invoices.filter(i => i.collectable || i.isPaid || (i.invoices?.length ?? 0) > 0);
  const notYetInvoiced = invoices.filter(i => !invoiceable.includes(i));
  const allOpen = invoiceable.filter(i => !isSettled(i));

  /**
   * Arrived here from a payment's INV link. Open that invoice and bring it into
   * view — landing on the right TAB but the wrong scroll position leaves the
   * user hunting the very row we just navigated for.
   *
   * Guarded on `invoices.length` so it fires once the list actually exists, and
   * on a ref so a re-render does not keep re-scrolling under the user.
   */
  const focusedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!focusVisitId || !invoices.length) return;
    if (focusedRef.current === focusVisitId) return;
    const inv = invoices.find(iv => String(iv.visitId) === String(focusVisitId));
    if (!inv) return;
    focusedRef.current = focusVisitId;
    if (!expandedVisits.has(String(focusVisitId))) toggleExpand(inv);
    // After the row expands — one frame is not enough, the document is fetched.
    setTimeout(() => {
      document.getElementById(`inv-row-${focusVisitId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusVisitId, invoices.length]);

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

  const visible = invoiceable.filter(matches);
  /** Invoice DOCUMENTS this client has, independent of the active tab or search. */
  const invoiceDocCount = invoices.filter(i => (i.invoices?.length ?? 0) > 0).length;
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
  // Credit spends FIRST (mirrors the server: drawn before cash is asked for,
  // oldest invoice first). It reduces the cash due; it is never part of it.
  const creditDraw = applyCredit ? round2(Math.min(credit, selectedTotal)) : 0;
  const cashDue = round2(selectedTotal - creditDraw);
  // Blank means "the cash the selection still needs"; anything else is a
  // short (or deliberate over-) pay.
  const tenderedNum = tendered.trim() === '' ? cashDue : round2(Number(tendered) || 0);
  const fundsTotal = round2(tenderedNum + creditDraw);
  const isShort = fundsTotal < selectedTotal - 0.005;
  // Over-tender is ALLOWED: the server keeps the surplus unapplied, which is
  // exactly what client credit is. Say so instead of blocking.
  const overTendered = fundsTotal > selectedTotal + 0.005;
  const surplus = overTendered ? round2(fundsTotal - selectedTotal) : 0;
  // Only the applied part of the cash spreads across invoices.
  const appliedCash = round2(Math.min(tenderedNum, cashDue));

  // How the credit would spread — oldest invoice first, same as the server.
  const creditSplit = React.useMemo(() => {
    const picked = open.filter(i => selected.has(i.visitId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let left = creditDraw;
    const out: Record<string, number> = {};
    for (const inv of picked) {
      if (left <= 0.005) break;
      const apply = round2(Math.min(inv.outstanding ?? inv.total, left));
      if (apply > 0) { out[inv.visitId] = apply; left = round2(left - apply); }
    }
    return out;
  }, [open, selected, creditDraw]);

  // What AUTO would do with the CASH, computed here so the split is visible
  // before it is committed rather than being a surprise on the receipt.
  // Mirrors the server's FIFO over what credit left behind.
  const autoSplit = React.useMemo(() => {
    const due = (i: typeof open[number]) => (i.outstanding ?? i.total);
    const order = {
      OLDEST:  (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      NEWEST:  (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      HIGHEST: (a: any, b: any) => due(b) - due(a),
      LOWEST:  (a: any, b: any) => due(a) - due(b),
    }[allocOrder];
    const picked = open.filter(i => selected.has(i.visitId)).sort(order);
    let left = appliedCash;
    const out: Record<string, number> = {};
    for (const inv of picked) {
      if (left <= 0.005) break;
      // Cap on what is still OWED after credit, not face value — on a
      // part-paid invoice the preview otherwise allocates money to a balance
      // that is already cleared.
      const due = round2((inv.outstanding ?? inv.total) - (creditSplit[inv.visitId] ?? 0));
      const apply = round2(Math.min(due, left));
      if (apply > 0) { out[inv.visitId] = apply; left = round2(left - apply); }
    }
    return out;
  }, [open, selected, appliedCash, creditSplit, allocOrder]);

  const manualTotal = round2(
    [...selected].reduce((s, id) => s + (Number(manual[id]) || 0), 0),
  );
  // Manual allocations describe the CASH split only (the server spreads the
  // credit itself), so they must add up to the cash being applied.
  const remaining = round2(appliedCash - manualTotal);
  // The effective split, whichever mode is active — drives the row previews.
  const effectiveSplit: Record<string, number> = allocMode === 'MANUAL'
    ? Object.fromEntries([...selected].map(id => [id, round2(Number(manual[id]) || 0)]))
    : autoSplit;

  const allocationInvalid =
    tenderedNum < 0 ||
    fundsTotal <= 0 ||
    (allocMode === 'MANUAL' && isShort && Math.abs(remaining) > 0.005);

  const collect = async () => {
    if (selected.size === 0 || allocationInvalid) return;
    setBusy(true);
    try {
      const res = await clientsAPI.collect(clientId, {
        visitIds: [...selected],
        paymentMethod: method,
        // Only send these when they actually change the outcome, so a plain
        // full collection stays the same request it always was. An explicit
        // amount is sent whenever the user typed one — the server's default
        // is "the cash still due after credit", which a typed value overrides
        // in BOTH directions (short pay and deliberate overpay-into-credit).
        ...(tendered.trim() !== '' ? { amountTendered: tenderedNum } : {}),
        ...(applyCredit && creditDraw > 0 ? { useCredit: true } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(appliedDiscount
          ? { discountType: appliedDiscount.discountType, discountValue: Number(appliedDiscount.value) }
          : {}),
        ...(allocMode === 'MANUAL' && isShort
          ? { allocations: [...selected].map(id => ({ visitId: id, amount: round2(Number(manual[id]) || 0) })).filter(a => a.amount > 0) }
          // A non-default order is expressed as explicit allocations — the
          // server only knows oldest-first, so anything else must be spelled
          // out or it would quietly fall back to FIFO.
          : allocMode === 'AUTO' && isShort && allocOrder !== 'OLDEST'
          ? { allocations: Object.entries(autoSplit).map(([visitId, amount]) => ({ visitId, amount })).filter(a => a.amount > 0) }
          : {}),
      });
      if (res.success) {
        setReference('');
        setAppliedDiscount(null);
        setPosted({
          amount: Number(res.data?.transaction?.amount ?? fundsTotal),
          receiptNumber: res.data?.receipt?.receiptNumber,
          allocations: res.data?.allocations ?? [],
          creditAfter: Math.max(0, round2(credit - creditDraw + surplus)),
        });
        const settled = res.data?.settledVisitIds?.length ?? selected.size;
        const touched = res.data?.visitIds?.length ?? selected.size;
        toast.success(
          settled === touched
            ? `Collected ${money(res.data?.receipt?.total ?? fundsTotal, currency)} across ${touched} invoice${touched === 1 ? '' : 's'}`
            : `Collected ${money(res.data?.receipt?.total ?? fundsTotal, currency)} — ${settled} of ${touched} settled in full`,
        );
        setSelected(new Set());
        setTendered(''); setManual({}); setAllocMode('AUTO'); setApplyCredit(false);
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
    const reason = await dialog.prompt({
      title: 'Delete this payment permanently?',
      variant: 'danger',
      message: `Use Void instead if the payment was real and is being reversed — a void keeps the history.\nDelete only for a mistaken entry (wrong client, duplicate, wrong amount).\n\n${coveredCount} invoice${coveredCount === 1 ? '' : 's'} will go back to unpaid and the wallet credit is reversed.`,
      label: 'Reason',
      placeholder: 'Why is this being deleted?',
      confirmLabel: 'Delete permanently',
      required: true,
    });
    if (reason === null) return;
    setBusy(true);
    try {
      const res = await transactionsAPI.remove(id, reason || undefined);
      if (res.success) { toast.success('Payment deleted — invoices reopened'); await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to delete the payment'); }
    finally { setBusy(false); }
  };

  const voidPayment = async (id: string, coveredCount: number) => {
    const reason = await dialog.prompt({
      title: 'Void this payment?',
      variant: 'danger',
      message: `It covers ${coveredCount} invoice${coveredCount === 1 ? '' : 's'} — all of them go back to unpaid and the wallet credit is reversed.`,
      label: 'Reason (optional)',
      placeholder: 'e.g. entered twice, wrong client',
      confirmLabel: 'Void payment',
    });
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
    // ⚠️ Counts INVOICE DOCUMENTS, not open ones. It used to be `open.length`,
    // which excludes settled invoices — so a client whose only invoice was PAID
    // read "INVOICES (0)" directly above that invoice (reported 2026-08-06).
    //
    // Deliberately NOT `visible`/`invoiceable`: both are derived from `only`,
    // the ACTIVE tab, so the chip would have shown a different number depending
    // on which tab you were standing on. This uses the same rule the Invoices
    // tab itself applies — "has an invoice document" — and is search-independent,
    // matching Payments and Receipts, which also count totals rather than the
    // filtered view. The "N of M shown" line above the list covers search.
    { id: 'invoices' as const, label: 'Invoices', icon: FileText, count: invoiceDocCount },
    { id: 'payments' as const, label: 'Payments', icon: CreditCard, count: payments.length },
    { id: 'receipts' as const, label: 'Receipts', icon: Receipt, count: receipts.length },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      {/* ── Payment posted — what the server actually did with the money ── */}
      {posted && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 sm:p-5 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-black text-pine dark:text-zinc-100">Payment posted · {money(posted.amount, currency)}</p>
              {posted.receiptNumber && (
                <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">Receipt {posted.receiptNumber}</p>
              )}
            </div>
            <button type="button" onClick={() => setPosted(null)}
              className="ml-auto px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam transition-all">
              Done
            </button>
          </div>
          {posted.allocations.length > 0 && (
            <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800">
              {posted.allocations.map(al => {
                const inv = invoices.find(iv => String(iv.visitId) === String(al.visitId));
                const cleared = Number(al.outstandingAfter) <= 0.005;
                return (
                  <div key={al.visitId} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">
                      Visit #{al.visitId}{inv?.pet ? ` · ${inv.pet.name}` : ''}
                    </span>
                    <span className="text-[11px] font-black font-mono text-pine dark:text-zinc-100">{money(al.amountApplied, currency)}</span>
                    <RevenueStatusChip status={cleared ? 'PAID' : 'PARTIAL'}
                      suffix={cleared ? undefined : `· ${money(al.outstandingAfter, currency)} left`} />
                  </div>
                );
              })}
            </div>
          )}
          {posted.creditAfter > 0.005 && (
            <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
              Client credit after this payment: {money(posted.creditAfter, currency)}
            </p>
          )}
        </div>
      )}

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
        {/* THE NUMBERS USED TO BE REPEATED HERE.
            "Payment account" and "Outstanding" were printed again in this row,
            directly beneath the Credit Available and Current Balance stat
            cards, which sit beneath the profile header's Available Credit and
            Outstanding Balance — the same two figures three times on one
            screen (user, 2026-08-13: "this is a repetition"). The ACTION is the
            only thing that was unique to this row, so only it stays. */}
        {canCollect && (
          <button type="button" onClick={() => setAdvanceOpen(o => !o)}
            className="shrink-0 text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-pine transition-colors">
            {advanceOpen ? 'Close' : '+ Receive payment'}
          </button>
        )}
      </div>

      {/* Record an advance — money ahead of any bill; lands as spendable credit. */}
      {advanceOpen && canCollect && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Receive a payment</p>
          <input type="number" min={0} value={advanceAmt} onChange={e => setAdvanceAmt(e.target.value)} placeholder="Amount" autoFocus
            className="w-28 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-zinc-950 text-sm font-bold text-pine dark:text-zinc-100 text-right outline-none focus:ring-2 focus:ring-emerald-400/40" />
          <select value={advanceMethod} onChange={e => setAdvanceMethod(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-zinc-950 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 outline-none">
            <option value="CASH">Cash</option>
            <option value="M_PESA">M-Pesa</option>
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
          {/* Where this client stands, in counts rather than money — the
              question the front desk asks first is "how many are open, and is
              anything late?" (user, 2026-08-04). */}
          {invoiceable.length > 0 && (() => {
            const openN = invoiceable.filter(i => !isSettled(i)).length;
            const overdueN = invoiceable.filter(i => isOverdue(i.visitId)).length;
            const paidN = invoiceable.filter(i => isSettled(i)).length;
            return (
              <div className="grid grid-cols-3 rounded-xl border border-slate-200 dark:border-zinc-800 divide-x divide-slate-200 dark:divide-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                {[
                  { l: 'Open', v: openN, cls: openN > 0 ? 'text-amber-600' : 'text-slate-400' },
                  { l: 'Overdue', v: overdueN, cls: overdueN > 0 ? 'text-rose-500' : 'text-slate-400' },
                  { l: 'Paid', v: paidN, cls: 'text-emerald-600 dark:text-emerald-400' },
                ].map(c => (
                  <div key={c.l} className="px-3 py-2 text-center">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{c.l}</p>
                    <p className={`text-base font-black ${c.cls}`}>{c.v}</p>
                  </div>
                ))}
              </div>
            );
          })()}
          {/* Open visits are NOT invoices yet — say so, rather than leaving the
              front desk wondering where a visit went. */}
          {notYetInvoiced.length > 0 && (
            <p className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
              {notYetInvoiced.length} bill{notYetInvoiced.length === 1 ? '' : 's'} not shown — they become invoices on the Bills tab, where you generate the invoice.
            </p>
          )}
          {canCollect && selectable.length > 0 && (
            <div ref={collectBarRef} className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
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

              {/* Use credit — spends the payment account before cash is asked
                  for (server `useCredit`, drawn oldest invoice first). */}
              {credit > 0 && (
                <button type="button"
                  onClick={() => setApplyCredit(v => !v)}
                  disabled={selected.size === 0}
                  title="Spend the client's payment-account credit on this collection — drawn before cash, oldest invoice first"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all disabled:opacity-40 ${
                    applyCredit
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-zinc-950 text-emerald-600 border-emerald-300 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  }`}>
                  <Wallet size={11} />
                  {applyCredit ? `Deducting ${money(creditDraw, currency)} from credit` : `Credit NOT used · ${money(credit, currency)} available`}
                </button>
              )}

              {/* Amount tendered — blank settles the (post-credit) cash due. */}
              <label className="inline-flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cash</span>
                <input
                  type="number" min={0} step="0.01" inputMode="decimal"
                  value={tendered} onChange={e => setTendered(e.target.value)}
                  placeholder={cashDue.toFixed(2)}
                  disabled={selected.size === 0}
                  title="Leave blank to settle the selection in full (after any credit)"
                  className="w-28 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] font-black font-mono text-right text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
              </label>

              {/* Only worth choosing a split once the money is short of the total. */}
              {isShort && selected.size > 1 && (
                <div className="inline-flex flex-wrap items-center gap-1.5">
                  <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800">
                    {(['AUTO', 'MANUAL'] as const).map(m => (
                      <button key={m} type="button" onClick={() => setAllocMode(m)}
                        title={m === 'AUTO' ? 'Spread the money automatically' : 'Set each invoice by hand'}
                        className={`px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                          allocMode === m ? 'bg-seafoam text-white' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 hover:bg-slate-100'
                        }`}>
                        {m === 'AUTO' ? 'Auto' : 'Manual'}
                      </button>
                    ))}
                  </div>
                  {allocMode === 'AUTO' && (
                    <select value={allocOrder} onChange={e => setAllocOrder(e.target.value as any)}
                      title="Which invoices the money clears first"
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300">
                      <option value="OLDEST">Oldest first</option>
                      <option value="NEWEST">Most recent first</option>
                      <option value="HIGHEST">Highest amount first</option>
                      <option value="LOWEST">Lowest amount first</option>
                    </select>
                  )}
                </div>
              )}

              <button type="button" onClick={collect} disabled={busy || selected.size === 0 || allocationInvalid}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-seafoam/90 disabled:opacity-40 transition-all">
                {busy ? <Loader2 size={11} className="animate-spin" /> : <CreditCard size={11} />}
                {busy ? 'Collecting…'
                  : selected.size === 0 ? 'Tick an invoice to collect'
                  : `Collect ${money(Math.max(0, cashDue), currency)}${selected.size > 1 ? ` · ${selected.size} invoices` : ''}`}
              </button>

              {/* How the money stacks up: credit + cash vs the selection, what
                  a short pay leaves behind, where a surplus goes. */}
              {applyCredit && creditDraw > 0 && selected.size > 0 && (
                /* Bold, and honest about the shortfall. Informational only —
                   staff read it and carry on collecting the rest. */
                cashDue > 0.005 ? (
                  <div className="w-full rounded-lg border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                      Credit does not cover the selection
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold text-amber-700/90 dark:text-amber-400/90">
                      Deducting <b>{money(creditDraw, currency)}</b> from credit against{' '}
                      <b>{money(selectedTotal, currency)}</b> selected — <b>{money(cashDue, currency)}</b> still to collect.
                    </p>
                  </div>
                ) : (
                  <div className="w-full rounded-lg border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                      Paying from credit
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold text-emerald-700/90 dark:text-emerald-400/90">
                      <b>{money(creditDraw, currency)}</b> comes off credit — nothing to collect.{' '}
                      <b>{money(Math.max(0, credit - creditDraw), currency)}</b> stays on account.
                    </p>
                  </div>
                )
              )}
              {((allocMode === 'MANUAL' && isShort && Math.abs(remaining) > 0.005) || isShort || overTendered) && (
                <p className={`w-full text-[9px] font-black uppercase tracking-wider ${
                  allocMode === 'MANUAL' && isShort && Math.abs(remaining) > 0.005 ? 'text-rose-500' : 'text-amber-600'
                }`}>
                  {allocMode === 'MANUAL' && isShort && Math.abs(remaining) > 0.005
                    ? `${money(Math.abs(remaining), currency)} ${remaining > 0 ? 'still to allocate' : 'over-allocated'}`
                    : isShort
                      ? `Short payment — ${money(round2(selectedTotal - fundsTotal), currency)} will stay outstanding`
                      : `${money(surplus, currency)} more than the selection — the surplus is saved as client credit`}
                </p>
              )}

              <label className="inline-flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ref</span>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                  placeholder="M-Pesa code, cheque no."
                  title="The payer's own reference — optional, stored with the payment"
                  className="w-40 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-bold text-pine dark:text-zinc-100" />
              </label>

              {/* This client HAS a discount — say so where the money is taken. */}
              {activeDiscounts.length > 0 && (
                <div className="w-full flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                  <Tag size={13} className="text-emerald-600 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    {activeDiscounts.length === 1 ? 'Client discount' : `${activeDiscounts.length} client discounts`}
                  </span>
                  {activeDiscounts.map((d: any) => {
                    const on = String(appliedDiscount?.id) === String(d.id);
                    return (
                      <button key={d.id} type="button"
                        onClick={() => setAppliedDiscount(on ? null : d)}
                        title={d.note || `Apply ${d.name}`}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all ${
                          on ? 'bg-emerald-600 text-white border-emerald-600'
                             : 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                        }`}>
                        {d.name} · {d.discountType === 'PERCENTAGE' ? `${d.value}%` : money(Number(d.value), currency)}
                        {on ? ' ✓' : ''}
                      </button>
                    );
                  })}
                  <span className="text-[9px] font-bold text-emerald-700/70 dark:text-emerald-400/70">
                    {appliedDiscount ? 'Applied to this collection' : 'Tap to apply'}
                  </span>
                </div>
              )}

              {/* BEFORE / AFTER — what this payment does to the account, spelled
                  out before it is posted (user, 2026-08-04, reference design).
                  Every figure is derived from the same numbers the collect call
                  uses, so the preview and the outcome cannot disagree. */}
              {selected.size > 0 && fundsTotal > 0 && (
                <div className="w-full grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-slate-200 dark:border-zinc-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                  {[
                    { l: 'Outstanding before', v: money(selectedTotal, currency), cls: 'text-pine dark:text-zinc-100' },
                    { l: 'Payment amount', v: money(fundsTotal, currency), cls: 'text-pine dark:text-zinc-100' },
                    {
                      l: 'Outstanding after',
                      v: money(Math.max(0, round2(selectedTotal - fundsTotal)), currency),
                      cls: isShort ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400',
                    },
                    {
                      // Credit drawn REDUCES the balance; a surplus ADDS to it.
                      l: 'Client credit after',
                      v: money(Math.max(0, round2(credit - creditDraw + surplus)), currency),
                      cls: 'text-purple-500',
                    },
                  ].map(c => (
                    <div key={c.l} className="px-3 py-2 text-center">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{c.l}</p>
                      <p className={`text-xs font-black font-mono ${c.cls}`}>{c.v}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Who the server will record as having taken the money. Shown,
                  not typed: it is `req.user` on the API, so a free-text name
                  here would be a different person from the one on the record. */}
              {/* WHAT THIS BAR DOES, in a sentence. It is a dense row of
                  controls — a method, a credit toggle, a cash box, a reference,
                  and a button — and nothing said that ticking several invoices
                  takes ONE payment across them, reversible as a unit (user,
                  2026-08-13: "the ui to pay is confusing a bit"). */}
              <p className="w-full text-[10px] font-bold text-slate-500 dark:text-zinc-400 leading-relaxed">
                {selected.size === 0
                  ? 'Tick the invoices you are collecting for. Several at once become ONE payment — reversible as a unit.'
                  : selected.size === 1
                    ? `Collecting for 1 invoice · ${money(Math.max(0, cashDue), currency)} in cash${credit > 0.005 ? ' after any credit applied' : ''}.`
                    : `${selected.size} invoices settle together as ONE payment of ${money(Math.max(0, cashDue), currency)}. Void it later and all ${selected.size} go back to unpaid.`}
              </p>
              {user && (
                <p className="w-full text-[9px] font-bold text-slate-400">
                  Received by <span className="text-slate-600 dark:text-zinc-300 font-black">{(user as any).name || (user as any).email}</span>
                  {surplus > 0.005 ? ' · the unallocated surplus is saved as client credit' : ''}
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
              const settled = isSettled(inv);
              const partly = !settled && (inv.paid ?? 0) > 0;
              const docs = inv.invoices || [];
              const isExpanded = expandedVisits.has(String(inv.visitId));
              // Per-row document and loading flag — with several rows open, a
              // single shared `expandedDoc` would show one invoice's lines
              // under another invoice's header.
              const expandedDoc = docsByVisit[String(inv.visitId)] ?? null;
              const docLoading = loadingVisits.has(String(inv.visitId));
              return (
                <div key={inv.visitId}
                  id={`inv-row-${inv.visitId}`}
                  className={`px-3 py-2.5 rounded-xl border transition-all ${
                    picked ? 'border-seafoam bg-seafoam/5' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                  }`}>
                <div className="flex flex-wrap items-center gap-2">
                  {canCollect && !settled && (
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
                  {/* Past its due date and still owing. Only shows when a due
                      date was actually set on the invoice. */}
                  {!settled && isOverdue(inv.visitId) && (() => {
                    const d = docByVisit.get(String(inv.visitId));
                    const days = d?.dueDate
                      ? Math.floor((startOfToday - new Date(d.dueDate).setHours(0, 0, 0, 0)) / 86400000)
                      : 0;
                    return (
                      <span title={d?.dueDate ? `Due ${fmt(d.dueDate)}` : undefined}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                        <AlertTriangle size={9} /> Overdue{days > 0 ? ` · ${days}d` : ''}
                      </span>
                    );
                  })()}
                  {settled ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle2 size={9} /> {inv.prepaid ? 'Paid up front' : 'Paid'}
                    </span>
                  ) : !inv.collectable ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                      title="The visit is still open and has no invoice yet, so its total can still change">
                      <AlertTriangle size={9} /> Not finalized
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Unpaid
                    </span>
                  )}
                  <span className="shrink-0 w-28 text-right">
                    {/* An INVOICE row quotes the INVOICE, not the visit. They
                        diverge the moment work is added after the invoice was
                        issued: visit 131 read 1,717 against a 1,517 invoice
                        (user, 2026-08-04). The document is what the client owes. */}
                    <span className="block text-sm font-black font-mono text-pine dark:text-zinc-100">
                      {(() => {
                        const agg = only === 'invoices' ? docTotalByVisit.get(String(inv.visitId)) : null;
                        if (agg) return money(agg.outstanding > 0.005 ? agg.outstanding : agg.total, currency);
                        return money(partly ? inv.outstanding : inv.total, currency);
                      })()}
                    </span>
                    {/* Face value stays visible on a part-paid bill — the big
                        number is what is still owed, which is what you collect. */}
                    {partly && (
                      <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400"
                        title={`${money(inv.paid, currency)} already paid of ${money(inv.total, currency)}`}>
                        of {money(inv.total, currency)}
                      </span>
                    )}
                    {/**
                      * DISCOUNT ON THE INVOICE ROW.
                      *
                      * Receipt rows in this tab have always shown their discount;
                      * invoice rows showed only a total, so money the client was
                      * let off was invisible until a receipt existed for it
                      * (user, 2026-08-21: "invoice show discounts too there").
                      * Summed across the visit's documents — a split-invoiced
                      * visit carries one per document.
                      */}
                    {(() => {
                      const disc = (inv.invoices || []).reduce((n: number, d: any) => n + Number(d?.discount ?? 0), 0);
                      if (!(disc > 0.005)) return null;
                      return (
                        <span className="block text-[8px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                          title="Discount already applied to this invoice">
                          −{money(disc, currency)} discount
                        </span>
                      );
                    })()}
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

                  {/* What this invoice gets from the payment account. */}
                  {picked && applyCredit && (creditSplit[inv.visitId] ?? 0) > 0 && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      title="Covered from the client's payment-account credit">
                      credit {money(creditSplit[inv.visitId], currency)}
                    </span>
                  )}
                  {/* What this invoice gets out of the CASH being taken. */}
                  {picked && isShort && (
                    allocMode === 'MANUAL' ? (
                      <input
                        type="number" min={0}
                        max={round2((inv.outstanding ?? inv.total) - (creditSplit[inv.visitId] ?? 0))}
                        step="0.01" inputMode="decimal"
                        value={manual[inv.visitId] ?? ''}
                        onChange={e => setManual(m => ({ ...m, [inv.visitId]: e.target.value }))}
                        placeholder="0.00"
                        title={`Apply cash to this invoice (max ${round2((inv.outstanding ?? inv.total) - (creditSplit[inv.visitId] ?? 0)).toFixed(2)} after credit)`}
                        className={`shrink-0 w-24 px-2 py-1 bg-white dark:bg-zinc-950 border rounded-lg text-[10px] font-black font-mono text-right text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam ${
                          (Number(manual[inv.visitId]) || 0) > round2((inv.outstanding ?? inv.total) - (creditSplit[inv.visitId] ?? 0)) + 0.005 ? 'border-rose-400' : 'border-slate-200 dark:border-zinc-800'
                        }`} />
                    ) : (
                      <span className="shrink-0 w-24 text-right text-[10px] font-black font-mono text-seafoam"
                        title="Allocated automatically, oldest invoice first">
                        {money(effectiveSplit[inv.visitId] ?? 0, currency)}
                      </span>
                    )
                  )}
                  {/* A short payment leaves a real balance — say so before it happens. */}
                  {picked && isShort && ((effectiveSplit[inv.visitId] ?? 0) + (creditSplit[inv.visitId] ?? 0)) < (inv.outstanding ?? inv.total) - 0.005 && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      title="This invoice will keep a balance after the payment">
                      {money(round2((inv.outstanding ?? inv.total) - (effectiveSplit[inv.visitId] ?? 0) - (creditSplit[inv.visitId] ?? 0)), currency)} left
                    </span>
                  )}

                  {/* Settle this one invoice (user, 2026-08-02). A finalized
                      invoice is collected right here; an unfinalized one CANNOT
                      be — the server refuses a visit that isn't
                      PENDING_PAYMENT/COMPLETED because its total can still move
                      — so that row sends you to the visit to generate the bill
                      rather than offering a button that would just 400. */}
                  {/* A row can carry an invoice DOCUMENT and still not be
                      collectable — visit 131 was invoiced, then reopened back to
                      IN_PROGRESS, so the server refuses to collect on it while
                      the UI kept offering a live Settle button that silently did
                      nothing (user, 2026-08-04: "this settle not working").
                      `inv.collectable` is the server's own signal; gate on it and
                      say why instead of failing on click. */}
                  {canCollect && !settled && (inv.collectable ? (
                    <button onClick={() => settleOne(inv.visitId)}
                      title={`Settle ${money(inv.outstanding ?? inv.total, currency)} on visit #${inv.visitId}`}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-pine transition-all">
                      <CreditCard size={10} /> Settle
                    </button>
                  ) : (
                    <button disabled
                      title={`Visit #${inv.visitId} has no invoice and is still open, so its total can still change — finalize it or approve its bill before taking payment.`}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-400 cursor-not-allowed">
                      <CreditCard size={10} /> Finalize first
                    </button>
                  ))}
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
                        {/* The invoice AS A DOCUMENT (user, 2026-08-04) — who it
                            is for, what was done, what it settles to. It was a
                            header strip and a line list before. */}
                        <div id={`inv-print-${inv.visitId}`} className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                          <div className="bg-pine text-white px-4 py-4 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-lg font-black uppercase tracking-tight leading-none">Invoice</p>
                              <p className="text-[9px] font-bold text-white/60 mt-1">
                                {expandedDoc.number || `INV #${expandedDoc.id}`} · Visit #{inv.visitId} · {fmt(expandedDoc.issuedAt || expandedDoc.createdAt || inv.date)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[11px] font-black uppercase tracking-tight">{clinicName || '—'}</p>
                              {expandedDoc.scope && expandedDoc.scope !== 'FULL' && (
                                <p className="text-[8px] font-black uppercase tracking-widest text-white/60 mt-0.5">{String(expandedDoc.scope).toLowerCase()} split</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-zinc-800 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/40">
                            {[
                              { l: 'Patient', a: inv.pet?.name || '—', b: [inv.pet?.species].filter(Boolean).join(' · ') },
                              { l: 'Client', a: clientName || '—', b: clientPhone || '' },
                              { l: 'Clinic', a: clinicName || '—', b: '' },
                            ].map(c => (
                              <div key={c.l} className="px-4 py-2.5 min-w-0">
                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{c.l}</p>
                                <p className="text-[12px] font-black text-pine dark:text-zinc-100 truncate uppercase">{c.a}</p>
                                {c.b && <p className="text-[9px] font-bold text-slate-400 truncate">{c.b}</p>}
                              </div>
                            ))}
                          </div>

                          <div className="p-4">
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Services &amp; items</p>
                            {(expandedDoc.lines || []).map((l: any) => (
                              <div key={l.id} className="flex justify-between items-center gap-3 py-2 border-b border-slate-100 dark:border-zinc-800 last:border-b-0">
                                <span className="min-w-0 text-[13px] font-bold text-pine dark:text-zinc-100">
                                  {l.name}{Number(l.quantity) !== 1 ? ` ×${l.quantity}` : ''}
                                  {l.category && <span className="ml-2 text-[8px] font-black uppercase tracking-widest text-slate-400">{l.category}</span>}
                                </span>
                                <span className="shrink-0 text-[13px] font-black font-mono text-pine dark:text-zinc-100">{money(Number(l.lineTotal), currency)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="border-t-2 border-pine dark:border-zinc-100 bg-slate-50 dark:bg-zinc-950 px-4 py-3">
                            <div className="flex items-end justify-between gap-3">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Total settlement{Number(expandedDoc.discount) > 0 ? ` · discount ${money(Number(expandedDoc.discount), currency)}` : ''}
                              </span>
                              <span className="text-xl font-black font-mono text-pine dark:text-zinc-100">{money(Number(expandedDoc.total), currency)}</span>
                            </div>
                            {Number(expandedDoc.amountPaid) > 0 && (
                              <p className="text-right text-[9px] font-bold text-slate-400 mt-1">
                                paid {money(Number(expandedDoc.amountPaid), currency)} · {money(Number(expandedDoc.outstanding ?? (Number(expandedDoc.total) - Number(expandedDoc.amountPaid))), currency)} outstanding
                              </p>
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
          {payments.length === 0 && (
            <div className="py-16 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-3xl opacity-30 uppercase font-black text-[10px] tracking-[0.2em]">
              No payments
            </div>
          )}
          {payments.map(p => {
            const voided = p.status === 'VOIDED';
            // The allocations say which invoices this payment actually settled.
            const isTarget = highlightInvoiceId != null
              && (p.allocations ?? []).some(a => String(a.invoiceId ?? '') === String(highlightInvoiceId));
            return (
              <div key={p.id}
                ref={isTarget ? highlightRef : undefined}
                className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                  isTarget ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20 shadow-lg' : ''
                } ${
                  voided ? 'border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 opacity-70' : isTarget ? '' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                }`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-black truncate ${voided ? 'text-slate-400 line-through' : 'text-pine dark:text-zinc-100'}`}>
                    Payment #{p.id} · {p.method.replace('_', ' ')}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {fmt(p.settledAt || p.createdAt)}
                    {p.receiptNumber ? (
                      <> · <button type="button"
                        onClick={() => onGoTab?.(`receipts:${p.receiptNumber}`)}
                        disabled={!onGoTab}
                        title="Open this receipt"
                        className="font-black text-seafoam hover:underline disabled:text-slate-400 disabled:no-underline">
                        {p.receiptNumber}{onGoTab ? ' →' : ''}
                      </button></>
                    ) : ''}
                    {p.reference ? ` · ref ${p.reference}` : ''}
                    {voided && p.voidReason ? ` · voided: ${p.voidReason}` : ''}
                  </p>
                  {/* WHERE THE MONEY WENT — the settlement rows. Voiding a
                      payment reverses every invoice it touched, so being able
                      to see that set before voiding is the whole audit trail
                      (user, 2026-08-04). */}
                  {openPayment === String(p.id) && (
                    <div className="mt-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/40 divide-y divide-slate-100 dark:divide-zinc-800">
                      {(p.allocations ?? []).length === 0 && (
                        <p className="px-3 py-2 text-[10px] font-bold text-slate-400">
                          No settlement rows — this payment predates per-invoice allocation.
                        </p>
                      )}
                      {(p.allocations ?? []).map(al => {
                        const inv = invoices.find(iv => String(iv.visitId) === String(al.visitId));
                        return (
                          <div key={`${al.visitId}-${al.invoiceId ?? 'x'}`} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                            <button type="button" onClick={() => onViewVisit?.(Number(al.visitId))} disabled={!onViewVisit}
                              className="min-w-0 flex-1 text-left text-[10px] font-bold text-seafoam hover:underline disabled:text-slate-600 disabled:no-underline dark:disabled:text-zinc-300 truncate">
                              Visit #{al.visitId}{inv?.pet ? ` · ${inv.pet.name}` : ''}
                            </button>
                            {al.invoiceId && (
                              /* Jump to the document itself. Seeing WHICH invoice
                                 a payment filled is the point of this row, and
                                 the number alone made you go and find it
                                 (user, 2026-08-18). */
                              <button type="button"
                                onClick={() => onGoTab
                                  ? onGoTab(`invoices:${al.visitId}`)
                                  : onViewVisit?.(Number(al.visitId))}
                                title="Open this invoice"
                                className="shrink-0 text-[8px] font-black uppercase tracking-wider text-indigo-500 hover:text-indigo-700 hover:underline">
                                INV #{al.invoiceId} →
                              </button>
                            )}
                            <span className="shrink-0 text-[10px] font-black font-mono text-pine dark:text-zinc-100">{money(al.amountApplied, currency)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                <button type="button" onClick={() => setOpenPayment(openPayment === String(p.id) ? null : String(p.id))}
                  title="Where this payment was applied"
                  className={`shrink-0 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                    openPayment === String(p.id)
                      ? 'border-seafoam text-seafoam'
                      : 'border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam'
                  }`}>
                  {openPayment === String(p.id) ? 'Hide' : 'Allocation'}
                </button>
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
          {receipts.length === 0 && (
            <div className="py-16 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-3xl opacity-30 uppercase font-black text-[10px] tracking-[0.2em]">
              No receipts
            </div>
          )}
          {receipts.map(r => {
            const open = expandedReceipt === String(r.id);
            // Every payment that produced this receipt, and the visit it filled.
            const rPayments = payments.filter(p => String(p.receiptNumber || '') === String(r.receiptNumber));
            const rVisit = invoices.find(iv => String(iv.visitId) === String(r.visitId));
            return (
            <div key={r.id}
              id={`rcp-row-${r.receiptNumber}`}
              className={`rounded-xl border border-slate-200 dark:border-zinc-800 ${
                r.voided ? 'bg-slate-50/60 dark:bg-zinc-950 opacity-70' : 'bg-white dark:bg-zinc-900'
              }`}>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <button type="button" onClick={() => setExpandedReceipt(open ? null : String(r.id))}
                title={open ? 'Hide the receipt' : 'Open the receipt'}
                className="shrink-0 text-slate-400 hover:text-seafoam transition-colors">
                <Receipt size={14} className={open ? 'text-seafoam' : ''} />
              </button>
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
              <button type="button" onClick={() => setExpandedReceipt(open ? null : String(r.id))}
                className="shrink-0 px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam transition-all">
                {open ? 'Hide' : 'Open'}
              </button>
            </div>

            {open && (
              <div className="border-t border-slate-100 dark:border-zinc-800 p-3 sm:p-4 space-y-3 bg-slate-50/40 dark:bg-zinc-950/30">
                {/* The REAL receipt document (user, 2026-08-04: "open actual
                    recept") — the same component the visit and client profile
                    print, rather than a summary of three totals. It resolves
                    its own reconciliation state, so a part-paid bill correctly
                    renders as a slip instead of claiming to be a receipt. */}
                {r.visitId ? (
                  <>
                    <ReconciliationDocument
                      domId={`receipt-doc-${r.id}`}
                      visitId={r.visitId}
                      clinicName={clinicName}
                      sourceCurrency={currency}
                      targetCurrency={currency}
                      visitRef={String(r.visitId)}
                      visitDate={fmt(r.createdAt)}
                      patient={rVisit?.pet ? { name: rVisit.pet.name, species: rVisit.pet.species } : null}
                      lines={receiptLines}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="button"
                        onClick={() => printElementAsPdf(`receipt-doc-${r.id}`, `Receipt ${r.receiptNumber}`, false)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
                        <FileText size={13} /> Print
                      </button>
                      {onViewVisit && (
                        <button type="button" onClick={() => onViewVisit(Number(r.visitId))}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam transition-all">
                          Open visit
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  // Pre-157 receipts were issued per PAYMENT, so there is no one
                  // visit to render a document for.
                  <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                    Issued per payment{r.coveredVisitIds.length > 1 ? ` across ${r.coveredVisitIds.length} invoices` : ''} —
                    this receipt predates per-visit receipts, so it has no single document.
                  </p>
                )}
              </div>
            )}
            </div>
          );})}
        </div>
      )}
    </div>
  );
};

export default ClientPaymentsTab;
