import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Store } from 'lucide-react';
import { supplierShopAPI, type PublicShop, type PublicShopProduct, type ShopTemplate } from '../../services/modules/supplierShop.api';
import { useShopBasket } from './useShopBasket';
import { BasketBar, BasketSheet, ProductSheet } from './ShopParts';
import { BoldTemplate, BoutiqueTemplate, MarketTemplate, type TemplateProps } from './ShopTemplates';

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
};

const TEMPLATES: Record<ShopTemplate, React.FC<TemplateProps>> = {
  market: MarketTemplate,
  boutique: BoutiqueTemplate,
  bold: BoldTemplate,
};

const hex6 = (c: string) => (c.length === 4 ? '#' + c.slice(1).split('').map((x) => x + x).join('') : c);

const ShopPage: React.FC = () => {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [products, setProducts] = useState<PublicShopProduct[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [viewing, setViewing] = useState<PublicShopProduct | null>(null);
  const [basketOpen, setBasketOpen] = useState(false);

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
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
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

  return (
    <>
      {preview && preview !== shop.template && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-400 text-amber-950 text-center text-[12.5px] font-bold py-1.5 px-3">
          Preview of the {preview.charAt(0).toUpperCase() + preview.slice(1)} template. Customers see your saved template.
        </div>
      )}
      <Template
        shop={shop}
        products={products}
        shown={shown}
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
        openBasket={() => setBasketOpen(true)}
      />
      <BasketBar count={basket.count} total={basket.total} currency={shop.currency} accent={accent} onOpen={() => setBasketOpen(true)} />
      <p className={`text-center text-[11.5px] py-6 ${template === 'bold' ? 'bg-[#0f1512] text-white/40' : template === 'boutique' ? 'bg-[#faf7f2] text-[#8a958d]' : 'bg-[#f3f5f4] text-slate-400'} ${basket.count ? 'pb-24' : ''}`}>
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
      {basketOpen && (
        <BasketSheet
          shop={shop}
          lines={basket.lines}
          total={basket.total}
          accent={accent}
          onSet={basket.setQty}
          onClear={basket.clear}
          onClose={() => setBasketOpen(false)}
        />
      )}
    </>
  );
};

export default ShopPage;
