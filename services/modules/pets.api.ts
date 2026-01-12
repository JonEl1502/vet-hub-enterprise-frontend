/**
 * Pets API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';

/**
 * Pet data type
 */
export interface Pet {
  id: number;
  clinicId: number;
  ownerId: number;
  name: string;
  species: string;
  breed: string;
  gender: string;
  dob?: string;
  age?: number;
  weight?: string;
  color?: string;
  microchipId?: string;
  avatarUrl?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Pets API
 */
export const petsAPI = {
  /**
   * Get all pets with pagination
   */
  getAll: async (
    params?: PaginationParams,
    options?: RequestOptions
  ): Promise<ApiResponse<{ pets: Pet[]; pagination: PaginationMeta }>> => {
    const query = buildPaginationQuery(params || {});
    return get(`${ENDPOINTS.PETS.BASE}${query}`, {
      cache: true,
      cacheDuration: 60000, // Cache for 1 minute
      ...options,
    });
  },

  /**
   * Get pet by ID
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ pet: Pet }>> => {
    return get(ENDPOINTS.PETS.BY_ID(id), {
      cache: true,
      ...options,
    });
  },

  /**
   * Create new pet
   */
  create: async (
    data: Partial<Pet>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ pet: Pet }>> => {
    return post(ENDPOINTS.PETS.BASE, data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Update pet
   */
  update: async (
    id: number,
    data: Partial<Pet>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ pet: Pet }>> => {
    return put(ENDPOINTS.PETS.BY_ID(id), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Delete pet
   */
  delete: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return del(ENDPOINTS.PETS.BY_ID(id), {
      showError: true,
      ...options,
    });
  },

  /**
   * Get pet transactions
   */
  getTransactions: async (
    petId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ transactions: any[] }>> => {
    return get(ENDPOINTS.PETS.TRANSACTIONS(petId), {
      cache: true,
      cacheDuration: 30000, // Cache for 30 seconds
      ...options,
    });
  },
};

