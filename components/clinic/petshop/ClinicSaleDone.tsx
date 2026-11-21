import React, { useState } from 'react';
import { Check, Plus, Banknote, FileText, ReceiptText } from 'lucide-react';
import DocumentActions from '../shared/DocumentActions';
import PosReceiptDocument, { ReceiptBranch, ReceiptShop, ScaledPaper } from '../../supplier/pos/PosReceiptDocument';
import PosTillSlip, { SLIP_WIDTH } from '../../supplier/pos/PosTillSlip';
import { money } from '../../supplier/pos/format';

/**
 * Sale complete — the clinic till's confirmation, with BOTH documents.
 *
 * The user asked for "a very beautiful invoice, and a receipt" (2026-11-21).
 * They are the same sale on two papers:
 *  - Invoice: the A4 sheet, on the clinic's letterhead, with a Bill to block.
 *  - Receipt: the till slip, for the thermal printer or a WhatsApp photo.
 * Whichever is showing is the one Download / Print / WhatsApp send, because
 * both are rendered under the same element id.
 *
 * Laid out like the supplier till's `PosReceipt` (change to give first, then
 * the paper, then New sale) so the two tills read the same.
 */

type Doc = 'invoice' | 'receipt';
const DOC_KEY = 'petshop.doc';

interface Props {
  sale: any;
  currency: string;
  shop: ReceiptShop;
  branch?: ReceiptBranch | null;
  cashierName?: string | null;
  onNewSale: () => void;
}

const ClinicSaleDone: React.FC<Props> = ({ sale, currency, shop, branch, cashierName, onNewSale }) => {
  const [doc, setDocState] = useState<Doc>(() => {
    try { return localStorage.getItem(DOC_KEY) === 'receipt' ? 'receipt' : 'invoice'; } catch { return 'invoice'; }
  });
  const setDoc = (d: Doc) => { setDocState(d); try { localStorage.setItem(DOC_KEY, d); } catch { /* private mode */ } };

  const cur = sale.currency || currency;
  const cash = (sale.payments ?? []).find((p: any) => p.method === 'CASH');
  const change = cash?.tendered != null ? Number(cash.tendered) - Number(sale.total) : 0;
  const lines = (sale.items ?? []).length;
  const hasPhotos = (sale.items ?? []).some((i: any) => i.imageUrl);
  const title = doc === 'invoice' ? `Invoice ${sale.saleNumber}` : `Receipt ${sale.saleNumber}`;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--sp-bg)' }}>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
        <div className="sp-done">
          <div className="sp-done-tick"><Check size={26} strokeWidth={3} /></div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ opacity: 0.8 }}>Sale complete</p>
            <p className="text-[28px] font-black leading-none mt-1 sp-num">{money(sale.total, cur)}</p>
            <p className="text-[12px] font-semibold mt-1.5" style={{ opacity: 0.85 }}>
              <span className="font-mono">{sale.saleNumber}</span>
              {` · ${lines} item${lines === 1 ? '' : 's'}`}
              {sale.customerName ? ` · ${sale.customerName}` : ''}
            </p>
          </div>
        </div>

        {change > 0 && (
          <div className="sp-done-change">
            <span className="sp-done-change-icon"><Banknote size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-widest sp-muted">Give change</p>
              <p className="text-[30px] font-black sp-good sp-num leading-tight">{money(change, cur)}</p>
              <p className="text-[12px] font-semibold sp-muted">
                Received {money(Number(cash.tendered), cur)}
              </p>
            </div>
          </div>
        )}

        <div>
          <div className="sp-seg mb-3" role="radiogroup" aria-label="Document">
            {([
              { id: 'invoice', label: 'Invoice', Icon: FileText },
              { id: 'receipt', label: 'Receipt', Icon: ReceiptText },
            ] as const).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={doc === id}
                onClick={() => setDoc(id)}
                className={`sp-seg-btn ${doc === id ? 'sp-seg-on' : ''}`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <div className={doc === 'invoice' ? 'sp-paper' : ''}>
            <ScaledPaper width={doc === 'invoice' ? 794 : SLIP_WIDTH}>
              {doc === 'invoice' ? (
                <PosReceiptDocument
                  id="petshop-sale-paper"
                  docTitle="Invoice"
                  sale={sale}
                  currency={cur}
                  shop={shop}
                  branch={branch}
                  cashierName={cashierName}
                  imageFor={hasPhotos ? (it: any) => it.imageUrl : undefined}
                />
              ) : (
                <PosTillSlip
                  id="petshop-sale-paper"
                  sale={sale}
                  currency={cur}
                  shop={shop}
                  branch={branch}
                  cashierName={cashierName}
                />
              )}
            </ScaledPaper>
          </div>
        </div>
      </div>

      <div
        className="shrink-0 px-3 pt-2.5 border-t space-y-2.5"
        style={{ borderColor: 'var(--sp-border)', background: 'var(--sp-surface)', paddingBottom: 'calc(0.75rem + var(--sp-safe-bottom))' }}
      >
        <DocumentActions
          size="sm"
          showPrint
          className="justify-center"
          elementId="petshop-sale-paper"
          title={title}
          phone={sale.customerPhone}
          message={`Here is your ${doc} ${sale.saleNumber} from ${shop.name}: ${money(sale.total, cur)}. Thank you.`}
        />
        <button onClick={onNewSale} className="sp-btn sp-charge w-full text-[15px]" style={{ justifyContent: 'center' }}>
          <Plus size={18} /> New sale
        </button>
      </div>
    </div>
  );
};

export default ClinicSaleDone;
