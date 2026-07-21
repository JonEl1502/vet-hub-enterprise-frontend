/**
 * Inventory API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';

/**
 * Inventory Item data type
 */
export interface InventoryItem {
  id: string;
  clinicId: string;
  name: string;
  category: string;
  sku: string;
  batchNumber?: string;
  quantity: number;
  minThreshold: number;
  unit: string;
  form?: InventoryForm;
  packSize?: number | null;
  billable?: boolean;
  price: number;
  costPrice?: number;
  expiryDate?: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED';
  supplierId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type InventoryForm = 'TABLET' | 'CAPSULE' | 'VIAL' | 'BOTTLE' | 'AMPOULE' | 'TUBE' | 'SACHET' | 'PACK' | 'UNIT';

export const INVENTORY_FORMS: { value: InventoryForm; label: string }[] = [
  { value: 'TABLET', label: 'Tablet' },
  { value: 'CAPSULE', label: 'Capsule' },
  { value: 'VIAL', label: 'Vial' },
  { value: 'BOTTLE', label: 'Bottle' },
  { value: 'AMPOULE', label: 'Ampoule' },
  { value: 'TUBE', label: 'Tube' },
  { value: 'SACHET', label: 'Sachet' },
  { value: 'PACK', label: 'Pack' },
  { value: 'UNIT', label: 'Unit' },
];

/**
 * Create Inventory Item data
 */
export interface CreateInventoryItemData {
  name: string;
  category: string;
  sku: string;
  batchNumber?: string;
  quantity: number;
  minThreshold: number;
  unit: string;
  price: number;
  costPrice?: number;
  expiryDate?: string;
  supplierId?: string;
  manufacturer?: string;
  imageUrl?: string;
  countryOfOrigin?: string;
  storageConditions?: string;
  prescriptionOnly?: boolean;
}

/**
 * Update Inventory Item data
 */
export interface UpdateInventoryItemData {
  name?: string;
  category?: string;
  sku?: string;
  batchNumber?: string;
  quantity?: number;
  minThreshold?: number;
  unit?: string;
  price?: number;
  costPrice?: number;
  expiryDate?: string;
  supplierId?: string;
  manufacturer?: string | null;
  imageUrl?: string | null;
  countryOfOrigin?: string | null;
  storageConditions?: string | null;
  prescriptionOnly?: boolean;
}

/**
 * Inventory API
 */
export const inventoryAPI = {
  /**
   * Get all inventory items with pagination
   */
  getAll: async (
    params?: PaginationParams,
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: InventoryItem[]; meta: PaginationMeta }>> => {
    const query = buildPaginationQuery(params || {});
    return get(`${ENDPOINTS.INVENTORY.BASE}${query}`, {
      cache: true,
      cacheDuration: 30000, // Cache for 30 seconds
      ...options,
    });
  },

  /**
   * Get inventory item by ID
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ item: InventoryItem }>> => {
    return get(ENDPOINTS.INVENTORY.BY_ID(id), {
      cache: true,
      ...options,
    });
  },

  /**
   * Create new inventory item
   */
  create: async (
    data: CreateInventoryItemData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ item: InventoryItem }>> => {
    return post(ENDPOINTS.INVENTORY.BASE, data, options);
  },

  /**
   * Update inventory item
   */
  update: async (
    id: number,
    data: UpdateInventoryItemData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ item: InventoryItem }>> => {
    return put(ENDPOINTS.INVENTORY.BY_ID(id), data, options);
  },

  /**
   * Delete inventory item
   */
  delete: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ success: boolean }>> => {
    return del(ENDPOINTS.INVENTORY.BY_ID(id), options);
  },

  /**
   * Get low stock items
   */
  getLowStock: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: InventoryItem[]; meta: PaginationMeta }>> => {
    return get(`${ENDPOINTS.INVENTORY.BASE}?status=LOW_STOCK`, {
      cache: true,
      cacheDuration: 30000,
      ...options,
    });
  },

  /**
   * Get out of stock items
   */
  getOutOfStock: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: InventoryItem[]; meta: PaginationMeta }>> => {
    return get(`${ENDPOINTS.INVENTORY.BASE}?status=OUT_OF_STOCK`, {
      cache: true,
      cacheDuration: 30000,
      ...options,
    });
  },
};

