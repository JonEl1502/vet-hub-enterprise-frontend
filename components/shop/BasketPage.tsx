import React, { useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle, ShoppingBasket } from 'lucide-react';
import type { PublicShop, PublicShopProduct } from '../../services/modules/supplierShop.api';
import { orderMessage, shopMoney, unitPriceOf, whatsappNumber } from './useShopBasket';
import { AddControl, ProductArt, lowerUnit } from './ShopParts';

/**
 * vethubcore.com/shop/<slug>/basket — the basket as its own page.
 *
 * It used to be a pop-up over the shop. The user, 2026-11-14: "the basket,
 * being a modal is not good … can we do just a page?" A page has room for
 * the lines, the total and the details side by side on a laptop, survives a
 * refresh, and the phone's Back button returns to the shop.
 *
 * Plain light colours whatever the template, so it reads like a checkout.
 */

interface Line { product: PublicShopProduct; qty: number }

interface Props {
  shop: PublicShop;
  lines: Line[];
  total: number;
  accent: string;
  onSet: (id: string, q: number) => void;
  onClear: () => void;
  onBack: () => void;
}

const BasketPage: React.FC<Props> = ({ shop, lines, total, accent, onSet, onClear, onBack }) => {
  const [name, setName] = useState('');
  const [branch, setBranch] = useState(shop.branches.length === 1 ? shop.branches[0].name : '');
  const [note, setNote] = useState('');
  const number = whatsappNumber(shop.whatsapp, shop.currency);
  const href = number
    ? `https://wa.me/${number}?text=${encodeURIComponent(orderMessage(shop, lines, total, { name, branch, note }))}`
    : null;
  const units = lines.reduce((t, l) => t + l.qty, 0);
  const saved = lines.reduce((t, l) => t + l.qty * (l.product.price - unitPriceOf(l.product)), 0);

  useEffect(() => {
    document.title = `Basket · ${shop.name}`;
    window.scrollTo(0, 0);
  }, [shop.name]);

  const input =
    'mt-1 w-full h-12 rounded-xl border border-slate-200 px-3 text-[16px] sm:text-[15px] outline-none focus:border-slate-400 bg-white text-slate-900';

  return (
    <div className="min-h-[100dvh] bg-[#f3f5f4] text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={onBack} className="h-10 pl-2 pr-3 rounded-xl inline-flex items-center gap-1.5 text-[14px] font-semibold text-slate-700 hover:bg-slate-100 active:scale-[0.98] transition">
            <ArrowLeft size={18} /> Continue shopping
          </button>
          <span className="flex-1" />
          <span className="text-[14px] font-semibold text-slate-500 truncate">{shop.name}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-32 lg:pb-12">
        <h1 className="text-[22px] font-bold">Your basket</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          {lines.length ? `${units} item${units === 1 ? '' : 's'} from ${shop.name}` : `Nothing yet from ${shop.name}`}
        </p>

        {lines.length === 0 ? (
          <div className="mt-6 bg-white rounded-3xl border border-slate-200 p-10 text-center">
            <ShoppingBasket size={36} className="mx-auto text-slate-300" />
            <p className="text-[16px] font-semibold mt-3">Your basket is empty</p>
            <p className="text-[13px] text-slate-500 mt-1">Tap Add on any product to start an order.</p>
            <button onClick={onBack} className="mt-5 h-11 px-5 rounded-xl text-white text-[14px] font-semibold active:scale-[0.98] transition-transform" style={{ background: accent }}>
              Browse products
            </button>
          </div>
        ) : (
          <div className="mt-5 grid lg:grid-cols-[1fr_22rem] gap-5 items-start">
            {/* The lines */}
            <section className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 shadow-[0_2px_8px_rgb(15_23_42/0.04)]">
              {lines.map(({ product: p, qty }) => (
                <div key={p.id} className="p-4 flex items-center gap-4">
                  <ProductArt p={p} className="w-20 h-20 rounded-2xl border border-slate-100 shrink-0" tint={accent} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug">{p.name}</p>
                    <p className="text-[12.5px] text-slate-500 tabular-nums mt-0.5">
                      {shopMoney(unitPriceOf(p), p.currency)} per {lowerUnit(p.unit)}
                      {p.offerPrice != null && <s className="ml-1.5 text-slate-400">{shopMoney(p.price, p.currency)}</s>}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                      <AddControl p={p} qty={qty} accent={accent} onSet={(q) => onSet(p.id, q)} size="sm" />
                      <p className="text-[15px] font-bold tabular-nums">{shopMoney(unitPriceOf(p) * qty, p.currency)}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="p-4 flex justify-between items-center">
                <button onClick={onClear} className="text-[13px] font-semibold text-slate-400 hover:text-slate-600">Empty the basket</button>
                <button onClick={onBack} className="text-[13px] font-semibold" style={{ color: accent }}>Add more items</button>
              </div>
            </section>

            {/* The order */}
            <aside className="bg-white rounded-3xl border border-slate-200 p-5 shadow-[0_2px_8px_rgb(15_23_42/0.04)] lg:sticky lg:top-4">
              <div className="space-y-1.5 text-[14px]">
                {saved > 0.005 && (
                  <div className="flex justify-between text-[13px]" style={{ color: '#15803d' }}>
                    <span>Offers you save</span><span className="font-semibold tabular-nums">{shopMoney(saved, shop.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold">Total</span>
                  <span className="text-[24px] font-bold tabular-nums" style={{ color: accent }}>{shopMoney(total, shop.currency)}</span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-[12.5px] font-semibold text-slate-600">Your name (optional)</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="So the shop knows who is ordering" autoComplete="name" />
                </label>
                {shop.branches.length > 1 && (
                  <label className="block">
                    <span className="text-[12.5px] font-semibold text-slate-600">Collect from</span>
                    <select value={branch} onChange={(e) => setBranch(e.target.value)} className={input}>
                      <option value="">Any branch</option>
                      {shop.branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="block">
                  <span className="text-[12.5px] font-semibold text-slate-600">Note (optional)</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${input} h-auto py-2.5 resize-none`} placeholder="Delivery address, a question, anything" />
                </label>
              </div>

              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden lg:flex mt-5 w-full py-3.5 rounded-2xl items-center justify-center gap-2 text-white text-[16px] font-semibold active:scale-[0.98] transition-transform"
                  style={{ background: '#25D366' }}
                >
                  <MessageCircle size={20} /> Send order on WhatsApp
                </a>
              ) : (
                <p className="mt-5 text-center text-[13px] text-slate-500">This shop has not added a WhatsApp number yet. Please call or visit them.</p>
              )}
              <p className="text-center text-[12px] text-slate-400 mt-2.5 leading-snug">
                WhatsApp opens with your order typed out. The shop confirms the price and how you pay.
              </p>
            </aside>
          </div>
        )}
      </div>

      {/* Phones: the send button docks to the bottom, above the home bar. */}
      {href && lines.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-14 rounded-2xl flex items-center justify-between px-5 text-white text-[16px] font-semibold active:scale-[0.98] transition-transform"
            style={{ background: '#25D366' }}
          >
            <span className="inline-flex items-center gap-2"><MessageCircle size={20} /> Send on WhatsApp</span>
            <span className="tabular-nums">{shopMoney(total, shop.currency)}</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default BasketPage;
