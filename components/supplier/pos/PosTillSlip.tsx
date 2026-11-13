import React from 'react';
import { money, unitFor, qtyText } from './format';
import {
  DEFAULT_ACCENT, isHex, isImage, methodLabel, fmtDate, fmtTime,
  ReceiptShop, ReceiptBranch,
} from './PosReceiptDocument';

/**
 * THE ITEMS-ONLY RECEIPT: a till slip.
 *
 * The second of the two receipts (user, 2026-11-13: "the other receipt will
 * just have the items only, just like a normal receipt, but very beautiful").
 * It is shaped like the paper roll a counter printer gives out: one narrow
 * column, dashed rules, the lines, the total and the change. The other
 * receipt is the A4 sheet with product photos.
 *
 * Plain Tailwind and fixed light colours, for the same reason as
 * PosReceiptDocument: the PDF helper clones it out of the till's scoped
 * styles and strips dark mode. The slip is 400px wide and centres itself, so
 * on the A4 PDF it sits in the middle of the page like a real slip would.
 */

interface Props {
  id: string;
  sale: any;
  currency: string;
  shop: ReceiptShop;
  branch?: ReceiptBranch | null;
  cashierName?: string | null;
}

export const SLIP_WIDTH = 400;

const Rule: React.FC = () => (
  <div className="my-4" style={{ borderTop: '1.5px dashed #cbd5e1' }} />
);

const Row: React.FC<{ label: React.ReactNode; value: React.ReactNode; strong?: boolean; color?: string }> = ({
  label, value, strong, color,
}) => (
  <div
    className={`flex justify-between gap-3 tabular-nums ${strong ? 'text-[14px] font-black' : 'text-[12.5px] text-slate-600'}`}
    style={color ? { color } : undefined}
  >
    <span>{label}</span>
    <span className={strong ? '' : 'font-semibold text-slate-800'} style={color ? { color } : undefined}>{value}</span>
  </div>
);

/**
 * A barcode-looking strip drawn from the receipt number. It is decoration,
 * not a scannable code, so the number is printed under it in full.
 */
const Bars: React.FC<{ text: string }> = ({ text }) => {
  const widths: number[] = [];
  for (const ch of `*${text}*`) {
    const c = ch.charCodeAt(0);
    for (let k = 0; k < 4; k++) widths.push(((c >> k) & 1) + 1 + ((c + k) % 2));
  }
  return (
    <div className="flex items-stretch justify-center h-12 gap-[1.5px]">
      {widths.map((w, i) => (
        <span key={i} style={{ width: w, background: i % 2 ? 'transparent' : '#0f172a' }} />
      ))}
    </div>
  );
};

const PosTillSlip: React.FC<Props> = ({ id, sale, currency, shop, branch, cashierName }) => {
  const [logoBroken, setLogoBroken] = React.useState(false);
  const cur = sale?.currency || currency;
  const accent = isHex(shop.primaryColor) ? shop.primaryColor.trim() : DEFAULT_ACCENT;
  // `#abc` → `#aabbcc`, so an alpha suffix can be appended for the soft tint.
  const hex6 = accent.length === 4 ? '#' + accent.slice(1).split('').map((c) => c + c).join('') : accent;
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
  const when = sale?.completedAt || sale?.createdAt;
  const showImage = isImage(shop.logoUrl) && !logoBroken;

  return (
    <div id={id} style={{ width: SLIP_WIDTH, margin: '0 auto' }}>
      <div
        className="bg-white text-slate-900 overflow-hidden"
        style={{ borderRadius: 18, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(15,23,42,0.05)' }}
      >
        {/* Brand band */}
        <div style={{ height: 8, background: accent }} />

        <div className="px-7 pt-6 pb-6">
          {/* Who */}
          <div className="flex flex-col items-center text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden text-[22px] font-black"
              style={showImage ? { border: '1px solid #e2e8f0' } : { background: accent, color: '#fff' }}
            >
              {showImage ? (
                <img src={shop.logoUrl!} alt="" crossOrigin="anonymous" className="w-full h-full object-cover" onError={() => setLogoBroken(true)} />
              ) : (
                <span>{(!isImage(shop.logoUrl) && shop.logoUrl) || (shop.name || '?').trim().charAt(0).toUpperCase()}</span>
              )}
            </div>
            <p className="text-[17px] font-black uppercase tracking-tight mt-3 leading-tight" style={{ color: accent }}>
              {shop.name}
            </p>
            {b.name && <p className="text-[12px] font-bold text-slate-600 mt-1">{b.name}</p>}
            {b.address && <p className="text-[11.5px] text-slate-500">{b.address}</p>}
            {b.phone && <p className="text-[11.5px] text-slate-500">Tel {b.phone}</p>}
          </div>

          <Rule />

          <p className="text-center text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">
            {voided ? 'Voided sale' : 'Sales receipt'}
          </p>
          <div className="mt-3 space-y-1">
            <Row label="Receipt" value={<span className="font-mono">{sale?.saleNumber}</span>} />
            <Row label="Date" value={when ? `${fmtDate(when)}, ${fmtTime(when)}` : '—'} />
            {cashier && <Row label="Served by" value={cashier} />}
            {sale?.customerName && <Row label="Customer" value={sale.customerName} />}
            {sale?.customerPhone && <Row label="Phone" value={sale.customerPhone} />}
          </div>

          <Rule />

          {/* What */}
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={it.id ?? i}>
                <div className="flex justify-between gap-3">
                  <span className="text-[13.5px] font-bold leading-snug">{it.name}</span>
                  <span className="text-[13.5px] font-black tabular-nums whitespace-nowrap">{money(it.lineTotal, cur)}</span>
                </div>
                <p className="text-[11.5px] text-slate-500 tabular-nums mt-0.5">
                  {qtyText(it.quantity)} {unitFor(it.quantity, it.unit)} × {money(it.unitPrice, cur)}
                  {Number(it.discount) > 0 ? ` · ${money(it.discount, cur)} off` : ''}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            {items.length} line{items.length === 1 ? '' : 's'} · {qtyText(units)} unit{units === 1 ? '' : 's'}
          </p>

          <Rule />

          {/* How much */}
          <div className="space-y-1.5">
            <Row label="Subtotal" value={money(sale?.subtotal ?? 0, cur)} />
            {Number(sale?.discount) > 0 && <Row label="Discount" value={`− ${money(sale.discount, cur)}`} color="#15803d" />}
            {Number(sale?.tax) > 0 && <Row label="Tax" value={money(sale.tax, cur)} />}
          </div>
          <div
            className="mt-3 flex justify-between items-baseline rounded-xl px-4 py-3"
            style={{ background: voided ? '#f1f5f9' : `${hex6}14`, border: `1.5px solid ${voided ? '#e2e8f0' : accent}` }}
          >
            <span className="text-[12px] font-black uppercase tracking-widest" style={{ color: voided ? '#64748b' : accent }}>
              Total
            </span>
            <span
              className={`text-[24px] font-black tabular-nums tracking-tight ${voided ? 'line-through' : ''}`}
              style={{ color: voided ? '#64748b' : accent }}
            >
              {money(sale?.total ?? 0, cur)}
            </span>
          </div>

          {/* Paid */}
          <div className="mt-4 space-y-1.5">
            {payments.map((p, i) => {
              const took = p.tendered != null ? Number(p.tendered) : null;
              return (
                <React.Fragment key={p.id ?? i}>
                  <Row label={`Paid by ${methodLabel(p.method)}`} value={money(p.amount, cur)} />
                  {p.reference && <Row label="Reference" value={<span className="font-mono">{p.reference}</span>} />}
                  {took != null && <Row label="Cash received" value={money(took, cur)} />}
                  {took != null && <Row label="Change" value={money(Math.max(0, took - Number(p.amount)), cur)} color="#15803d" />}
                </React.Fragment>
              );
            })}
          </div>

          {voided && (
            <p className="mt-4 text-[12px] font-bold text-center" style={{ color: '#b91c1c' }}>
              Voided: {sale.voidReason || 'no reason recorded'}. Stock returned.
            </p>
          )}

          <Rule />

          {/* Sign-off */}
          <p className="text-center text-[15px] font-black" style={{ color: accent }}>Thank you!</p>
          <p className="text-center text-[11.5px] text-slate-500 mt-1 leading-snug">
            Please keep this receipt for returns and questions.
          </p>
          <div className="mt-4">
            <Bars text={String(sale?.saleNumber ?? '')} />
            <p className="text-center text-[11px] font-mono tracking-[0.2em] text-slate-500 mt-1.5">{sale?.saleNumber}</p>
          </div>
          <p className="text-center text-[9.5px] text-slate-400 mt-3 tracking-wide">Powered by VetHubCore</p>
        </div>
        <div style={{ height: 8, background: accent }} />
      </div>
    </div>
  );
};

export default PosTillSlip;
