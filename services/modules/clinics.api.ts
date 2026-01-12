/**
 * Clinics API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * Clinic data type
 */
export interface Clinic {
  id: number;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  logo?: string;
  subdomain?: string;
  isActive?: boolean;
  balance?: number;
  rating?: number;
  currency?: string;
  primaryColor?: string;
  secondaryColor?: string;
  slogan?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Clinics API
 */
export const clinicsAPI = {
  /**
   * Get user's accessible clinics with full details
   */
  getUserClinics: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ clinics: Clinic[] }>> => {
    return get(ENDPOINTS.CLINICS.USER_CLINICS, {
      cache: true,
      cacheDuration: 300000, // Cache for 5 minutes
      ...options,
    });
  },

  /**
   * Get all clinics (admin only)
   */
  getAll: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ clinics: Clinic[] }>> => {
    return get(ENDPOINTS.CLINICS.BASE, {
      cache: true,
      ...options,
    });
  },

  /**
   * Get clinic by ID
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ clinic: Clinic }>> => {
    return get(ENDPOINTS.CLINICS.BY_ID(id), {
      cache: true,
      ...options,
    });
  },

  /**
   * Create new clinic
   */
  create: async (
    data: Partial<Clinic>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ clinic: Clinic }>> => {
    return post(ENDPOINTS.CLINICS.BASE, data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Update clinic
   */
  update: async (
    id: number,
    data: Partial<Clinic>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ clinic: Clinic }>> => {
    return put(ENDPOINTS.CLINICS.BY_ID(id), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Delete clinic
   */
  delete: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return del(ENDPOINTS.CLINICS.BY_ID(id), {
      showError: true,
      ...options,
    });
  },
};

