import { get } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

export interface SupplierMetrics {
  suppliers: {
    total: number;
    active: number;
    inactive: number;
    verified?: number | null;
    pending?: number | null;
    byCategory: Array<{ category: string | null; count: number }>;
    top: Array<{ supplierId: string; supplierName: string; gmv: number; orderCount: number }>;
  };
  products: { total: number };
  orders: {
    total: number;
    gmv: number;
    open: number;
    fulfilled: number;
    recent: Array<{
      id: string;
      orderNumber: string;
      supplierName: string;
      clinicName: string;
      amount: number;
      status: string;
      createdAt: string;
    }>;
  };
}

const BASE = '/admin/supplier-metrics';

export const supplierMetricsAPI = {
  get: (options?: RequestOptions): Promise<ApiResponse<SupplierMetrics>> =>
    get(BASE, { cache: false, ...options }),
};
