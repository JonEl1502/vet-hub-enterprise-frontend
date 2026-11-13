import React from 'react';
import { Check, Plus, Banknote } from 'lucide-react';
import DocumentActions from '../../clinic/shared/DocumentActions';
import { ReceiptBranch, ScaledPaper, useReceiptStyle } from './PosReceiptDocument';
import { ReceiptPaper, ReceiptStyleToggle } from './PosReceiptPaper';
import { SLIP_WIDTH } from './PosTillSlip';
import { money } from './format';

/**
 * The confirmation.
 *
 * Deliberately a FULL SCREEN and not a toast. It is the cashier's proof the
 * sale landed, the customer's cue that they are done, and the moment change is
 * counted out — a notification that fades after three seconds is none of those.
 * The only prominent action is "New sale", because that is what happens next
 * ninety-nine times out of a hundred.
 *
 * Below the confirmation sits the receipt itself, the same A4 sheet the PDF,
 * Print and WhatsApp share produce, shrunk to fit. What the cashier sees is
 * what the customer gets (user, 2026-11-13: "do the same for the sale complete
 * screen"). It names the shop, so the old letterhead block went with it.
 */

interface Props {
  sale: any;
  currency: string;
  changeDue?: number;
  onNewSale: () => void;
  /** The shop this receipt is from. */
  shopName?: string;
  shopLogo?: string | null;
  shopColor?: string | null;
  /** The till's branch: the sale-complete response carries no address. */
  branch?: ReceiptBranch | null;
  /** Who is on the till: the sale-complete response carries no cashier. */
  cashierName?: string | null;
  /** The product photo for a sale line, from the till's catalogue. */
  imageFor?: (item: any) => string | null | undefined;
}

const PosReceipt: React.FC<Props> = ({
  sale, currency, changeDue, onNewSale, shopName, shopLogo, shopColor, branch, cashierName, imageFor,
}) => {
  const [style, setStyle] = useReceiptStyle();
  const cur = sale.currency || currency;
  const lines = (sale.items ?? []).length;
  const method = (sale.payments ?? [])
    .map((p: any) => String(p.method).toUpperCase())
    .map((m: string) => (m === 'MPESA' || m === 'M_PESA' ? 'M-Pesa' : m.charAt(0) + m.slice(1).toLowerCase().replace(/_/g, ' ')))
    .join(' + ');

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--sp-bg)' }}>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
        {/* The confirmation: did it land, for how much. */}
        <div className="sp-done">
          <div className="sp-done-tick">
            <Check size={26} strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ opacity: 0.8 }}>
              Sale complete
            </p>
            <p className="text-[28px] font-black leading-none mt-1 sp-num">{money(sale.total, cur)}</p>
            <p className="text-[12px] font-semibold mt-1.5" style={{ opacity: 0.85 }}>
              <span className="font-mono">{sale.saleNumber}</span>
              {` · ${lines} item${lines === 1 ? '' : 's'}`}
              {method ? ` · ${method}` : ''}
            </p>
          </div>
        </div>

        {/* Change: the one number the cashier must act on right now. */}
        {changeDue != null && changeDue > 0 && (
          <div className="sp-done-change">
            <span className="sp-done-change-icon"><Banknote size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-widest sp-muted">Give change</p>
              <p className="text-[30px] font-black sp-good sp-num leading-tight">{money(changeDue, currency)}</p>
            </div>
          </div>
        )}

        {/* The receipt, as it prints: the photo sheet or the till slip. */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-2 px-1">
            <p className="text-[11px] font-black uppercase tracking-widest sp-muted">Receipt</p>
          </div>
          <div className="mb-3"><ReceiptStyleToggle value={style} onChange={setStyle} /></div>
          <div className={style === 'slip' ? '' : 'sp-paper'}>
            <ScaledPaper width={style === 'slip' ? SLIP_WIDTH : 794}>
              <ReceiptPaper
                id="pos-receipt-paper"
                style={style}
                sale={sale}
                currency={currency}
                shop={{ name: shopName || '', logoUrl: shopLogo, primaryColor: shopColor }}
                branch={branch}
                cashierName={cashierName}
                imageFor={imageFor}
              />
            </ScaledPaper>
          </div>
        </div>
      </div>

      <div
        className="shrink-0 px-3 pt-2.5 border-t space-y-2.5"
        style={{
          borderColor: 'var(--sp-border)',
          background: 'var(--sp-surface)',
          paddingBottom: 'calc(0.75rem + var(--sp-safe-bottom))',
        }}
      >
        <DocumentActions
          size="sm"
          showPrint
          className="justify-center"
          elementId="pos-receipt-paper"
          title={`Receipt ${sale.saleNumber}`}
          phone={sale.customerPhone ?? sale.customer?.phone}
          message={`Here is your receipt ${sale.saleNumber} — ${money(sale.total, cur)}. Thank you.`}
        />
        <button onClick={onNewSale} className="sp-btn sp-charge w-full text-[15px]" style={{ justifyContent: 'center' }}>
          <Plus size={18} /> New sale
        </button>
      </div>
    </div>
  );
};

export default PosReceipt;
