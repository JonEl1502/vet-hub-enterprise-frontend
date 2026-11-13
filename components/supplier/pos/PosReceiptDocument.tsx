import React from 'react';
import { money, unitFor, qtyText } from './format';

/**
 * THE TILL RECEIPT, AS PAPER.
 *
 * The PDF used to be a snapshot of the sale panel on screen: three item rows,
 * a subtotal and "Rung up by", with no table, no colour and no payment
 * summary. The user called it "very basic even compared to clinic side"
 * (2026-11-13). The panel could not look right as a PDF anyway. Every
 * `sp-*` style is scoped under `.supplier-pos`, and the PDF helper clones the
 * element into a bare box on <body>, so on paper those styles do not apply.
 *
 * So this is a separate document, built for A4 (the helper lays it out at
 * 794px) and styled with plain Tailwind and fixed light colours only:
 *  - no `sp-*` classes, which would not apply outside the till;
 *  - no `dark:` variants, because the helper strips dark mode while it
 *    captures, and paper is white anyway.
 * The shop's own brand colour is the accent when it has one, as the clinic
 * receipt wears the clinic's letterhead.
 *
 * Rendered off screen by the sale panel and the sale-complete screen. Their
 * Download, Share and Print buttons point at this element's id.
 */

export interface ReceiptShop {
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export interface ReceiptBranch {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
}

interface Props {
  id: string;
  sale: any;
  currency: string;
  shop: ReceiptShop;
  /** Falls back to `sale.branch`. The sale-complete response has no address. */
  branch?: ReceiptBranch | null;
  /** Falls back to `sale.cashier.profile`. */
  cashierName?: string | null;
}

const DEFAULT_ACCENT = '#1f5c45';

const isHex = (v?: string | null): v is string => !!v && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

/** White text on a dark brand colour, near-black on a light one (a yellow shop). */
const inkFor = (hex: string): string => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '#0f172a' : '#ffffff';
};

const isImage = (v?: string | null): boolean =>
  !!v && (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:') || v.startsWith('/'));

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  M_PESA: 'M-Pesa',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
  CREDIT: 'On account',
};
const methodLabel = (m: string) =>
  METHOD_LABEL[String(m).toUpperCase()] ??
  String(m).toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const PosReceiptDocument: React.FC<Props> = ({ id, sale, currency, shop, branch, cashierName }) => {
  const [logoBroken, setLogoBroken] = React.useState(false);
  const cur = sale?.currency || currency;
  const accent = isHex(shop.primaryColor) ? shop.primaryColor.trim() : DEFAULT_ACCENT;
  const ink = inkFor(accent);
  const voided = sale?.status === 'VOIDED';
  const b: ReceiptBranch = { ...(sale?.branch ?? {}), ...(branch ?? {}) };
  const cashier =
    cashierName ||
    (sale?.cashier?.profile
      ? `${sale.cashier.profile.firstName ?? ''} ${sale.cashier.profile.surname ?? ''}`.trim()
      : '');
  const items: any[] = sale?.items ?? [];
  const payments: any[] = sale?.payments ?? [];
  const units = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const showImage = isImage(shop.logoUrl) && !logoBroken;
  const initial = (shop.name || '?').trim().charAt(0).toUpperCase();
  const when = sale?.completedAt || sale?.createdAt;

  return (
    <div
      id={id}
      className="bg-white text-slate-900 rounded-2xl border border-slate-200 overflow-hidden"
      style={{ width: '100%' }}
    >
      {/* Letterhead: who was paid, then what this is. */}
      <div className="px-8 pt-8 pb-6 flex items-start justify-between gap-6">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden text-2xl font-black"
            style={showImage ? { border: '1px solid #e2e8f0' } : { background: accent, color: ink }}
          >
            {showImage ? (
              <img
                src={shop.logoUrl!}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setLogoBroken(true)}
              />
            ) : (
              <span>{(!isImage(shop.logoUrl) && shop.logoUrl) || initial}</span>
            )}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-xl font-black uppercase tracking-tight leading-tight" style={{ color: accent }}>
              {shop.name}
            </p>
            {b.name && <p className="text-[13px] font-bold text-slate-700 mt-1">{b.name}</p>}
            {b.address && <p className="text-[12px] text-slate-500 leading-snug">{b.address}</p>}
            {b.phone && <p className="text-[12px] text-slate-500 leading-snug">Tel {b.phone}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[30px] font-black uppercase tracking-tight leading-none" style={{ color: accent }}>
            Receipt
          </p>
          <p className="text-[14px] font-black font-mono mt-2 text-slate-800">{sale?.saleNumber}</p>
          <span
            className="inline-block mt-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest"
            style={
              voided
                ? { background: '#fee2e2', color: '#b91c1c' }
                : { background: '#dcfce7', color: '#15803d' }
            }
          >
            {voided ? 'Voided' : 'Paid'}
          </span>
        </div>
      </div>

      {/* Facts strip in the brand colour. */}
      <div className="grid grid-cols-4" style={{ background: accent, color: ink }}>
        {[
          { label: 'Date', value: when ? fmtDate(when) : '—' },
          { label: 'Time', value: when ? fmtTime(when) : '—' },
          { label: 'Served by', value: cashier || '—' },
          { label: 'Payment', value: payments.length ? payments.map((p) => methodLabel(p.method)).join(' + ') : '—' },
        ].map((f, i) => (
          <div key={f.label} className="px-8 py-3.5" style={i ? { borderLeft: `1px solid ${ink === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.12)'}` } : undefined}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ opacity: 0.7 }}>{f.label}</p>
            <p className="text-[14px] font-bold mt-0.5 truncate">{f.value}</p>
          </div>
        ))}
      </div>

      {voided && (
        <div className="mx-8 mt-6 px-5 py-4 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <p className="text-[13px] font-black uppercase tracking-widest" style={{ color: '#b91c1c' }}>
            This sale was voided
          </p>
          <p className="text-[13px] text-slate-600 mt-1">
            {sale.voidReason || 'No reason recorded'}
            {sale.voidedAt ? ` · ${fmtDate(sale.voidedAt)}, ${fmtTime(sale.voidedAt)}` : ''}. The stock was returned and
            no money is owed on it.
          </p>
        </div>
      )}

      {(sale?.customerName || sale?.customerPhone) && (
        <div className="px-8 pt-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sold to</p>
          <p className="text-[15px] font-bold mt-0.5">{sale.customerName || 'Walk-in customer'}</p>
          {sale.customerPhone && <p className="text-[13px] text-slate-500">{sale.customerPhone}</p>}
        </div>
      )}

      {/* What was sold. */}
      <div className="px-8 pt-6">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              {['#', 'Item', 'Qty', 'Unit price', 'Amount'].map((h, i) => (
                <th
                  key={h}
                  className={`py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 ${i >= 2 ? 'text-right' : 'text-left'}`}
                  style={i === 0 ? { width: '2.5rem', borderRadius: '0.5rem 0 0 0.5rem' } : i === 4 ? { borderRadius: '0 0.5rem 0.5rem 0' } : undefined}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id ?? `${it.sku}-${i}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td className="py-3 px-3 text-[13px] text-slate-400 font-bold align-top">{i + 1}</td>
                <td className="py-3 px-3 align-top">
                  <p className="text-[14px] font-bold leading-tight">{it.name}</p>
                  {it.sku && <p className="text-[11px] text-slate-400 font-mono mt-0.5">{it.sku}</p>}
                  {Number(it.discount) > 0 && (
                    <p className="text-[11px] font-bold mt-0.5" style={{ color: '#15803d' }}>
                      {money(it.discount, cur)} off
                    </p>
                  )}
                </td>
                <td className="py-3 px-3 text-right text-[13px] font-semibold align-top whitespace-nowrap tabular-nums">
                  {qtyText(it.quantity)} {unitFor(it.quantity, it.unit)}
                </td>
                <td className="py-3 px-3 text-right text-[13px] text-slate-600 align-top whitespace-nowrap tabular-nums">
                  {money(it.unitPrice, cur)}
                </td>
                <td className="py-3 px-3 text-right text-[14px] font-black align-top whitespace-nowrap tabular-nums">
                  {money(it.lineTotal, cur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-400 font-semibold px-3 pt-2">
          {items.length} line{items.length === 1 ? '' : 's'} · {qtyText(units)} unit{units === 1 ? '' : 's'}
        </p>
      </div>

      {/* How it was paid, and the totals. */}
      <div className="px-8 pt-6 pb-8 grid grid-cols-2 gap-6 items-start">
        <div className="rounded-xl p-5" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Payment</p>
          {payments.length === 0 && <p className="text-[13px] text-slate-500">No payment recorded</p>}
          {payments.map((p, i) => {
            const took = p.tendered != null ? Number(p.tendered) : null;
            const ch = took != null ? took - Number(p.amount) : 0;
            return (
              <div key={p.id ?? i} className={i ? 'pt-3 mt-3' : ''} style={i ? { borderTop: '1px dashed #cbd5e1' } : undefined}>
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-[14px] font-black">{methodLabel(p.method)}</span>
                  <span className="text-[14px] font-black tabular-nums">{money(p.amount, cur)}</span>
                </div>
                {p.reference && (
                  <p className="text-[12px] text-slate-500 mt-1">
                    Reference <span className="font-mono font-bold text-slate-700">{p.reference}</span>
                  </p>
                )}
                {took != null && (
                  <>
                    <div className="flex justify-between text-[12px] text-slate-500 mt-1 tabular-nums">
                      <span>Cash received</span><span>{money(took, cur)}</span>
                    </div>
                    <div className="flex justify-between text-[12px] font-bold mt-0.5 tabular-nums" style={{ color: '#15803d' }}>
                      <span>Change given</span><span>{money(Math.max(0, ch), cur)}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <div className="space-y-2 px-1">
            <div className="flex justify-between text-[13px] text-slate-500 tabular-nums">
              <span>Subtotal</span><span className="font-semibold text-slate-700">{money(sale?.subtotal ?? 0, cur)}</span>
            </div>
            {Number(sale?.discount) > 0 && (
              <div className="flex justify-between text-[13px] tabular-nums" style={{ color: '#15803d' }}>
                <span>Discount</span><span className="font-bold">− {money(sale.discount, cur)}</span>
              </div>
            )}
            {Number(sale?.tax) > 0 && (
              <div className="flex justify-between text-[13px] text-slate-500 tabular-nums">
                <span>Tax</span><span className="font-semibold text-slate-700">{money(sale.tax, cur)}</span>
              </div>
            )}
          </div>
          <div
            className="mt-3 rounded-xl px-5 py-4 flex justify-between items-center"
            style={{ background: voided ? '#f1f5f9' : accent, color: voided ? '#64748b' : ink }}
          >
            <span className="text-[12px] font-black uppercase tracking-widest">{voided ? 'Total (voided)' : 'Total paid'}</span>
            <span className={`text-[26px] font-black tabular-nums tracking-tight ${voided ? 'line-through' : ''}`}>
              {money(sale?.total ?? 0, cur)}
            </span>
          </div>
        </div>
      </div>

      {/* Sign-off. */}
      <div className="px-8 py-5 text-center" style={{ borderTop: '2px dashed #e2e8f0' }}>
        <p className="text-[15px] font-black" style={{ color: accent }}>Thank you for shopping with us</p>
        <p className="text-[12px] text-slate-500 mt-1">
          Please keep this receipt. Bring it with you if you need to return or ask about an item.
        </p>
        <p className="text-[10px] text-slate-400 mt-3 tracking-wide">
          {sale?.saleNumber} · {when ? `${fmtDate(when)}, ${fmtTime(when)}` : ''} · Powered by VetHubCore
        </p>
      </div>
    </div>
  );
};

/**
 * Holds the paper receipt off screen. Not `display:none`: the PDF helper clones
 * the element, and the logo should already be loaded when it does.
 */
export const OffscreenPaper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    aria-hidden
    data-nopdf
    style={{ position: 'fixed', left: -10000, top: 0, width: 794, pointerEvents: 'none' }}
  >
    {children}
  </div>
);

/**
 * The paper receipt, shrunk to fit a narrow column.
 *
 * It is laid out at 794px (A4) so the screen shows exactly what prints, then
 * scaled down to the column width. The wrapper takes the scaled height, or the
 * page would scroll over a gap the size of the unscaled sheet. The PDF helper
 * clones the receipt itself, never this wrapper, so the transform does not
 * reach the PDF.
 */
export const ScaledPaper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const outer = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ scale: 0.45, height: 0 });

  React.useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const scale = Math.min(1, outer.current.clientWidth / 794);
      setBox({ scale, height: inner.current.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} style={{ width: '100%', height: box.height || undefined, overflow: 'hidden' }}>
      <div ref={inner} style={{ width: 794, transform: `scale(${box.scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
};

export default PosReceiptDocument;
