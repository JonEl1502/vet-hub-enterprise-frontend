import { get } from '../api/client';
import { ApiResponse } from '../api/types';

/** 326 — admin organisation pages. Mirrors backend src/services/adminOrg.service.ts. */
export interface OrgWarning {
  code: string;
  level: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  action?: { kind: 'open-clinic' | 'open-billing' | 'open-users' | 'open-products' | 'edit'; id?: string; label: string };
}

export interface RecordPage<T = any> { rows: T[]; total: number; page: number; pageSize: number }

export interface ClinicSummary {
  id: string;
  currency: string;
  shell: string | null;
  parent: { id: string; name: string } | null;
  plan: { name: string; expiresAt: string; isTrial: boolean; inheritedFrom: { id: string; name: string } | null } | null;
  trialEndsAt: string | null;
  figures: { clients: number; patients: number; visitsThisMonth: number; revenueThisMonth: number; staff: number; openInvoices: number; lastLoginAt: string | null };
  warnings: OrgWarning[];
}

export interface SupplierSummary {
  supplier: {
    id: string; name: string; category: string | null; partnerType: string | null; email: string | null; phone: string | null;
    address: string | null; website: string | null; logoUrl: string | null; slogan: string | null; currency: string;
    isActive: boolean; verificationStatus: string; trialEndsAt: string | null; createdAt: string;
    shopSlug: string | null; shopEnabled: boolean; shopTemplate: string; outstandingBalance: number;
  };
  plan: { name: string; expiresAt: string; startedAt: string; isTrial: boolean } | null;
  subscriptions: Array<{ id: string; name: string; isAddon: boolean; startedAt: string; expiresAt: string; isActive: boolean; amountPaid: number }>;
  figures: { products: number; outOfStock: number; salesThisMonth: number; salesTotalThisMonth: number; ordersThisMonth: number; ordersTotalThisMonth: number; staff: number; branches: number; lastLoginAt: string | null };
  users: Array<{ id: string; name: string; email: string; role: string; branch: string | null; isActive: boolean; lastLoginAt: string | null; joinedAt: string }>;
  branches: Array<{ id: string; name: string; city: string | null; isActive: boolean; createdAt: string }>;
  warnings: OrgWarning[];
}

const qs = (o: Record<string, any>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const adminOrgAPI = {
  clinicSummary: (id: string | number): Promise<ApiResponse<ClinicSummary>> =>
    get(`/admin/orgs/clinics/${id}/summary`, { cache: false }),
  clinicRecords: (id: string | number, kind: string, q: { page?: number; search?: string; status?: string }): Promise<ApiResponse<RecordPage>> =>
    get(`/admin/orgs/clinics/${id}/records/${kind}${qs(q)}`, { cache: false }),
  suppliers: (): Promise<ApiResponse<{ suppliers: Array<{ id: string; name: string; isActive: boolean; category: string | null }> }>> =>
    get('/admin/orgs/suppliers', { cache: false }),
  supplierSummary: (id: string | number): Promise<ApiResponse<SupplierSummary>> =>
    get(`/admin/orgs/suppliers/${id}/summary`, { cache: false }),
  supplierRecords: (id: string | number, kind: string, q: { page?: number; search?: string }): Promise<ApiResponse<RecordPage>> =>
    get(`/admin/orgs/suppliers/${id}/records/${kind}${qs(q)}`, { cache: false }),
};
