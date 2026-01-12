/**
 * Common API Types for VetHub Enterprise
 */

import { AxiosRequestConfig } from 'axios';

/**
 * Standard API Response format from backend
 */
export interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  message: string;
  data: T;
  timestamp?: string;
}

/**
 * API Error structure
 */
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
  timestamp?: string;
}

/**
 * Loading target types for component-specific loading states
 */
export type LoadingTarget = 'button' | 'table' | 'form' | 'modal' | 'page' | 'custom';

/**
 * Request options for API calls
 */
export interface RequestOptions extends Omit<AxiosRequestConfig, 'url' | 'method' | 'data'> {
  /**
   * Whether to show error toast notification
   * @default true
   */
  showError?: boolean;

  /**
   * Whether to suppress all UI feedback (loading, errors, etc.)
   * @default false
   */
  silent?: boolean;

  /**
   * Custom error message to show instead of API error
   */
  customErrorMessage?: string;

  /**
   * Number of retry attempts for failed requests
   * @default 0
   */
  retry?: number;

  /**
   * Delay between retry attempts in milliseconds
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Whether to cache the response (only for GET requests)
   * @default false
   */
  cache?: boolean;

  /**
   * Cache duration in milliseconds
   * @default 300000 (5 minutes)
   */
  cacheDuration?: number;

  /**
   * Loading state setter function for component-specific loading
   * Example: setLoading => setLoading(true) before request, setLoading(false) after
   */
  setLoading?: (loading: boolean) => void;

  /**
   * Type of UI element that is loading
   * Used to determine loading animation style
   */
  loadingTarget?: LoadingTarget;

  /**
   * Custom loading message
   */
  loadingMessage?: string;
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * API Client configuration
 */
export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
  withCredentials: boolean;
}

/**
 * Toast notification types
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast notification structure
 */
export interface ToastNotification {
  type: ToastType;
  message: string;
  duration?: number;
  id?: string;
}

