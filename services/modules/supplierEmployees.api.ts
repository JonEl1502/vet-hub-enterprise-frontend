import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { ApiResponse, RequestOptions } from '../api/types';

export type SupplierRole = 'OWNER' | 'MANAGER' | 'SALES' | 'CASHIER' | 'DELIVERY_DRIVER';

export const SUPPLIER_ROLE_LABELS: Record<SupplierRole, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  SALES: 'Sales',
  CASHIER: 'Cashier',
  DELIVERY_DRIVER: 'Delivery Driver',
};

export const SUPPLIER_ROLE_COLORS: Record<SupplierRole, string> = {
  OWNER: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  MANAGER: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  SALES: 'bg-green-500/10 text-green-600 dark:text-green-400',
  CASHIER: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  DELIVERY_DRIVER: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
};

export interface SupplierEmployee {
  id: string;
  userId: string;
  supplierId: string;
  branchId?: string;
  role: SupplierRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    role: string;
    profile?: {
      name: string;
      avatarUrl?: string;
      phone?: string;
      idNumber?: string;
    };
  };
  branch?: {
    id: string;
    name: string;
    city?: string;
  };
}

export interface InviteEmployeeData {
  name: string;
  email: string;
  password: string;
  role: SupplierRole;
  branchId?: string;
  phone?: string;
}

export interface UpdateEmployeeData {
  role?: SupplierRole;
  branchId?: string | null;
  isActive?: boolean;
}

export const supplierEmployeesAPI = {
  getMyEmployees: async (
    params?: { branchId?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<{ employees: SupplierEmployee[] }>> => {
    const query = params?.branchId ? `?branchId=${params.branchId}` : '';
    return get(`${ENDPOINTS.SUPPLIER_EMPLOYEES.BASE}${query}`, { cache: false, ...options });
  },

  getById: async (id: number, options?: RequestOptions): Promise<ApiResponse<{ employee: SupplierEmployee }>> => {
    return get(ENDPOINTS.SUPPLIER_EMPLOYEES.BY_ID(id), { cache: false, ...options });
  },

  invite: async (data: InviteEmployeeData, options?: RequestOptions): Promise<ApiResponse<{ employee: SupplierEmployee }>> => {
    return post(ENDPOINTS.SUPPLIER_EMPLOYEES.INVITE, data, options);
  },

  update: async (id: number, data: UpdateEmployeeData, options?: RequestOptions): Promise<ApiResponse<{ employee: SupplierEmployee }>> => {
    return put(ENDPOINTS.SUPPLIER_EMPLOYEES.BY_ID(id), data, options);
  },

  delete: async (id: number, options?: RequestOptions): Promise<ApiResponse<void>> => {
    return del(ENDPOINTS.SUPPLIER_EMPLOYEES.BY_ID(id), options);
  },
};
