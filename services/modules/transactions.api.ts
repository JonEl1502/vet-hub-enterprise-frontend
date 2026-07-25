/**
 * Transactions API Module
 */

import { get, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * Transaction data type
 */
export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  method: string;
  createdAt: string;
  settledAt?: string;
  appointmentId?: string;
  receiptNumber?: string;
  referenceNumber?: string;
  fromId?: number;
  toId?: number;
  metadata?: Record<string, any>;
  client?: {
    id: string;
    name: string;
  };
  appointment?: {
    id: string;
    date: string;
    pet?: {
      id: string;
      name: string;
      species: string;
    };
  };
}

/**
 * Transactions API
 */
export const transactionsAPI = {
  /**
   * Get all transactions
   */
  getAll: async (
    params?: { startDate?: string; endDate?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<{ transactions: Transaction[] }>> => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    const url = qs.toString() ? `${ENDPOINTS.TRANSACTIONS.BASE}?${qs}` : ENDPOINTS.TRANSACTIONS.BASE;
    return get(url, {
      cache: !params?.startDate && !params?.endDate,
      cacheDuration: 30000,
      ...options,
    });
  },

  /**
   * Get transaction by ID
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ transaction: Transaction }>> => {
    return get(ENDPOINTS.TRANSACTIONS.BY_ID(id), {
      cache: true,
      ...options,
    });
  },

  /**
   * Soft-delete a transaction. Backend flips status to VOIDED, reverses
   * the wallet credit if it was settled. After this, the transaction is
   * filtered out of all list endpoints automatically.
   */
  void: async (
    id: number | string,
    reason?: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ id: string; status: string }>> => {
    return patch(`/transactions/${id}/void`, { reason }, { showError: true, ...options });
  },

  /**
   * HARD DELETE a mistaken payment (wrong client, duplicate, wrong amount).
   * Void is the default for genuine reversals — this is for entries that
   * should never have existed. Owner/manager/admin only; the deletion is
   * audited server-side before the row is removed.
   */
  remove: async (
    id: string | number,
    reason?: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ id: string; deleted: boolean; revertedVisitIds: string[] }>> => {
    // The shared del() helper sends no body, so the reason rides as a query
    // param (the server accepts it from either place).
    const q = reason?.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : '';
    return del(`/transactions/${id}${q}`, { showError: true, ...options });
  },
};

