/**
 * Suppliers API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';

/**
 * Supplier data type
 */
export interface Supplier {
  id: string;
  name: string;
  category?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  /** Brand & visual identity — match the clinic's branding model. */
  website?: string;
  logoUrl?: string;
  slogan?: string;
  primaryColor?: string;
  secondaryColor?: string;
  currency?: string;
  rating?: number;
  isActive: boolean;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
  };
}

/**
 * Create Supplier data
 */
export interface CreateSupplierData {
  name: string;
  category: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  rating?: number;
  isActive?: boolean;
  // Optional user account creation
  userEmail?: string;
  userPassword?: string;
  userName?: string;
}

/**
 * Update Supplier data
 */
export interface UpdateSupplierData {
  name?: string;
  category?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  website?: string;
  logoUrl?: string;
  slogan?: string;
  primaryColor?: string;
  secondaryColor?: string;
  currency?: string;
  rating?: number;
  isActive?: boolean;
}

/**
 * Suppliers API
 */
export const suppliersAPI = {
  /**
   * Public supplier registration — used by the unauthenticated supplier
   * onboarding flow. Creates the Supplier record + an associated User
   * account. The endpoint is open (no auth header required), but goes
   * through the standard apiClient so it picks up the configured
   * VITE_API_URL instead of the previous hardcoded localhost fetch.
   */
  register: async (data: {
    name: string;
    category: string;
    contactEmail: string;
    contactPhone?: string;
    address?: string;
    isActive?: boolean;
    userEmail: string;
    userPassword: string;
    userName: string;
  }): Promise<ApiResponse<{ supplier: Supplier; user?: any }>> =>
    post(ENDPOINTS.SUPPLIERS.REGISTER, data, { showError: false }),

  /**
   * Get all suppliers with pagination
   */
  /**
   * `scope: 'mine'` returns only THIS clinic's suppliers (205) — the ones it has
   * bought from, stocked a product from, or saved. Omit it for the full
   * directory, which is where a clinic finds a supplier it has never dealt with.
   */
  getAll: async (
    params?: PaginationParams & { scope?: 'mine' },
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: Supplier[]; meta: PaginationMeta }>> => {
    const { scope, ...rest } = (params || {}) as any;
    const query = buildPaginationQuery(rest);
    const scoped = scope ? `${query}${query.includes('?') ? '&' : '?'}scope=${scope}` : query;
    return get(`${ENDPOINTS.SUPPLIERS.BASE}${scoped}`, {
      // ⚠️ NOT cached when scoped: saving a supplier must show up immediately,
      // and a 30-minute cache would leave the hub looking unchanged after the
      // action that was supposed to change it.
      cache: !scope,
      cacheDuration: 30 * 60 * 1000,
      ...options,
    });
  },

  /** Add this supplier to the clinic's own list (205). */
  save: async (supplierId: string | number): Promise<ApiResponse<{ linked: boolean; reason: string }>> =>
    post(`${ENDPOINTS.SUPPLIERS.BASE}/${supplierId}/save`, {}),

  /**
   * Remove a SAVED supplier. One linked by a purchase or a stocked product is
   * refused by the server — that history is not a list preference.
   */
  unsave: async (supplierId: string | number): Promise<ApiResponse<{ linked: boolean }>> =>
    del(`${ENDPOINTS.SUPPLIERS.BASE}/${supplierId}/save`),

  /**
   * Get supplier by ID
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ supplier: Supplier }>> => {
    return get(ENDPOINTS.SUPPLIERS.BY_ID(id), {
      cache: true,
      ...options,
    });
  },

  /**
   * Create new supplier
   */
  create: async (
    data: CreateSupplierData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ supplier: Supplier }>> => {
    return post(ENDPOINTS.SUPPLIERS.BASE, data, options);
  },

  /**
   * Clinic-side quick-add of an unclaimed supplier (name + phone/email).
   * The supplier can later claim the account and reconcile inventory.
   */
  quickAdd: async (
    data: { name: string; contactPhone?: string; contactEmail?: string; category?: string; address?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<{ supplier: Supplier }>> => {
    return post(ENDPOINTS.SUPPLIERS.QUICK_ADD, data, { showError: true, ...options });
  },

  /**
   * Update supplier
   */
  update: async (
    id: number,
    data: UpdateSupplierData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ supplier: Supplier }>> => {
    return put(ENDPOINTS.SUPPLIERS.BY_ID(id), data, options);
  },

  /**
   * Delete supplier
   */
  delete: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ success: boolean }>> => {
    return del(ENDPOINTS.SUPPLIERS.BY_ID(id), options);
  },

  /**
   * Get active suppliers
   */
  getActive: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ suppliers: Supplier[] }>> => {
    return get(`${ENDPOINTS.SUPPLIERS.BASE}?isActive=true`, {
      cache: true,
      cacheDuration: 60000,
      ...options,
    });
  },

  /**
   * Get suppliers by category
   */
  getByCategory: async (
    category: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ suppliers: Supplier[] }>> => {
    return get(`${ENDPOINTS.SUPPLIERS.BASE}?category=${encodeURIComponent(category)}`, {
      cache: true,
      cacheDuration: 60000,
      ...options,
    });
  },
};

