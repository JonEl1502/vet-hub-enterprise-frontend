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
  maxLevel?: number | null;
  reorderQty?: number | null;
  barcode?: string | null;
  unit: string;
  form?: InventoryForm;
  packSize?: number | null;
  billable?: boolean;
  price: number;
  costPrice?: number;
  expiryDate?: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED';
  supplierId?: string;
  metadata?: ProductMetadata | null;
  // Target species carried from the reference catalog (empty = all). Captured
  // for a later species-mismatch warning; not enforced yet.
  species?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/** Inventory control-center dashboard snapshot. */
export interface InventoryDashboard {
  productsCount: number;
  inventoryValue: number;
  todaysConsumption: number;
  pendingPOs: number;
  awaitingDeliveries: number;
  lowStock: number;
  outOfStock: number;
  expired: number;
  expiringThisMonth: number;
  supplierPayable: number;
  alerts: { kind: string; message: string; severity: 'warn' | 'danger' }[];
  reorderSuggestions: { id: string; name: string; sku: string; currentQty: number; unit: string; recommendedQty: number; supplierId: string | null; supplierName: string | null; estimatedCost: number }[];
  recentActivity: { id: string; type: string; item: string; quantity: number; unit: string; notes: string | null; at: string }[];
}

/** Inventory reports (valuation + movement analytics). */
export interface InventoryReports {
  totalValue: number;
  itemsCount: number;
  byCategory: { category: string; value: number; count: number }[];
  fastMoving: { id: string; name: string; category: string; qty: number; unit: string; value: number; used90: number }[];
  slowMoving: { id: string; name: string; category: string; qty: number; unit: string; value: number; used90: number }[];
  deadStock: { id: string; name: string; category: string; qty: number; unit: string; value: number; lastMoveAt: string | null }[];
}

/** Per-product analytics (ledger + consumption + reorder). */
export interface InventoryItemAnalytics {
  itemId: string;
  currentQty: number;
  unit: string;
  avgCost: number;
  inventoryValue: number;
  consumption: { last30: number; last90: number; avgMonthlyUse: number; monthsRemaining: number | null };
  reorder: { reorderPoint: number; maxLevel: number | null; belowReorder: boolean; recommendedQty: number };
  ledger: { id: string; type: string; quantity: number; balanceAfter: number; batchNumber: string | null; reference: string | null; at: string }[];
}

/** Product service charges added at billing time (per unit of dispense). */
export interface ProductFees {
  service?: number;
  admin?: number;
  injection?: number;
  prescription?: number;
}

/**
 * Extended product attributes persisted in inventory_items.metadata (JSONB).
 * mainCategory is the required top-level bucket; subcategories is an ordered,
 * user-reorderable path (subcat1, subcat2, …).
 */
export interface ProductMetadata {
  mainCategory?: 'MEDICINE' | 'CONSUMABLE';
  subcategories?: string[];
  fees?: ProductFees;
  injectionUnitMl?: number;
  sellUnit?: string;
  costUnit?: string;
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
  metadata?: ProductMetadata;
  species?: string[];
  maxLevel?: number | null;
  reorderQty?: number | null;
  barcode?: string | null;
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
  metadata?: ProductMetadata;
  species?: string[];
  maxLevel?: number | null;
  reorderQty?: number | null;
  barcode?: string | null;
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
  /** Inventory control-center dashboard snapshot (ERP P1). */
  getDashboard: async (options?: RequestOptions): Promise<ApiResponse<InventoryDashboard>> => {
    return get(ENDPOINTS.INVENTORY.DASHBOARD, { cache: true, cacheDuration: 20000, ...options });
  },

  /** Per-product analytics: ledger + consumption + reorder (ERP P2). */
  getItemAnalytics: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<InventoryItemAnalytics>> => {
    return get(ENDPOINTS.INVENTORY.ANALYTICS(id), { cache: false, ...options });
  },

  /** Inventory reports: valuation, dead stock, fast/slow movers (ERP P5). */
  getReports: async (options?: RequestOptions): Promise<ApiResponse<InventoryReports>> => {
    return get(ENDPOINTS.INVENTORY.REPORTS, { cache: true, cacheDuration: 30000, ...options });
  },

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

