/**
 * Purchase Order API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta } from '../types/pagination';

/**
 * Purchase Order Status
 */
export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'PAID'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Purchase Order Item data type
 */
export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  supplierProductId?: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unitPrice: number;
  sellPrice?: number;   // clinic's resale price — applied to inventory on receive
  totalPrice: number;
  receivedQuantity: number;
  notes?: string;
}

/**
 * Purchase Order data type
 */
export interface PurchaseOrder {
  id: string;
  clinicId: string;
  supplierId: string;
  supplierBranchId?: string | null;
  orderNumber: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  notes?: string;
  orderedAt?: string;
  expectedAt?: string;
  receivedAt?: string;
  approvedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    name: string;
    category?: string;
  };
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  approver?: {
    id: string;
    name: string;
    email: string;
  };
  items?: PurchaseOrderItem[];
  _count?: {
    items: number;
  };
}

/**
 * Create Purchase Order Item data
 */
export interface CreatePurchaseOrderItemData {
  supplierProductId?: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unitPrice: number;
  sellPrice?: number;   // clinic's resale price for the received stock item
  notes?: string;
}

/**
 * Create Purchase Order data
 */
export interface CreatePurchaseOrderData {
  supplierId: string;
  supplierBranchId?: string | null;
  notes?: string;
  expectedAt?: string;
  items: CreatePurchaseOrderItemData[];
  autoSubmit?: boolean;
  autoOrder?: boolean; // creates directly as ORDERED (skips draft/submit/approve flow)
}

/**
 * Update Purchase Order data (fields only — DRAFT status)
 */
export interface UpdatePurchaseOrderData {
  supplierId?: string;
  notes?: string;
  expectedAt?: string;
  items?: CreatePurchaseOrderItemData[];
}

/**
 * Receive item quantities for custom receive
 */
export interface ReceivePurchaseOrderItemData {
  itemId: string;
  receivedQuantity: number;
}

/**
 * Purchase Order Filters
 */
export interface PurchaseOrderFilters extends PaginationParams {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  supplierBranchIds?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Purchase Order API
 */
export const purchaseOrderAPI = {
  /** Get all purchase orders with pagination and filters */
  getAll: async (
    params?: PurchaseOrderFilters,
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: PurchaseOrder[]; meta: PaginationMeta }>> => {
    const p = params || {};
    const qs = new URLSearchParams();
    if (p.page) qs.append('page', String(p.page));
    if (p.limit) qs.append('limit', String(p.limit));
    if (p.search) qs.append('search', p.search);
    if (p.sortBy) qs.append('sortBy', p.sortBy);
    if (p.sortOrder) qs.append('sortOrder', p.sortOrder);
    if (p.supplierId) qs.append('supplierId', p.supplierId);
    if (p.supplierBranchIds) qs.append('supplierBranchIds', p.supplierBranchIds);
    if (p.status) qs.append('status', p.status);
    if (p.startDate) qs.append('startDate', p.startDate);
    if (p.endDate) qs.append('endDate', p.endDate);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return get(`${ENDPOINTS.PURCHASE_ORDERS.BASE}${query}`, {
      cache: true,
      cacheDuration: 30000,
      ...options,
    });
  },

  /** Get purchase order by ID */
  getById: async (
    id: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ purchaseOrder: PurchaseOrder }>> => {
    return get(ENDPOINTS.PURCHASE_ORDERS.BY_ID(id), { cache: true, ...options });
  },

  /** Create new purchase order */
  create: async (
    data: CreatePurchaseOrderData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ purchaseOrder: PurchaseOrder }>> => {
    return post(ENDPOINTS.PURCHASE_ORDERS.BASE, data, options);
  },

  /** Update purchase order fields (only while DRAFT) */
  update: async (
    id: string,
    data: UpdatePurchaseOrderData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ purchaseOrder: PurchaseOrder }>> => {
    return put(ENDPOINTS.PURCHASE_ORDERS.BY_ID(id), data, options);
  },

  /**
   * Update purchase order status — single endpoint for all transitions
   * @param status  Target status: SUBMITTED | APPROVED | RECEIVED | PARTIALLY_RECEIVED | PAID | COMPLETED | CANCELLED
   * @param items   Optional: per-item quantities for RECEIVED/PARTIALLY_RECEIVED. Omit to auto-receive all.
   */
  updateStatus: async (
    id: string,
    status: PurchaseOrderStatus,
    items?: ReceivePurchaseOrderItemData[],
    options?: RequestOptions
  ): Promise<ApiResponse<{ purchaseOrder: PurchaseOrder }>> => {
    return put(ENDPOINTS.PURCHASE_ORDERS.STATUS(id), { status, items }, options);
  },

  /** Delete purchase order (only DRAFT or CANCELLED) */
  delete: async (id: string, options?: RequestOptions): Promise<ApiResponse<null>> => {
    return del(ENDPOINTS.PURCHASE_ORDERS.BY_ID(id), options);
  },
};
