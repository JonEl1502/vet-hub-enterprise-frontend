import { get, patch as patch_, put } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

/**
 * A supplier's public shop page (vethubcore.com/shop/<slug>) and its settings.
 * The public call needs no login; the settings calls are the owner's.
 */

/** 325 — the page builder. Mirrors backend src/services/shopSite.ts. */
export type BlockType =
  | 'hero' | 'text' | 'image' | 'offers' | 'popular' | 'products' | 'categories'
  | 'contact' | 'faq' | 'quotes' | 'sendList' | 'divider';
export interface SiteBlock { id: string; type: BlockType; props: Record<string, any> }
export interface SitePage { id: string; slug: string; title: string; inNav: boolean; blocks: SiteBlock[] }
export interface ShopSite { pages: SitePage[]; home: string | null }

export type ShopTemplate = 'market' | 'boutique' | 'bold' | 'counter' | 'vetshop';

/** Opening hours: days 0 = Sunday … 6 = Saturday, times as HH:MM. */
export interface ShopHours { days: number[]; open: string; close: string }

export interface PublicShop {
  /** Who runs it: an agrovet/supplier, or a clinic's pet shop. */
  kind?: 'supplier' | 'clinic';
  /** The shop's own pages (page builder), when its plan includes them. */
  site?: ShopSite | null;
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
  /** Prescription only: shown, but ordered by sending the prescription, never added. */
  rx?: boolean;
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
  site?: ShopSite | null;
  /** Clinics only: whether the plan includes the shop page at all (Pet shop module). */
  base?: boolean;
  kind?: 'supplier' | 'clinic';
  /** The template every plan gets: Market for suppliers, Vet Shop for clinics. */
  freeTemplate?: ShopTemplate;
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

  // 30s, not the app-wide 7-minute timeout: a save caught by a server
  // restart sat on "Saving…" until the user gave up (2026-11-14).
  saveSite: (site: ShopSite, options?: RequestOptions): Promise<ApiResponse<ShopSettings>> =>
    put('/supplier-shop/site', { site }, { timeout: 30000, ...options }),
};

/** One clinic inventory item, as the shop page picker sees it. */
export interface ClinicShopProduct {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  rx: boolean;
  visible: boolean;
  offerPrice: number | null;
  promo: string;
}

/** 324 — a clinic's pet shop page. */
export const clinicShopAPI = {
  getSettings: (options?: RequestOptions): Promise<ApiResponse<ShopSettings>> =>
    get('/clinic-shop/settings', { cache: false, ...options }),
  updateSettings: (patch: Record<string, any>, options?: RequestOptions): Promise<ApiResponse<ShopSettings>> =>
    put('/clinic-shop/settings', patch, options),
  saveSite: (site: ShopSite, options?: RequestOptions): Promise<ApiResponse<ShopSettings>> =>
    put('/clinic-shop/site', { site }, { timeout: 30000, ...options }),
  listProducts: (q?: string, options?: RequestOptions): Promise<ApiResponse<{ products: ClinicShopProduct[] }>> =>
    get(`/clinic-shop/products${q ? `?q=${encodeURIComponent(q)}` : ''}`, { cache: false, ...options }),
  updateProduct: (
    id: string,
    patch: { visible?: boolean; offerPrice?: number | null | ''; promo?: string; imageUrl?: string | null },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ product: ClinicShopProduct }>> => patch_(`/clinic-shop/products/${id}`, patch, options),
};
