/**
 * Clinics API Module
 */

import { get, post, put, patch, del } from '../api/client';
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
  latitude?: number | null;
  longitude?: number | null;
  countryCode?: string | null;
  dialCode?: string | null;
  region?: 'AFRICA' | 'ASIA' | 'LATAM' | 'MIDDLE_EAST' | 'EUROPE' | 'OCEANIA' | 'NORTH_AMERICA' | null;
  parentClinicId?: string | null;
  isMain?: boolean;
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
   * Activate / deactivate a clinic, optionally cascading to branches.
   * scope: 'this' (default) | 'with-branches' | 'selected' (with branchIds).
   */
  setStatus: async (
    id: number,
    isActive: boolean,
    opts?: { scope?: 'this' | 'with-branches' | 'selected'; branchIds?: Array<string | number> },
    options?: RequestOptions
  ): Promise<ApiResponse<{ affected: string[]; isActive: boolean }>> => {
    return patch(`${ENDPOINTS.CLINICS.BY_ID(id)}/status`, {
      isActive,
      scope: opts?.scope ?? 'this',
      branchIds: opts?.branchIds ?? [],
    }, { showError: true, ...options });
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

  /**
   * List branches of a clinic. The first entry is the main clinic
   * (marked with `isMain: true`); the rest are sibling branches.
   */
  getBranches: async (
    clinicId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ branches: (Clinic & { isMain?: boolean })[] }>> => {
    return get(`${ENDPOINTS.CLINICS.BY_ID(Number(clinicId))}/branches`, {
      showError: true,
      ...options,
    });
  },

  /**
   * Create a new branch under the given clinic.
   */
  createBranch: async (
    clinicId: number | string,
    data: Partial<Clinic>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ clinic: Clinic }>> => {
    return post(`${ENDPOINTS.CLINICS.BY_ID(Number(clinicId))}/branches`, data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Update a branch under the given clinic.
   */
  updateBranch: async (
    clinicId: number | string,
    branchId: number | string,
    data: Partial<Clinic>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ branch: Clinic }>> => {
    return put(`${ENDPOINTS.CLINICS.BY_ID(Number(clinicId))}/branches/${branchId}`, data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Delete a branch under the given clinic.
   */
  deleteBranch: async (
    clinicId: number | string,
    branchId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return del(`${ENDPOINTS.CLINICS.BY_ID(Number(clinicId))}/branches/${branchId}`, {
      showError: true,
      ...options,
    });
  },
};

