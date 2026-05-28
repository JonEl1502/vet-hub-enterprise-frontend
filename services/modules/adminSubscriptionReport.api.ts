/**
 * SUPER_ADMIN cross-clinic subscription payments report.
 * Backs the /admin/subscriptions/payments page.
 */
import { get } from '../api/client';
import { ApiResponse } from '../api/types';

export type AdminChannel = 'MPESA' | 'PESAPAL' | 'LIPANA' | 'PAYSTACK';
export type AdminStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface AdminReportRow {
  id: string;
  channel: AdminChannel;
  clinicId: string;
  clinicName: string;
  packageId: string;
  packageName: string;
  amount: number;
  currency: string;
  amountUsd: number;
  status: AdminStatus;
  reference: string;
  transactionId: string | null;
  initiatedBy: string | null;
  createdAt: string;
  settledAt: string | null;
  resultDesc: string | null;
}

export interface AdminReportFilters {
  from?: string;
  to?: string;
  packageId?: string | number;
  channel?: AdminChannel;
  status?: AdminStatus;
  clinicSearch?: string;
  minSubsPerClinic?: number;
  limit?: number;
  offset?: number;
}

export interface AdminReportResponse {
  rows: AdminReportRow[];
  total: number;
  aggregates: {
    totalSuccessAmountUsd: number;
    totalSuccessAmountKes: number;
    successCount: number;
    failedCount: number;
    pendingCount: number;
    distinctClinics: number;
  };
  perClinicCounts: Array<{ clinicId: string; clinicName: string; successCount: number }>;
  displayCurrency: string;
  usdToKesRate: number;
}

export const adminSubscriptionReportAPI = {
  list: (filters: AdminReportFilters = {}): Promise<ApiResponse<AdminReportResponse>> => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      p.set(k, String(v));
    });
    const qs = p.toString();
    return get(`/admin/subscriptions/payments${qs ? `?${qs}` : ''}`, { cache: false });
  },
};
