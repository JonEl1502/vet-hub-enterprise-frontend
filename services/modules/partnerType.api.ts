import { get, post, put, del } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

export interface PartnerType {
  id: string;
  name: string;
  rank: number;
  description: string | null;
  color: string | null;
  isActive: boolean;
  counts?: { clinics: number; suppliers: number; users: number };
  createdAt: string;
  updatedAt: string;
}

export type PartnerEntity = 'clinic' | 'supplier' | 'user';

export interface FeaturedClinic {
  id: string;
  name: string;
  slogan: string | null;
  logo: string | null;
  city: string | null;
  countryCode: string | null;
  rating: number;
  specialties: string[];
  subdomain: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  tier: { name: string; rank: number; color: string | null } | null;
}

const ADMIN = '/admin/partner-types';

export const partnerTypeAPI = {
  list: (options?: RequestOptions): Promise<ApiResponse<{ types: PartnerType[] }>> =>
    get(ADMIN, { cache: false, ...options }),

  create: (
    data: { name: string; rank?: number; description?: string | null; color?: string | null; isActive?: boolean },
    options?: RequestOptions
  ): Promise<ApiResponse<{ type: PartnerType }>> =>
    post(ADMIN, data, { showError: true, ...options }),

  update: (
    id: string,
    data: Partial<{ name: string; rank: number; description: string | null; color: string | null; isActive: boolean }>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ type: PartnerType }>> =>
    put(`${ADMIN}/${id}`, data, { showError: true, ...options }),

  remove: (id: string, options?: RequestOptions): Promise<ApiResponse<{ id: string }>> =>
    del(`${ADMIN}/${id}`, { showError: true, ...options }),

  assign: (
    data: { entity: PartnerEntity; entityId: string | number; partnerTypeId: string | number | null },
    options?: RequestOptions
  ): Promise<ApiResponse<{ entity: string; id: string; partnerTypeId: string | null }>> =>
    post(`${ADMIN}/assign`, data, { showError: true, ...options }),

  // Public — no auth required.
  featuredClinics: (limit = 12, options?: RequestOptions): Promise<ApiResponse<{ clinics: FeaturedClinic[] }>> =>
    get(`/public/featured-clinics?limit=${limit}`, { cache: false, ...options }),
};
