import React, { createContext, useContext, useState } from 'react';
import { Clock, FileText, MessageCircle, Minus, Package, Phone, Plus, Store, Trash2, Truck, X } from 'lucide-react';
import type { PublicShop, PublicShopProduct, ShopHours } from '../../services/modules/supplierShop.api';
import { shopMoney, unitPriceOf, whatsappNumber } from './useShopBasket';

/**
 * Pieces every shop template shares: the product picture, the add button and
 * stepper, the product sheet and the basket sheet. A template decides the
 * layout and the mood. These decide how the shop behaves, so a customer gets
 * the same basket whichever template the shop picked.
 */

/** The shop every part on the page belongs to, for "Ask price" links. */
export const ShopCtx = createContext<PublicShop | null>(null);

const askHref = (shop: PublicShop | null, p: PublicShopProduct) => {
  const n = shop ? whatsappNumber(shop.whatsapp, shop.currency) : null;
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(`Hello ${shop!.name}, what is the price of ${p.name}?`)}` : null;
};

export const pctOff = (p: PublicShopProduct) =>
  p.offerPrice != null && p.price > 0 ? Math.round((1 - p.offerPrice / p.price) * 100) : 0;

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
  const shop = useContext(ShopCtx);
  // No price set: the customer asks on WhatsApp instead of seeing "KES 0".
  if (!(p.price > 0)) {
    const href = askHref(shop, p);
    return href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`${h} ${r} px-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold border bg-white active:scale-95 transition-transform`}
        style={{ borderColor: '#cbd5e1', color: '#334155' }}
      >
        <MessageCircle size={14} /> Ask price
      </a>
    ) : (
      <span className={`${h} px-3 inline-flex items-center text-[12px] font-bold text-slate-400`}>Ask in store</span>
    );
  }
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
          <PriceTag p={p} size="lg" />
          <p className="text-[12px] text-slate-500 mt-1">per {lowerUnit(p.unit)} · <StockNote p={p} /></p>
        </div>
        <AddControl p={p} qty={qty} accent={accent} onSet={onSet} label="Add to basket" />
      </div>
    </div>
  </Sheet>
);

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

// ─── Prices, offers and promos ─────────────────────────────────────────────

/**
 * The price, and when the product is on offer: the offer price on a yellow
 * highlight with the old price struck through. "Ask price" when there is none.
 */
export const PriceTag: React.FC<{ p: PublicShopProduct; size?: 'sm' | 'md' | 'lg'; dark?: boolean; unit?: boolean }> = ({
  p, size = 'md', dark, unit = true,
}) => {
  const big = size === 'lg' ? 'text-[26px]' : size === 'md' ? 'text-[16px]' : 'text-[14px]';
  if (!(p.price > 0)) {
    return <span className={`text-[13px] font-semibold ${dark ? 'text-white/60' : 'text-slate-500'}`}>Price on request</span>;
  }
  const on = p.offerPrice != null;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span
        className={`${big} font-black tabular-nums leading-none whitespace-nowrap ${on ? 'px-1.5 py-0.5 rounded-md' : ''}`}
        style={on ? { background: '#fde047', color: '#1f2937' } : undefined}
      >
        {shopMoney(unitPriceOf(p), p.currency)}
      </span>
      {on && <s className={`text-[12px] tabular-nums ${dark ? 'text-white/45' : 'text-slate-400'}`}>{shopMoney(p.price, p.currency)}</s>}
      {unit && <span className={`text-[11.5px] ${dark ? 'text-white/50' : 'text-slate-400'}`}>/ {lowerUnit(p.unit)}</span>}
    </span>
  );
};

export const OffBadge: React.FC<{ p: PublicShopProduct; className?: string }> = ({ p, className = '' }) => {
  const off = pctOff(p);
  return off > 0 ? (
    <span className={`absolute top-2.5 left-2.5 z-[1] rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`} style={{ background: '#fde047', color: '#1f2937' }}>
      −{off}%
    </span>
  ) : null;
};

export const PromoLines: React.FC<{ p: PublicShopProduct; dark?: boolean }> = ({ p, dark }) =>
  p.promo?.length ? (
    <div className="mt-1 space-y-0.5">
      {p.promo.map((t) => (
        <p key={t} className="text-[11.5px] font-semibold leading-snug" style={{ color: dark ? '#86efac' : '#15803d' }}>{t}</p>
      ))}
    </div>
  ) : null;

// ─── Hours, delivery and contact ───────────────────────────────────────────

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}${ap}`;
};

/** "Open now · closes 6pm" or "Closed · opens 8am Mon", by the visitor's clock. */
export const openStatus = (hours: ShopHours | null, now = new Date()): { open: boolean; text: string } | null => {
  if (!hours?.days?.length) return null;
  const today = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const o = toMin(hours.open);
  const c = toMin(hours.close);
  if (hours.days.includes(today) && mins >= o && mins < c) return { open: true, text: `Open now · closes ${fmt12(hours.close)}` };
  for (let i = 0; i < 8; i++) {
    const d = (today + i) % 7;
    if (!hours.days.includes(d)) continue;
    if (i === 0 && mins >= o) continue;
    const when = i === 0 ? '' : i === 1 ? ' tomorrow' : ` ${DAY[d]}`;
    return { open: false, text: `Closed · opens ${fmt12(hours.open)}${when}` };
  }
  return null;
};

export const hoursLine = (hours: ShopHours | null) => {
  if (!hours?.days?.length) return null;
  const d = [...hours.days].sort();
  const run = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const days = d.length === 7 ? 'Every day' : run && d.length > 2 ? `${DAY[d[0]]}–${DAY[d[d.length - 1]]}` : d.map((x) => DAY[x]).join(', ');
  return `${days}, ${fmt12(hours.open)}–${fmt12(hours.close)}`;
};

/** The practical facts a customer checks before they come or order. */
export const InfoChips: React.FC<{ shop: PublicShop; dark?: boolean; accent: string; className?: string }> = ({ shop, dark, accent, className = '' }) => {
  const st = openStatus(shop.hours);
  const chip = `inline-flex items-center gap-1.5 text-[12.5px] ${dark ? 'text-white/85' : 'text-slate-600'}`;
  if (!st && !shop.deliveryNote && !shop.pickup) return null;
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 ${className}`}>
      {st && (
        <span className={chip}>
          <span className="w-2 h-2 rounded-full" style={{ background: st.open ? '#22c55e' : '#f59e0b' }} />
          <span className={st.open ? 'font-semibold' : ''} style={st.open && !dark ? { color: '#15803d' } : undefined}>{st.text}</span>
        </span>
      )}
      {shop.deliveryNote && <span className={chip}><Truck size={14} style={{ color: dark ? undefined : accent }} /> {shop.deliveryNote}</span>}
      {shop.pickup && <span className={chip}><Store size={14} style={{ color: dark ? undefined : accent }} /> Collect in store</span>}
    </div>
  );
};

/**
 * "Got a long list?" / "Have a prescription?": the customer sends a photo or
 * a list on WhatsApp and the shop prices the lot. Farmers and pet owners
 * already order this way; the page just makes it one tap.
 */
export const SendListCard: React.FC<{ shop: PublicShop; accent: string; kind?: 'list' | 'prescription'; dark?: boolean; className?: string }> = ({
  shop, accent, kind = 'list', dark, className = '',
}) => {
  const n = whatsappNumber(shop.whatsapp, shop.currency);
  if (!n && !shop.phone) return null;
  const text =
    kind === 'prescription'
      ? `Hello ${shop.name}, I have a vet prescription. I'll send a photo here.`
      : `Hello ${shop.name}, here is my list. Please price it for me:\n\n`;
  const title = kind === 'prescription' ? 'Have a vet prescription?' : 'Got a long list?';
  const body =
    kind === 'prescription'
      ? "Send a photo on WhatsApp. We'll reply with the price and get it ready."
      : "Send it on WhatsApp and we'll price the lot for you.";
  return (
    <div
      className={`rounded-3xl p-4 ${className}`}
      style={dark ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' } : { background: '#fff', border: '1px solid #e2e8f0' }}
    >
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${accent}18`, color: dark ? '#fff' : accent }}>
          <FileText size={18} />
        </span>
        <div className="min-w-0">
          <p className={`text-[15px] font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</p>
          <p className={`text-[12.5px] mt-0.5 leading-snug ${dark ? 'text-white/65' : 'text-slate-500'}`}>{body}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {n && (
          <a
            href={`https://wa.me/${n}?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 rounded-xl inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-white active:scale-[0.98] transition-transform"
            style={{ background: accent }}
          >
            <MessageCircle size={15} /> {kind === 'prescription' ? 'Send photo' : 'Send list'}
          </a>
        )}
        {shop.phone && (
          <a
            href={`tel:${shop.phone.replace(/\s+/g, '')}`}
            className={`h-10 rounded-xl inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold active:scale-[0.98] transition-transform ${n ? '' : 'col-span-2'}`}
            style={dark ? { background: 'rgba(255,255,255,0.1)', color: '#fff' } : { background: '#f1f5f9', color: '#334155' }}
          >
            <Phone size={15} /> Call
          </a>
        )}
      </div>
    </div>
  );
};

export const HoursCard: React.FC<{ shop: PublicShop; accent: string }> = ({ shop, accent }) => {
  const line = hoursLine(shop.hours);
  if (!line) return null;
  return (
    <p className="text-[12.5px] text-slate-600 flex items-center gap-1.5"><Clock size={13} style={{ color: accent }} /> {line}</p>
  );
};
