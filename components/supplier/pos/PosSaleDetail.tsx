import DocumentActions from '../../clinic/shared/DocumentActions';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Ban, Phone, User, Clock, AlertTriangle } from 'lucide-react';
import { supplierPosAPI, toast } from '../../../services';
import { money, unitFor, qtyText } from './format';
import DocumentBrand from '../../shared/common/DocumentBrand';

/**
 * One sale, opened.
 *
 * This is the receipt a cashier reaches for when a customer comes back — "what
 * did I actually sell them?" — so the LINES are the point, not the total. The
 * total is already on the list row they tapped to get here.
 *
 * Void lives here rather than on the list row, deliberately: reversing a sale
 * puts stock back and rewrites the day's takings, and it should not be one tap
 * away from a scrolling list. Here you are looking at what you are about to
 * undo.
 */

interface Props {
  saleId: string;
  currency: string;
  /** MANAGER/OWNER — anyone else sees no void button. */
  canVoid: boolean;
  onBack: () => void;
  /** Fired after a successful void so the list and the grid can refresh. */
  onVoided: () => void;
  /**
   * Who the receipt is FROM. This document leaves the building — a customer
   * keeps it, an auditor reads it a year later — and it went out naming
   * nobody: three line items, a total, and no clue who was paid.
   */
  shopName?: string;
  shopLogo?: string | null;
}

const PosSaleDetail: React.FC<Props> = ({ saleId, currency, canVoid, onBack, onVoided, shopName, shopLogo }) => {
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setConfirming(false);
    setReason('');
    supplierPosAPI
      .getSale(saleId)
      .then((r) => { if (!cancelled) setSale(r.data.sale); })
      .catch((e: any) => { if (!cancelled) toast.error(e?.message || 'Could not open that sale'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [saleId]);

  const doVoid = async () => {
    if (!reason.trim()) return;
    setVoiding(true);
    try {
      await supplierPosAPI.voidSale(saleId, reason.trim());
      toast.success(`${sale.saleNumber} voided — stock returned`);
      onVoided();
    } catch (e: any) {
      toast.error(e?.message || 'Could not void that sale');
      setVoiding(false);
    }
  };

  const cur = sale?.currency || currency;
  const voided = sale?.status === 'VOIDED';
  const cashierName = sale?.cashier?.profile
    ? `${sale.cashier.profile.firstName ?? ''} ${sale.cashier.profile.surname ?? ''}`.trim()
    : null;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--sp-bg)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 border-b shrink-0"
        style={{ borderColor: 'var(--sp-border)', minHeight: '3.5rem' }}
      >
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center sp-btn-ghost"
          aria-label="Back to today’s sales"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="text-[13px] font-black font-mono truncate">{sale?.saleNumber ?? '…'}</p>
          {sale && (
            <p className="text-[11px] sp-muted font-semibold">
              {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {sale.branch?.name ? ` · ${sale.branch.name}` : ''}
            </p>
          )}
        </div>
      </div>

      <div id="pos-sale-doc" className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {/* LETTERHEAD. On screen it is a quiet line; on the PDF it is the only
            thing naming the business that took the money. */}
        {shopName && sale && (
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
            <DocumentBrand
              name={shopName}
              logo={shopLogo}
              contact={[sale.branch?.name]}
            />
            <div className="text-right shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest sp-muted">Receipt</p>
              <p className="text-[12px] font-black font-mono">{sale.saleNumber}</p>
              <p className="text-[10px] sp-muted font-semibold">
                {new Date(sale.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
        {loading && <p className="text-center text-sm sp-muted py-12">Opening…</p>}

        {!loading && sale && (
          <>
            {voided && (
              <div
                className="sp-card p-3.5 flex items-start gap-2.5"
                style={{ borderColor: 'var(--sp-bad)' }}
              >
                <AlertTriangle size={16} className="sp-bad shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[13px] font-black sp-bad">Voided</p>
                  <p className="text-[12px] sp-muted mt-0.5">
                    {sale.voidReason || 'No reason recorded'}
                  </p>
                  {sale.voidedAt && (
                    <p className="text-[11px] sp-muted mt-1">
                      {new Date(sale.voidedAt).toLocaleString()} · stock was returned
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* What was sold — the reason this screen exists. */}
            <div className="sp-card overflow-hidden">
              {sale.items.map((it: any) => (
                <div
                  key={it.id}
                  className="px-4 py-3 border-b last:border-b-0"
                  style={{ borderColor: 'var(--sp-border)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold leading-tight">{it.name}</p>
                      <p className="text-[11px] sp-muted sp-num mt-0.5">
                        {qtyText(it.quantity)} {unitFor(it.quantity, it.unit)} ×{' '}
                        {money(it.unitPrice, cur)}
                        {it.sku ? ` · ${it.sku}` : ''}
                      </p>
                      {Number(it.discount) > 0 && (
                        <p className="text-[11px] font-bold sp-good sp-num mt-0.5">
                          − {money(it.discount, cur)} off
                        </p>
                      )}
                    </div>
                    <p className="text-[14px] font-black sp-num shrink-0">
                      {money(it.lineTotal, cur)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="sp-card px-4 py-3">
              <Row label="Subtotal" value={money(sale.subtotal, cur)} muted />
              {Number(sale.discount) > 0 && (
                <Row label="Discount" value={`− ${money(sale.discount, cur)}`} good />
              )}
              {Number(sale.tax) > 0 && <Row label="Tax" value={money(sale.tax, cur)} muted />}
              <div
                className="flex justify-between items-baseline pt-2 mt-2 border-t"
                style={{ borderColor: 'var(--sp-border)' }}
              >
                <span className="text-[13px] font-black uppercase tracking-wide">Total</span>
                <span
                  className={`text-[20px] font-black sp-num ${voided ? 'sp-muted line-through' : ''}`}
                >
                  {money(sale.total, cur)}
                </span>
              </div>
            </div>

            {/* How it was paid */}
            <div className="sp-card overflow-hidden">
              {sale.payments.map((p: any) => {
                const change = p.tendered != null ? Number(p.tendered) - Number(p.amount) : null;
                return (
                  <div
                    key={p.id}
                    className="px-4 py-3 border-b last:border-b-0"
                    style={{ borderColor: 'var(--sp-border)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-bold capitalize">
                        {String(p.method).toLowerCase().replace('_', ' ')}
                      </span>
                      <span className="text-[13px] font-black sp-num">
                        {money(p.amount, cur)}
                      </span>
                    </div>
                    {(p.reference || change != null) && (
                      <p className="text-[11px] sp-muted sp-num mt-0.5">
                        {p.reference ? `Ref ${p.reference}` : ''}
                        {p.reference && change != null ? ' · ' : ''}
                        {change != null
                          ? `Took ${money(p.tendered, cur)}, change ${money(change, cur)}`
                          : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Who and for whom */}
            <div className="sp-card px-4 py-3 space-y-1.5">
              {cashierName && <Meta icon={User} text={`Rung up by ${cashierName}`} />}
              {sale.customerName && <Meta icon={User} text={sale.customerName} />}
              {sale.customerPhone && <Meta icon={Phone} text={sale.customerPhone} />}
              <Meta icon={Clock} text={new Date(sale.createdAt).toLocaleString()} />
            </div>

            {/* Void — behind a reason, always. An unexplained void is the one
                that causes an argument at close of day. */}
            {canVoid && !voided && (
              /* Chrome, not document — this printed INSIDE the customer's PDF,
                 which ended with the words "Void this sale" under the total.
                 `print:hidden` covers the print path, `data-nopdf` the
                 html2canvas download path; both are this app's conventions. */
              <div className="sp-card p-3.5 print:hidden" data-nopdf>
                {confirming ? (
                  <>
                    <p className="text-[12px] font-bold mb-2">
                      Why is this being voided?
                    </p>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="sp-input"
                      placeholder="e.g. customer changed their mind"
                      autoFocus
                    />
                    <p className="text-[11px] sp-muted mt-2">
                      The stock goes back on the shelf and the sale stays on record as voided.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => { setConfirming(false); setReason(''); }}
                        className="sp-btn sp-btn-ghost px-4"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={doVoid}
                        disabled={!reason.trim() || voiding}
                        className="sp-btn flex-1"
                        style={{ background: 'var(--sp-bad)' }}
                      >
                        {voiding ? 'Voiding…' : 'Void this sale'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    className="sp-btn sp-btn-ghost w-full gap-2"
                    style={{ color: 'var(--sp-bad)' }}
                  >
                    <Ban size={16} /> Void this sale
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!loading && sale && (
        <div
          className="shrink-0 px-3 pt-2.5 border-t"
          style={{
            borderColor: 'var(--sp-border)',
            background: 'var(--sp-surface)',
            paddingBottom: 'calc(0.75rem + var(--sp-safe-bottom))',
          }}
        >
          <DocumentActions
            size="sm"
            className="justify-center"
            elementId="pos-sale-doc"
            title={`Receipt ${sale.saleNumber}`}
            phone={sale.customerPhone ?? sale.customer?.phone}
            message={`Here is your receipt ${sale.saleNumber}. Thank you.`}
          />
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; muted?: boolean; good?: boolean }> = ({
  label, value, muted, good,
}) => (
  <div className="flex justify-between text-[13px] font-semibold">
    <span className={muted ? 'sp-muted' : good ? 'sp-good' : ''}>{label}</span>
    <span className={`sp-num ${good ? 'sp-good' : ''}`}>{value}</span>
  </div>
);

const Meta: React.FC<{ icon: React.FC<any>; text: string }> = ({ icon: Icon, text }) => (
  <p className="flex items-center gap-2 text-[12px] sp-muted font-semibold">
    <Icon size={13} className="shrink-0" /> <span className="truncate">{text}</span>
  </p>
);

export default PosSaleDetail;
