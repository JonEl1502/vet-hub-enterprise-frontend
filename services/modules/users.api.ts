/**
 * Users API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * User data type
 */
export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  avatarUrl?: string;
  avatar?: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Shape returned by the admin directory endpoint (adds membership ids). */
export interface AdminUserRow extends User {
  clinicIds?: string[];
}

export interface AdminUserFilters {
  search?: string;
  clinicId?: string | number;
  role?: string;
  status?: 'active' | 'inactive' | 'all';
}

/**
 * Users API
 */
export const usersAPI = {
  /**
   * Get all users
   */
  getAll: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ users: User[] }>> => {
    return get(ENDPOINTS.USERS.BASE, {
      cache: true,
      ...options,
    });
  },

  /**
   * Admin-only: global user directory with optional filters.
   */
  adminList: async (
    filters?: AdminUserFilters,
    options?: RequestOptions
  ): Promise<ApiResponse<{ users: AdminUserRow[] }>> => {
    const qs = new URLSearchParams();
    if (filters?.search) qs.set('search', filters.search);
    if (filters?.clinicId) qs.set('clinicId', String(filters.clinicId));
    if (filters?.role) qs.set('role', filters.role);
    if (filters?.status) qs.set('status', filters.status);
    const q = qs.toString();
    return get(`/users/admin/all${q ? `?${q}` : ''}`, { cache: false, ...options });
  },

  /**
   * Get user by ID
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ user: User }>> => {
    return get(ENDPOINTS.USERS.BY_ID(id), {
      cache: true,
      ...options,
    });
  },

  /**
   * Create new user
   */
  create: async (
    data: Partial<User>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ user: User }>> => {
    return post(ENDPOINTS.USERS.BASE, data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Update user
   */
  update: async (
    id: number,
    data: Partial<User>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ user: User }>> => {
    return put(ENDPOINTS.USERS.BY_ID(id), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Delete user
   */
  delete: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return del(ENDPOINTS.USERS.BY_ID(id), {
      showError: true,
      ...options,
    });
  },
};

