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
  clinicName?: string | null;
  title?: string;
  firstName: string;
  secondName?: string;
  surname: string;
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
  pets?: any[];
  appointmentCount?: number;
  petCount?: number;
}

export interface DuplicateGroupClient {
  id: string;
  title?: string | null;
  firstName: string;
  secondName?: string | null;
  surname: string;
  email?: string | null;
  phone: string;
  clientType?: string | null;
  totalSpent?: number;
  lastVisitAt?: string | null;
  createdAt: string;
}

export interface DuplicateGroup {
  key: string;
  reason: 'phone' | 'email';
  keyValue: string;
  clients: DuplicateGroupClient[];
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
   * Delete client. Pass `cascadePets: true` to also soft-delete every
   * pet owned by this client (avoids leaving orphans on the dedupe path).
   */
  delete: async (
    id: number,
    optsOrLegacy?: RequestOptions | { cascadePets?: boolean },
    options?: RequestOptions
  ): Promise<ApiResponse<{ message?: string; petsDeleted?: number }>> => {
    const cascadePets = (optsOrLegacy as { cascadePets?: boolean })?.cascadePets;
    const reqOptions = (cascadePets !== undefined ? options : (optsOrLegacy as RequestOptions)) || {};
    const path = cascadePets
      ? `${ENDPOINTS.CLIENTS.BY_ID(id)}?cascade=pets`
      : ENDPOINTS.CLIENTS.BY_ID(id);
    return del(path, {
      showError: true,
      ...reqOptions,
    });
  },

  /**
   * Move a client + their pets to another clinic. Admin only.
   */
  transfer: async (
    id: number | string,
    toClinicId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ clientId: string; petsMoved: number; fromClinicId: string; toClinicId: string }>> => {
    return post(`${ENDPOINTS.CLIENTS.BY_ID(Number(id))}/transfer`, { toClinicId: String(toClinicId) }, {
      showError: true,
      ...options,
    });
  },

  /**
   * Find duplicate clients in the active clinic. Groups by normalized
   * phone and email; returns groups of size >= 2.
   */
  duplicates: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ groups: DuplicateGroup[] }>> => {
    return get(ENDPOINTS.CLIENTS.DUPLICATES, {
      cache: false,
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

