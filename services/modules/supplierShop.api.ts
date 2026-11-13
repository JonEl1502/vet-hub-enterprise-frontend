import { get, put } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

/**
 * A supplier's public shop page (vethubcore.com/shop/<slug>) and its settings.
 * The public call needs no login; the settings calls are the owner's.
 */

export type ShopTemplate = 'market' | 'boutique' | 'bold' | 'counter' | 'vetshop';

/** Opening hours: days 0 = Sunday … 6 = Saturday, times as HH:MM. */
export interface ShopHours { days: number[]; open: string; close: string }

export interface PublicShop {
  slug: string;
  name: string;
  logoUrl: string | null;
  tagline: string | null;
  template: ShopTemplate;
  /** The brand colour, only when the shop's plan includes it. */
  color: string | null;
  coverUrl: string | null;
  currency: string;
  whatsapp: string | null;
  phone: string | null;
  address: string | null;
  headline: string | null;
  intro: string | null;
  hours: ShopHours | null;
  deliveryNote: string | null;
  pickup: boolean;
  branches: { id: string; name: string; address: string | null; phone: string | null }[];
}

export interface PublicShopProduct {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  maker: string | null;
  description: string | null;
  stock: 'in' | 'low' | 'out';
  /** Lower than `price` when the product is on offer. */
  offerPrice: number | null;
  /** Short promo lines ("Free delivery over 5 bags"). */
  promo: string[];
}

export interface ShopSettings {
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  template: ShopTemplate;
  tagline: string | null;
  coverUrl: string | null;
  whatsapp: string | null;
  fallbackPhone: string | null;
  enabled: boolean;
  headline: string | null;
  intro: string | null;
  hours: ShopHours | null;
  deliveryNote: string | null;
  pickup: boolean;
  /** Whether the plan includes the other templates, colour and cover. */
  pro: boolean;
  productCount: number;
}

export const supplierShopAPI = {
  getPublic: (slug: string, options?: RequestOptions): Promise<ApiResponse<{ shop: PublicShop; products: PublicShopProduct[]; popular: string[] }>> =>
    get(`/public/shop/${encodeURIComponent(slug)}`, { cache: false, silent: true, ...options }),

  getSettings: (options?: RequestOptions): Promise<ApiResponse<ShopSettings>> =>
    get('/supplier-shop/settings', { cache: false, ...options }),

  updateSettings: (
    patch: Partial<Pick<ShopSettings, 'slug' | 'template' | 'tagline' | 'coverUrl' | 'whatsapp' | 'enabled' | 'primaryColor' | 'headline' | 'intro' | 'hours' | 'deliveryNote' | 'pickup'>>,
    options?: RequestOptions,
  ): Promise<ApiResponse<ShopSettings>> => put('/supplier-shop/settings', patch, options),
};
