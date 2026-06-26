/**
 * VetHub Core sales-rep program — admin CRUD + signup-flow code resolver.
 */
import { get, post, patch, del } from '../api/client';
import { ApiResponse } from '../api/types';

export interface SalesRepStats {
  clinicsBrought: number;
  clinicsWithPaidSub: number;
  activeSubs: number;
  totalUsdAttributed: number;
}

export interface SalesRep {
  id: string;
  email: string;
  name: string;
  referralCode: string;
  isActive: boolean;
  createdAt: string;
  stats: SalesRepStats;
}

export interface ReferredClinic {
  id: string;
  name: string;
  logo?: string | null;
  subdomain?: string | null;
  isActive: boolean;
  referredAt: string | null;
  hasActiveSub: boolean;
  totalUsdAttributed: number;
}

export const salesRepAPI = {
  list: (): Promise<ApiResponse<{ reps: SalesRep[] }>> =>
    get('/admin/sales-reps', { cache: false }),

  // Drill-down: the actual clinics a single rep brought in.
  listClinics: (id: string | number): Promise<ApiResponse<{ clinics: ReferredClinic[] }>> =>
    get(`/admin/sales-reps/${id}/clinics`, { cache: false }),

  enroll: (email: string, referralCode?: string): Promise<ApiResponse<{ rep: SalesRep }>> =>
    post('/admin/sales-reps/enroll', { email, referralCode }, { showError: true }),

  updateCode: (id: string | number, referralCode: string): Promise<ApiResponse<{ rep: SalesRep }>> =>
    patch(`/admin/sales-reps/${id}/code`, { referralCode }, { showError: true }),

  revoke: (id: string | number): Promise<ApiResponse<{ ok: boolean }>> =>
    del(`/admin/sales-reps/${id}`, { showError: true }),

  // Public — no auth required. Used by signup form to validate ?ref=CODE
  // before the user submits.
  resolveCode: (code: string): Promise<ApiResponse<{ valid: boolean; code: string | null }>> =>
    get(`/admin/sales-reps/resolve/${encodeURIComponent(code)}`, { cache: false }),
};
