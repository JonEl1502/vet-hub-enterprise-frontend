/**
 * Axios Interceptors for Request/Response Handling
 */

import { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { convertBigIntToString } from '../utils/transformers';
import { handleApiError, isAuthError } from '../utils/errorHandler';
import { toast } from '../utils/toast';
import { RequestOptions } from './types';

/**
 * Setup request interceptor
 * Adds authentication token and clinic headers to all requests
 */
export const setupRequestInterceptor = (axiosInstance: AxiosInstance): void => {
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Get token from localStorage if available
      const token = localStorage.getItem('authToken');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Skip clinic headers for authentication endpoints
      const isAuthEndpoint = config.url?.startsWith('/auth/');

      if (!isAuthEndpoint && config.headers) {
        // Active scope headers — clinic / supplier / freelancer selections.
        // Empty selection = blank header = backend interprets as "all
        // entities the user is allowed to see" (per scope). When exactly
        // one ID is picked we send the singular form (X-Clinic-Id) so the
        // backend's single-clinic fast paths still apply; multi sends the
        // plural form which goes through the `IN (...)` query path.
        const attachScopeHeader = (storageKey: string, singularHeader: string, pluralHeader: string) => {
          const raw = localStorage.getItem(storageKey);
          if (!raw) return;
          try {
            const ids: string[] = JSON.parse(raw);
            if (!Array.isArray(ids) || ids.length === 0) return;
            if (ids.length === 1) {
              config.headers![singularHeader] = ids[0];
            } else {
              config.headers![pluralHeader] = ids.join(',');
            }
          } catch (error) {
            console.error(`Failed to parse ${storageKey}:`, error);
          }
        };

        attachScopeHeader('selectedClinicIds',     'X-Clinic-Id',     'X-Clinic-Ids');
        attachScopeHeader('selectedSupplierIds',   'X-Supplier-Id',   'X-Supplier-Ids');
        attachScopeHeader('selectedFreelancerIds', 'X-Freelancer-Id', 'X-Freelancer-Ids');
      }

      // Log request in development
      if (import.meta.env.DEV) {
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data,
        });
      }

      return config;
    },
    (error: AxiosError) => {
      console.error('[API Request Error]', error);
      return Promise.reject(error);
    }
  );
};

/**
 * Setup response interceptor
 * Handles response transformation and error handling
 */
export const setupResponseInterceptor = (axiosInstance: AxiosInstance): void => {
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Transform response data (convert BigInt to string)
      if (response.data) {
        response.data = convertBigIntToString(response.data);
      }

      // Log response in development
      if (import.meta.env.DEV) {
        console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
          status: response.status,
          data: response.data,
        });
      }

      return response;
    },
    async (error: AxiosError) => {
      // Get request options from config
      const requestOptions = (error.config as any)?._requestOptions as RequestOptions | undefined;

      // Handle authentication errors (401)
      if (isAuthError(error)) {
        const reqUrl = error.config?.url || '';
        // A 401 from the login/signup request itself is a failed *attempt*
        // (bad credentials, deactivated clinic/supplier) — surface the real
        // server message inline and do NOT clear the session or reload the page.
        const isAuthAttempt = /\/(auth|portal)\/(login|signup)/.test(reqUrl);
        const serverMessage = (error.response?.data as any)?.message as string | undefined;

        if (isAuthAttempt) {
          const message = serverMessage || handleApiError(error).message;
          // Stamp the real reason onto the error so the login form's inline
          // `err.message` matches the toast (the raw axios message is generic).
          (error as any).message = message;
          if (!requestOptions?.silent && requestOptions?.showError !== false) {
            toast.error(message);
          }
          return Promise.reject(error);
        }

        // Otherwise this is an authenticated request being rejected — the session
        // expired or the account was suspended mid-session. Clear and redirect,
        // but show the server's reason (e.g. "Your clinic has been deactivated").
        localStorage.removeItem('authToken');
        if (!requestOptions?.silent && requestOptions?.showError !== false) {
          toast.error(serverMessage || 'Your session has expired. Please log in again.');
        }

        // Redirect to the matching login page after a short delay — pet-owner
        // portal sessions go back to the portal login, not the staff one.
        const onPortal = window.location.pathname.startsWith('/client');
        setTimeout(() => {
          window.location.href = onPortal ? '/client/login' : '/login';
        }, 1500);

        return Promise.reject(error);
      }

      // Handle other errors
      const apiError = handleApiError(error, requestOptions?.customErrorMessage);

      // Show error toast if enabled and not silent
      if (!requestOptions?.silent && requestOptions?.showError !== false) {
        toast.error(apiError.message);
      }

      // Log error in development
      if (import.meta.env.DEV) {
        console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
          status: error.response?.status,
          message: apiError.message,
          details: apiError.details,
        });
      }

      return Promise.reject(error);
    }
  );
};

/**
 * Setup all interceptors
 */
export const setupInterceptors = (axiosInstance: AxiosInstance): void => {
  setupRequestInterceptor(axiosInstance);
  setupResponseInterceptor(axiosInstance);
};

