import React from 'react';
import toast from 'react-hot-toast';
import {
  ReceiptText, Loader2, AlertTriangle, ChevronDown, Eye, FileText, CheckCircle2,
} from 'lucide-react';
import { clientsAPI, billsAPI, invoicesAPI } from '../../../services';
import { ClientBilling } from '../../../services/modules/clients.api';
import { Bill } from '../../../services/modules/bills.api';
import { Invoice } from '../../../services/modules/invoices.api';

/**
 * Financials → BILLS (user, 2026-08-03: "Bills tab b4 Invoice … and can
 * generate its invoice there").
 *
 * The chain is **Bill → Invoice → Payment → Receipt**. This is stage one: what
 * the visit produced, rendered as the bill document (the same layout the visit's
 * Bill Review shows), with the one action that moves it along — generate the
 * invoice. Nothing here collects money; that starts on the Invoices tab, which
 * is empty until a bill has been turned into an invoice.
 */

interface Props {
  clientId: string | number;
  currency: string;
  /** Narrow to one patient (the Patient → Financials tab). */
  petId?: string | number;
  onViewVisit?: (visitId: number) => void;
  /** Told after an invoice is generated, so the header money refreshes. */
  onChanged?: () => void;
  /** Generating an invoice is a billing action — owner/manager only. */
  canManage?: boolean;
}

const money = (n: number, c: string) =>
  `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Mirrors BillPanel's vocabulary so a bill reads the same wherever it is shown.
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

const ClientBillsTab: React.FC<Props> = ({
  clientId, currency, petId, onViewVisit, onChanged, canManage = true,
}) => {
  const [billing, setBilling] = React.useState<ClientBilling | null>(null);
  const [loading, setLoading] = React.useState(true);
  // The bill document is fetched only when a row is OPENED. `GET /visits/:id/bill`
  // raises a DRAFT from the encounter's charges when none exists — a write — so
  // it must never fire just because a list rendered.
  const [openVisit, setOpenVisit] = React.useState<string | null>(null);
  const [doc, setDoc] = React.useState<Bill | null>(null);
  const [docInvoice, setDocInvoice] = React.useState<Invoice | null>(null);
  const [docLoading, setDocLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientsAPI.getBilling(clientId);
      if (res.success && res.data) setBilling(res.data);
    } catch { /* surfaced by the client */ }
    finally { setLoading(false); }
  }, [clientId]);
  React.useEffect(() => { load(); }, [load]);

  const petKey = petId != null ? String(petId) : null;
  const rows = (billing?.invoices ?? []).filter(i => !petKey || String(i.pet?.id ?? '') === petKey);

  const openRow = async (visitId: string) => {
    if (openVisit === visitId) { setOpenVisit(null); setDoc(null); setDocInvoice(null); return; }
    setOpenVisit(visitId); setDoc(null); setDocInvoice(null); setDocLoading(true);
    try {
      const [b, inv] = await Promise.all([
        billsAPI.get(visitId),
        invoicesAPI.forVisit(visitId).catch(() => null),
      ]);
      if (b.success && b.data?.bill) setDoc(b.data.bill);
      if (inv?.success) setDocInvoice(inv.data?.invoice ?? null);
    } catch { /* the row stays open with an error line */ }
    finally { setDocLoading(false); }
  };

  const generateInvoice = async (visitId: string) => {
    setBusy(true);
    try {
      const res = await invoicesAPI.generate(visitId);
      if (res.success && res.data?.invoice) {
        setDocInvoice(res.data.invoice);
        toast.success(`Invoice ${res.data.invoice.number ?? ''} generated`.trim());
        const b = await billsAPI.get(visitId);
        if (b.success && b.data?.bill) setDoc(b.data.bill);
        load();
        onChanged?.();
      }
    } catch { /* API layer toasts */ }
    finally { setBusy(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-seafoam" /></div>;
  }

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Bills</h3>
        <p className="text-[10px] font-bold text-slate-400">
          What each visit produced. Approve on the visit, generate the invoice here.
        </p>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-slate-400">{rows.length} total</span>
      </div>

      {rows.length === 0 && (
        <div className="py-16 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-3xl opacity-40 uppercase font-black text-[10px] tracking-[0.2em]">
          No bills yet
        </div>
      )}

      {rows.map(r => {
        const isOpen = openVisit === r.visitId;
        const invoiced = (r.invoices?.length ?? 0) > 0;
        return (
          <div key={r.visitId} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            {/* Row */}
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 shrink-0"><ReceiptText size={16} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">
                  Visit #{r.visitId}{r.pet ? ` — ${r.pet.name}` : ''}
                  {r.encounterType ? <span className="font-bold text-slate-400"> · {String(r.encounterType).replace(/_/g, ' ').toLowerCase()}</span> : null}
                </p>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                  {fmt(r.date)}
                  {invoiced && <> · <span className="text-indigo-500">{r.invoices![0].number || `INV #${r.invoices![0].id}`}</span></>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black font-mono text-pine dark:text-zinc-100">{money(r.total, currency)}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border ${
                  r.isPaid ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : invoiced ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                  : 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'
                }`}>{r.isPaid ? 'Paid' : invoiced ? 'Invoiced' : 'Bill'}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {onViewVisit && (
                  <button onClick={() => onViewVisit(Number(r.visitId))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam transition-all">
                    <Eye size={11} /> Visit
                  </button>
                )}
                <button onClick={() => openRow(r.visitId)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                    isOpen ? 'border-seafoam text-seafoam' : 'border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam'
                  }`}>
                  {isOpen ? 'Hide bill' : 'View bill'}
                  <ChevronDown size={11} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
              </div>
            </div>

            {/* The bill document — same layout as the visit's Bill Review. */}
            {isOpen && (
              <div className="border-t border-slate-100 dark:border-zinc-800 p-4 space-y-3 bg-slate-50/40 dark:bg-zinc-950/30">
                {docLoading && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 py-3">
                    <Loader2 size={13} className="animate-spin" /> Loading bill…
                  </div>
                )}
                {!docLoading && !doc && (
                  <p className="text-[11px] font-bold text-slate-400 py-2">This visit has no bill document.</p>
                )}
                {!docLoading && doc && (() => {
                  const meta = STATUS_META[doc.status];
                  return (
                    <>
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <ReceiptText size={17} className="text-seafoam shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                              Bill {doc.number && <span className="text-slate-400 font-bold normal-case tracking-normal text-[11px]">· {doc.number}</span>}
                            </h4>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                              {doc.editable
                                ? 'Still open — approve it on the visit before it can be invoiced'
                                : 'Approved — reopen on the visit to make changes'}
                            </p>
                          </div>
                        </div>
                        {meta && <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${meta.cls}`}>{meta.label}</span>}
                      </div>

                      {doc.isSynthetic && (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20">
                          <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                            Backfilled from the visit record — nobody reviewed this at the time of care.
                          </p>
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-zinc-950">
                              <tr className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                <th className="px-3 py-2">Item</th>
                                <th className="px-2 py-2 w-24">Kind</th>
                                <th className="px-2 py-2 w-16 text-right">Qty</th>
                                <th className="px-2 py-2 w-24 text-right">Unit</th>
                                <th className="px-3 py-2 w-28 text-right">Line</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                              {doc.lines.length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-4 text-[11px] text-slate-400 text-center">Nothing has been charged to this visit yet.</td></tr>
                              )}
                              {doc.lines.map(l => (
                                <tr key={l.id} className="text-[11px]">
                                  <td className="px-3 py-1.5">
                                    <span className="font-bold text-pine dark:text-zinc-100">{l.name}</span>
                                    {l.category && <span className="block text-[9px] font-bold text-slate-400">{l.category}</span>}
                                  </td>
                                  <td className="px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">{KIND_LABEL[l.kind] ?? l.kind}</td>
                                  <td className="px-2 py-1.5 text-right">{l.quantity}</td>
                                  <td className="px-2 py-1.5 text-right">{money(l.unitPrice, currency)}</td>
                                  <td className="px-3 py-1.5 text-right font-black text-pine dark:text-zinc-100">{money(l.lineTotal, currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50 dark:bg-zinc-950">
                              <tr>
                                <td colSpan={4} className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Total</td>
                                <td className="px-3 py-2 text-right text-sm font-black font-mono text-pine dark:text-zinc-100">{money(doc.total, currency)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Stage two of the chain. A bill can only become an invoice
                          once it is APPROVED — that is the vet's sign-off, and it
                          belongs on the visit, not here. */}
                      <div className="flex flex-wrap items-center gap-2">
                        {docInvoice ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                            <CheckCircle2 size={11} /> Invoiced · {docInvoice.number || `INV #${docInvoice.id}`}
                          </span>
                        ) : doc.editable ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-900">
                            <AlertTriangle size={11} /> Approve the bill on the visit to invoice it
                          </span>
                        ) : canManage ? (
                          <button onClick={() => generateInvoice(r.visitId)} disabled={busy}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-seafoam text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all shadow-sm disabled:opacity-50">
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                            {busy ? 'Generating…' : 'Generate invoice'}
                          </button>
                        ) : null}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ClientBillsTab;
