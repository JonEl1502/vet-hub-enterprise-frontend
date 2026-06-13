/**
 * SUPER_ADMIN cross-clinic subscription payments report.
 * Backs the /admin/subscriptions/payments page.
 */
import { get, post } from '../api/client';
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

export interface ReconcileResult {
  found: boolean;
  changed: boolean;
  status: AdminStatus;
  reason?: string;
}

// The provider's unique key the reconcile endpoints expect:
//   Paystack → reference · Mpesa → checkoutRequestId · Lipana → merchantReference
//   Pesapal  → orderTrackingId (NOT merchantReference — it lives in row.transactionId)
export const reconcileRefForRow = (row: AdminReportRow): string =>
  row.channel === 'PESAPAL' ? (row.transactionId ?? row.reference) : row.reference;

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

  // Re-verify a stuck attempt against its provider; settles only if confirmed.
  reconcile: (channel: AdminChannel, reference: string): Promise<ApiResponse<ReconcileResult>> =>
    post(`/admin/subscriptions/attempts/${channel}/${encodeURIComponent(reference)}/reconcile`, {}, { showError: true }),

  // Force-activate an out-of-band payment the provider can't confirm.
  manualActivate: (channel: AdminChannel, reference: string, reason?: string): Promise<ApiResponse<{ status: AdminStatus }>> =>
    post(`/admin/subscriptions/attempts/${channel}/${encodeURIComponent(reference)}/manual-activate`, { reason }, { showError: true }),
};
