/**
 * Handshakes API Module
 * Clinic-to-clinic partnership requests
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type HandshakeStatusValue = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface HandshakeClinicSummary {
  id: string;
  name: string;
  logo?: string | null;
  subdomain?: string | null;
  address?: string | null;
  phone?: string | null;
  specialties?: string[];
}

/** A negotiated, escrow-style price for one shared service-category. */
export interface HandshakeServicePrice {
  id: string;
  handshakeId: string;
  category: string;
  amount: number;
  currency: string;
  proposedById: string; // clinic that last proposed/countered
  agreed: boolean;      // true once the OTHER clinic agreed
  createdAt: string;
  updatedAt: string;
}

export type SettlementMode = 'PER_SERVICE' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM_DAYS';

/** The money picture of a partnership, both directions (169). */
export interface OutsourcedBalance {
  paidTotal: number;   // settled OUTSOURCED_PAYOUT transactions between the pair
  paidCount: number;
  owedTotal: number;   // accrued: job's visit is paid, payout not yet run
  owedCount: number;
  pendingTotal: number; // accepted/completed jobs whose visit isn't paid yet
  pendingCount: number;
}

export interface Handshake {
  id: string;
  requesterClinicId: string;
  receiverClinicId: string;
  status: HandshakeStatusValue;
  allowedServices: string[];
  settlementMode?: SettlementMode;
  settlementDays?: number | null;
  note?: string | null;
  servicePrices?: HandshakeServicePrice[];
  createdAt: string;
  updatedAt: string;
  requesterClinic?: HandshakeClinicSummary;
  receiverClinic?: HandshakeClinicSummary;
}

export interface HandshakeList {
  sent: Handshake[];
  received: Handshake[];
}

export interface CreateHandshakeData {
  receiverClinicId: number | string;
  allowedServices: string[];
  note?: string;
}

export interface UpdateHandshakeData {
  status?: HandshakeStatusValue;
  allowedServices?: string[];
  note?: string;
}

export const handshakesAPI = {
  /** Get sent + received handshakes for the active clinic (uses X-Clinic-Id) */
  getAll: async (options?: RequestOptions): Promise<ApiResponse<HandshakeList>> =>
    get(ENDPOINTS.HANDSHAKES.BASE, { cache: false, ...options }),

  /** Get one handshake by ID */
  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ handshake: Handshake }>> =>
    get(ENDPOINTS.HANDSHAKES.BY_ID(id), { cache: false, ...options }),

  /** Create a new partnership request */
  create: async (data: CreateHandshakeData, options?: RequestOptions): Promise<ApiResponse<{ handshake: Handshake }>> =>
    post(ENDPOINTS.HANDSHAKES.BASE, data, { showError: true, ...options }),

  /** Update handshake fields (status, services, note) */
  update: async (id: string | number, data: UpdateHandshakeData, options?: RequestOptions): Promise<ApiResponse<{ handshake: Handshake }>> =>
    put(ENDPOINTS.HANDSHAKES.BY_ID(id), data, { showError: true, ...options }),

  /** Delete a handshake */
  delete: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ message: string }>> =>
    del(ENDPOINTS.HANDSHAKES.BY_ID(id), { showError: true, ...options }),

  /** Accept an incoming handshake */
  accept: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ handshake: Handshake }>> =>
    post(ENDPOINTS.HANDSHAKES.ACCEPT(id), {}, { showError: true, ...options }),

  /** Reject an incoming handshake */
  reject: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ handshake: Handshake }>> =>
    post(ENDPOINTS.HANDSHAKES.REJECT(id), {}, { showError: true, ...options }),

  /** List negotiated per-category prices for a handshake */
  listPrices: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ prices: HandshakeServicePrice[] }>> =>
    get(ENDPOINTS.HANDSHAKES.PRICES(id), { cache: false, ...options }),

  /** Propose or counter a category price (escrow-style) */
  proposePrice: async (id: string | number, data: { category: string; amount: number; currency?: string }, options?: RequestOptions): Promise<ApiResponse<{ price: HandshakeServicePrice }>> =>
    post(ENDPOINTS.HANDSHAKES.PRICES(id), data, { showError: true, ...options }),

  /** Agree to the current proposal for a category (only the other clinic) */
  agreePrice: async (id: string | number, data: { category: string }, options?: RequestOptions): Promise<ApiResponse<{ price: HandshakeServicePrice }>> =>
    post(ENDPOINTS.HANDSHAKES.AGREE_PRICE(id), data, { showError: true, ...options }),

  /** The partner's own catalog charges per shared category — negotiation reference (169) */
  partnerPrices: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ prices: Record<string, { name: string; price: number }[]> }>> =>
    get(`${ENDPOINTS.HANDSHAKES.BY_ID(id)}/partner-prices`, { cache: false, ...options }),

  /** Set how outsourced payouts settle between the two clinics (169) */
  setSettlementTerms: async (id: string | number, data: { mode: SettlementMode; days?: number }, options?: RequestOptions): Promise<ApiResponse<{ terms: { settlementMode: SettlementMode; settlementDays: number | null } }>> =>
    post(`${ENDPOINTS.HANDSHAKES.BY_ID(id)}/settlement-terms`, data, { showError: true, ...options }),

  /** Paid / owed / pending outsourced money between the pair (169) */
  outsourcedBalance: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ balance: OutsourcedBalance }>> =>
    get(`${ENDPOINTS.HANDSHAKES.BY_ID(id)}/outsourced-balance`, { cache: false, ...options }),

  /** Bundled sweep: pay out every accrued job between the pair (169) */
  settleOutsourced: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ paid: number; total: number }>> =>
    post(`${ENDPOINTS.HANDSHAKES.BY_ID(id)}/settle-outsourced`, {}, { showError: true, ...options }),
};
