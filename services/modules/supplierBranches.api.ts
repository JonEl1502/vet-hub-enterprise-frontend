import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { ApiResponse, RequestOptions } from '../api/types';

export interface SupplierBranch {
  id: string;
  supplierId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
  currency: string;
  isActive: boolean;
  isMain?: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { employees: number };
}

export interface CreateBranchData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
  currency?: string;
}

export interface UpdateBranchData {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
  currency?: string;
  isActive?: boolean;
}

export const supplierBranchesAPI = {
  // Supplier self-service: fetch own branches (requires SUPPLIER role)
  getMyBranches: async (options?: RequestOptions): Promise<ApiResponse<{ branches: SupplierBranch[] }>> => {
    return get(ENDPOINTS.SUPPLIER_BRANCHES.BASE, { cache: true, cacheDuration: 5 * 60 * 1000, ...options });
  },

  // Clinic-facing: fetch branches for a specific supplier (read-only, no X-Supplier-Id needed)
  getBySupplierId: async (supplierId: number | string, options?: RequestOptions): Promise<ApiResponse<{ branches: SupplierBranch[] }>> => {
    return get(`${ENDPOINTS.SUPPLIER_BRANCHES.BASE}/by-supplier/${supplierId}`, { cache: true, cacheDuration: 5 * 60 * 1000, ...options });
  },

  getById: async (id: number, options?: RequestOptions): Promise<ApiResponse<{ branch: SupplierBranch }>> => {
    return get(ENDPOINTS.SUPPLIER_BRANCHES.BY_ID(id), { cache: true, ...options });
  },

  create: async (data: CreateBranchData, options?: RequestOptions): Promise<ApiResponse<{ branch: SupplierBranch }>> => {
    return post(ENDPOINTS.SUPPLIER_BRANCHES.BASE, data, options);
  },

  update: async (id: number, data: UpdateBranchData, options?: RequestOptions): Promise<ApiResponse<{ branch: SupplierBranch }>> => {
    return put(ENDPOINTS.SUPPLIER_BRANCHES.BY_ID(id), data, options);
  },

  delete: async (id: number, options?: RequestOptions): Promise<ApiResponse<void>> => {
    return del(ENDPOINTS.SUPPLIER_BRANCHES.BY_ID(id), options);
  },
};
