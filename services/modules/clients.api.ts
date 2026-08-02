/**
 * Clients API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';

/**
 * Client data type
 */
export interface Client {
  id: number;
  clinicId: number;
  clinicName?: string | null;
  title?: string;
  firstName: string;
  secondName?: string;
  surname: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  country?: string;
  currency?: string;
  gender?: string;
  region?: string;
  dob?: string;
  avatarUrl?: string;
  joinedAt?: string;
  totalSpent?: number;
  lastVisitAt?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  internalNotes?: string | null;
  clientType?: string | null;
  clientTypeNote?: string | null;
  maxDebt?: number | null;
  clientRiskRate?: number | null;
  lat?: number | null;
  lng?: number | null;
  pets?: any[];
  appointmentCount?: number;
  petCount?: number;
  /** Files tab (backend 175). Absent on older deploys — treat as []. */
  attachments?: ClientAttachment[];
}

export interface ClientAttachment {
  url: string;
  key?: string | null;
  kind: 'ID' | 'CONSENT' | 'INSURANCE' | 'DOC' | 'PHOTO' | 'OTHER' | string;
  contentType?: string | null;
  sizeBytes?: number | null;
  label?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export interface DuplicateGroupClient {
  id: string;
  title?: string | null;
  firstName: string;
  secondName?: string | null;
  surname: string;
  email?: string | null;
  phone: string;
  clientType?: string | null;
  totalSpent?: number;
  lastVisitAt?: string | null;
  createdAt: string;
}

export interface DuplicateGroup {
  key: string;
  reason: 'phone' | 'email';
  keyValue: string;
  clients: DuplicateGroupClient[];
}

/**
 * Clients API
 */
// ── Payments tab (backend migration 097) ──────────────────────────────────
// An "invoice" is a visit's own bill — the app has no separate invoice
// document. `collectable` says whether the bill is finalized enough to take
// money against; unfinalized bills are still listed so nothing is hidden.
export interface ClientInvoice {
  visitId: string;
  date: string;
  status: string;
  isPaid: boolean;
  prepaid: boolean;
  total: number;
  /** Applied so far across every live (non-voided) payment. */
  paid: number;
  /** `total - paid` — what settling this invoice actually costs today. */
  outstanding: number;
  /**
   * Every payment that went against THIS invoice, newest first. An invoice
   * fulfilled by three payments lists three — `settlements` is a genuine
   * many-to-many, so a single "payment reference" would be a lie.
   */
  payments: { id: string; amountApplied: number; method: string; status: string; date: string }[];
  encounterType?: string;
  visitType?: string | null;
  pet: { id: string; name: string; species: string } | null;
  collectable: boolean;
  /** The visit's live invoice documents (several on a split bill). */
  invoices?: { id: string; number: string | null; scope: string; status: string; total: number }[];
}

export interface ClientPayment {
  id: string;
  amount: number;
  discountAmount: number;
  currency: string;
  method: string;
  status: string;
  settledAt?: string | null;
  createdAt: string;
  voidedAt?: string | null;
  voidReason?: string | null;
  receiptNumber?: string | null;
  // Every bill this ONE payment covered — voiding it reverses them all.
  coveredVisitIds: string[];
  coveredCount: number;
}

export interface ClientReceipt {
  id: string;
  receiptNumber: string;
  transactionId: string;
  /**
   * The receivable this receipt is FOR (migration 157). A receipt is issued when
   * a bill is FILLED, not when money moves — so one payment clearing three bills
   * produces three receipts, each naming its own visit.
   * NULL on pre-157 receipts, which were issued per payment.
   */
  visitId?: string | null;
  invoiceId?: string | null;
  /** Face value of the receivable, before discount. */
  subtotal: number;
  /** What was forgiven — a discount or a write-off. */
  discount: number;
  /** The FINAL AMOUNT = subtotal − discount. */
  total: number;
  /** What actually arrived: cash and client credit alike. */
  amountPaid?: number;
  /** total − amountPaid. Zero on any receipt; present so the doc reads in full. */
  balance?: number;
  paymentMethod: string;
  createdAt: string;
  voided: boolean;
  /** Set when the receipt was UN-ISSUED because its payment was reversed. */
  voidReason?: string | null;
  coveredVisitIds: string[];
}

/**
 * The reconciliation slip for a PART-PAID bill (157).
 *
 * A part payment deliberately issues no receipt — but the client must not leave
 * with nothing, so this is what the front desk hands over. Derived from the
 * settlements, never stored, and its `REC-` reference sits outside the receipt
 * number series so it can't be mistaken for proof of settlement.
 */
export interface VisitReconciliation {
  kind: 'RECONCILIATION' | 'RECEIPT_ISSUED';
  reference: string;
  visitId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  finalAmount: number;
  paidSoFar: number;
  balance: number;
  settled: boolean;
  receipt: { id: string; receiptNumber: string; issuedAt: string } | null;
  payments: { transactionId: string; amount: number; method: string; paidAt: string }[];
  generatedAt: string;
}

export interface ClientBilling {
  invoices: ClientInvoice[];
  payments: ClientPayment[];
  receipts: ClientReceipt[];
  outstanding: number;
}

export const clientsAPI = {
  /** Invoices + payments + receipts for the client's Payments tab. */
  getBilling: async (clientId: string | number, options?: RequestOptions): Promise<ApiResponse<ClientBilling>> =>
    get(`/clients/${clientId}/billing`, { cache: false, ...options }),

  /**
   * Collect ONE payment across several of the client's invoices. The
   * resulting transaction is reversible as a unit: voiding it puts every
   * covered invoice back to unpaid.
   *
   * ALLOCATION (backend P3, migration 105). `amountTendered` short of the
   * selection's total splits the money oldest-invoice-first; pass
   * `allocations` to set the split by hand instead. An invoice only clears
   * when its share covers it in full — otherwise it keeps a real balance.
   */
  collect: async (
    clientId: string | number,
    data: {
      visitIds: (string | number)[];
      paymentMethod: string;
      walletId?: string | number;
      discountType?: 'PERCENTAGE' | 'FIXED';
      discountValue?: number;
      amountTendered?: number;
      allocations?: { visitId: string | number; amount: number }[];
      /**
       * Spend the client's existing credit on this collection. `true` draws
       * whatever it covers; a number caps the draw. Credit REDUCES the cash
       * needed, so it is not part of `amountTendered` — pass 0 tendered to
       * settle a bill entirely from credit.
       */
      useCredit?: boolean | number;
    },
    options?: RequestOptions,
  ): Promise<ApiResponse<{
    transaction: { id: string; amount: number };
    receipt: { receiptNumber: string; total: number };
    visitIds: string[];
    settledVisitIds: string[];
    allocations: { visitId: string; invoiceId: string | null; amountApplied: number; outstandingAfter: number }[];
  }>> =>
    post(`/clients/${clientId}/collect`, data, { showError: true, ...options }),

  /**
   * Unapplied money on the client's account. DERIVED on read — money paid that
   * no settlement has attached to a receivable. There is no stored balance.
   */
  /** Prepayment into the client's payment account (derived credit) — no invoices. */
  recordAdvance: (clientId: string | number, data: { amount: number; paymentMethod: string; note?: string }): Promise<ApiResponse<{ transactionId: string; amount: number; creditBalance: number | null }>> =>
    post(`/clients/${clientId}/advance`, data, { showError: true }),

  /** Client file attachments (backend 175) — metadata only; bytes go to R2 via uploadsAPI (scope 'client'). */
  addAttachment: (clientId: string | number, data: {
    url: string; key?: string; kind?: string; contentType?: string; sizeBytes?: number; label?: string;
  }): Promise<ApiResponse<{ clientId: string; attachments: ClientAttachment[] }>> =>
    post(`/clients/${clientId}/attachments`, data, { showError: true }),

  removeAttachment: (clientId: string | number, index: number): Promise<ApiResponse<{ clientId: string; attachments: ClientAttachment[] }>> =>
    del(`/clients/${clientId}/attachments/${index}`, { showError: true }),

  credit: (clientId: string | number): Promise<ApiResponse<{
    balance: number;
    sources: { transactionId: string; paidAt: string; amount: number; applied: number; remaining: number }[];
  }>> => get(`/clients/${clientId}/credit`, { cache: false }),

  /** Chronological account: charges, payments, running balance. */
  statement: (clientId: string | number): Promise<ApiResponse<{
    rows: { date: string; kind: 'CHARGE' | 'PAYMENT'; description: string; visitId: string; charge: number; payment: number; balance: number }[];
    balance: number;
    credit: number;
    totalCharged: number;
    totalPaid: number;
  }>> => get(`/clients/${clientId}/statement`, { cache: false }),

  /**
   * Get all clients with pagination
   */
  getAll: async (
    params?: PaginationParams & { status?: 'active' | 'inactive' | 'all' },
    options?: RequestOptions
  ): Promise<ApiResponse<{ clients: Client[]; pagination: PaginationMeta }>> => {
    const { status, ...pagination } = params || {};
    const baseQuery = buildPaginationQuery(pagination);
    const query = status
      ? `${baseQuery}${baseQuery ? '&' : '?'}status=${status}`
      : baseQuery;
    return get(`${ENDPOINTS.CLIENTS.BASE}${query}`, {
      cache: true,
      cacheDuration: 60000, // Cache for 1 minute
      ...options,
    });
  },

  /**
   * Get client by ID
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ client: Client }>> => {
    return get(ENDPOINTS.CLIENTS.BY_ID(id), {
      cache: true,
      ...options,
    });
  },

  /**
   * Create new client
   */
  create: async (
    data: Partial<Client>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ client: Client }>> => {
    return post(ENDPOINTS.CLIENTS.BASE, data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Quick walk-in registration — client + optional pet, flagged "needs update".
   */
  walkIn: async (
    data: { firstName: string; surname: string; phone: string; title?: string; email?: string; pet?: { name: string; species: string; breed?: string; gender?: string; dob?: string; weightValue?: number } },
    options?: RequestOptions
  ): Promise<ApiResponse<{ client: Client; pet: any }>> => {
    return post(ENDPOINTS.CLIENTS.WALK_IN, data, { showError: true, ...options });
  },

  /**
   * Update client
   */
  update: async (
    id: number,
    data: Partial<Client>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ client: Client }>> => {
    return put(ENDPOINTS.CLIENTS.BY_ID(id), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Delete client. Pass `cascadePets: true` to also soft-delete every
   * pet owned by this client (avoids leaving orphans on the dedupe path).
   */
  delete: async (
    id: number,
    optsOrLegacy?: RequestOptions | { cascadePets?: boolean; hard?: boolean },
    options?: RequestOptions
  ): Promise<ApiResponse<{ message?: string; petsDeleted?: number; hard?: boolean }>> => {
    const flags = optsOrLegacy as { cascadePets?: boolean; hard?: boolean };
    const cascadePets = flags?.cascadePets;
    const hard = flags?.hard;
    const hasFlags = cascadePets !== undefined || hard !== undefined;
    const reqOptions = (hasFlags ? options : (optsOrLegacy as RequestOptions)) || {};
    // hard delete implies removing pets too (owner-cascade), so `?hard=true`
    // alone covers it; otherwise `?cascade=pets` soft-archives with pets.
    const qs = hard ? '?hard=true' : cascadePets ? '?cascade=pets' : '';
    return del(`${ENDPOINTS.CLIENTS.BY_ID(id)}${qs}`, {
      showError: true,
      ...reqOptions,
    });
  },

  /**
   * Move a client + their pets to another clinic. Admin only.
   */
  transfer: async (
    id: number | string,
    toClinicId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ clientId: string; petsMoved: number; fromClinicId: string; toClinicId: string }>> => {
    return post(`${ENDPOINTS.CLIENTS.BY_ID(Number(id))}/transfer`, { toClinicId: String(toClinicId) }, {
      showError: true,
      ...options,
    });
  },

  /**
   * Invite this client to the pet-owner portal. Emails a one-time accept
   * link; the client sets a password and gets linked to this Client record.
   */
  inviteToPortal: async (
    id: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ sent: boolean }>> => {
    return post(`${ENDPOINTS.CLIENTS.BY_ID(Number(id))}/invite`, undefined, {
      showError: true,
      ...options,
    });
  },

  /**
   * Nudge a DORMANT portal client (has an account, hasn't logged in lately)
   * with a "log back in" email.
   */
  wakePortalClient: async (
    id: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ sent: boolean }>> => {
    return post(`${ENDPOINTS.CLIENTS.BY_ID(Number(id))}/wake`, undefined, {
      showError: true,
      ...options,
    });
  },

  /**
   * Find duplicate clients in the active clinic. Groups by normalized
   * phone and email; returns groups of size >= 2.
   */
  duplicates: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ groups: DuplicateGroup[] }>> => {
    return get(ENDPOINTS.CLIENTS.DUPLICATES, {
      cache: false,
      ...options,
    });
  },

  /**
   * Get client transactions
   */
  getTransactions: async (
    clientId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ transactions: any[] }>> => {
    return get(ENDPOINTS.CLIENTS.TRANSACTIONS(clientId), {
      cache: true,
      cacheDuration: 30000, // Cache for 30 seconds
      ...options,
    });
  },
};

