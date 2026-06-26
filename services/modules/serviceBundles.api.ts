import { get, post, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type BundlePricingMode = 'BATCH' | 'ITEMIZED';

export interface ServiceBundleItem {
  id: string;
  serviceId: string;
  quantity: number;
  name: string | null;
  category: string | null;
  price: number;
}

export interface ServiceBundle {
  id: string;
  clinicId: string;
  name: string;
  description: string | null;
  pricingMode: BundlePricingMode;
  batchPrice: number | null;
  discount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: ServiceBundleItem[];
  pricing: { sell: number; discount: number; sellAfterDiscount: number };
}

export interface BundlePayload {
  name: string;
  description?: string;
  pricingMode?: BundlePricingMode;
  batchPrice?: number | null;
  discount?: number;
  isActive?: boolean;
  items: { serviceId: string | number; quantity?: number }[];
}

export const serviceBundlesAPI = {
  list: async (includeInactive = false, options?: RequestOptions): Promise<ApiResponse<{ bundles: ServiceBundle[] }>> =>
    get(`${ENDPOINTS.SERVICE_BUNDLES.BASE}${includeInactive ? '?includeInactive=true' : ''}`, { cache: false, ...options }),

  create: async (data: BundlePayload, options?: RequestOptions): Promise<ApiResponse<{ bundle: ServiceBundle }>> =>
    post(ENDPOINTS.SERVICE_BUNDLES.BASE, data, { showError: true, ...options }),

  update: async (id: string | number, data: Partial<BundlePayload>, options?: RequestOptions): Promise<ApiResponse<{ bundle: ServiceBundle }>> =>
    patch(ENDPOINTS.SERVICE_BUNDLES.BY_ID(id), data, { showError: true, ...options }),

  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(ENDPOINTS.SERVICE_BUNDLES.BY_ID(id), { showError: true, ...options }),

  apply: async (id: string | number, appointmentId: string | number, options?: RequestOptions): Promise<ApiResponse<{ total: number }>> =>
    post(ENDPOINTS.SERVICE_BUNDLES.APPLY(id), { appointmentId }, { showError: true, ...options }),
};
