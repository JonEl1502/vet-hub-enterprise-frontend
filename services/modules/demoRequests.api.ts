import { get, patch, post } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * The lead inbox, in BOTH directions (backend 146, 234).
 *
 * INBOUND — the public "request a demo" form. These used to exist only as an
 * email in one Gmail account: not searchable, not assignable, with no record
 * of whether anyone followed up.
 *
 * OUTREACH — "Potential clients": researched prospects who have never heard of
 * us, imported from a spreadsheet. Same endpoints because the work is the same
 * work, and both end at the same one-click convert.
 */

export type DemoRequestStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'DISMISSED';
/** Which queue — not a status. A lead is inbound or outbound for life. */
export type LeadKind = 'INBOUND' | 'OUTREACH';

export interface DemoRequest {
  id: string;
  name: string;
  /** ⚠️ NULLable: most researched leads publish no address (see convert). */
  email?: string | null;
  clinicName?: string | null;
  phone?: string | null;
  message?: string | null;
  status: DemoRequestStatus;
  notes?: string | null;
  source: string;
  /** Outreach only — the row id in the research sheet, e.g. "CL-0001". */
  externalRef?: string | null;
  segment?: string | null;
  country?: string | null;
  region?: string | null;
  town?: string | null;
  website?: string | null;
  leadScore?: number | null;
  priority?: string | null;
  contactedAt?: string | null;
  contactedBy?: { id: string; email: string } | null;
  createdAt: string;
}

/** One parsed spreadsheet row, already mapped onto our field names. */
export interface LeadImportRow {
  externalRef?: string | null;
  name?: string | null;
  clinicName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  country?: string | null;
  region?: string | null;
  town?: string | null;
  segment?: string | null;
  priority?: string | null;
  leadScore?: number | string | null;
  message?: string | null;
}

export const demoRequestsAPI = {
  list: (params?: { status?: string; q?: string; kind?: LeadKind }, options?: RequestOptions): Promise<ApiResponse<{
    requests: DemoRequest[];
    counts: Record<string, number>;
    kindCounts: Record<string, number>;
  }>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.q) qs.set('q', params.q);
    if (params?.kind) qs.set('kind', params.kind);
    const suffix = qs.toString() ? `?${qs}` : '';
    return get(`/admin/demo-requests${suffix}`, { cache: false, ...options });
  },

  /**
   * Working the queue — status, notes, and the contact details research left
   * blank. Moving off NEW stamps who + when. Editing `email` here is how a
   * researched lead becomes convertible: the address is the login.
   */
  update: (
    id: string,
    data: {
      status?: DemoRequestStatus; notes?: string; email?: string; phone?: string;
      name?: string; clinicName?: string; website?: string;
      country?: string; region?: string; town?: string; segment?: string; priority?: string;
    },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ id: string; status: DemoRequestStatus; notes: string | null; email: string | null; contactedAt: string | null }>> =>
    patch(`/admin/demo-requests/${id}`, data, { showError: true, ...options }),

  /** One prospect, typed by hand — mentioned on a call, no spreadsheet involved. */
  create: (data: LeadImportRow & { notes?: string }, options?: RequestOptions): Promise<ApiResponse<{ id: string }>> =>
    post('/admin/demo-requests', data, { showError: true, ...options }),

  /**
   * Bulk import of a researched list.
   *
   * ⚠️ Re-import UPDATES rather than duplicates, keyed on `externalRef` (the
   * sheet's own row id). It never touches status, notes or contact history —
   * a corrected spreadsheet knows a better phone number, it does not know that
   * this lead said no last Tuesday.
   */
  importLeads: (rows: LeadImportRow[], options?: RequestOptions): Promise<ApiResponse<{
    created: number; updated: number; total: number;
    skipped: { row: number; reason: string }[];
  }>> =>
    post('/admin/demo-requests/import', { rows }, { showError: true, timeout: 120000, ...options }),

  /**
   * ONE-CLICK convert: creates the ORG **and its OWNER** and marks the lead
   * CONVERTED. The owner's email is the login, which is why a user is created
   * and not just an org — an org with no owner cannot be signed into.
   *
   * `ownerEmail` is for researched leads that publish no address: pass the one
   * learnt on the call and it is saved back onto the lead too.
   * `temporaryPassword` is returned ONCE and is not retrievable afterwards.
   */
  convert: (
    id: string,
    data: { accountType: 'CLINIC' | 'FARM'; orgName: string; ownerEmail?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{
    accountType: string; orgName: string; ownerEmail: string;
    temporaryPassword: string; clinicId: string | null;
  }>> =>
    post(`/admin/demo-requests/${id}/convert`, data, { showError: true, ...options }),
};

export default demoRequestsAPI;
