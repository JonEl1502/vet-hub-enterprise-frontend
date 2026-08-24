/**
 * Visits API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';

/**
 * Visit data type
 */
export interface Visit {
  id: number;
  clinicId: number;
  clientId: number;
  petId: number;
  visitDate: string;
  status: string;
  totalAmount?: number;
  paidAmount?: number;
  paymentStatus?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Task data type
 */
export interface Task {
  id: number;
  appointmentId: number;
  serviceId?: number;
  name: string;
  description?: string;
  status: string;
  assignedTo?: number;
  price?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Payment data type
 */
export interface PaymentData {
  method: string;
  amount?: number;
  notes?: string;
  // Server accepts arbitrary extras (clientId, walletId, discountType,
  // discountValue) — we don't lock these down here so legacy callers
  // can keep passing through. Typed as `any` via index sig below.
  [key: string]: any;
}

/**
 * Visits API
 */
/** A stacked encounter on a visit (172). Primary mirrors the visit's own
 * encounter_type; added rows are the extra workflows staff attached. */
export interface VisitEncounter {
  id: string;
  visitId: string;
  encounterType: string;
  visitType: string | null;
  leadStaffId: string | null;
  templateId: string | null;
  isPrimary: boolean;
  status: string;
  sortOrder: number;
  attendingStaff?: { id: string; userId: string; role: string | null; fee: number | null; isLead?: boolean; name?: string }[];
  /**
   * Staff credited through a SERVICE or PROCEDURE on this encounter (106+125),
   * not added to the encounter directly. Kept separate from `attendingStaff` so
   * saving the encounter team never overwrites service-level attribution.
   */
  serviceStaff?: { userId: string; role: string | null; isLead: boolean; name: string | null; via: string; taskId: string }[];
}

/** Who REGISTERED the visit (127) — front desk. Null on visits created before 127. */
export interface VisitRegisteredBy { id: string; role: string | null; name: string | null }

export type VisitLinkType = 'ESCALATION' | 'TRANSFER' | 'SAME_DAY';

export interface LinkedVisitRow {
  id: string;
  date: string;
  status: string;
  isPaid: boolean;
  totalCost: number;
  encounterType: string | null;
  visitType: string | null;
  patient: { id: string; name: string } | null;
  /** Did this come OUT of the visit, is it the visit's origin, or a same-day peer? */
  direction: 'DESCENDANT' | 'ORIGIN' | 'PEER';
  linkType: VisitLinkType;
  reason: string | null;
  bill: { id: string; status: string; total: number; number: string | null } | null;
}

export interface LinkedVisits {
  visitId: string;
  origin: { visitId: string; linkType: VisitLinkType; reason: string | null } | null;
  linked: LinkedVisitRow[];
}

export const visitsAPI = {
  /**
   * Get all appointments with pagination
   */
  getAll: async (
    params?: PaginationParams & { startDate?: string; endDate?: string; status?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointments: Visit[]; pagination: PaginationMeta }>> => {
    const { startDate, endDate, status, ...paginationParams } = params || {};
    let query = buildPaginationQuery(paginationParams);

    // Add additional filters
    const additionalParams = new URLSearchParams();
    if (startDate) additionalParams.append('startDate', startDate);
    if (endDate) additionalParams.append('endDate', endDate);
    if (status) additionalParams.append('status', status);

    const additionalQuery = additionalParams.toString();
    if (additionalQuery) {
      query = query ? `${query}&${additionalQuery}` : `?${additionalQuery}`;
    }

    return get(`${ENDPOINTS.APPOINTMENTS.BASE}${query}`, {
      cache: true,
      cacheDuration: 30000, // Cache for 30 seconds
      ...options,
    });
  },

  /**
   * Get appointment by ID
   */
  getById: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointment: Visit }>> => {
    return get(ENDPOINTS.APPOINTMENTS.BY_ID(id), {
      cache: true,
      cacheDuration: 30000,
      ...options,
    });
  },

  /**
   * Create new appointment
   */
  create: async (
    data: Partial<Visit>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointment: Visit }>> => {
    return post(ENDPOINTS.APPOINTMENTS.BASE, data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Upsert the grooming intake/report card (GROOMING encounters).
   */
  saveGrooming: async (
    id: number | string,
    data: { temperament?: string; vaccinationStatus?: string; specialInstructions?: string; beforePhotos?: string[]; afterPhotos?: string[]; groomerNotes?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointment: any }>> => {
    return put(ENDPOINTS.APPOINTMENTS.GROOMING(id), data, { showError: true, ...options });
  },

  /**
   * Update appointment
   */
  update: async (
    id: number,
    data: Partial<Visit>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointment: Visit }>> => {
    return put(ENDPOINTS.APPOINTMENTS.BY_ID(id), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Delete appointment
   */
  delete: async (
    id: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return del(ENDPOINTS.APPOINTMENTS.BY_ID(id), {
      showError: true,
      ...options,
    });
  },

  /**
   * Add task to appointment
   */
  addTask: async (
    appointmentId: number,
    data: Partial<Task>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ task: Task }>> => {
    return post(ENDPOINTS.APPOINTMENTS.TASKS(appointmentId), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Update appointment task
   */
  /**
   * Who performed this service (backend 106). Replaces the whole list.
   * `fee` is INTERNAL clinic cost and never reaches the client's invoice.
   */
  setTaskAttendance: async (
    appointmentId: number,
    taskId: number,
    staff: Array<{ userId: string | number; role?: string | null; fee?: number | null; isLead?: boolean }>,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ taskId: string; attendance: any[] }>> => {
    return put(`${ENDPOINTS.APPOINTMENTS.TASK_BY_ID(appointmentId, taskId)}/staff`, { staff }, {
      showError: true,
      ...options,
    });
  },

  /**
   * Swap the ITEM behind a visit line in place (Bordetella → Rabies) instead
   * of delete-and-re-add, which loses the assigned staff, price and notes.
   * Rides the same PUT as a normal task edit — a swap IS an edit of the line.
   * Returns non-blocking `warnings` (species mismatch, cleared next-dose date).
   */
  swapTaskItem: async (
    appointmentId: number,
    taskId: number,
    swap: { serviceId?: string | number | null; inventoryItemId?: string | number | null; name?: string; price?: number; allowCategoryChange?: boolean },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ task: Task; warnings: string[] }>> => {
    return put(ENDPOINTS.APPOINTMENTS.TASK_BY_ID(appointmentId, taskId), { swap }, {
      showError: true,
      ...options,
    });
  },

  updateTask: async (
    appointmentId: number,
    taskId: number,
    data: Partial<Task>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ task: Task }>> => {
    return put(ENDPOINTS.APPOINTMENTS.TASK_BY_ID(appointmentId, taskId), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Delete appointment task
   */
  deleteTask: async (
    appointmentId: number,
    taskId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return del(ENDPOINTS.APPOINTMENTS.TASK_BY_ID(appointmentId, taskId), {
      showError: true,
      ...options,
    });
  },

  /**
   * Finalize appointment — complete all tasks + set PENDING_PAYMENT in one call
   */
  finalize: async (
    appointmentId: number,
    // Follow-up reminder collected at the strict finalize gate (required unless
    // the patient is deceased). Omit only for the deceased bypass.
    reminder?: { serviceType?: string; title?: string; notes?: string; dueAt: string; recurrence?: string | null; meta?: Record<string, any> } | null,
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointment: Visit }>> => {
    return post(ENDPOINTS.APPOINTMENTS.FINALIZE(appointmentId), reminder ? { reminder } : {}, {
      showError: true,
      ...options,
    });
  },

  /**
   * Process payment for appointment
   */
  processPayment: async (
    appointmentId: number,
    data: PaymentData,
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointment: Visit; transaction: any }>> => {
    return post(ENDPOINTS.APPOINTMENTS.PAYMENT(appointmentId), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Initiate an async gateway payment (Stripe / Mpesa).
   * Returns a provider ref + client payload (clientSecret or Mpesa STK message).
   * Webhook finalizes settlement — do not mark appointment paid client-side.
   */
  initiatePayment: async (
    appointmentId: number,
    data: {
      clientId: number | string;
      provider: 'STRIPE' | 'MPESA';
      phone?: string;
      discountType?: 'PERCENTAGE' | 'FIXED';
      discountValue?: number;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      transactionId: string;
      provider: 'STRIPE' | 'MPESA';
      providerRef: string;
      providerStatus: string;
      amount: number;
      discountAmount: number;
      currency: string;
      client: Record<string, any>;
    }>
  > => {
    return post(ENDPOINTS.APPOINTMENTS.PAYMENT_INITIATE(appointmentId), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Poll the payment status (useful while Mpesa STK is waiting for the customer).
   */
  getPaymentStatus: async (
    appointmentId: number,
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      status: 'PENDING' | 'SETTLED' | 'NONE';
      provider?: 'STRIPE' | 'MPESA' | null;
      providerRef?: string | null;
      providerStatus?: string | null;
      receipt?: { id: string; receiptNumber: string; total: number } | null;
      raw?: Record<string, any>;
    }>
  > => {
    return get(ENDPOINTS.APPOINTMENTS.PAYMENT_STATUS(appointmentId), {
      silent: true,
      ...options,
    });
  },

  /**
   * Reconcile payment status — fix appointments with settled transactions still showing unpaid
   */
  reconcile: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ reconciled: number; appointmentIds: string[] }>> => {
    return post('/appointments/reconcile', {}, {
      showError: true,
      ...options,
    });
  },

  reconcileOne: async (
    appointmentId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ reconciled: boolean; isPaid: boolean; paymentMethod?: string }>> => {
    return post(`/appointments/${appointmentId}/reconcile`, {}, {
      showError: true,
      ...options,
    });
  },

  regenerateTransaction: async (
    appointmentId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ found: boolean; transactionId?: string; receiptNumber?: string; appointment?: any }>> => {
    return post(`/appointments/${appointmentId}/regenerate-transaction`, {}, {
      showError: true,
      ...options,
    });
  },

  /**
   * Group visit (077): all sibling visits sharing a group ref — feeds the
   * per-animal progress panel + the consolidated group invoice.
   */
  /**
   * Linked visits (backend 120) — origin, descendants and same-day peers for
   * this visit, each with its OWN bill status.
   */
  getLinked: async (
    visitId: string | number,
    options?: RequestOptions,
  ): Promise<ApiResponse<LinkedVisits>> =>
    get(`/visits/${visitId}/linked`, { cache: false, ...options }),

  getGroup: async (
    groupVisitId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ visits: any[] }>> => {
    return get(`/appointments/group/${encodeURIComponent(groupVisitId)}`, {
      cache: false,
      ...options,
    });
  },

  /**
   * Client outstanding balance — unpaid finalized bills, so a new invoice can
   * carry the previous balance forward. excludeId keeps the visit being
   * invoiced out of its own "previous balance".
   */
  getClientOutstanding: async (
    clientId: number | string,
    excludeAppointmentId?: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ outstanding: { total: number; items: Array<{ appointmentId: string; petId: string; petName: string | null; scheduledAt: string; encounterType: string; amount: number }> } }>> => {
    const q = excludeAppointmentId ? `?excludeId=${excludeAppointmentId}` : '';
    return get(`/appointments/outstanding/${clientId}${q}`, { cache: false, silent: true, ...options });
  },

  /**
   * Patient Journey — REBUILT SERVER-SIDE from the visit's own records on every
   * read (services, products, module records, bill/invoice/payment timestamps,
   * the workflow's `completed` map), merged with the stored `visit_events` rows
   * that cover staff notes and the transitions no row records (status changes,
   * reopens, removals).
   *
   * So this is the ONLY source of the timeline. Do not rebuild it in the
   * client: an event the UI invents is one no other surface can see, and it
   * lands in click order rather than in the order things actually happened.
   */
  getEvents: async (
    appointmentId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ events: Array<{
    id: string; visitId: string; at: string; label: string; kind: string; auto: boolean;
    /** Which record produced it — 'service' | 'product' | 'bill' | 'lab' | … */
    source?: string;
    refId?: string | null;
    /** Where it happened, so the drawer can jump there: 'tab:billing', 'step:treatment', 'page:lab'. */
    anchor?: string | null;
    amount?: number | null;
    actor?: string | null;
  }> }>> => {
    return get(`/appointments/${appointmentId}/events`, { cache: false, silent: true, ...options });
  },

  /** Stacked encounters (172) — the rows that make the workflow chips real. */
  listEncounters: async (
    appointmentId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{
    encounters: VisitEncounter[];
    registeredBy: VisitRegisteredBy | null;
    unassignedServiceStaff?: NonNullable<VisitEncounter['serviceStaff']>;
  }>> => {
    return get(`/appointments/${appointmentId}/encounters`, { cache: false, silent: true, ...options });
  },

  /**
   * Assign / reassign who attended an encounter. REPLACE semantics — send the
   * WHOLE list; anyone omitted is removed. The server keeps
   * `visit_encounters.lead_staff_id` in sync with the flagged lead.
   * `fee` is INTERNAL clinic cost and is never billed (rule from 106).
   */
  /**
   * Who performed a SERVICE or PROCEDURE. Procedures anchor to a task, so both
   * go through here and roll into the same encounter stats. REPLACE semantics —
   * an empty list clears it, which is why a service can simply be left blank.
   */
  setTaskStaff: async (
    appointmentId: number | string,
    taskId: string | number,
    staff: { userId: string | number; role?: string | null; fee?: number | null; isLead?: boolean }[],
    options?: RequestOptions
  ): Promise<ApiResponse<{ task: any }>> => {
    return put(`/appointments/${appointmentId}/tasks/${taskId}/staff`, { staff }, { showError: true, ...options });
  },

  setEncounterStaff: async (
    appointmentId: number | string,
    encounterId: string | number,
    staff: { userId: string | number; role?: string | null; fee?: number | null; isLead?: boolean }[],
    options?: RequestOptions
  ): Promise<ApiResponse<{ encounter: VisitEncounter }>> => {
    return put(`/appointments/${appointmentId}/encounters/${encounterId}/staff`, { staff }, { showError: true, ...options });
  },

  addEncounter: async (
    appointmentId: number | string,
    data: { encounterType: string; visitType?: string | null; leadStaffId?: string | number | null; templateId?: string | number | null },
    options?: RequestOptions
  ): Promise<ApiResponse<{ encounter: VisitEncounter }>> => {
    return post(`/appointments/${appointmentId}/encounters`, data, { showError: true, ...options });
  },

  removeEncounter: async (
    appointmentId: number | string,
    encounterId: string | number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return del(`/appointments/${appointmentId}/encounters/${encounterId}`, { showError: true, ...options });
  },

  addEvent: async (
    appointmentId: number | string,
    data: { label: string; kind?: 'milestone' | 'action' | 'alert' | 'billing' | 'info' | 'transfer' },
    options?: RequestOptions
  ): Promise<ApiResponse<{ event: { id: string; at: string; label: string; kind: string } }>> => {
    return post(`/appointments/${appointmentId}/events`, data, { silent: true, ...options });
  },

  /**
   * Clinical wizard state (consultation_records) — the visit's record
   * follows the visit across machines; localStorage is only a cache.
   */
  getWorkflow: async (
    appointmentId: number | string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ workflow: { entryKey: string; startedAt: string; currentStep: string; completed: any; data: any; updatedAt: string; templateId?: string | null } | null }>> => {
    return get(`/appointments/${appointmentId}/workflow`, { cache: false, silent: true, ...options });
  },

  saveWorkflow: async (
    appointmentId: number | string,
    data: { entryKey: string; startedAt: string; currentStep: string; completed: any; data: any; templateId?: string | null },
    options?: RequestOptions
  ): Promise<ApiResponse<{ workflow: { updatedAt: string } }>> => {
    return put(`/appointments/${appointmentId}/workflow`, data, { silent: true, ...options });
  },

  /**
   * Settle several visits in ONE action (group visits) — per-visit results.
   */
  settleGroup: async (
    data: { visitIds: (number | string)[]; paymentMethod: string; walletId?: string | number },
    options?: RequestOptions
  ): Promise<ApiResponse<{ results: Array<{ visitId: string; ok: boolean; error?: string }>; settled: number }>> => {
    return post('/appointments/settle-group', data, { showError: true, ...options });
  },

  /**
   * Accounting export — finalized invoices as structured JSON (pass
   * format:'csv' to get a downloadable CSV from the same endpoint).
   */
  exportInvoices: async (
    params?: { startDate?: string; endDate?: string; format?: 'json' | 'csv' },
    options?: RequestOptions
  ): Promise<ApiResponse<{ invoices: any[]; count: number }>> => {
    const q = new URLSearchParams();
    if (params?.startDate) q.append('startDate', params.startDate);
    if (params?.endDate) q.append('endDate', params.endDate);
    if (params?.format) q.append('format', params.format);
    const qs = q.toString();
    return get(`/appointments/export/invoices${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },

  /**
   * Batch update appointment (tasks, medications, etc.)
   */
  batchUpdate: async (
    appointmentId: number,
    data: {
      taskUpdates?: Array<{
        taskId: number;
        updates: Partial<Task>;
      }>;
      medicationAdditions?: Array<{
        taskId?: number;
        inventoryItemId: string;
        quantity: number;
        notes?: string;
        batchNumber?: string;
        expiryDate?: string;
      }>;
      medicationRemovals?: string[];
    },
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointment: any }>> => {
    return put(`/appointments/${appointmentId}/batch-update`, data, {
      showError: true,
      ...options,
    });
  },
};

