/**
 * API Configuration for VetHub Enterprise
 */

import { ApiClientConfig } from './types';

/**
 * API Base URL from environment or default to localhost
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

/**
 * API Request timeout in milliseconds (30 seconds)
 */
export const API_TIMEOUT = 30000;

/**
 * Default cache duration in milliseconds (5 minutes)
 */
export const DEFAULT_CACHE_DURATION = 5 * 60 * 1000;

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_ATTEMPTS = 0;
export const DEFAULT_RETRY_DELAY = 1000;

/**
 * Default headers for all API requests
 */
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

/**
 * API Client configuration
 */
export const apiClientConfig: ApiClientConfig = {
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: DEFAULT_HEADERS,
  withCredentials: true, // Include cookies for session management
};

/**
 * API Endpoints
 */
export const ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    GOOGLE: '/auth/google',
    GOOGLE_CALLBACK: '/auth/google/callback',
  },

  // Users
  USERS: {
    BASE: '/users',
    BY_ID: (id: number) => `/users/${id}`,
  },

  // Clinics
  CLINICS: {
    BASE: '/clinics',
    BY_ID: (id: number) => `/clinics/${id}`,
    USER_CLINICS: '/clinics/user-clinics',
  },

  // Clients
  CLIENTS: {
    BASE: '/clients',
    BY_ID: (id: number) => `/clients/${id}`,
    TRANSACTIONS: (id: number) => `/clients/${id}/transactions`,
  },

  // Pets
  PETS: {
    BASE: '/pets',
    BY_ID: (id: number) => `/pets/${id}`,
    TRANSACTIONS: (id: number) => `/pets/${id}/transactions`,
  },

  // Appointments
  APPOINTMENTS: {
    BASE: '/appointments',
    BY_ID: (id: number) => `/appointments/${id}`,
    TASKS: (id: number) => `/appointments/${id}/tasks`,
    TASK_BY_ID: (appointmentId: number, taskId: number) => `/appointments/${appointmentId}/tasks/${taskId}`,
    PAYMENT: (id: number) => `/appointments/${id}/payment`,
  },

  // Transactions
  TRANSACTIONS: {
    BASE: '/transactions',
    BY_ID: (id: number) => `/transactions/${id}`,
  },

  // Medical Records
  MEDICAL_RECORDS: {
    BASE: '/medical-records',
    BY_ID: (id: number) => `/medical-records/${id}`,
  },

  // Inventory
  INVENTORY: {
    BASE: '/inventory',
    BY_ID: (id: number) => `/inventory/${id}`,
  },

  // Referrals
  REFERRALS: {
    BASE: '/referrals',
    BY_ID: (id: number) => `/referrals/${id}`,
  },

  // Stock Movements
  STOCK_MOVEMENTS: {
    BASE: '/stock-movements',
    BY_ITEM: (inventoryItemId: number) => `/stock-movements/item/${inventoryItemId}`,
    TRACK_MEDICATION: '/stock-movements/track-medication',
    RESTOCK: '/stock-movements/restock',
    BY_APPOINTMENT: (appointmentId: number) => `/stock-movements/appointment/${appointmentId}/medications`,
  },

  // Suppliers
  SUPPLIERS: {
    BASE: '/suppliers',
    BY_ID: (id: number) => `/suppliers/${id}`,
  },

  // Supplier Products
  SUPPLIER_PRODUCTS: {
    BASE: '/supplier-products',
    BY_ID: (id: number) => `/supplier-products/${id}`,
    BY_SUPPLIER: (supplierId: number) => `/supplier-products/supplier/${supplierId}`,
  },

  // Supplier Branches
  SUPPLIER_BRANCHES: {
    BASE: '/supplier-branches',
    BY_ID: (id: number) => `/supplier-branches/${id}`,
  },

  // Supplier Employees
  SUPPLIER_EMPLOYEES: {
    BASE: '/supplier-employees',
    INVITE: '/supplier-employees/invite',
    BY_ID: (id: number) => `/supplier-employees/${id}`,
  },

  // Supplier Orders (for suppliers to view orders placed with them)
  SUPPLIER_ORDERS: {
    BASE: '/supplier-orders',
    BY_ID: (id: number) => `/supplier-orders/${id}`,
    UPDATE_STATUS: (id: number) => `/supplier-orders/${id}/status`,
  },

  // Purchase Orders
  PURCHASE_ORDERS: {
    BASE: '/purchase-orders',
    BY_ID: (id: string) => `/purchase-orders/${id}`,
    SUBMIT: (id: string) => `/purchase-orders/${id}/submit`,
    APPROVE: (id: string) => `/purchase-orders/${id}/approve`,
    RECEIVE: (id: string) => `/purchase-orders/${id}/receive`,
    MARK_RECEIVED: (id: string) => `/purchase-orders/${id}/mark-received`,
    COMPLETE: (id: string) => `/purchase-orders/${id}/complete`,
    CANCEL: (id: string) => `/purchase-orders/${id}/cancel`,
  },
} as const;

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

