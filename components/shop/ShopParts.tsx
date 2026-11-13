import React, { useState } from 'react';
import { MessageCircle, Minus, Package, Plus, Trash2, X } from 'lucide-react';
import type { PublicShop, PublicShopProduct } from '../../services/modules/supplierShop.api';
import { orderMessage, shopMoney, whatsappNumber } from './useShopBasket';

/**
 * Pieces every shop template shares: the product picture, the add button and
 * stepper, the product sheet and the basket sheet. A template decides the
 * layout and the mood. These decide how the shop behaves, so a customer gets
 * the same basket whichever template the shop picked.
 */

export const lowerUnit = (unit: string, qty = 1) => {
  const u = String(unit || '').toLowerCase();
  return qty === 1 && u.endsWith('s') ? u.slice(0, -1) : u;
};

export const ProductArt: React.FC<{ p: PublicShopProduct; className?: string; tint?: string }> = ({ p, className = '', tint }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative bg-white flex items-center justify-center overflow-hidden ${className}`}>
      {p.imageUrl && !broken ? (
        <img
          src={p.imageUrl}
          alt={p.name}
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 w-full h-full object-contain p-[8%]"
        />
      ) : (
        <div className="flex flex-col items-center gap-2" style={{ color: tint || '#94a3b8' }}>
          <Package size={34} strokeWidth={1.6} />
          <span className="text-[11px] font-bold uppercase tracking-widest opacity-70">{p.category}</span>
        </div>
      )}
      {p.stock === 'out' && (
        <span className="absolute inset-0 bg-white/70 flex items-center justify-center">
          <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
            Out of stock
          </span>
        </span>
      )}
    </div>
  );
};

/** "Add", then a stepper once it is in the basket. */
export const AddControl: React.FC<{
  p: PublicShopProduct;
  qty: number;
  accent: string;
  onSet: (q: number) => void;
  size?: 'sm' | 'md';
  shape?: 'pill' | 'square';
  label?: string;
}> = ({ p, qty, accent, onSet, size = 'md', shape = 'pill', label = 'Add' }) => {
  const h = size === 'sm' ? 'h-9' : 'h-10';
  const r = shape === 'pill' ? 'rounded-full' : 'rounded-xl';
  if (p.stock === 'out') {
    return <span className={`${h} px-3 inline-flex items-center text-[12px] font-bold text-slate-400`}>Unavailable</span>;
  }
  if (qty <= 0) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSet(1); }}
        className={`${h} ${r} px-4 inline-flex items-center gap-1.5 text-[13px] font-black text-white active:scale-95 transition-transform`}
        style={{ background: accent }}
        aria-label={`Add ${p.name} to basket`}
      >
        <Plus size={15} strokeWidth={3} /> {label}
      </button>
    );
  }
  return (
    <div
      className={`${h} ${r} inline-flex items-center gap-1 px-1`}
      style={{ background: `${accent}14`, border: `1.5px solid ${accent}` }}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={() => onSet(qty - 1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: accent }} aria-label="One less">
        {qty === 1 ? <Trash2 size={14} /> : <Minus size={15} strokeWidth={3} />}
      </button>
      <span className="min-w-[1.5rem] text-center text-[14px] font-black tabular-nums" style={{ color: accent }}>{qty}</span>
      <button type="button" onClick={() => onSet(qty + 1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: accent }} aria-label="One more">
        <Plus size={15} strokeWidth={3} />
      </button>
    </div>
  );
};

export const StockNote: React.FC<{ p: PublicShopProduct }> = ({ p }) =>
  p.stock === 'low' ? (
    <span className="text-[11px] font-bold" style={{ color: '#b45309' }}>Only a few left</span>
  ) : p.stock === 'out' ? (
    <span className="text-[11px] font-bold text-slate-400">Out of stock</span>
  ) : (
    <span className="text-[11px] font-bold" style={{ color: '#15803d' }}>In stock</span>
  );

const Sheet: React.FC<{ onClose: () => void; children: React.ReactNode; label: string }> = ({ onClose, children, label }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={label}>
    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
    <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl text-slate-900">
      {children}
    </div>
  </div>
);

export const ProductSheet: React.FC<{
  p: PublicShopProduct;
  qty: number;
  accent: string;
  onSet: (q: number) => void;
  onClose: () => void;
}> = ({ p, qty, accent, onSet, onClose }) => (
  <Sheet onClose={onClose} label={p.name}>
    <button onClick={onClose} className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center" aria-label="Close">
      <X size={18} />
    </button>
    <ProductArt p={p} className="w-full aspect-square sm:aspect-[4/3]" tint={accent} />
    <div className="p-6">
      <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: accent }}>{p.category}</p>
      <h2 className="text-[22px] font-black leading-tight mt-1">{p.name}</h2>
      {p.maker && <p className="text-[13px] text-slate-500 mt-1">by {p.maker}</p>}
      {p.description && <p className="text-[14px] text-slate-600 mt-3 leading-relaxed whitespace-pre-line">{p.description}</p>}
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[26px] font-black tabular-nums leading-none">{shopMoney(p.price, p.currency)}</p>
          <p className="text-[12px] text-slate-500 mt-1">per {lowerUnit(p.unit)} · <StockNote p={p} /></p>
        </div>
        <AddControl p={p} qty={qty} accent={accent} onSet={onSet} label="Add to basket" />
      </div>
    </div>
  </Sheet>
);

export const BasketSheet: React.FC<{
  shop: PublicShop;
  lines: { product: PublicShopProduct; qty: number }[];
  total: number;
  accent: string;
  onSet: (id: string, q: number) => void;
  onClear: () => void;
  onClose: () => void;
}> = ({ shop, lines, total, accent, onSet, onClear, onClose }) => {
  const [name, setName] = useState('');
  const [branch, setBranch] = useState(shop.branches.length === 1 ? shop.branches[0].name : '');
  const [note, setNote] = useState('');
  const number = whatsappNumber(shop.whatsapp, shop.currency);
  const href = number
    ? `https://wa.me/${number}?text=${encodeURIComponent(orderMessage(shop, lines, total, { name, branch, note }))}`
    : null;

  return (
    <Sheet onClose={onClose} label="Your basket">
      <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between z-10">
        <div>
          <h2 className="text-[19px] font-black">Your basket</h2>
          <p className="text-[12px] text-slate-500">{lines.length} item{lines.length === 1 ? '' : 's'} from {shop.name}</p>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {lines.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-[15px] font-bold">Your basket is empty</p>
          <p className="text-[13px] text-slate-500 mt-1">Tap Add on any product to start an order.</p>
        </div>
      ) : (
        <div className="px-6 py-4">
          <div className="divide-y divide-slate-100">
            {lines.map(({ product: p, qty }) => (
              <div key={p.id} className="py-3 flex items-center gap-3">
                <ProductArt p={p} className="w-16 h-16 rounded-xl border border-slate-100 shrink-0" tint={accent} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold leading-tight">{p.name}</p>
                  <p className="text-[12px] text-slate-500 tabular-nums mt-0.5">
                    {shopMoney(p.price, p.currency)} per {lowerUnit(p.unit)}
                  </p>
                  <p className="text-[13px] font-black tabular-nums mt-1">{shopMoney(p.price * qty, p.currency)}</p>
                </div>
                <AddControl p={p} qty={qty} accent={accent} onSet={(q) => onSet(p.id, q)} size="sm" />
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl px-4 py-3 flex items-baseline justify-between" style={{ background: `${accent}12` }}>
            <span className="text-[12px] font-black uppercase tracking-widest" style={{ color: accent }}>Total</span>
            <span className="text-[24px] font-black tabular-nums" style={{ color: accent }}>{shopMoney(total, shop.currency)}</span>
          </div>

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="text-[12px] font-bold text-slate-600">Your name (optional)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 text-[14px] outline-none focus:border-slate-400" placeholder="So the shop knows who is ordering" />
            </label>
            {shop.branches.length > 1 && (
              <label className="block">
                <span className="text-[12px] font-bold text-slate-600">Collect from</span>
                <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 text-[14px] bg-white outline-none">
                  <option value="">Any branch</option>
                  {shop.branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-[12px] font-bold text-slate-600">Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 text-[14px] outline-none focus:border-slate-400" placeholder="Delivery, a question, anything" />
            </label>
          </div>

          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-white text-[16px] font-black shadow-lg active:scale-[0.98] transition-transform"
              style={{ background: '#25D366' }}
            >
              <MessageCircle size={20} /> Send order on WhatsApp
            </a>
          ) : (
            <p className="mt-5 text-center text-[13px] text-slate-500">This shop has not added a WhatsApp number yet. Please call or visit them.</p>
          )}
          <p className="text-center text-[11.5px] text-slate-400 mt-2">
            WhatsApp opens with your order typed out. The shop confirms the price and how you pay.
          </p>
          <button onClick={onClear} className="mt-3 w-full text-[12px] font-bold text-slate-400 hover:text-slate-600">Empty the basket</button>
        </div>
      )}
    </Sheet>
  );
};

/** The floating "view basket" bar every template shows once something is in it. */
export const BasketBar: React.FC<{ count: number; total: number; currency: string; accent: string; onOpen: () => void }> = ({
  count, total, currency, accent, onOpen,
}) =>
  count > 0 ? (
    <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-5 pointer-events-none">
      <button
        onClick={onOpen}
        className="pointer-events-auto mx-auto w-full max-w-xl h-14 rounded-2xl text-white flex items-center justify-between px-5 shadow-2xl active:scale-[0.99] transition-transform"
        style={{ background: accent }}
      >
        <span className="flex items-center gap-2.5 text-[15px] font-black">
          <span className="min-w-[1.75rem] h-7 px-2 rounded-full bg-white/25 flex items-center justify-center text-[13px] tabular-nums">{count}</span>
          View basket
        </span>
        <span className="text-[16px] font-black tabular-nums">{shopMoney(total, currency)}</span>
      </button>
    </div>
  ) : null;
