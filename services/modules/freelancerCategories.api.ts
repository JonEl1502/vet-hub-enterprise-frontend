/**
 * Freelancer Categories API — admin-managed catalog of services a freelancer
 * can advertise (e.g. "Dog walking"). Linked many-to-many to FREELANCER users.
 */

import { get, post, put, del } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export interface FreelancerCategory {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

const BASE = '/freelancer-categories';

export const freelancerCategoriesAPI = {
  // `all: true` includes inactive categories (admin management screen).
  list: (
    opts?: { all?: boolean },
    options?: RequestOptions
  ): Promise<ApiResponse<{ categories: FreelancerCategory[] }>> =>
    get(`${BASE}${opts?.all ? '?all=1' : ''}`, { cache: false, ...options }),

  create: (
    data: Partial<FreelancerCategory>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ category: FreelancerCategory }>> =>
    post(BASE, data, { showError: true, ...options }),

  update: (
    id: string | number,
    data: Partial<FreelancerCategory>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ category: FreelancerCategory }>> =>
    put(`${BASE}/${id}`, data, { showError: true, ...options }),

  delete: (
    id: string | number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ id: string }>> =>
    del(`${BASE}/${id}`, { showError: true, ...options }),
};
