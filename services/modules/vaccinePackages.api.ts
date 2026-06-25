import { get, post, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type PackagePricingMode = 'BATCH' | 'ITEMIZED';

export interface VaccinePackageItem {
  id: string;
  inventoryItemId: string;
  quantity: number;
  name: string | null;
  unit: string | null;
  form: string | null;
  price: number;
  availableQuantity: number;
}

export interface VaccinePackage {
  id: string;
  clinicId: string;
  name: string;
  description: string | null;
  pricingMode: PackagePricingMode;
  batchCostPrice: number | null;
  batchSellPrice: number | null;
  discount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: VaccinePackageItem[];
  pricing: { cost: number; sell: number; discount: number; sellAfterDiscount: number };
}

export interface PackagePayload {
  name: string;
  description?: string;
  pricingMode?: PackagePricingMode;
  batchCostPrice?: number | null;
  batchSellPrice?: number | null;
  discount?: number;
  isActive?: boolean;
  items: { inventoryItemId: string | number; quantity?: number }[];
}

export const vaccinePackagesAPI = {
  list: async (includeInactive = false, options?: RequestOptions): Promise<ApiResponse<{ packages: VaccinePackage[] }>> =>
    get(`${ENDPOINTS.VACCINE_PACKAGES.BASE}${includeInactive ? '?includeInactive=true' : ''}`, { cache: false, ...options }),

  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ package: VaccinePackage }>> =>
    get(ENDPOINTS.VACCINE_PACKAGES.BY_ID(id), { cache: false, ...options }),

  create: async (data: PackagePayload, options?: RequestOptions): Promise<ApiResponse<{ package: VaccinePackage }>> =>
    post(ENDPOINTS.VACCINE_PACKAGES.BASE, data, { showError: true, ...options }),

  update: async (id: string | number, data: Partial<PackagePayload>, options?: RequestOptions): Promise<ApiResponse<{ package: VaccinePackage }>> =>
    patch(ENDPOINTS.VACCINE_PACKAGES.BY_ID(id), data, { showError: true, ...options }),

  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(ENDPOINTS.VACCINE_PACKAGES.BY_ID(id), { showError: true, ...options }),

  apply: async (id: string | number, appointmentId: string | number, options?: RequestOptions): Promise<ApiResponse<{ taskId: string; total: number }>> =>
    post(ENDPOINTS.VACCINE_PACKAGES.APPLY(id), { appointmentId }, { showError: true, ...options }),
};
