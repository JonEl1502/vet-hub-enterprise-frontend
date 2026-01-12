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
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
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

