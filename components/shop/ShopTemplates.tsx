import React from 'react';
import { MapPin, MessageCircle, Phone, Search, ShoppingBasket } from 'lucide-react';
import type { PublicShop, PublicShopProduct } from '../../services/modules/supplierShop.api';
import { shopMoney, whatsappNumber } from './useShopBasket';
import { AddControl, ProductArt, StockNote, lowerUnit } from './ShopParts';

/**
 * The three looks a shop page can wear. Each gets the same data and the same
 * basket callbacks; only the layout and mood differ.
 *
 *  · market   — bright and busy, like the till: a card grid on soft grey.
 *               The default, free on every plan.
 *  · boutique — calm and editorial: cream paper, serif names, big photos.
 *  · bold     — a brand-colour hero with the cover photo, aisles by category.
 */

export interface TemplateProps {
  shop: PublicShop;
  products: PublicShopProduct[];
  /** Products after search and category. */
  shown: PublicShopProduct[];
  categories: string[];
  category: string;
  setCategory: (c: string) => void;
  query: string;
  setQuery: (q: string) => void;
  accent: string;
  qtyOf: (id: string) => number;
  setQty: (id: string, q: number) => void;
  open: (p: PublicShopProduct) => void;
  basketCount: number;
  openBasket: () => void;
}

const initials = (name: string) => name.trim().charAt(0).toUpperCase() || '?';
const isImg = (v?: string | null) => !!v && /^(https?:|data:|\/)/.test(v);

const Logo: React.FC<{ shop: PublicShop; accent: string; className?: string; round?: boolean }> = ({ shop, accent, className = 'w-14 h-14', round }) => (
  <div
    className={`${className} ${round ? 'rounded-full' : 'rounded-2xl'} shrink-0 overflow-hidden flex items-center justify-center text-[22px] font-black`}
    style={isImg(shop.logoUrl) ? { background: '#fff', border: '1px solid #e2e8f0' } : { background: accent, color: '#fff' }}
  >
    {isImg(shop.logoUrl) ? <img src={shop.logoUrl!} alt="" className="w-full h-full object-cover" /> : <span>{shop.logoUrl || initials(shop.name)}</span>}
  </div>
);

const contactLinks = (shop: PublicShop) => {
  const wa = whatsappNumber(shop.whatsapp, shop.currency);
  return {
    wa: wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hello ${shop.name}, I found your shop on VetHubCore.`)}` : null,
    tel: shop.phone ? `tel:${shop.phone.replace(/\s+/g, '')}` : null,
  };
};

const SearchBox: React.FC<{ query: string; setQuery: (q: string) => void; className?: string; placeholder?: string }> = ({
  query, setQuery, className = '', placeholder = 'Search products',
}) => (
  <label className={`relative block ${className}`}>
    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" />
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder={placeholder}
      className="w-full h-12 rounded-2xl pl-11 pr-4 text-[15px] outline-none bg-white border border-slate-200 focus:border-slate-400 text-slate-900"
      type="search"
    />
  </label>
);

const Empty: React.FC<{ query: string }> = ({ query }) => (
  <div className="py-20 text-center text-slate-500">
    <p className="text-[16px] font-bold">{query ? `Nothing matches "${query}"` : 'No products here yet'}</p>
    <p className="text-[13px] mt-1">Try another word or category.</p>
  </div>
);

// ─── Market ─────────────────────────────────────────────────────────────────

export const MarketTemplate: React.FC<TemplateProps> = (t) => {
  const { shop, accent } = t;
  const links = contactLinks(shop);
  return (
    <div className="min-h-screen bg-[#f3f5f4] text-slate-900 pb-28">
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 60%, ${accent}aa 100%)` }}>
        <div className="absolute -right-20 -top-24 w-72 h-72 rounded-full bg-white/10" />
        <div className="absolute right-24 -bottom-28 w-56 h-56 rounded-full bg-white/10" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-16 text-white">
          <div className="flex items-center gap-4">
            <Logo shop={shop} accent="#ffffff33" className="w-16 h-16 ring-4 ring-white/20" />
            <div className="min-w-0">
              <h1 className="text-[26px] sm:text-[32px] font-black leading-tight tracking-tight">{shop.name}</h1>
              {shop.tagline && <p className="text-[14px] text-white/85 mt-0.5">{shop.tagline}</p>}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {shop.branches.slice(0, 3).map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/15 text-[12.5px] font-bold">
                <MapPin size={13} /> {b.name}
              </span>
            ))}
            {links.wa && (
              <a href={links.wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white text-[12.5px] font-black" style={{ color: accent }}>
                <MessageCircle size={13} /> WhatsApp
              </a>
            )}
            {links.tel && (
              <a href={links.tel} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/15 text-[12.5px] font-bold">
                <Phone size={13} /> Call
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 -mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/5 p-3 border border-slate-100">
            <SearchBox query={t.query} setQuery={t.setQuery} placeholder={`Search ${t.products.length} products`} />
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {['All', ...t.categories].map((c) => {
                const on = t.category === c;
                return (
                  <button
                    key={c}
                    onClick={() => t.setCategory(c)}
                    className="shrink-0 h-9 px-4 rounded-full text-[13px] font-bold border transition-colors"
                    style={on ? { background: accent, borderColor: accent, color: '#fff' } : { background: '#fff', borderColor: '#e2e8f0', color: '#334155' }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
        {t.shown.length === 0 ? <Empty query={t.query} /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {t.shown.map((p) => (
              <article
                key={p.id}
                onClick={() => t.open(p)}
                className="group bg-white rounded-3xl overflow-hidden border border-slate-100 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col"
              >
                <ProductArt p={p} className="aspect-square" tint={accent} />
                <div className="p-3.5 pt-2 flex flex-col flex-1">
                  <p className="text-[10.5px] font-black uppercase tracking-wider" style={{ color: accent }}>{p.category}</p>
                  <h3 className="text-[14px] font-bold leading-snug mt-0.5 line-clamp-2">{p.name}</h3>
                  {p.maker && <p className="text-[11.5px] text-slate-400 truncate mt-0.5">{p.maker}</p>}
                  <div className="mt-auto pt-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="text-[16px] font-black tabular-nums leading-none whitespace-nowrap">{shopMoney(p.price, p.currency)}</p>
                      <p className="text-[11px] text-slate-400 mt-1">per {lowerUnit(p.unit)}</p>
                    </div>
                    <AddControl p={p} qty={t.qtyOf(p.id)} accent={accent} onSet={(q) => t.setQty(p.id, q)} size="sm" label="Add" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

// ─── Boutique ───────────────────────────────────────────────────────────────

const SERIF = { fontFamily: 'Georgia, "Times New Roman", serif' };

export const BoutiqueTemplate: React.FC<TemplateProps> = (t) => {
  const { shop, accent } = t;
  const links = contactLinks(shop);
  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1d2a22] pb-28">
      <header className="border-b border-[#e8e1d4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo shop={shop} accent={accent} className="w-9 h-9" round />
            <span className="text-[15px] font-bold truncate">{shop.name}</span>
          </div>
          <button onClick={t.openBasket} className="relative h-10 px-4 rounded-full border border-[#d9cfbd] inline-flex items-center gap-2 text-[13px] font-bold">
            <ShoppingBasket size={16} /> Basket
            {t.basketCount > 0 && (
              <span className="min-w-[1.4rem] h-[1.4rem] px-1 rounded-full text-white text-[11px] flex items-center justify-center" style={{ background: accent }}>{t.basketCount}</span>
            )}
          </button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-10 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.35em]" style={{ color: accent }}>The shop</p>
        <h1 className="text-[40px] sm:text-[56px] leading-[1.05] mt-3" style={SERIF}>{shop.name}</h1>
        {shop.tagline && <p className="text-[16px] text-[#5b6b60] mt-4 max-w-xl mx-auto" style={SERIF}><em>{shop.tagline}</em></p>}
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-[#5b6b60]">
          {shop.branches.slice(0, 3).map((b) => <span key={b.id} className="inline-flex items-center gap-1.5"><MapPin size={13} /> {b.name}</span>)}
          {links.wa && <a href={links.wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold underline underline-offset-4" style={{ color: accent }}><MessageCircle size={13} /> Message us</a>}
          {links.tel && <a href={links.tel} className="inline-flex items-center gap-1.5 underline underline-offset-4"><Phone size={13} /> {shop.phone}</a>}
        </div>
      </section>

      <div className="sticky top-0 z-30 bg-[#faf7f2]/95 backdrop-blur border-y border-[#e8e1d4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex gap-5 overflow-x-auto no-scrollbar flex-1">
            {['All', ...t.categories].map((c) => (
              <button
                key={c}
                onClick={() => t.setCategory(c)}
                className="shrink-0 py-2 text-[14px] border-b-2 transition-colors"
                style={t.category === c ? { borderColor: accent, color: '#1d2a22', fontWeight: 700 } : { borderColor: 'transparent', color: '#7a877e' }}
              >
                {c}
              </button>
            ))}
          </div>
          <SearchBox query={t.query} setQuery={t.setQuery} className="sm:w-72" />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-10">
        {t.shown.length === 0 ? <Empty query={t.query} /> : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-12 sm:gap-x-8">
            {t.shown.map((p) => (
              <article key={p.id} onClick={() => t.open(p)} className="group cursor-pointer">
                <div className="rounded-[1.75rem] overflow-hidden border border-[#ece5d8] group-hover:shadow-2xl group-hover:shadow-[#1d2a22]/10 transition-shadow">
                  <ProductArt p={p} className="aspect-[4/5] transition-transform duration-500 group-hover:scale-[1.03]" tint={accent} />
                </div>
                <div className="mt-4 text-center px-1">
                  <p className="text-[10.5px] uppercase tracking-[0.25em] text-[#8a958d]">{p.maker || p.category}</p>
                  <h3 className="text-[17px] sm:text-[19px] leading-snug mt-1.5" style={SERIF}>{p.name}</h3>
                  <p className="text-[15px] font-bold tabular-nums mt-1.5">{shopMoney(p.price, p.currency)} <span className="text-[12px] font-normal text-[#8a958d]">/ {lowerUnit(p.unit)}</span></p>
                  <div className="mt-3 flex justify-center">
                    <AddControl p={p} qty={t.qtyOf(p.id)} accent={accent} onSet={(q) => t.setQty(p.id, q)} size="sm" label="Add to basket" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 mt-20 pt-8 border-t border-[#e8e1d4] text-center text-[12px] text-[#8a958d]">
        {shop.address && <p>{shop.address}</p>}
      </footer>
    </div>
  );
};

// ─── Bold ───────────────────────────────────────────────────────────────────

export const BoldTemplate: React.FC<TemplateProps> = (t) => {
  const { shop, accent } = t;
  const links = contactLinks(shop);
  const aisles = t.category === 'All' && !t.query
    ? t.categories.map((c) => ({ name: c, items: t.shown.filter((p) => p.category === c) })).filter((a) => a.items.length)
    : [{ name: t.query ? `Results for "${t.query}"` : t.category, items: t.shown }];

  return (
    <div className="min-h-screen bg-[#0f1512] text-white pb-28">
      <header className="relative min-h-[22rem] sm:min-h-[26rem] flex items-end overflow-hidden">
        {shop.coverUrl ? (
          <img src={shop.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `radial-gradient(60rem 30rem at 85% -10%, ${accent}, transparent 60%), radial-gradient(40rem 25rem at 0% 120%, ${accent}aa, transparent 60%), #0f1512` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1512] via-[#0f1512]/60 to-transparent" />
        <div className="relative max-w-6xl w-full mx-auto px-4 sm:px-6 pb-10">
          <Logo shop={shop} accent={accent} className="w-16 h-16 ring-4 ring-white/10" />
          <h1 className="text-[40px] sm:text-[64px] font-black leading-[0.95] tracking-tight mt-5 uppercase">{shop.name}</h1>
          {shop.tagline && <p className="text-[16px] sm:text-[18px] text-white/75 mt-3 max-w-2xl">{shop.tagline}</p>}
          <div className="mt-6 flex flex-wrap gap-2.5">
            {links.wa && (
              <a href={links.wa} target="_blank" rel="noopener noreferrer" className="h-11 px-5 rounded-xl inline-flex items-center gap-2 text-[14px] font-black" style={{ background: accent }}>
                <MessageCircle size={16} /> Order on WhatsApp
              </a>
            )}
            {links.tel && (
              <a href={links.tel} className="h-11 px-5 rounded-xl inline-flex items-center gap-2 text-[14px] font-bold bg-white/10 border border-white/15">
                <Phone size={16} /> Call
              </a>
            )}
            {shop.branches.slice(0, 2).map((b) => (
              <span key={b.id} className="h-11 px-4 rounded-xl inline-flex items-center gap-2 text-[13px] font-bold text-white/70">
                <MapPin size={15} /> {b.name}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 bg-[#0f1512]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchBox query={t.query} setQuery={t.setQuery} className="sm:w-80" />
          <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
            {['All', ...t.categories].map((c) => {
              const on = t.category === c;
              return (
                <button
                  key={c}
                  onClick={() => t.setCategory(c)}
                  className="shrink-0 h-10 px-4 rounded-xl text-[13px] font-black uppercase tracking-wide"
                  style={on ? { background: accent, color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)' }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        {t.shown.length === 0 ? <div className="text-white/70"><Empty query={t.query} /></div> : aisles.map((a) => (
          <section key={a.name} className="mt-12">
            <div className="flex items-end justify-between gap-3 mb-5">
              <h2 className="text-[28px] sm:text-[34px] font-black uppercase tracking-tight leading-none">
                {a.name}
                <span className="block h-1.5 w-14 mt-3 rounded-full" style={{ background: accent }} />
              </h2>
              <span className="text-[13px] text-white/50 font-bold">{a.items.length} item{a.items.length === 1 ? '' : 's'}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {a.items.map((p) => (
                <article key={p.id} onClick={() => t.open(p)} className="cursor-pointer rounded-3xl overflow-hidden bg-[#18201c] border border-white/5 hover:border-white/20 transition-colors flex flex-col">
                  <ProductArt p={p} className="aspect-square" tint={accent} />
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-[15px] font-bold leading-snug line-clamp-2">{p.name}</h3>
                    <p className="text-[12px] mt-1"><StockNote p={p} /></p>
                    <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-[14px] font-black tabular-nums whitespace-nowrap" style={{ background: `${accent}33`, color: '#fff' }}>
                        {shopMoney(p.price, p.currency)}
                      </span>
                      <AddControl p={p} qty={t.qtyOf(p.id)} accent={accent} onSet={(q) => t.setQty(p.id, q)} size="sm" shape="square" label="Add" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
};
