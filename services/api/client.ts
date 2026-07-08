/**
 * Axios API Client with Interceptors and Request Handling
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { apiClientConfig, DEFAULT_RETRY_ATTEMPTS, DEFAULT_RETRY_DELAY } from './config';
import { setupInterceptors } from './interceptors';
import { RequestOptions, ApiResponse } from './types';
import { cache } from '../utils/cache';
import { shouldRetry } from '../utils/errorHandler';
import { sanitizeRequestData } from '../utils/transformers';

/**
 * Create axios instance with default configuration
 */
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create(apiClientConfig);
  setupInterceptors(instance);
  return instance;
};

/**
 * Main axios instance
 */
export const axiosInstance = createAxiosInstance();

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Global network-activity tracker — how many requests are in flight right
 * now (cache hits don't count). UI surfaces (e.g. the visit workflow's
 * loading pill) subscribe to show that SOMETHING is loading.
 */
let pendingCount = 0;
const pendingListeners = new Set<(n: number) => void>();
export const subscribePendingRequests = (fn: (n: number) => void): (() => void) => {
  pendingListeners.add(fn);
  fn(pendingCount);
  return () => { pendingListeners.delete(fn); };
};
const bumpPending = (delta: number) => {
  pendingCount = Math.max(0, pendingCount + delta);
  pendingListeners.forEach(fn => { try { fn(pendingCount); } catch { /* listener */ } });
};

/**
 * Make API request with retry logic and caching
 */
const makeRequest = async <T = any>(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  data?: any,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> => {
  const {
    retry = DEFAULT_RETRY_ATTEMPTS,
    retryDelay = DEFAULT_RETRY_DELAY,
    cache: enableCache = false,
    cacheDuration,
    setLoading,
    silent = false,
    showError = true,
    ...axiosConfig
  } = options;

  // Check cache for GET requests
  if (method === 'get' && enableCache) {
    const cachedData = cache.get<ApiResponse<T>>(url, axiosConfig.params);
    if (cachedData) {
      return cachedData;
    }
  }

  // Set loading state
  if (setLoading && !silent) {
    setLoading(true);
  }
  bumpPending(1);
  try {

  let lastError: any;
  let retryCount = 0;

  // Retry loop
  while (retryCount <= retry) {
    try {
      // Sanitize request data
      const sanitizedData = data ? sanitizeRequestData(data) : undefined;

      // Build axios config
      const config: AxiosRequestConfig = {
        ...axiosConfig,
        method,
        url,
        ...(sanitizedData && { data: sanitizedData }),
      };

      // Store request options in config for interceptors
      (config as any)._requestOptions = options;

      // Make request
      const response = await axiosInstance.request<ApiResponse<T>>(config);

      // Cache successful GET requests
      if (method === 'get' && enableCache && response.data) {
        cache.set(url, response.data, axiosConfig.params, cacheDuration);
      }

      // Clear loading state
      if (setLoading && !silent) {
        setLoading(false);
      }

      return response.data;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (shouldRetry(error, retryCount, retry)) {
        retryCount++;
        
        if (import.meta.env.DEV) {
          console.log(`[API] Retrying request (${retryCount}/${retry}): ${method.toUpperCase()} ${url}`);
        }

        // Wait before retrying
        await sleep(retryDelay * retryCount);
        continue;
      }

      // No more retries, clear loading and throw error
      if (setLoading && !silent) {
        setLoading(false);
      }

      throw error;
    }
  }

  // Clear loading state
  if (setLoading && !silent) {
    setLoading(false);
  }

  throw lastError;

  } finally {
    bumpPending(-1);
  }
};

/**
 * GET request
 */
export const get = <T = any>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> => {
  return makeRequest<T>('get', url, undefined, options);
};

/**
 * POST request
 */
export const post = <T = any>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> => {
  return makeRequest<T>('post', url, data, options);
};

/**
 * PUT request
 */
export const put = <T = any>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> => {
  return makeRequest<T>('put', url, data, options);
};

/**
 * PATCH request
 */
export const patch = <T = any>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> => {
  return makeRequest<T>('patch', url, data, options);
};

/**
 * DELETE request
 */
export const del = <T = any>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> => {
  return makeRequest<T>('delete', url, undefined, options);
};

// Export as default object
export default {
  get,
  post,
  put,
  patch,
  delete: del,
  axiosInstance,
};

