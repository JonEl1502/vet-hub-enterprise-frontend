import { useEffect, useMemo, useState } from 'react';
import type { PublicShop, PublicShopProduct } from '../../services/modules/supplierShop.api';

/**
 * The visitor's basket on a shop page. Kept in this browser per shop, so a
 * customer who closes the tab and comes back still has it. Nothing is sent
 * anywhere until they tap "Send order on WhatsApp".
 */

export type Basket = Record<string, number>;

const key = (slug: string) => `vh.shop.basket.${slug}`;

export const useShopBasket = (slug: string, products: PublicShopProduct[]) => {
  const [basket, setBasket] = useState<Basket>(() => {
    try { return JSON.parse(localStorage.getItem(key(slug)) || '{}') || {}; } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(key(slug), JSON.stringify(basket)); } catch { /* private mode */ }
  }, [slug, basket]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const lines = useMemo(
    () =>
      Object.entries(basket)
        .map(([id, qty]) => ({ product: byId.get(id)!, qty }))
        .filter((l) => l.product && l.qty > 0),
    [basket, byId],
  );
  const count = lines.reduce((t, l) => t + l.qty, 0);
  const total = lines.reduce((t, l) => t + l.qty * l.product.price, 0);

  const setQty = (id: string, qty: number) =>
    setBasket((b) => {
      const next = { ...b };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(999, qty);
      return next;
    });
  const add = (id: string) => setQty(id, (basket[id] ?? 0) + 1);
  const clear = () => setBasket({});

  return { basket, lines, count, total, setQty, add, clear };
};

export const shopMoney = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** The country code to put in front of a local number, from the shop's currency. */
const DIAL_BY_CURRENCY: Record<string, string> = {
  KES: '254', UGX: '256', TZS: '255', RWF: '250', NGN: '234', GHS: '233', ZAR: '27', ZMW: '260', ETB: '251',
};

export const whatsappNumber = (raw: string | null, currency: string): string | null => {
  if (!raw) return null;
  let d = raw.replace(/[^0-9+]/g, '');
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0') && DIAL_BY_CURRENCY[currency]) return DIAL_BY_CURRENCY[currency] + d.slice(1);
  return d || null;
};

export const orderMessage = (
  shop: PublicShop,
  lines: { product: PublicShopProduct; qty: number }[],
  total: number,
  extra: { name?: string; branch?: string; note?: string },
) => {
  const rows = lines.map(
    (l) => `• ${l.qty} × ${l.product.name} — ${shopMoney(l.qty * l.product.price, l.product.currency)}`,
  );
  return [
    `Hello ${shop.name}, I would like to order:`,
    '',
    ...rows,
    '',
    `Total: ${shopMoney(total, shop.currency)}`,
    extra.name ? `Name: ${extra.name}` : '',
    extra.branch ? `Collect from: ${extra.branch}` : '',
    extra.note ? `Note: ${extra.note}` : '',
    '',
    `(Order from vethubcore.com/shop/${shop.slug})`,
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n');
};
