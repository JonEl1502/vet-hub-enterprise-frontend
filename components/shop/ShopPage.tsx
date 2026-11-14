import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Store } from 'lucide-react';
import { supplierShopAPI, type PublicShop, type PublicShopProduct, type ShopTemplate } from '../../services/modules/supplierShop.api';
import { useShopBasket } from './useShopBasket';
import { BasketBar, ProductSheet, ShopCtx } from './ShopParts';
import BasketPage from './BasketPage';
import SitePageView, { SiteNav, navItems } from './SitePage';
import type { BlockCtx } from './blocks';
import { TEMPLATE_COMPONENTS as TEMPLATES } from './ShopTemplates';
import LoadingSpinner from '../shared/common/LoadingSpinner';

/**
 * vethubcore.com/shop/<slug> — a supplier's public shop page.
 *
 * Anyone with the link can browse, fill a basket and send the order to the
 * shop on WhatsApp. Nothing is paid here and nothing is written to VetHub; the
 * shop confirms on WhatsApp and takes payment the way it always does.
 *
 * `?template=boutique` previews another template. The shop's settings page
 * links here with it, so an owner can see a template before choosing it,
 * including a Pro one. It changes the look only, never the data.
 */

const DEFAULT_ACCENT: Record<ShopTemplate, string> = {
  market: '#1c7a5b',
  boutique: '#7a5c2e',
  bold: '#16a34a',
  counter: '#ea580c',
  vetshop: '#0f766e',
};

const TEMPLATE_NAMES: Record<string, string> = { market: 'Market', boutique: 'Boutique', bold: 'Bold', counter: 'Counter', vetshop: 'Vet Shop' };

const hex6 = (c: string) => (c.length === 4 ? '#' + c.slice(1).split('').map((x) => x + x).join('') : c);

const ShopPage: React.FC = () => {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [products, setProducts] = useState<PublicShopProduct[]>([]);
  const [popularIds, setPopularIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [viewing, setViewing] = useState<PublicShopProduct | null>(null);
  // The basket is its own page: /shop/<slug>/basket (user, 2026-11-14).
  const location = useLocation();
  const navigate = useNavigate();
  // What follows /shop/<slug>/: '', 'products', 'basket', or one of the shop's own pages (325).
  const sub = (location.pathname.split('/')[3] || '').toLowerCase();
  const onBasket = sub === 'basket';
  const openBasket = () => navigate(`/shop/${slug}/basket${location.search}`);
  const backToShop = () => {
    // Back to where they were when they came from the shop; the shop itself otherwise.
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(`/shop/${slug}${location.search}`);
  };

  useEffect(() => {
    let alive = true;
    setState('loading');
    supplierShopAPI
      .getPublic(slug)
      .then((r) => {
        if (!alive) return;
        if (r.success && r.data?.shop) {
          setShop(r.data.shop);
          setProducts(r.data.products ?? []);
          setPopularIds(r.data.popular ?? []);
          setState('ready');
        } else setState('missing');
      })
      .catch(() => alive && setState('missing'));
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    if (shop) document.title = `${shop.name} · Shop`;
  }, [shop]);

  const basket = useShopBasket(slug, products);

  const preview = params.get('template') as ShopTemplate | null;
  const template: ShopTemplate = preview && preview in TEMPLATES ? preview : shop?.template ?? 'market';
  const accent = hex6(shop?.color || DEFAULT_ACCENT[template]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const offers = useMemo(() => products.filter((p) => p.offerPrice != null && p.stock !== 'out'), [products]);
  const popular = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return popularIds.map((id) => byId.get(id)).filter((p): p is PublicShopProduct => !!p && p.stock !== 'out');
  }, [products, popularIds]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || (p.maker ?? '').toLowerCase().includes(q) || p.category.toLowerCase().includes(q)),
    );
  }, [products, query, category]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f5f4]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (state === 'missing' || !shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#f3f5f4] px-6 text-center text-slate-700">
        <Store size={40} className="text-slate-400" />
        <h1 className="text-[22px] font-black">We could not find that shop</h1>
        <p className="text-[14px] text-slate-500 max-w-sm">Check the link with the shop. It may have changed its address, or closed its page.</p>
        <a href="/" className="mt-2 text-[14px] font-bold underline underline-offset-4">Go to VetHubCore</a>
      </div>
    );
  }

  const Template = TEMPLATES[template];

  // 325 — the shop's own pages, when its plan includes them.
  const site = shop.site ?? null;
  const homePage = site?.pages.find((p) => p.id === site.home) ?? null;
  const productsKey = homePage ? 'products' : '';
  const customPage =
    sub === '' ? homePage : sub && sub !== 'products' && sub !== 'basket' ? site?.pages.find((p) => p.slug === sub) ?? null : null;
  const nav = navItems(site);
  const go = (key: string, cat?: string) => {
    if (cat !== undefined) { setCategory(cat || 'All'); setQuery(''); }
    const target = cat !== undefined && key === 'products' ? productsKey : key;
    navigate(`/shop/${slug}${target ? `/${target}` : ''}${location.search}`);
    window.scrollTo(0, 0);
  };
  const ctx: BlockCtx = {
    shop, products, offers, popular, categories, accent,
    qtyOf: (id) => basket.basket[id] ?? 0,
    setQty: basket.setQty,
    open: setViewing,
    go,
  };
  const navBar = (
    <SiteNav
      shop={shop}
      items={nav}
      active={customPage ? (customPage.id === site?.home ? '' : customPage.slug) : productsKey}
      accent={accent}
      basketCount={basket.count}
      go={(k) => go(k)}
      openBasket={openBasket}
    />
  );

  if (onBasket) {
    return (
      <ShopCtx.Provider value={shop}>
        <BasketPage
          shop={shop}
          lines={basket.lines}
          total={basket.total}
          accent={accent}
          onSet={basket.setQty}
          onClear={basket.clear}
          onBack={backToShop}
        />
      </ShopCtx.Provider>
    );
  }

  return (
    <ShopCtx.Provider value={shop}>
      {/* With the menu bar on top, the templates' sticky bars sit under it. */}
      <div style={nav.length ? ({ '--shop-nav-h': '3.5rem' } as React.CSSProperties) : undefined}>
      {preview && preview !== shop.template && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-400 text-amber-950 text-center text-[12.5px] font-bold py-1.5 px-3">
          Preview of the {TEMPLATE_NAMES[preview] ?? preview} template. Customers see your saved template.
        </div>
      )}
      {preview && preview !== shop.template && <div className="h-[30px]" />}
      {navBar}
      {customPage ? (
        <SitePageView page={customPage} ctx={ctx} />
      ) : sub && sub !== 'products' && !customPage ? (
        <div className="py-24 text-center text-slate-500 bg-[#f6f7f6]">
          <p className="text-[16px] font-semibold">That page is not here</p>
          <button onClick={() => go('')} className="mt-3 text-[14px] font-semibold underline underline-offset-4" style={{ color: accent }}>Back to the shop</button>
        </div>
      ) : (
      <Template
        shop={shop}
        products={products}
        shown={shown}
        offers={offers}
        popular={popular}
        categories={categories}
        category={category}
        setCategory={setCategory}
        query={query}
        setQuery={setQuery}
        accent={accent}
        qtyOf={(id) => basket.basket[id] ?? 0}
        setQty={basket.setQty}
        open={setViewing}
        basketCount={basket.count}
        openBasket={openBasket}
      />
      )}
      </div>
      <BasketBar count={basket.count} total={basket.total} currency={shop.currency} accent={accent} onOpen={openBasket} />
      <p className={`text-center text-[11.5px] py-6 ${template === 'bold' ? 'bg-[#0f1512] text-white/40' : template === 'boutique' ? 'bg-[#faf7f2] text-[#8a958d]' : template === 'vetshop' ? 'bg-white text-slate-400' : template === 'counter' ? 'bg-[#f4f4f5] text-slate-400' : 'bg-[#f3f5f4] text-slate-400'} ${basket.count ? 'pb-24' : ''}`}>
        Shop page by <a href="/" className="underline underline-offset-2">VetHubCore</a>
      </p>
      {viewing && (
        <ProductSheet
          p={viewing}
          qty={basket.basket[viewing.id] ?? 0}
          accent={accent}
          onSet={(q) => basket.setQty(viewing.id, q)}
          onClose={() => setViewing(null)}
        />
      )}
    </ShopCtx.Provider>
  );
};

export default ShopPage;
