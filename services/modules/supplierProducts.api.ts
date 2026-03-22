/**
 * Supplier Products API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';

/**
 * Supplier Product data type
 */
export interface SupplierProduct {
  id: string;
  supplierId: string;
  name: string;
  description?: string;
  category: string;
  sku: string;
  unitPrice: number;
  buyPrice: number;
  currency: string;
  unit: string;
  minOrderQty: number;
  stockQty: number;
  lowStockThreshold?: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    name: string;
    email: string;
    category: string;
  };
}

/**
 * Create Supplier Product data
 */
export interface CreateSupplierProductData {
  supplierId?: string;
  name: string;
  description?: string;
  category: string;
  sku: string;
  unitPrice: number;
  buyPrice?: number;
  currency?: string;
  unit?: string;
  minOrderQty?: number;
  stockQty?: number;
  lowStockThreshold?: number;
  isAvailable?: boolean;
}

/**
 * Update Supplier Product data
 */
export interface UpdateSupplierProductData {
  name?: string;
  description?: string;
  category?: string;
  sku?: string;
  unitPrice?: number;
  buyPrice?: number;
  currency?: string;
  unit?: string;
  minOrderQty?: number;
  stockQty?: number;
  lowStockThreshold?: number;
  isAvailable?: boolean;
}

/**
 * Supplier Product filters
 */
export interface SupplierProductFilters extends PaginationParams {
  category?: string;
  isAvailable?: boolean;
  search?: string;
}

/**
 * Supplier Products API
 */
export const supplierProductsAPI = {
  /**
   * Get products for the logged-in supplier (SUPPLIER role) or specified supplier (SUPER_ADMIN)
   * This endpoint auto-scopes to the logged-in supplier's products
   */
  getMyProducts: async (
    filters?: SupplierProductFilters,
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: SupplierProduct[]; meta: PaginationMeta }>> => {
    const query = buildPaginationQuery(filters || {});
    return get(`${ENDPOINTS.SUPPLIER_PRODUCTS.BASE}${query}`, {
      cache: true,
      cacheDuration: 5 * 60 * 1000,
      ...options,
    });
  },

  /**
   * Get all supplier products (legacy - use getMyProducts for supplier users)
   */
  getAll: async (
    params?: PaginationParams,
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: SupplierProduct[]; meta: PaginationMeta }>> => {
    const query = buildPaginationQuery(params || {});
    return get(`${ENDPOINTS.SUPPLIER_PRODUCTS.BASE}${query}`, {
      cache: true,
      cacheDuration: 5 * 60 * 1000,
      ...options,
    });
  },

  /**
   * Get supplier product by ID
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ product: SupplierProduct }>> => {
    return get(ENDPOINTS.SUPPLIER_PRODUCTS.BY_ID(id), {
      cache: true,
      ...options,
    });
  },

  /**
   * Get products by supplier ID
   */
  getBySupplierId: async (
    supplierId: number,
    filters?: SupplierProductFilters,
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: SupplierProduct[]; meta: PaginationMeta }>> => {
    const query = buildPaginationQuery(filters || {});
    return get(`${ENDPOINTS.SUPPLIER_PRODUCTS.BY_SUPPLIER(supplierId)}${query}`, {
      cache: true,
      cacheDuration: 60000,
      ...options,
    });
  },

  /**
   * Create new supplier product
   */
  create: async (
    data: CreateSupplierProductData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ product: SupplierProduct }>> => {
    return post(ENDPOINTS.SUPPLIER_PRODUCTS.BASE, data, options);
  },

  /**
   * Update supplier product
   */
  update: async (
    id: number,
    data: UpdateSupplierProductData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ product: SupplierProduct }>> => {
    return put(ENDPOINTS.SUPPLIER_PRODUCTS.BY_ID(id), data, options);
  },

  /**
   * Delete supplier product
   */
  delete: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ success: boolean }>> => {
    return del(ENDPOINTS.SUPPLIER_PRODUCTS.BY_ID(id), options);
  },
};

