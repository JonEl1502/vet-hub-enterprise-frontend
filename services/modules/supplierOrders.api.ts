/**
 * Supplier Orders API Module
 * For suppliers to view and manage purchase orders placed with them
 */

import { get, put } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';
import { PurchaseOrder, PurchaseOrderStatus } from './purchaseOrders.api';

/**
 * Supplier Order filters
 */
export interface SupplierOrderFilters extends PaginationParams {
  status?: PurchaseOrderStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
  supplierBranchIds?: string[]; // '__main__' for unassigned, or real branch IDs
}

/**
 * Update order status data
 */
export interface UpdateSupplierOrderStatusData {
  status: 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
}

/**
 * Supplier Orders API
 */
export const supplierOrdersAPI = {
  /**
   * Get all purchase orders for the logged-in supplier
   */
  getMyOrders: async (
    filters?: SupplierOrderFilters,
    options?: RequestOptions
  ): Promise<ApiResponse<{ data: PurchaseOrder[]; meta: PaginationMeta }>> => {
    const { supplierBranchIds, ...rest } = filters || {};
    let query = buildPaginationQuery(rest);
    if (supplierBranchIds && supplierBranchIds.length > 0) {
      const sep = query ? '&' : '?';
      query += `${sep}supplierBranchIds=${supplierBranchIds.join(',')}`;
    }
    return get(`${ENDPOINTS.SUPPLIER_ORDERS.BASE}${query}`, {
      cache: true,
      cacheDuration: 5 * 60 * 1000,
      ...options,
    });
  },

  /**
   * Get a single purchase order by ID (supplier can only view their own orders)
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ purchaseOrder: PurchaseOrder }>> => {
    return get(ENDPOINTS.SUPPLIER_ORDERS.BY_ID(id), {
      cache: true,
      ...options,
    });
  },

  /**
   * Update purchase order status (supplier perspective)
   */
  updateStatus: async (
    id: number,
    data: UpdateSupplierOrderStatusData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ purchaseOrder: PurchaseOrder }>> => {
    return put(ENDPOINTS.SUPPLIER_ORDERS.UPDATE_STATUS(id), data, options);
  },
};

