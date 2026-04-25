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
  specialties?: string[];
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
   * Get the public clinic directory used by partnership pages.
   * Hits /partner-clinics — open to any authenticated user, so it bypasses
   * the admin-only /clinics endpoint.
   */
  getPartnerClinics: async (
    params?: { excludeClinicId?: number | string; limit?: number; fresh?: boolean },
    options?: RequestOptions
  ): Promise<ApiResponse<{ clinics: Clinic[] }>> => {
    const qs = new URLSearchParams();
    if (params?.excludeClinicId !== undefined) qs.set('excludeClinicId', String(params.excludeClinicId));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    if (params?.fresh) qs.set('fresh', '1');
    const path = qs.toString()
      ? `${ENDPOINTS.PARTNER_CLINICS.BASE}?${qs.toString()}`
      : ENDPOINTS.PARTNER_CLINICS.BASE;
    // When fresh=true, also bypass the frontend in-memory cache.
    const cache = params?.fresh ? false : true;
    return get(path, {
      cache,
      cacheDuration: 300000,
      ...options,
    });
  },

  /**
   * Get all clinics (admin only). Pass `search` to perform a clinic-discovery
   * search that any authenticated user can call (routes to /clinics/search).
   */
  getAll: async (
    params?: { search?: string; excludeClinicId?: number | string; limit?: number },
    options?: RequestOptions
  ): Promise<ApiResponse<{ clinics: Clinic[] }>> => {
    if (params?.search) {
      const qs = new URLSearchParams({ q: params.search });
      if (params.excludeClinicId !== undefined) qs.set('excludeClinicId', String(params.excludeClinicId));
      if (params.limit !== undefined) qs.set('limit', String(params.limit));
      return get(`${ENDPOINTS.CLINICS.BASE}/search?${qs.toString()}`, {
        cache: true,
        cacheDuration: 60000,
        ...options,
      });
    }
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

