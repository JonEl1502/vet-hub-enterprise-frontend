import { get, patch } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * Demo-request inbox (backend 146).
 *
 * These leads used to exist only as an email in one Gmail account — not
 * searchable, not assignable, with no record of whether anyone followed up.
 */

export type DemoRequestStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'DISMISSED';

export interface DemoRequest {
  id: string;
  name: string;
  email: string;
  clinicName?: string | null;
  phone?: string | null;
  message?: string | null;
  status: DemoRequestStatus;
  notes?: string | null;
  source: string;
  contactedAt?: string | null;
  contactedBy?: { id: string; email: string } | null;
  createdAt: string;
}

export const demoRequestsAPI = {
  list: (params?: { status?: string; q?: string }, options?: RequestOptions): Promise<ApiResponse<{
    requests: DemoRequest[];
    counts: Record<string, number>;
  }>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs}` : '';
    return get(`/admin/demo-requests${suffix}`, { cache: false, ...options });
  },

  /** Working the queue — status and/or notes. Moving off NEW stamps who + when. */
  update: (
    id: string,
    data: { status?: DemoRequestStatus; notes?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ id: string; status: DemoRequestStatus; notes: string | null; contactedAt: string | null }>> =>
    patch(`/admin/demo-requests/${id}`, data, { showError: true, ...options }),
};

export default demoRequestsAPI;
