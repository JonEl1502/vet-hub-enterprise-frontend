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
        // Get selected clinic(s) from localStorage and add to headers
        const selectedClinicIds = localStorage.getItem('selectedClinicIds');
        if (selectedClinicIds) {
          try {
            const clinicIds: string[] = JSON.parse(selectedClinicIds);
            if (clinicIds.length === 1) {
              config.headers['X-Clinic-Id'] = clinicIds[0];
            } else if (clinicIds.length > 1) {
              config.headers['X-Clinic-Ids'] = clinicIds.join(',');
            }
          } catch (error) {
            console.error('Failed to parse selected clinic IDs:', error);
          }
        }
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
        // Clear auth token
        localStorage.removeItem('authToken');
        
        // Show error toast if not silent
        if (!requestOptions?.silent && requestOptions?.showError !== false) {
          toast.error('Your session has expired. Please log in again.');
        }

        // Redirect to login page after a short delay
        setTimeout(() => {
          window.location.href = '/login';
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

