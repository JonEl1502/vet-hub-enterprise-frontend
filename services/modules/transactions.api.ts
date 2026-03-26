/**
 * Transactions API Module
 */

import { get } from '../api/client';
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
};

