/**
 * Appointments API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';

/**
 * Appointment data type
 */
export interface Appointment {
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
 * Appointments API
 */
export const appointmentsAPI = {
  /**
   * Get all appointments with pagination
   */
  getAll: async (
    params?: PaginationParams & { startDate?: string; endDate?: string; status?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointments: Appointment[]; pagination: PaginationMeta }>> => {
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
  ): Promise<ApiResponse<{ appointment: Appointment }>> => {
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
    data: Partial<Appointment>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointment: Appointment }>> => {
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
    data: Partial<Appointment>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointment: Appointment }>> => {
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
    options?: RequestOptions
  ): Promise<ApiResponse<{ appointment: Appointment }>> => {
    return post(ENDPOINTS.APPOINTMENTS.FINALIZE(appointmentId), {}, {
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
  ): Promise<ApiResponse<{ appointment: Appointment; transaction: any }>> => {
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

