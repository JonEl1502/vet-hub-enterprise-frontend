/**
 * Clients API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';

/**
 * Client data type
 */
export interface Client {
  id: number;
  clinicId: number;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  country?: string;
  currency?: string;
  gender?: string;
  region?: string;
  dob?: string;
  avatarUrl?: string;
  joinedAt?: string;
  totalSpent?: number;
  lastVisitAt?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  internalNotes?: string | null;
  clientType?: string | null;
  clientTypeNote?: string | null;
  maxDebt?: number | null;
  clientRiskRate?: number | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * Clients API
 */
export const clientsAPI = {
  /**
   * Get all clients with pagination
   */
  getAll: async (
    params?: PaginationParams,
    options?: RequestOptions
  ): Promise<ApiResponse<{ clients: Client[]; pagination: PaginationMeta }>> => {
    const query = buildPaginationQuery(params || {});
    return get(`${ENDPOINTS.CLIENTS.BASE}${query}`, {
      cache: true,
      cacheDuration: 60000, // Cache for 1 minute
      ...options,
    });
  },

  /**
   * Get client by ID
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ client: Client }>> => {
    return get(ENDPOINTS.CLIENTS.BY_ID(id), {
      cache: true,
      ...options,
    });
  },

  /**
   * Create new client
   */
  create: async (
    data: Partial<Client>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ client: Client }>> => {
    return post(ENDPOINTS.CLIENTS.BASE, data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Update client
   */
  update: async (
    id: number,
    data: Partial<Client>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ client: Client }>> => {
    return put(ENDPOINTS.CLIENTS.BY_ID(id), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Delete client
   */
  delete: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return del(ENDPOINTS.CLIENTS.BY_ID(id), {
      showError: true,
      ...options,
    });
  },

  /**
   * Get client transactions
   */
  getTransactions: async (
    clientId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ transactions: any[] }>> => {
    return get(ENDPOINTS.CLIENTS.TRANSACTIONS(clientId), {
      cache: true,
      cacheDuration: 30000, // Cache for 30 seconds
      ...options,
    });
  },
};

