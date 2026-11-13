import React from 'react';
import { ChevronRight, MapPin, MessageCircle, Phone, Search, ShoppingBasket, Truck, Store, Clock } from 'lucide-react';
import type { PublicShop, PublicShopProduct, ShopTemplate } from '../../services/modules/supplierShop.api';
import { whatsappNumber } from './useShopBasket';
import {
  AddControl, InfoChips, OffBadge, PriceTag, ProductArt, PromoLines, SendListCard, StockNote,
  hoursLine, openStatus,
} from './ShopParts';

/**
 * The five looks a shop page can wear. Each gets the same data and basket;
 * only the layout and mood differ.
 *
 *  · market   — bright and busy, like the till: card grid, panels either side.
 *               The default, free on every plan.
 *  · boutique — calm and editorial: cream paper, serif headings, big photos.
 *  · bold     — a dark hero in the brand colour with the cover photo, aisles.
 *  · counter  — the trade counter: price-list rows by department, "send your
 *               list" up top. Built for agrovets with hundreds of lines.
 *  · vetshop  — search first, "have a vet prescription?", a clean grid. For
 *               pet shops and vet pharmacies.
 *
 * Counter and Vet Shop were drawn from Rekodi's Hardware and Chemist shop
 * templates (user, 2026-11-14: "see what you can extract"). Every template
 * shows Offers (sale price struck through, −%), Popular (till best sellers)
 * and promo lines when the shop has them, and "Ask price" for unpriced items.
 */

export interface TemplateProps {
  shop: PublicShop;
  products: PublicShopProduct[];
  /** Products after search and category. */
  shown: PublicShopProduct[];
  /** On offer, in catalogue order. */
  offers: PublicShopProduct[];
  /** Best sellers from the till, best first. */
  popular: PublicShopProduct[];
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
/** The landing view: nothing searched, no category picked. */
const isHome = (t: TemplateProps) => t.category === 'All' && !t.query.trim();
const countIn = (t: TemplateProps) =>
  t.products.reduce<Record<string, number>>((m, p) => ((m[p.category] = (m[p.category] ?? 0) + 1), m), {});

const Logo: React.FC<{ shop: PublicShop; accent: string; className?: string; round?: boolean }> = ({ shop, accent, className = 'w-14 h-14', round }) => (
  <div
    className={`${className} ${round ? 'rounded-full' : 'rounded-2xl'} shrink-0 overflow-hidden flex items-center justify-center text-[20px] font-bold`}
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

const SearchBox: React.FC<{ query: string; setQuery: (q: string) => void; className?: string; placeholder?: string; tall?: boolean }> = ({
  query, setQuery, className = '', placeholder = 'Search products', tall,
}) => (
  <label className={`relative block ${className}`}>
    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 text-slate-500" />
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder={placeholder}
      className={`w-full ${tall ? 'h-14 text-[16px]' : 'h-12 text-[16px] sm:text-[15px]'} rounded-2xl pl-11 pr-4 outline-none bg-white border border-slate-200 focus:border-slate-400 text-slate-900`}
      type="search"
      inputMode="search"
      autoComplete="off"
    />
  </label>
);

const Empty: React.FC<{ query: string; dark?: boolean }> = ({ query, dark }) => (
  <div className={`py-20 text-center ${dark ? 'text-white/60' : 'text-slate-500'}`}>
    <p className="text-[16px] font-semibold">{query ? `Nothing matches "${query}"` : 'No products here yet'}</p>
    <p className="text-[13px] mt-1">Try another word or category.</p>
  </div>
);

const SectionHead: React.FC<{ title: string; count?: number; serif?: boolean; dark?: boolean; accent?: string; onMore?: () => void }> = ({
  title, count, serif, dark, accent, onMore,
}) => (
  <div className={`flex items-end justify-between gap-3 mb-3 ${serif ? 'border-b border-[#e8e1d4] pb-2.5 mb-5' : ''}`}>
    <h2
      className={serif ? 'text-[28px] sm:text-[34px] leading-none text-[#1d2a22]' : `text-[18px] font-bold ${dark ? 'text-white' : 'text-slate-900'}`}
      style={serif ? { fontFamily: 'Georgia, "Times New Roman", serif' } : undefined}
    >
      {title}
      {count != null && <span className={`ml-1.5 text-[13px] font-medium ${dark ? 'text-white/40' : 'text-slate-400'}`} style={{ fontFamily: 'inherit' }}>{count}</span>}
    </h2>
    {onMore && (
      <button onClick={onMore} className="text-[13px] font-semibold inline-flex items-center gap-0.5 shrink-0" style={{ color: accent }}>
        See all <ChevronRight size={15} />
      </button>
    )}
  </div>
);

// ─── Advertising rail ──────────────────────────────────────────────────────

/**
 * The right-hand column on wide screens, held for advertising (user,
 * 2026-11-13: "on the right panel we can leave it for future advertising").
 * Until real ads are sold it carries one quiet "advertise here" card, so the
 * slot is visible and saleable rather than an empty gap. Hidden below xl.
 */
export const AdRail: React.FC<{ dark?: boolean; className?: string }> = ({ dark, className = '' }) => (
  <aside className={`hidden xl:block w-72 shrink-0 self-stretch ${className}`} aria-label="Sponsored">
    <div className="sticky top-4 space-y-3">
      <p className={`text-[10px] font-bold uppercase tracking-[0.06em] ${dark ? 'text-white/40' : 'text-slate-400'}`}>Sponsored</p>
      <a
        href="/"
        className={`block rounded-3xl p-5 border-2 border-dashed transition-colors ${
          dark ? 'border-white/15 hover:border-white/30 text-white/80' : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white/60'
        }`}
      >
        <div className={`h-28 rounded-2xl mb-4 flex items-center justify-center text-[12px] font-semibold ${dark ? 'bg-white/5 text-white/40' : 'bg-slate-100 text-slate-400'}`}>
          Your brand here
        </div>
        <p className="text-[14px] font-bold leading-snug">Reach customers while they shop</p>
        <p className="text-[12px] mt-1 opacity-75">Advertise feeds, seeds, pet food or animal health products on VetHubCore shop pages.</p>
        <p className="text-[12px] font-semibold mt-3 underline underline-offset-4">Advertise with VetHubCore</p>
      </a>
    </div>
  </aside>
);

// ─── A product card used by Market and Vet Shop ─────────────────────────────

const GridCard: React.FC<{ t: TemplateProps; p: PublicShopProduct; outline?: boolean }> = ({ t, p, outline }) => (
  <article
    onClick={() => t.open(p)}
    className="group relative bg-white rounded-3xl overflow-hidden border border-slate-200/70 hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 ease-[cubic-bezier(.22,.7,.2,1)] cursor-pointer flex flex-col shadow-[0_2px_8px_rgb(15_23_42/0.04)]"
  >
    <OffBadge p={p} />
    <ProductArt p={p} className="aspect-[5/4]" tint={t.accent} />
    <div className="p-3.5 pt-2 flex flex-col flex-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: t.accent }}>{p.category}</p>
      <h3 className="text-[14px] font-semibold leading-snug mt-0.5 line-clamp-2 text-slate-900">{p.name}</h3>
      {p.maker && <p className="text-[11.5px] text-slate-400 truncate mt-0.5">{p.maker}</p>}
      <PromoLines p={p} />
      <div className="mt-auto pt-3 flex flex-col gap-2">
        <PriceTag p={p} size="md" />
        <div className={outline ? '' : 'flex justify-end'}>
          <AddControl p={p} qty={t.qtyOf(p.id)} accent={t.accent} onSet={(q) => t.setQty(p.id, q)} size="sm" label={outline ? 'Add to basket' : 'Add'} />
        </div>
      </div>
    </div>
  </article>
);

/** A row of cards that scrolls sideways on phones and wraps into a grid on desktop. */
const Shelf: React.FC<{ t: TemplateProps; items: PublicShopProduct[]; outline?: boolean }> = ({ t, items, outline }) => (
  <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x pb-1 sm:grid sm:grid-cols-3 2xl:grid-cols-4 sm:overflow-visible sm:gap-4">
    {items.map((p) => (
      <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
        <GridCard t={t} p={p} outline={outline} />
      </div>
    ))}
  </div>
);

// ─── Market ─────────────────────────────────────────────────────────────────

export const MarketTemplate: React.FC<TemplateProps> = (t) => {
  const { shop, accent } = t;
  const links = contactLinks(shop);
  const counts = countIn(t);
  const home = isHome(t);

  return (
    <div className="min-h-[100dvh] bg-[#f3f5f4] text-slate-900 pb-28">
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(120deg, ${accent} 0%, ${accent}e6 70%, ${accent}bb 100%)` }}>
        <div className="absolute -right-16 -top-20 w-60 h-60 rounded-full bg-white/10" />
        <div className="relative max-w-[1600px] mx-auto px-4 lg:px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <Logo shop={shop} accent="#ffffff33" className="w-12 h-12 ring-2 ring-white/20" />
            <div className="min-w-0">
              <h1 className="text-[20px] sm:text-[24px] font-bold leading-tight tracking-tight truncate">{shop.name}</h1>
              {shop.tagline && <p className="text-[13px] text-white/85 truncate">{shop.tagline}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {shop.branches.slice(0, 3).map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/15 text-[12.5px] font-semibold">
                <MapPin size={13} /> {b.name}
              </span>
            ))}
            {links.wa && (
              <a href={links.wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white text-[12.5px] font-semibold" style={{ color: accent }}>
                <MessageCircle size={13} /> WhatsApp
              </a>
            )}
            {links.tel && (
              <a href={links.tel} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/15 text-[12.5px] font-semibold">
                <Phone size={13} /> Call
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Phone and tablet: search and categories as a sticky bar. */}
      <div className="lg:hidden sticky top-0 z-30 bg-[#f3f5f4]/95 backdrop-blur px-4 pt-3 pb-2 border-b border-slate-200">
        <SearchBox query={t.query} setQuery={t.setQuery} placeholder={`Search ${t.products.length} products`} />
        <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar">
          {['All', ...t.categories].map((c) => {
            const on = t.category === c;
            return (
              <button
                key={c}
                onClick={() => t.setCategory(c)}
                className="shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold border active:scale-95 transition-transform"
                style={on ? { background: accent, borderColor: accent, color: '#fff' } : { background: '#fff', borderColor: '#e2e8f0', color: '#334155' }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 pt-4 lg:pt-6 flex gap-6 items-start">
        <aside className="hidden lg:block w-64 shrink-0 sticky top-4 space-y-3">
          <div className="bg-white rounded-3xl border border-slate-200/70 p-3 shadow-[0_2px_8px_rgb(15_23_42/0.04)]">
            <SearchBox query={t.query} setQuery={t.setQuery} placeholder={`Search ${t.products.length} products`} />
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400 mt-4 mb-1.5 px-2">Categories</p>
            <nav className="space-y-0.5">
              {['All', ...t.categories].map((c) => {
                const on = t.category === c;
                const n = c === 'All' ? t.products.length : counts[c] ?? 0;
                return (
                  <button
                    key={c}
                    onClick={() => t.setCategory(c)}
                    className="w-full h-10 px-3 rounded-xl flex items-center justify-between text-[14px] font-medium transition-colors"
                    style={on ? { background: `${accent}14`, color: accent, fontWeight: 600 } : { color: '#334155' }}
                  >
                    <span className="truncate">{c === 'All' ? 'All products' : c}</span>
                    <span className="text-[12px] tabular-nums opacity-60">{n}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          <SendListCard shop={shop} accent={accent} />
          {shop.branches.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/70 p-4 shadow-[0_2px_8px_rgb(15_23_42/0.04)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400 mb-2">Find us</p>
              {hoursLine(shop.hours) && <p className="text-[12.5px] text-slate-600 flex items-center gap-1.5 mb-2"><Clock size={13} style={{ color: accent }} /> {hoursLine(shop.hours)}</p>}
              {shop.branches.map((b) => (
                <div key={b.id} className="py-1.5">
                  <p className="text-[13px] font-semibold flex items-center gap-1.5"><MapPin size={13} style={{ color: accent }} /> {b.name}</p>
                  {b.address && <p className="text-[12px] text-slate-500 pl-5">{b.address}</p>}
                  {b.phone && <a href={`tel:${b.phone.replace(/\s+/g, '')}`} className="text-[12px] text-slate-500 pl-5 underline underline-offset-2">{b.phone}</a>}
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0 space-y-8">
          {home && (shop.headline || shop.intro || shop.hours || shop.deliveryNote) && (
            <section className="bg-white rounded-3xl border border-slate-200/70 p-5 sm:p-6 shadow-[0_2px_8px_rgb(15_23_42/0.04)]">
              {shop.headline && <h2 className="text-[22px] sm:text-[26px] font-bold leading-tight tracking-tight">{shop.headline}</h2>}
              {shop.intro && <p className="text-[14px] text-slate-600 mt-2 max-w-3xl leading-relaxed">{shop.intro}</p>}
              <InfoChips shop={shop} accent={accent} className="mt-3" />
            </section>
          )}
          {home && <div className="lg:hidden"><SendListCard shop={shop} accent={accent} /></div>}

          {home && t.offers.length > 0 && (
            <section>
              <SectionHead title="On offer" count={t.offers.length} />
              <Shelf t={t} items={t.offers.slice(0, 8)} />
            </section>
          )}
          {home && t.popular.length > 0 && (
            <section>
              <SectionHead title="Popular" />
              <Shelf t={t} items={t.popular.slice(0, 8)} />
            </section>
          )}

          <section>
            <SectionHead
              title={t.query ? `Results for "${t.query}"` : t.category === 'All' ? 'All products' : t.category}
              count={t.shown.length}
            />
            {t.shown.length === 0 ? <Empty query={t.query} /> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                {t.shown.map((p) => <GridCard key={p.id} t={t} p={p} />)}
              </div>
            )}
          </section>
        </main>

        <AdRail />
      </div>
    </div>
  );
};

// ─── Boutique ───────────────────────────────────────────────────────────────

const SERIF = { fontFamily: 'Georgia, "Times New Roman", serif' };

const BoutiqueCard: React.FC<{ t: TemplateProps; p: PublicShopProduct }> = ({ t, p }) => (
  <article onClick={() => t.open(p)} className="group cursor-pointer min-w-0">
    <div className="relative rounded-[1.5rem] overflow-hidden border border-[#ece5d8] group-hover:border-[#d9cfbd] transition-colors">
      <OffBadge p={p} />
      <ProductArt p={p} className="aspect-[4/5] transition-transform duration-500 ease-[cubic-bezier(.22,.7,.2,1)] group-hover:scale-[1.03]" tint={t.accent} />
    </div>
    <div className="mt-3 text-center px-1">
      <p className="text-[10px] uppercase tracking-[0.06em] text-[#8a958d]">{p.maker || p.category}</p>
      <h3 className="text-[16px] sm:text-[18px] leading-snug mt-1 text-[#1d2a22]" style={SERIF}>{p.name}</h3>
      <div className="mt-1.5 flex justify-center"><PriceTag p={p} size="sm" /></div>
      <div className="flex justify-center"><PromoLines p={p} /></div>
      <div className="mt-3 flex justify-center">
        <AddControl p={p} qty={t.qtyOf(p.id)} accent={t.accent} onSet={(q) => t.setQty(p.id, q)} size="sm" label="Add to basket" />
      </div>
    </div>
  </article>
);

export const BoutiqueTemplate: React.FC<TemplateProps> = (t) => {
  const { shop, accent } = t;
  const links = contactLinks(shop);
  const home = isHome(t);
  const grid = 'grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-5 gap-y-10 sm:gap-x-7';
  return (
    <div className="min-h-[100dvh] bg-[#faf7f2] text-[#1d2a22] pb-28">
      <header className="border-b border-[#e8e1d4]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo shop={shop} accent={accent} className="w-9 h-9" round />
            <span className="text-[15px] font-semibold truncate">{shop.name}</span>
          </div>
          <button onClick={t.openBasket} className="relative h-10 px-4 rounded-full border border-[#d9cfbd] inline-flex items-center gap-2 text-[13px] font-semibold active:scale-[0.98] transition-transform">
            <ShoppingBasket size={16} /> Basket
            {t.basketCount > 0 && (
              <span className="min-w-[1.4rem] h-[1.4rem] px-1 rounded-full text-white text-[11px] flex items-center justify-center" style={{ background: accent }}>{t.basketCount}</span>
            )}
          </button>
        </div>
      </header>

      <section className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-8 pb-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: accent }}>
          {shop.branches[0]?.name || 'The shop'}
        </p>
        <h1 className="text-[34px] sm:text-[48px] leading-[1.05] mt-2 max-w-3xl mx-auto" style={SERIF}>{shop.headline || shop.name}</h1>
        {(shop.intro || shop.tagline) && (
          <p className="text-[15px] text-[#5b6b60] mt-3 max-w-xl mx-auto leading-relaxed">{shop.intro || shop.tagline}</p>
        )}
        <div className="mt-4 flex justify-center"><InfoChips shop={shop} accent={accent} className="justify-center" /></div>
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-[#5b6b60]">
          {links.wa && <a href={links.wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4" style={{ color: accent }}><MessageCircle size={13} /> Message us</a>}
          {links.tel && <a href={links.tel} className="inline-flex items-center gap-1.5 underline underline-offset-4"><Phone size={13} /> {shop.phone}</a>}
        </div>
      </section>

      <div className="sticky top-0 z-30 bg-[#faf7f2]/95 backdrop-blur border-y border-[#e8e1d4]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex gap-5 overflow-x-auto no-scrollbar flex-1">
            {['All', ...t.categories].map((c) => (
              <button
                key={c}
                onClick={() => t.setCategory(c)}
                className="shrink-0 py-2 text-[14px] border-b-2 transition-colors"
                style={t.category === c ? { borderColor: accent, color: '#1d2a22', fontWeight: 600 } : { borderColor: 'transparent', color: '#7a877e' }}
              >
                {c}
              </button>
            ))}
          </div>
          <SearchBox query={t.query} setQuery={t.setQuery} className="sm:w-72" />
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 mt-8 flex gap-8 items-start">
        <main className="flex-1 min-w-0 space-y-14">
          {home && t.offers.length > 0 && (
            <section>
              <SectionHead title="On offer" count={t.offers.length} serif />
              <div className={grid}>{t.offers.slice(0, 8).map((p) => <BoutiqueCard key={p.id} t={t} p={p} />)}</div>
            </section>
          )}
          {home && t.popular.length > 0 && (
            <section>
              <SectionHead title="Loved by our customers" serif />
              <div className={grid}>{t.popular.slice(0, 4).map((p) => <BoutiqueCard key={p.id} t={t} p={p} />)}</div>
            </section>
          )}
          <section>
            <SectionHead title={t.query ? `Results for "${t.query}"` : t.category === 'All' ? 'Everything' : t.category} count={t.shown.length} serif />
            {t.shown.length === 0 ? <Empty query={t.query} /> : <div className={grid}>{t.shown.map((p) => <BoutiqueCard key={p.id} t={t} p={p} />)}</div>}
          </section>
          {home && <div className="max-w-xl"><SendListCard shop={shop} accent={accent} /></div>}
        </main>
        <AdRail />
      </div>

      <footer className="max-w-[1600px] mx-auto px-4 sm:px-6 mt-20 pt-8 border-t border-[#e8e1d4] text-center text-[12px] text-[#8a958d] space-y-1">
        {hoursLine(shop.hours) && <p>{hoursLine(shop.hours)}</p>}
        {shop.address && <p>{shop.address}</p>}
      </footer>
    </div>
  );
};

// ─── Bold ───────────────────────────────────────────────────────────────────

const BoldCard: React.FC<{ t: TemplateProps; p: PublicShopProduct }> = ({ t, p }) => (
  <article onClick={() => t.open(p)} className="relative cursor-pointer rounded-3xl overflow-hidden bg-[#18201c] border border-white/5 hover:border-white/20 transition-colors flex flex-col">
    <OffBadge p={p} />
    <ProductArt p={p} className="aspect-square" tint={t.accent} />
    <div className="p-4 flex flex-col flex-1">
      <h3 className="text-[15px] font-semibold leading-snug line-clamp-2 text-white">{p.name}</h3>
      <p className="text-[12px] mt-1"><StockNote p={p} /></p>
      <PromoLines p={p} dark />
      <div className="mt-auto pt-3 flex flex-col gap-2">
        <PriceTag p={p} size="md" dark />
        <div className="flex justify-end">
          <AddControl p={p} qty={t.qtyOf(p.id)} accent={t.accent} onSet={(q) => t.setQty(p.id, q)} size="sm" shape="square" label="Add" />
        </div>
      </div>
    </div>
  </article>
);

export const BoldTemplate: React.FC<TemplateProps> = (t) => {
  const { shop, accent } = t;
  const links = contactLinks(shop);
  const home = isHome(t);
  const aisles = [
    ...(home && t.offers.length ? [{ name: 'On offer', items: t.offers.slice(0, 8) }] : []),
    ...(home && t.popular.length ? [{ name: 'Popular', items: t.popular.slice(0, 8) }] : []),
    ...(home
      ? t.categories.map((c) => ({ name: c, items: t.shown.filter((p) => p.category === c) })).filter((a) => a.items.length)
      : [{ name: t.query ? `Results for "${t.query}"` : t.category, items: t.shown }]),
  ];

  return (
    <div className="min-h-[100dvh] bg-[#0f1512] text-white pb-28">
      <header className="relative min-h-[16rem] sm:min-h-[19rem] flex items-end overflow-hidden">
        {shop.coverUrl ? (
          <img src={shop.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `radial-gradient(60rem 30rem at 85% -10%, ${accent}, transparent 60%), radial-gradient(40rem 25rem at 0% 120%, ${accent}aa, transparent 60%), #0f1512` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1512] via-[#0f1512]/60 to-transparent" />
        <div className="relative max-w-[1600px] w-full mx-auto px-4 sm:px-6 pb-10">
          <Logo shop={shop} accent={accent} className="w-14 h-14 ring-4 ring-white/10" />
          <h1 className="text-[34px] sm:text-[52px] font-bold leading-[0.95] tracking-tight mt-4">{shop.headline || shop.name}</h1>
          {(shop.intro || shop.tagline) && <p className="text-[15px] sm:text-[17px] text-white/75 mt-3 max-w-2xl leading-relaxed">{shop.intro || shop.tagline}</p>}
          <InfoChips shop={shop} accent={accent} dark className="mt-4" />
          <div className="mt-5 flex flex-wrap gap-2.5">
            {links.wa && (
              <a href={links.wa} target="_blank" rel="noopener noreferrer" className="h-11 px-5 rounded-xl inline-flex items-center gap-2 text-[14px] font-semibold active:scale-[0.98] transition-transform" style={{ background: accent }}>
                <MessageCircle size={16} /> Order on WhatsApp
              </a>
            )}
            {links.tel && (
              <a href={links.tel} className="h-11 px-5 rounded-xl inline-flex items-center gap-2 text-[14px] font-semibold bg-white/10 border border-white/15 active:scale-[0.98] transition-transform">
                <Phone size={16} /> Call
              </a>
            )}
            {shop.branches.slice(0, 2).map((b) => (
              <span key={b.id} className="h-11 px-4 rounded-xl inline-flex items-center gap-2 text-[13px] font-medium text-white/70">
                <MapPin size={15} /> {b.name}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 bg-[#0f1512]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchBox query={t.query} setQuery={t.setQuery} className="sm:w-80" />
          <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
            {['All', ...t.categories].map((c) => {
              const on = t.category === c;
              return (
                <button
                  key={c}
                  onClick={() => t.setCategory(c)}
                  className="shrink-0 h-10 px-4 rounded-xl text-[13px] font-semibold active:scale-95 transition-transform"
                  style={on ? { background: accent, color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)' }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex gap-8 items-start">
        <main className="flex-1 min-w-0">
          {t.shown.length === 0 && !home ? <Empty query={t.query} dark /> : aisles.map((a) => (
            <section key={a.name} className="mt-8">
              <div className="flex items-end justify-between gap-3 mb-5">
                <h2 className="text-[26px] sm:text-[32px] font-bold tracking-tight leading-none">
                  {a.name}
                  <span className="block h-1.5 w-14 mt-3 rounded-full" style={{ background: accent }} />
                </h2>
                <span className="text-[13px] text-white/50 font-medium">{a.items.length} item{a.items.length === 1 ? '' : 's'}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {a.items.map((p) => <BoldCard key={`${a.name}-${p.id}`} t={t} p={p} />)}
              </div>
            </section>
          ))}
          {home && <SendListCard shop={shop} accent={accent} dark className="mt-10 max-w-xl" />}
        </main>
        <AdRail dark className="pt-8" />
      </div>
    </div>
  );
};

// ─── Counter (trade price list) ──────────────────────────────────────────────

const CounterRow: React.FC<{ t: TemplateProps; p: PublicShopProduct }> = ({ t, p }) => (
  <div
    onClick={() => t.open(p)}
    className="flex items-center gap-3 px-3 sm:px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
  >
    <ProductArt p={p} className="w-14 h-14 rounded-xl border border-slate-200 shrink-0" tint={t.accent} />
    <div className="min-w-0 flex-1">
      <p className="text-[14px] font-semibold leading-snug text-slate-900 line-clamp-2">{p.name}</p>
      <p className="text-[11.5px] mt-0.5"><StockNote p={p} />{p.maker && <span className="text-slate-400"> · {p.maker}</span>}</p>
      <PromoLines p={p} />
    </div>
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <PriceTag p={p} size="sm" />
      <AddControl p={p} qty={t.qtyOf(p.id)} accent={t.accent} onSet={(q) => t.setQty(p.id, q)} size="sm" shape="square" label="Add" />
    </div>
  </div>
);

const RowList: React.FC<{ t: TemplateProps; items: PublicShopProduct[] }> = ({ t, items }) => (
  <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-[0_2px_8px_rgb(15_23_42/0.04)]">
    {items.map((p) => <CounterRow key={p.id} t={t} p={p} />)}
  </div>
);

export const CounterTemplate: React.FC<TemplateProps> = (t) => {
  const { shop, accent } = t;
  const counts = countIn(t);
  const home = isHome(t);
  const groups = home
    ? t.categories.map((c) => ({ name: c, items: t.shown.filter((p) => p.category === c) })).filter((g) => g.items.length)
    : [{ name: t.query ? `Results for "${t.query}"` : t.category, items: t.shown }];
  const st = openStatus(shop.hours);

  return (
    <div className="min-h-[100dvh] bg-[#f4f4f5] text-slate-900 pb-28">
      <header className="bg-[#1C1F24] text-white">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4 flex items-center gap-3">
          <Logo shop={shop} accent={accent} className="w-10 h-10" round />
          <p className="text-[17px] font-semibold truncate flex-1">{shop.name}</p>
          <SearchBox query={t.query} setQuery={t.setQuery} className="hidden md:block w-96" placeholder={`Search ${shop.name}`} />
        </div>
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 pb-6 pt-2 grid lg:grid-cols-[1fr_24rem] gap-5 items-end">
          <div>
            <h1 className="text-[26px] sm:text-[32px] font-bold leading-tight tracking-tight max-w-3xl">{shop.headline || shop.tagline || shop.name}</h1>
            {shop.intro && <p className="text-[14px] text-white/70 mt-2 max-w-2xl leading-relaxed">{shop.intro}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-white/85">
              {shop.deliveryNote && <span className="inline-flex items-center gap-1.5"><Truck size={14} style={{ color: accent }} /> {shop.deliveryNote}</span>}
              {shop.pickup && <span className="inline-flex items-center gap-1.5"><Store size={14} style={{ color: accent }} /> Collect at the shop</span>}
              {st && <span className="inline-flex items-center gap-1.5"><Clock size={14} style={{ color: st.open ? '#22c55e' : '#f59e0b' }} /> {st.text}</span>}
            </div>
          </div>
          <SendListCard shop={shop} accent={accent} dark />
        </div>
        <div className="md:hidden px-4 pb-4"><SearchBox query={t.query} setQuery={t.setQuery} placeholder={`Search ${shop.name}`} /></div>
      </header>

      <div className="lg:hidden sticky top-0 z-30 bg-[#f4f4f5]/95 backdrop-blur border-b border-slate-200 px-4 py-2.5 flex gap-2 overflow-x-auto no-scrollbar">
        {['All', ...t.categories].map((c) => (
          <button
            key={c}
            onClick={() => t.setCategory(c)}
            className="shrink-0 h-9 px-3.5 rounded-lg text-[13px] font-medium border active:scale-95 transition-transform"
            style={t.category === c ? { background: '#1C1F24', borderColor: '#1C1F24', color: '#fff' } : { background: '#fff', borderColor: '#e4e4e7', color: '#3f3f46' }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 pt-5 flex gap-6 items-start">
        <aside className="hidden lg:block w-56 shrink-0 sticky top-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400 mb-2 px-2">Departments</p>
          <nav className="space-y-0.5">
            {['All', ...t.categories].map((c) => {
              const on = t.category === c;
              return (
                <button
                  key={c}
                  onClick={() => t.setCategory(c)}
                  className="w-full h-10 px-3 rounded-lg flex items-center justify-between text-[14px] transition-colors"
                  style={on ? { background: '#1C1F24', color: '#fff', fontWeight: 600 } : { color: '#3f3f46' }}
                >
                  <span className="truncate">{c === 'All' ? 'Everything' : c}</span>
                  <span className="text-[12px] tabular-nums opacity-60">{c === 'All' ? t.products.length : counts[c] ?? 0}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 space-y-7">
          {home && t.offers.length > 0 && (
            <section>
              <SectionHead title="Offers" count={t.offers.length} />
              <RowList t={t} items={t.offers} />
            </section>
          )}
          {t.shown.length === 0 ? <Empty query={t.query} /> : groups.map((g) => (
            <section key={g.name}>
              <SectionHead title={g.name} count={g.items.length} />
              <RowList t={t} items={g.items} />
            </section>
          ))}
        </main>

        <AdRail />
      </div>
    </div>
  );
};

// ─── Vet Shop (search first, prescriptions) ──────────────────────────────────

export const VetShopTemplate: React.FC<TemplateProps> = (t) => {
  const { shop, accent } = t;
  const home = isHome(t);
  const st = openStatus(shop.hours);
  const groups = home
    ? t.categories.map((c) => ({ name: c, items: t.shown.filter((p) => p.category === c) })).filter((g) => g.items.length)
    : [{ name: t.query ? `Results for "${t.query}"` : t.category, items: t.shown }];

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 pb-28">
      <header className="border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
          <Logo shop={shop} accent={accent} className="w-10 h-10" round />
          <p className="text-[17px] font-semibold truncate flex-1">{shop.name}</p>
          <button onClick={t.openBasket} className="relative w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition-transform" aria-label="Basket">
            <ShoppingBasket size={18} />
            {t.basketCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 rounded-full text-white text-[11px] flex items-center justify-center" style={{ background: accent }}>{t.basketCount}</span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 pt-5 flex gap-6 items-start">
        <main className="flex-1 min-w-0 space-y-8">
          <section className="rounded-[1.75rem] p-5 sm:p-8" style={{ background: `${accent}0f` }}>
            <div className="grid lg:grid-cols-[1fr_22rem] gap-6 items-start">
              <div>
                <h1 className="text-[28px] sm:text-[36px] font-semibold leading-tight tracking-tight">{shop.headline || 'What do you need today?'}</h1>
                <p className="text-[14.5px] text-slate-600 mt-1.5">{shop.intro || shop.tagline || `Your local pet shop and vet pharmacy`}</p>
                <SearchBox query={t.query} setQuery={t.setQuery} tall className="mt-5 max-w-2xl" placeholder="Search medicine, pet food, supplies" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.categories.slice(0, 8).map((c) => (
                    <button
                      key={c}
                      onClick={() => t.setCategory(t.category === c ? 'All' : c)}
                      className="h-9 px-4 rounded-full text-[13px] font-medium border bg-white active:scale-95 transition-transform"
                      style={t.category === c ? { borderColor: accent, color: accent, background: '#fff', fontWeight: 600 } : { borderColor: '#e2e8f0', color: '#334155' }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <InfoChips shop={shop} accent={accent} className="mt-4" />
              </div>
              <div className="space-y-3">
                <SendListCard shop={shop} accent={accent} kind="prescription" />
                {shop.phone && (
                  <a href={`tel:${shop.phone.replace(/\s+/g, '')}`} className="flex items-center gap-3 rounded-3xl p-4 bg-white border border-slate-200 active:scale-[0.99] transition-transform">
                    <span className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}><Phone size={18} /></span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">Talk to us</span>
                      <span className="block text-[12.5px] text-slate-500">{shop.phone}{st ? ` · ${st.text}` : ''}</span>
                    </span>
                  </a>
                )}
              </div>
            </div>
          </section>

          {home && t.offers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3"><span className="w-1 h-6 rounded-full" style={{ background: accent }} /><SectionHead title="Offers" count={t.offers.length} /></div>
              <Shelf t={t} items={t.offers.slice(0, 8)} outline />
            </section>
          )}
          {home && t.popular.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3"><span className="w-1 h-6 rounded-full" style={{ background: accent }} /><SectionHead title="Popular" /></div>
              <Shelf t={t} items={t.popular.slice(0, 8)} outline />
            </section>
          )}
          {t.shown.length === 0 ? <Empty query={t.query} /> : groups.map((g) => (
            <section key={g.name}>
              <SectionHead title={g.name} count={g.items.length} />
              <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                {g.items.map((p) => <GridCard key={p.id} t={t} p={p} outline />)}
              </div>
            </section>
          ))}
        </main>
        <AdRail />
      </div>
    </div>
  );
};

export const TEMPLATE_COMPONENTS: Record<ShopTemplate, React.FC<TemplateProps>> = {
  market: MarketTemplate,
  boutique: BoutiqueTemplate,
  bold: BoldTemplate,
  counter: CounterTemplate,
  vetshop: VetShopTemplate,
};
