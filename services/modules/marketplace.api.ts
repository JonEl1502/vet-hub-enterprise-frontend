/**
 * Farm marketplace (296) — farmers trading animals and produce.
 *
 * ⚠️ Every path is under the portal's `/me/` prefix and gated on
 * `client:marketplace`, the "Sale of Farm Produce" add-on. The server enforces
 * it; this module only has to not pretend otherwise.
 */

import { get, post, patch } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export interface MarketListing {
  id: string;
  sellerClientId: string;
  sellerName: string | null;
  sellerArea: string | null;
  farmId: string | null;
  farmName: string | null;
  /** LIVESTOCK | PRODUCE */
  kind: string;
  title: string;
  description: string | null;
  species: string | null;
  breed: string | null;
  sex: string | null;
  ageMonths: number | null;
  weightKg: number | null;
  quantity: number;
  /** head | birds | kg | trays | litres — the species' own counting noun. */
  unit: string;
  /** ⚠️ PER UNIT. `totalPrice` is the convenience, not the source. */
  unitPrice: number;
  totalPrice: number;
  currency: string;
  negotiable: boolean;
  county: string | null;
  location: string | null;
  mediaUrls: string[];
  status: string;
  publishedAt: string | null;
  expiresAt: string | null;
  viewCount: number;
  orderCount: number;
  createdAt: string;
}

export interface MarketOrder {
  id: string;
  listingId: string;
  listingTitle: string | null;
  buyerClientId: string;
  buyerName: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  platformFee: number;
  currency: string;
  /** ENQUIRY | AGREED | PENDING_PAYMENT | HELD | RELEASED | REFUNDED | DISPUTED | CANCELLED */
  status: string;
  paymentReference: string | null;
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  heldAt: string | null;
  releasedAt: string | null;
  disputeReason: string | null;
  note: string | null;
  createdAt: string;
}

export interface MarketListingInput {
  farmId?: string | null;
  kind?: string;
  title: string;
  description?: string | null;
  species?: string | null;
  breed?: string | null;
  sex?: string | null;
  ageMonths?: number | null;
  weightKg?: number | null;
  quantity?: number;
  unit?: string;
  unitPrice: number;
  currency?: string;
  negotiable?: boolean;
  county?: string | null;
  location?: string | null;
  mediaUrls?: string[];
}

const BASE = '/portal/me/marketplace';

export const marketplaceAPI = {
  browse: (
    params: { kind?: string; species?: string; county?: string; q?: string; maxPrice?: number; limit?: number; cursor?: string } = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<{ listings: MarketListing[]; nextCursor: string | null }>> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      // ⚠️ Drop empties rather than sending `?county=`. An empty string is a
      // FILTER for the empty string on the way through, not the absence of one.
      if (v !== undefined && v !== null && String(v).trim() !== '') qs.set(k, String(v));
    });
    const q = qs.toString();
    return get(`${BASE}${q ? `?${q}` : ''}`, options);
  },

  mine: (options?: RequestOptions): Promise<ApiResponse<{ listings: MarketListing[] }>> =>
    get(`${BASE}/mine`, options),

  orders: (options?: RequestOptions): Promise<ApiResponse<{ buying: MarketOrder[]; selling: MarketOrder[] }>> =>
    get(`${BASE}/orders`, options),

  getListing: (listingId: string, options?: RequestOptions): Promise<ApiResponse<{ listing: MarketListing }>> =>
    get(`${BASE}/${listingId}`, options),

  create: (data: MarketListingInput, options?: RequestOptions): Promise<ApiResponse<{ listing: MarketListing }>> =>
    post(BASE, data, { showError: true, ...options }),

  update: (
    listingId: string,
    data: Partial<MarketListingInput> & { status?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ listing: MarketListing }>> =>
    patch(`${BASE}/${listingId}`, data, { showError: true, ...options }),

  enquire: (
    listingId: string,
    data: { quantity?: number; note?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ order: MarketOrder }>> =>
    post(`${BASE}/${listingId}/enquire`, data, { showError: true, ...options }),
};

export default marketplaceAPI;
