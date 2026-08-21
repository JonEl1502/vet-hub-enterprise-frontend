/**
 * Bill API — Revenue Cycle P1 (backend migration 100).
 *
 * Everything the encounter produces lands on the bill as lines. The vet
 * reviews and adjusts it at End Encounter, and APPROVING is what locks the
 * clinical record — payment is no longer part of that decision.
 */
import { get, post, patch, del } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export type BillStatus =
  | 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'ISSUED' | 'INVOICED' | 'PAID' | 'RECONCILED' | 'VOID';
export type BillLineKind = 'SERVICE' | 'CONSUMABLE' | 'MEDICATION' | 'OTHER';

export interface BillLine {
  id: string;
  kind: BillLineKind;
  taskId?: string | null;
  inventoryItemId?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface Bill {
  id: string;
  number?: string | null;
  clinicId: string;
  visitId: string;
  patientId?: string | null;
  doctorId?: string | null;
  source: string;
  status: BillStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  // §7.4 (180): raise and approve are two rights, possibly two people.
  raisedById?: string | null;
  raisedAt?: string | null;
  raisedToId?: string | null;
  clientApprovalChannels?: BillClientApprovalChannel[];
  clientApprovedAt?: string | null;
  clientApprovalNote?: string | null;
  clientApprovalById?: string | null;
  isSynthetic: boolean;
  issuedAt?: string | null;
  paidAt?: string | null;
  reconciledAt?: string | null;
  actualTotal?: number | null;
  amountPaid?: number | null;
  deltaAmount?: number | null;
  /** DRAFT / PENDING_REVIEW — lines can still be changed. */
  editable: boolean;
  createdAt: string;
  updatedAt: string;
  lines: BillLine[];
}

export interface BillQueueRow {
  id: string;
  number?: string | null;
  visitId: string;
  status: BillStatus;
  total: number;
  isSynthetic: boolean;
  lineCount: number;
  createdAt: string;
  approvedAt?: string | null;
  patient: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  visitDate?: string | null;
  isPaid: boolean;
}

export interface BillLineInput {
  kind?: BillLineKind;
  taskId?: string | null;
  inventoryItemId?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
}

/**
 * `?encounterId=` — WHICH encounter's bill an operation means (backend 123/125).
 *
 * Omitted ⇒ the visit's primary bill, i.e. exactly how every caller behaved
 * before per-encounter bills existed. Only a multi-encounter visit is explicit.
 */
const encQ = (encounterId?: string | number | null, existing?: string) =>
  encounterId == null || encounterId === ''
    ? (existing ?? '')
    : `${existing ? `${existing}&` : '?'}encounterId=${encounterId}`;

/** A bill row as returned by `listForVisit`, carrying its encounter. */
export interface VisitBillRow extends Bill {
  encounterId?: string | null;
  encounter?: { id: string; encounterType: string; visitType: string | null; isPrimary: boolean } | null;
}

/**
 * How the client told us they approved (§7.4). PORTAL means the client acted
 * themselves; the rest are how staff reached them. Mirrors
 * BILL_CLIENT_APPROVAL_CHANNELS in backend `bill.service.ts`.
 */
export const BILL_CLIENT_APPROVAL_CHANNELS = [
  { id: 'PORTAL', label: 'Approved through portal' },
  { id: 'FRONT_OFFICE_CALL', label: 'Front-office call' },
  { id: 'MESSAGE', label: 'Message' },
  { id: 'WHATSAPP', label: 'WhatsApp' },
  { id: 'EMAIL', label: 'Email' },
] as const;
export type BillClientApprovalChannel = typeof BILL_CLIENT_APPROVAL_CHANNELS[number]['id'];

export const billsAPI = {
  /** The visit's bill — raises a DRAFT from the encounter's charges if none. */
  get: (visitId: number | string, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    get(`/visits/${visitId}/bill${encQ(encounterId)}`, { cache: false, silent: true, ...options }),

  /** Every bill on the visit — one per encounter. Drives the encounter selector. */
  listForVisit: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ bills: Bill[] }>> =>
    get(`/visits/${visitId}/bills`, { cache: false, silent: true, ...options }),

  /** Re-snapshot the lines from the encounter (DRAFT only). */
  refresh: (visitId: number | string, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/refresh${encQ(encounterId)}`, {}, { showError: true, ...options }),

  /**
   * Non-destructive sync — append what the visit gained, drop the task-backed
   * lines whose task is gone, LEAVE HAND-ADDED LINES ALONE.
   *
   * Use this for automatic calls. `refresh` deletes every line and re-snapshots,
   * which silently destroys a line typed in by hand at bill review, so it stays
   * reserved for the button a human actually presses.
   */
  sync: (visitId: number | string, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill; changed: number }>> =>
    post(`/visits/${visitId}/bill/sync${encQ(encounterId)}`, {}, { showError: false, ...options }),

  addLine: (visitId: number | string, data: BillLineInput, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/lines${encQ(encounterId)}`, data, { showError: true, ...options }),

  updateLine: (visitId: number | string, lineId: string | number, data: Partial<BillLineInput>, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    patch(`/visits/${visitId}/bill/lines/${lineId}${encQ(encounterId)}`, data, { showError: true, ...options }),

  /**
   * Removing a SERVICE line also removes the visit task behind it — otherwise
   * the service stays on the visit and "rebuild from visit" brings the line
   * back. If that task already has work on it (a module record, logged
   * consumables, a status past PENDING) the API answers **409 with a message
   * naming what is there**; show it, and retry with `force` to confirm.
   */
  removeLine: (visitId: number | string, lineId: string | number, force?: boolean, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    // showError:false — the caller turns the 409 into a confirm prompt rather
    // than a toast, and reports any other failure itself.
    del(`/visits/${visitId}/bill/lines/${lineId}${encQ(encounterId, force ? '?force=true' : '')}`, { showError: false, ...options }),

  /** Header-level discount / notes. */
  updateHeader: (visitId: number | string, data: { discount?: number; notes?: string | null }, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    patch(`/visits/${visitId}/bill${encQ(encounterId)}`, data, { showError: true, ...options }),

  /** Vet signs off ⇒ the clinical record locks. */
  /** §7.4: prepare and hand on WITHOUT signing off. Optional escalation target. */
  raise: (visitId: number | string, raisedToId?: string | number | null, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/raise${encQ(encounterId)}`, raisedToId != null ? { raisedToId } : {}, { showError: true, ...options }),

  /** §7.4: record HOW the client approved. Evidence, not a status change. */
  recordClientApproval: (visitId: number | string, channels: BillClientApprovalChannel[], note?: string | null, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/client-approval${encQ(encounterId)}`, { channels, note }, { showError: true, ...options }),

  approve: (visitId: number | string, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/approve${encQ(encounterId)}`, {}, { showError: true, ...options }),

  /** Explicit, auditable unlock back to DRAFT. */
  reopen: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/reopen`, {}, { showError: true, ...options }),

  /** Pay-first: quote the client before the work is finished. */
  issue: (visitId: number | string, encounterId?: string | number | null, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/issue${encQ(encounterId)}`, {}, { showError: true, ...options }),

  void: (visitId: number | string, options?: RequestOptions): Promise<ApiResponse<{ bill: Bill }>> =>
    post(`/visits/${visitId}/bill/void`, {}, { showError: true, ...options }),

  // ── clinic-wide ────────────────────────────────────────────────────────
  /** Reception queue — pending review + approved, awaiting an invoice. */
  list: (status?: string, options?: RequestOptions): Promise<ApiResponse<{ bills: BillQueueRow[] }>> =>
    get(`/bills${status ? `?status=${status}` : ''}`, { cache: false, ...options }),
};

export default billsAPI;
