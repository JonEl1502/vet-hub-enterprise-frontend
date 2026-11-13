import React, { useState } from 'react';
import { Menu, ShoppingBasket, X } from 'lucide-react';
import type { PublicShop, ShopSite, SitePage as Page } from '../../services/modules/supplierShop.api';
import { BlockStack, type BlockCtx } from './blocks';
import { AdRail } from './ShopTemplates';

/**
 * The shop's own website pages (325): a menu bar across the top, the page's
 * blocks, and a footer. Used for every custom page, and for the home page
 * when the owner picks one of their pages as home.
 */

const isImg = (v?: string | null) => !!v && /^(https?:|data:|\/)/.test(v);

export interface NavItem { key: string; label: string }

/** The menu: the shop's pages marked "in menu", plus Shop (the products). */
export const navItems = (site: ShopSite | null | undefined): NavItem[] => {
  if (!site?.pages?.length) return [];
  const pages = site.pages.filter((p) => p.inNav);
  const home = site.pages.find((p) => p.id === site.home);
  const items: NavItem[] = [];
  if (home) items.push({ key: '', label: home.title });
  for (const p of pages) if (p.id !== site.home) items.push({ key: p.slug, label: p.title });
  items.push({ key: home ? 'products' : '', label: 'Shop' });
  return items;
};

/** The menu bar. Shown above every view of the shop once it has its own pages. */
export const SiteNav: React.FC<{
  shop: PublicShop;
  items: NavItem[];
  active: string;
  accent: string;
  basketCount: number;
  go: (key: string) => void;
  openBasket: () => void;
}> = ({ shop, items, active, accent, basketCount, go, openBasket }) => {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 text-slate-900">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 h-14 flex items-center gap-3">
        <button onClick={() => go('')} className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[14px] font-bold shrink-0"
            style={isImg(shop.logoUrl) ? { border: '1px solid #e2e8f0' } : { background: accent, color: '#fff' }}
          >
            {isImg(shop.logoUrl) ? <img src={shop.logoUrl!} alt="" className="w-full h-full object-cover" /> : (shop.logoUrl || shop.name.charAt(0))}
          </span>
          <span className="text-[15px] font-semibold truncate max-w-[12rem] sm:max-w-none">{shop.name}</span>
        </button>
        <div className="hidden md:flex items-center gap-1 ml-4 flex-1 overflow-x-auto no-scrollbar">
          {items.map((it) => (
            <button
              key={it.key + it.label}
              onClick={() => go(it.key)}
              className="h-9 px-3 rounded-lg text-[14px] whitespace-nowrap transition-colors"
              style={active === it.key ? { color: accent, background: `${accent}12`, fontWeight: 600 } : { color: '#475569' }}
            >
              {it.label}
            </button>
          ))}
        </div>
        <span className="flex-1 md:hidden" />
        <button onClick={openBasket} className="relative w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition-transform" aria-label="Basket">
          <ShoppingBasket size={18} />
          {basketCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 rounded-full text-white text-[11px] flex items-center justify-center" style={{ background: accent }}>{basketCount}</span>
          )}
        </button>
        <button onClick={() => setOpen(!open)} className="md:hidden w-10 h-10 rounded-full flex items-center justify-center" aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-slate-200 px-4 py-2 bg-white">
          {items.map((it) => (
            <button
              key={it.key + it.label}
              onClick={() => { setOpen(false); go(it.key); }}
              className="w-full text-left h-11 px-2 rounded-lg text-[15px]"
              style={active === it.key ? { color: accent, fontWeight: 600 } : { color: '#334155' }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
};

/** One of the shop's own pages. */
const SitePageView: React.FC<{ page: Page; ctx: BlockCtx }> = ({ page, ctx }) => (
  <div className="min-h-[70dvh] bg-[#f6f7f6] text-slate-900 pb-28">
    <div className="max-w-[1600px] mx-auto px-4 lg:px-6 pt-6 flex gap-8 items-start">
      <main className="flex-1 min-w-0">
        {page.blocks.length ? (
          <BlockStack blocks={page.blocks} ctx={ctx} />
        ) : (
          <p className="py-24 text-center text-slate-500">This page is being written. Come back soon.</p>
        )}
      </main>
      <AdRail />
    </div>
  </div>
);

export default SitePageView;
