import React from 'react';
import { Check, Plus } from 'lucide-react';
import DocumentActions from '../../clinic/shared/DocumentActions';

/**
 * The confirmation.
 *
 * Deliberately a FULL SCREEN and not a toast. It is the cashier's proof the
 * sale landed, the customer's cue that they are done, and the moment change is
 * counted out — a notification that fades after three seconds is none of those.
 * The only prominent action is "New sale", because that is what happens next
 * ninety-nine times out of a hundred.
 */

const money = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  sale: any;
  currency: string;
  changeDue?: number;
  onNewSale: () => void;
}

const PosReceipt: React.FC<Props> = ({ sale, currency, changeDue, onNewSale }) => (
  <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--sp-bg)' }}>
    <div id="pos-receipt-doc" className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
      <div className="flex flex-col items-center text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
          style={{ background: 'var(--sp-accent-soft)', color: 'var(--sp-good)' }}
        >
          <Check size={30} strokeWidth={3} />
        </div>
        <p className="text-[12px] font-bold uppercase tracking-wider sp-muted">Sale complete</p>
        <p className="text-[34px] font-black leading-none mt-1 sp-num">
          {money(sale.total, sale.currency || currency)}
        </p>
        <p className="text-[12px] sp-muted font-semibold mt-1.5 font-mono">{sale.saleNumber}</p>
      </div>

      {changeDue != null && changeDue > 0 && (
        <div
          className="sp-card mt-5 p-4 text-center"
          style={{ borderColor: 'var(--sp-good)' }}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider sp-muted">Change to give</p>
          <p className="text-[32px] font-black sp-good sp-num leading-tight">
            {money(changeDue, currency)}
          </p>
        </div>
      )}

      <div className="sp-card mt-4">
        {(sale.items ?? []).map((it: any) => (
          <div
            key={it.id ?? it.sku}
            className="flex justify-between gap-3 px-4 py-2.5 border-b last:border-b-0 text-[13px]"
            style={{ borderColor: 'var(--sp-border)' }}
          >
            <span className="font-semibold min-w-0 truncate">
              <span className="sp-muted sp-num mr-1.5">{Number(it.quantity)}×</span>
              {it.name}
            </span>
            <span className="font-bold sp-num shrink-0">
              {money(it.lineTotal, sale.currency || currency)}
            </span>
          </div>
        ))}
      </div>
    </div>

    <div className="shrink-0 px-3 pt-2" data-nopdf>
      <DocumentActions
        size="sm"
        showPrint
        className="justify-center"
        elementId="pos-receipt-doc"
        title={`Receipt ${sale.saleNumber}`}
        phone={sale.customerPhone ?? sale.customer?.phone}
        message={`Here is your receipt ${sale.saleNumber} — ${money(sale.total, sale.currency || currency)}. Thank you.`}
      />
    </div>
    <div
      className="shrink-0 px-3 pt-2.5 border-t flex gap-2"
      style={{
        borderColor: 'var(--sp-border)',
        background: 'var(--sp-surface)',
        paddingBottom: 'calc(0.75rem + var(--sp-safe-bottom))',
      }}
    >
      <button onClick={onNewSale} className="sp-btn flex-1 text-[15px]">
        <Plus size={18} /> New sale
      </button>
    </div>
  </div>
);

export default PosReceipt;
