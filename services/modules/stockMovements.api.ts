/**
 * Stock Movements API Module
 */

import { get, post } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';

/**
 * Stock Movement Type
 */
export type StockMovementType =
  | 'USED_IN_APPOINTMENT'
  | 'RESTOCKED'
  | 'ADJUSTED'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'RETURNED';

/**
 * Stock Movement data type
 */
export interface StockMovement {
  id: string;
  clinicId: string;
  inventoryItemId: string;
  appointmentId?: string;
  movementType: StockMovementType;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  costPrice?: number;
  sellingPrice?: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  inventoryItem?: {
    id: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
  };
  appointment?: {
    id: string;
    appointmentNumber: string;
    petName: string;
  };
}

/**
 * Create Stock Movement data
 */
export interface CreateStockMovementData {
  inventoryItemId: string;
  appointmentId?: string;
  movementType: StockMovementType;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  costPrice?: number;
  sellingPrice?: number;
  notes?: string;
}

/**
 * Restock Inventory data
 */
export interface RestockInventoryData {
  inventoryItemId: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  costPrice?: number;
  sellingPrice?: number;
  notes?: string;
}

/**
 * Stock Movement filters
 */
export interface StockMovementFilters extends PaginationParams {
  inventoryItemId?: string;
  appointmentId?: string;
  movementType?: StockMovementType;
  startDate?: string;
  endDate?: string;
}

/**
 * Stock Movements API
 */
export const stockMovementsAPI = {
  /**
   * Get all stock movements with filters
   */
  getAll: async (
    filters?: StockMovementFilters,
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: StockMovement[]; meta: PaginationMeta }>> => {
    const query = buildPaginationQuery(filters || {});
    return get(`${ENDPOINTS.STOCK_MOVEMENTS.BASE}${query}`, {
      cache: true,
      cacheDuration: 30000, // Cache for 30 seconds
      ...options,
    });
  },

  /**
   * Get stock movements for a specific inventory item
   */
  getByItem: async (
    inventoryItemId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ movements: StockMovement[] }>> => {
    return get(ENDPOINTS.STOCK_MOVEMENTS.BY_ITEM(inventoryItemId), {
      cache: true,
      ...options,
    });
  },

  /**
   * Get medication usage for an appointment
   */
  getByAppointment: async (
    appointmentId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ medications: StockMovement[] }>> => {
    return get(ENDPOINTS.STOCK_MOVEMENTS.BY_APPOINTMENT(appointmentId), {
      cache: true,
      ...options,
    });
  },

  /**
   * Create a new stock movement
   */
  create: async (
    data: CreateStockMovementData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ movement: StockMovement }>> => {
    return post(ENDPOINTS.STOCK_MOVEMENTS.BASE, data, options);
  },

  /**
   * Restock inventory item
   */
  restock: async (
    data: RestockInventoryData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ movement: StockMovement }>> => {
    return post(ENDPOINTS.STOCK_MOVEMENTS.RESTOCK, data, options);
  },
};

