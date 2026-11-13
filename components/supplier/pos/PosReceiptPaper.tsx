import React from 'react';
import { Image as ImageIcon, ReceiptText } from 'lucide-react';
import PosReceiptDocument, { ReceiptBranch, ReceiptShop, ReceiptStyle } from './PosReceiptDocument';
import PosTillSlip from './PosTillSlip';

/**
 * Which receipt goes out: the A4 sheet with product photos, or the
 * items-only till slip. Whichever is chosen is the one rendered under the
 * id, so Download, Print and WhatsApp share all send the receipt on screen.
 */

interface PaperProps {
  id: string;
  style: ReceiptStyle;
  sale: any;
  currency: string;
  shop: ReceiptShop;
  branch?: ReceiptBranch | null;
  cashierName?: string | null;
  imageFor?: (item: any) => string | null | undefined;
}

export const ReceiptPaper: React.FC<PaperProps> = ({ style, imageFor, ...rest }) =>
  style === 'slip' ? <PosTillSlip {...rest} /> : <PosReceiptDocument {...rest} imageFor={imageFor} />;

export const ReceiptStyleToggle: React.FC<{ value: ReceiptStyle; onChange: (s: ReceiptStyle) => void }> = ({
  value, onChange,
}) => (
  <div className="sp-seg" role="radiogroup" aria-label="Receipt style">
    {([
      { id: 'photos', label: 'With photos', Icon: ImageIcon },
      { id: 'slip', label: 'Items only', Icon: ReceiptText },
    ] as const).map(({ id, label, Icon }) => (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={value === id}
        onClick={() => onChange(id)}
        className={`sp-seg-btn ${value === id ? 'sp-seg-on' : ''}`}
      >
        <Icon size={14} /> {label}
      </button>
    ))}
  </div>
);
