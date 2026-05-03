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
  getAll: async (
    params?: PaginationParams,
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: Supplier[]; meta: PaginationMeta }>> => {
    const query = buildPaginationQuery(params || {});
    return get(`${ENDPOINTS.SUPPLIERS.BASE}${query}`, {
      cache: true,
      cacheDuration: 30 * 60 * 1000, // Cache for 30 minutes
      ...options,
    });
  },

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

