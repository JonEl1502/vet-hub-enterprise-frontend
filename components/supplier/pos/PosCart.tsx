import React from 'react';
import { Minus, Plus, Trash2, AlertTriangle } from 'lucide-react';
import type { PosController } from './usePos';

/**
 * The basket.
 *
 * Rendered in TWO places without changing: inside the mobile bottom sheet, and
 * as the desktop cart rail. It owns no layout of its own beyond a column that
 * fills its parent, which is what lets one implementation serve both.
 *
 * ⚠️ Every number here comes from `pos.preview` — the server's pricing — except
 * the per-line `displayPrice`, which exists only so a freshly tapped line has
 * something to show during the 250ms before the preview lands. If the two ever
 * disagree, the server is right.
 */

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  pos: PosController;
  /** The tender button lives in the sheet's footer on mobile, so it is optional. */
  onTender?: () => void;
  compact?: boolean;
}

const PosCart: React.FC<Props> = ({ pos, onTender, compact }) => {
  // `compact` = rendered inside the bottom sheet, which supplies its own frame
  // and its own footer. The rail version owns both.
  const { cart, preview, pricing, priceError, currency, bump, removeLine, clearCart, canTender } = pos;

  const shortLines = new Set(
    (preview?.items ?? []).filter((i) => i.insufficientStock).map((i) => i.supplierProductId)
  );

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-sm font-bold sp-muted">Nothing in the sale yet</p>
        <p className="text-[12px] sp-muted mt-1">Scan an item, or tap it in the grid</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Lines */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {cart.map((line) => {
          const priced = preview?.items.find((i) => i.supplierProductId === line.productId);
          const short = shortLines.has(line.productId);
          return (
            <div
              key={line.productId}
              className="px-4 py-3 border-b"
              style={{ borderColor: 'var(--sp-border)' }}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold leading-tight">{line.name}</p>
                  <p className="text-[11px] sp-muted sp-num mt-0.5">
                    {money(priced?.unitPrice ?? line.displayPrice, currency)} each
                  </p>
                  {short && (
                    <p className="text-[11px] font-bold sp-bad mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Only {priced?.available ?? 0} left
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[14px] font-black sp-num">
                    {money(priced?.lineTotal ?? line.displayPrice * line.quantity, currency)}
                  </p>
                </div>
              </div>

              {/* Stepper. 40px targets — this is tapped more than anything
                  except the tiles themselves. */}
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={() => bump(line.productId, -1)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center sp-btn-ghost"
                  aria-label={`One less ${line.name}`}
                >
                  <Minus size={16} />
                </button>
                <span className="w-10 text-center text-[15px] font-black sp-num">
                  {line.quantity}
                </span>
                <button
                  onClick={() => bump(line.productId, 1)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center sp-btn-ghost"
                  aria-label={`One more ${line.name}`}
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => removeLine(line.productId)}
                  className="ml-auto w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ color: 'var(--sp-muted)' }}
                  aria-label={`Remove ${line.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div
        className="shrink-0 border-t px-4 py-3"
        style={{ borderColor: 'var(--sp-border)', background: 'var(--sp-surface)' }}
      >
        <Row label="Subtotal" value={money(preview?.subtotal ?? 0, currency)} muted />
        {(preview?.discount ?? 0) > 0 && (
          <Row label="Discount" value={`− ${money(preview!.discount, currency)}`} good />
        )}
        <div className="flex justify-between items-baseline pt-1.5 mt-1.5 border-t"
             style={{ borderColor: 'var(--sp-border)' }}>
          <span className="text-[13px] font-black uppercase tracking-wide">Total</span>
          <span className="text-[22px] font-black sp-num">
            {money(preview?.total ?? 0, currency)}
          </span>
        </div>

        {priceError && (
          <p className="text-[12px] font-bold sp-bad mt-2" role="alert">{priceError}</p>
        )}

        {!compact && (
          <div className="flex gap-2 mt-3">
            <button onClick={clearCart} className="sp-btn sp-btn-ghost px-4">
              Clear
            </button>
            <button
              onClick={onTender}
              disabled={!canTender}
              className="sp-btn flex-1"
            >
              {pricing ? 'Pricing…' : 'Take payment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; muted?: boolean; good?: boolean }> = ({
  label,
  value,
  muted,
  good,
}) => (
  <div className="flex justify-between text-[13px] font-semibold">
    <span className={muted ? 'sp-muted' : good ? 'sp-good' : ''}>{label}</span>
    <span className={`sp-num ${good ? 'sp-good' : ''}`}>{value}</span>
  </div>
);

export default PosCart;
