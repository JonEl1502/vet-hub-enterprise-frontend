import { get, put } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

/**
 * A supplier's public shop page (vethubcore.com/shop/<slug>) and its settings.
 * The public call needs no login; the settings calls are the owner's.
 */

export type ShopTemplate = 'market' | 'boutique' | 'bold';

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
  /** Whether the plan includes the other templates, colour and cover. */
  pro: boolean;
  productCount: number;
}

export const supplierShopAPI = {
  getPublic: (slug: string, options?: RequestOptions): Promise<ApiResponse<{ shop: PublicShop; products: PublicShopProduct[] }>> =>
    get(`/public/shop/${encodeURIComponent(slug)}`, { cache: false, silent: true, ...options }),

  getSettings: (options?: RequestOptions): Promise<ApiResponse<ShopSettings>> =>
    get('/supplier-shop/settings', { cache: false, ...options }),

  updateSettings: (
    patch: Partial<Pick<ShopSettings, 'slug' | 'template' | 'tagline' | 'coverUrl' | 'whatsapp' | 'enabled' | 'primaryColor'>>,
    options?: RequestOptions,
  ): Promise<ApiResponse<ShopSettings>> => put('/supplier-shop/settings', patch, options),
};
