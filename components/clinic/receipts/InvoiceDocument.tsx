import React from 'react';
import { Trash2 } from 'lucide-react';
import Money from '../../shared/common/Money';
import { useFx } from '../../../contexts/FxContext';
import {
  DocClinic, DocLetterhead, DocTitleBar, DocSectionBar, DocFooter, docColor, docInk,
} from '../../shared/common/DocumentChrome';

/**
 * THE VISIT INVOICE, as the client receives it.
 *
 *   logo ............................ clinic name / address / tel / email
 *   ══════════════ INVOICE ══════════════════════════════════════════════
 *   Customer                                          Invoice:  INV-123
 *   name · phone · Patient: Rex                       Bill Date: …
 *                                                     Due Date:  …
 *   Item           Price   Disc   Qty   Amount
 *   ─ Category ─────────────────────────────────
 *   …                                      Total: KES …
 *   ══════════════ PAYMENT RECEIPTS ═════════════════════════════════════
 *   Total paid KES x                             BALANCE. KES y
 *   [QR] Scan to join …                          Powered by VetHubCore
 *
 * The figures are passed in, not derived here: the caller already resolved
 * which invoice (a split-invoiced bill carries a CLINICAL and a STAY one), the
 * server's own paid/balance, and the display currency. This component only
 * lays them out, so the invoice and its PDF cannot disagree about a number.
 *
 * ⚠️ `id` is what `downloadDocumentPdf` / WhatsApp share capture. Keep it
 * `invoice-content` on the visit page; the PDF is a rasterisation of THIS node.
 *
 * ⚠️ Editing hooks (`editable` / `removable` rows) exist because a reopened,
 * un-finalized bill is edited in place on this very page. Both controls carry
 * `print:hidden`, which the PDF clone strips — they never reach the paper.
 */

export interface InvoiceRow {
  id: string | number;
  name: string;
  category?: string | null;
  unitPrice: number | null;
  discount?: number;
  quantity?: number;
  /** `null` = no price on record (a medication with no unit price). */
  amount: number | null;
  /** A discount/adjustment line — grouped apart, green, and removable until paid. */
  adjustment?: boolean;
  /** Price is editable in place (reopened bill). */
  editable?: boolean;
  /** Can be deleted from here (adjustments before payment). */
  removable?: boolean;
  /** Group this row falls under, overriding `category`. */
  group?: string;
}

export interface InvoicePayments {
  paid: number;
  balance: number;
  /** One line per payment received, when the server gave them. */
  list?: { key: string; date: string; method: string; amount: number; ref?: string | null }[];
}

interface Props {
  id?: string;
  title?: string;
  clinic: DocClinic;
  invoiceNo: string;
  billDate: string;
  dueDate: string;
  client: { name?: string | null; phone?: string | null; address?: string | null };
  patient?: { name: string; species?: string; breed?: string } | null;
  onOpenClient?: () => void;
  onOpenPet?: () => void;
  rows: InvoiceRow[];
  sourceCurrency: string;
  printCurrency: string;
  /** Printed above the total only when there is a discount. */
  subtotal?: number | null;
  discount?: number | null;
  total: number;
  /** `null` hides the PAYMENT RECEIPTS bar (a bill that is still a draft). */
  payments?: InvoicePayments | null;
  onEditPrice?: (rowId: string | number, price: number) => void;
  onRemoveRow?: (rowId: string | number) => void;
  /** Rendered between the total and the payments bar (carried-forward balance). */
  children?: React.ReactNode;
}

const DEFAULT_GROUP = 'General';
const ADJUSTMENT_GROUP = 'Discounts & adjustments';

const InvoiceDocument: React.FC<Props> = ({
  id = 'invoice-content', title = 'INVOICE', clinic, invoiceNo, billDate, dueDate, client, patient,
  onOpenClient, onOpenPet, rows, sourceCurrency, printCurrency, subtotal, discount, total, payments,
  onEditPrice, onRemoveRow, children,
}) => {
  const color = docColor(clinic.color);
  // Text set in the clinic colour must stay legible on white (see docInk).
  const ink = docInk(clinic.color);

  // Group by category in first-seen order; adjustments sink to the bottom.
  const groups = React.useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, InvoiceRow[]>();
    for (const r of rows) {
      const g = r.group || (r.adjustment ? ADJUSTMENT_GROUP : (r.category || DEFAULT_GROUP));
      if (!map.has(g)) { map.set(g, []); order.push(g); }
      map.get(g)!.push(r);
    }
    const adj = order.filter((g) => g === ADJUSTMENT_GROUP);
    return [...order.filter((g) => g !== ADJUSTMENT_GROUP), ...adj].map((g) => ({ name: g, rows: map.get(g)! }));
  }, [rows]);

  // Table cells are bare numbers — the currency is named once, in the column
  // heads — so the five columns fit a phone-width screen as well as the PDF.
  // Same conversion as <Money>, which stays in charge of the headline figures.
  const { convert } = useFx();
  const sameCcy = !sourceCurrency || sourceCurrency.toUpperCase() === printCurrency.toUpperCase();
  const canConvert = sameCcy || convert(1, sourceCurrency, printCurrency) !== null;
  const shownCcy = (canConvert ? printCurrency : sourceCurrency).toUpperCase();
  const fig = (v: number) => {
    const n = sameCcy || !canConvert ? v : (convert(v, sourceCurrency, printCurrency) ?? v);
    const whole = Math.abs(n - Math.round(n)) < 0.005;
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(n);
  };

  const money = (v: number, cls: string) => (
    <Money amount={v} currency={sourceCurrency} target={printCurrency} hideOriginal showCode primaryClassName={cls} />
  );
  const num = 'font-mono tabular-nums whitespace-nowrap';
  const hasDiscount = Number(discount ?? 0) > 0.005;

  const nameLink = (text: string, onClick?: () => void) => onClick ? (
    <button type="button" onClick={onClick} className="text-left font-black text-slate-900 hover:underline print:no-underline">{text}</button>
  ) : (
    <span className="font-black text-slate-900">{text}</span>
  );

  return (
    <div id={id} className="bg-white text-slate-800 border border-slate-200 rounded-xl overflow-hidden shadow-sm p-6 space-y-4">
      <DocLetterhead clinic={clinic} />

      <DocTitleBar title={title} color={clinic.color} />

      {/* Customer (left) · invoice facts (right) */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 text-[11px] leading-snug">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Customer</p>
          <p className="text-sm">{nameLink(client.name || '—', onOpenClient)}</p>
          {client.address && <p className="text-slate-500">{client.address}</p>}
          {client.phone && <p className="text-slate-500">{client.phone}</p>}
          {patient && (
            <p className="mt-1 text-slate-500">
              Patient:{' '}
              {nameLink(patient.name, onOpenPet)}
              {(patient.species || patient.breed) && (
                <span> · {[patient.species, patient.breed].filter(Boolean).join(' · ')}</span>
              )}
            </p>
          )}
        </div>
        <dl className="shrink-0 text-[11px] leading-snug grid gap-x-3 gap-y-0.5" style={{ gridTemplateColumns: 'auto auto' }}>
          <dt className="text-right text-slate-500">Invoice:</dt>
          <dd className="font-black text-slate-900">{invoiceNo}</dd>
          <dt className="text-right text-slate-500">Bill Date:</dt>
          <dd className="font-bold text-slate-800">{billDate}</dd>
          <dt className="text-right text-slate-500">Due Date:</dt>
          <dd className="font-bold text-slate-800">{dueDate}</dd>
        </dl>
      </div>

      {/* Items */}
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-y-2" style={{ borderColor: color }}>
            <th className="py-1.5 text-left font-black uppercase tracking-wider text-[9px] text-slate-600">Item</th>
            <th className="py-1.5 pl-2 text-right font-black uppercase tracking-wider text-[9px] text-slate-600">Price<span className="font-bold normal-case tracking-normal text-slate-400"> ({shownCcy})</span></th>
            <th className="py-1.5 pl-2 text-right font-black uppercase tracking-wider text-[9px] text-slate-600">Disc</th>
            <th className="py-1.5 pl-2 text-right font-black uppercase tracking-wider text-[9px] text-slate-600">Qty</th>
            <th className="py-1.5 pl-2 text-right font-black uppercase tracking-wider text-[9px] text-slate-600">Amount<span className="font-bold normal-case tracking-normal text-slate-400"> ({shownCcy})</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={5} className="py-4 text-center text-slate-400">No items on this invoice yet.</td></tr>
          )}
          {groups.map((g) => (
            <React.Fragment key={g.name}>
              <tr>
                <td colSpan={5} className="pt-3 pb-1 text-[10px] font-black uppercase tracking-wider" style={{ color: ink }}>{g.name}</td>
              </tr>
              {g.rows.map((r) => {
                const neg = (r.amount ?? 0) < 0;
                const tone = neg ? 'text-emerald-600' : 'text-slate-800';
                return (
                  <tr key={`${g.name}-${r.id}`} className="border-b border-slate-100 align-top">
                    <td className={`py-1.5 pr-2 font-bold ${tone}`}>{r.name}</td>
                    <td className={`py-1.5 pl-2 text-right ${num} text-slate-600`}>
                      {r.unitPrice == null ? '—' : fig(r.unitPrice)}
                    </td>
                    <td className={`py-1.5 pl-2 text-right ${num} text-slate-600`}>
                      {r.discount && r.discount > 0.005 ? fig(r.discount) : '—'}
                    </td>
                    <td className={`py-1.5 pl-2 text-right ${num} text-slate-600`}>{r.quantity ?? 1}</td>
                    <td className={`py-1.5 pl-2 text-right ${num} font-black ${tone}`}>
                      {r.editable && onEditPrice ? (
                        <span className="inline-flex items-center gap-1 print:hidden">
                          <input
                            type="number"
                            min={0}
                            defaultValue={r.amount ?? 0}
                            key={`${r.id}-${r.amount}`}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isNaN(v) && v !== (r.amount ?? 0)) onEditPrice(r.id, v);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            className="w-24 field-input !py-1 text-right font-mono font-black text-sm"
                          />
                        </span>
                      ) : r.amount == null ? '—' : fig(r.amount)}
                      {r.removable && onRemoveRow && (
                        <button
                          type="button"
                          onClick={() => onRemoveRow(r.id)}
                          title="Remove this discount/adjustment"
                          className="ml-1 p-1 rounded text-slate-300 hover:text-rose-500 transition-colors print:hidden align-middle"
                        ><Trash2 size={12} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex flex-col items-end gap-1">
        {hasDiscount && (
          <>
            <div className="flex items-baseline gap-4 text-[11px]">
              <span className="font-black uppercase tracking-widest text-[9px] text-slate-400">Subtotal</span>
              {money(Number(subtotal ?? total + Number(discount)), 'text-[12px] font-black text-slate-800 font-mono')}
            </div>
            <div className="flex items-baseline gap-4 text-[11px]">
              <span className="font-black uppercase tracking-widest text-[9px] text-emerald-600">Discount applied</span>
              {money(-Number(discount), 'text-[12px] font-black text-emerald-600 font-mono')}
            </div>
          </>
        )}
        <div className="flex items-baseline gap-4 pt-1 border-t-2" style={{ borderColor: color }}>
          <span className="font-black uppercase tracking-widest text-[10px] text-slate-500">Total:</span>
          {money(total, 'text-xl font-black tracking-tight text-slate-900 font-mono')}
        </div>
      </div>

      {children}

      {/* Money received */}
      {payments && (
        <>
          <DocSectionBar color={color} className="text-[11px] font-black uppercase tracking-[0.2em]">
            Payment receipts
          </DocSectionBar>
          {payments.list && payments.list.length > 0 && (
            <div className="space-y-0.5 text-[10px] text-slate-600">
              {payments.list.map((p) => (
                <div key={p.key} className="flex items-baseline justify-between gap-3">
                  <span className="truncate">
                    {p.date} · {p.method}{p.ref ? ` · ${p.ref}` : ''}
                  </span>
                  {money(p.amount, 'text-[11px] font-black text-slate-800 font-mono')}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total paid</span>
              {money(payments.paid, 'text-sm font-black text-slate-900 font-mono')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: ink }}>Balance.</span>
              {money(payments.balance, 'text-lg font-black text-slate-900 font-mono')}
            </div>
          </div>
        </>
      )}

      <DocFooter clinic={clinic} />
    </div>
  );
};

export default InvoiceDocument;
