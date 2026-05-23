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
  clinicName?: string | null;
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
 * Pet whose owner Client has been soft-deleted. Surfaced by the
 * /api/v1/pets/orphaned endpoint so the user can reassign it.
 */
export interface OrphanedPet {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  gender?: string | null;
  dob?: string | null;
  age?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  formerOwner: { id: string; name: string; phone?: string | null; email?: string | null } | null;
}

/**
 * Pets API
 */
export const petsAPI = {
  /**
   * Get all pets with pagination
   */
  getAll: async (
    params?: PaginationParams & { status?: 'alive' | 'deceased' | 'all' },
    options?: RequestOptions
  ): Promise<ApiResponse<{ pets: Pet[]; pagination: PaginationMeta }>> => {
    const { status, ...pagination } = params || {};
    const baseQuery = buildPaginationQuery(pagination);
    const query = status
      ? `${baseQuery}${baseQuery ? '&' : '?'}status=${status}`
      : baseQuery;
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
   * Move a pet to another clinic. Admin only. Owner client moves with
   * the pet if needed.
   */
  transfer: async (
    id: number | string,
    toClinicId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ petId: string; ownerMoved: boolean; fromClinicId: string; toClinicId: string }>> => {
    return post(`${ENDPOINTS.PETS.BY_ID(Number(id))}/transfer`, { toClinicId: String(toClinicId) }, {
      showError: true,
      ...options,
    });
  },

  /**
   * Pets whose owner Client is soft-deleted in the active clinic.
   */
  orphaned: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ pets: OrphanedPet[] }>> => {
    return get(ENDPOINTS.PETS.ORPHANED, { cache: false, ...options });
  },

  /**
   * Reassign a pet to a different active client in the same clinic.
   */
  reassign: async (
    id: number | string,
    ownerId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ pet: Pet }>> => {
    return put(ENDPOINTS.PETS.BY_ID(Number(id)), { ownerId: String(ownerId) }, {
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

