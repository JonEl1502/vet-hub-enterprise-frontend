/**
 * Centralized Error Handling for API Requests
 */

import { AxiosError } from 'axios';
import { ApiError } from '../api/types';
import { HTTP_STATUS } from '../api/config';

/**
 * Check if error is a network error
 */
export const isNetworkError = (error: any): boolean => {
  return (
    error.message === 'Network Error' ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK' ||
    !error.response
  );
};

/**
 * Check if error is a timeout error
 */
export const isTimeoutError = (error: any): boolean => {
  return error.code === 'ECONNABORTED' || error.message?.includes('timeout');
};

/**
 * Check if request should be retried
 */
export const shouldRetry = (error: any, retryCount: number, maxRetries: number): boolean => {
  if (retryCount >= maxRetries) {
    return false;
  }

  // Retry on network errors
  if (isNetworkError(error)) {
    return true;
  }

  // Retry on timeout errors
  if (isTimeoutError(error)) {
    return true;
  }

  // Retry on 5xx server errors
  if (error.response?.status >= 500) {
    return true;
  }

  // Don't retry on 4xx client errors
  return false;
};

/**
 * Extract user-friendly error message from API error
 */
export const getErrorMessage = (error: any, customMessage?: string): string => {
  // Use custom message if provided
  if (customMessage) {
    return customMessage;
  }

  // Network error
  if (isNetworkError(error)) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  // Timeout error
  if (isTimeoutError(error)) {
    return 'Request timed out. Please try again.';
  }

  // API error response
  if (error.response?.data) {
    const data = error.response.data;
    
    // Backend sends { success: false, message: "..." }
    if (data.message) {
      return data.message;
    }

    // Backend sends { error: "..." }
    if (data.error) {
      return data.error;
    }

    // Backend sends { errors: [...] }
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors[0].message || data.errors[0];
    }
  }

  // HTTP status code messages
  if (error.response?.status) {
    switch (error.response.status) {
      case HTTP_STATUS.UNAUTHORIZED:
        return 'You are not authorized. Please log in again.';
      case HTTP_STATUS.FORBIDDEN:
        return 'You do not have permission to perform this action.';
      case HTTP_STATUS.NOT_FOUND:
        return 'The requested resource was not found.';
      case HTTP_STATUS.CONFLICT:
        return 'This resource already exists or conflicts with existing data.';
      case HTTP_STATUS.UNPROCESSABLE_ENTITY:
        return 'Invalid data provided. Please check your input.';
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        return 'An internal server error occurred. Please try again later.';
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        return 'Service is temporarily unavailable. Please try again later.';
      default:
        return `Request failed with status ${error.response.status}`;
    }
  }

  // Generic error message
  return error.message || 'An unexpected error occurred. Please try again.';
};

/**
 * Handle API error and return structured ApiError
 */
export const handleApiError = (error: any, customMessage?: string): ApiError => {
  const axiosError = error as AxiosError;

  const apiError: ApiError = {
    message: getErrorMessage(error, customMessage),
    status: axiosError.response?.status,
    code: axiosError.code,
    details: axiosError.response?.data,
    timestamp: new Date().toISOString(),
  };

  // Log error in development
  if (import.meta.env.DEV) {
    console.error('API Error:', {
      message: apiError.message,
      status: apiError.status,
      code: apiError.code,
      details: apiError.details,
      originalError: error,
    });
  }

  return apiError;
};

/**
 * Check if error is an authentication error
 */
export const isAuthError = (error: any): boolean => {
  return error.response?.status === HTTP_STATUS.UNAUTHORIZED;
};

/**
 * Check if error is a permission error
 */
export const isPermissionError = (error: any): boolean => {
  return error.response?.status === HTTP_STATUS.FORBIDDEN;
};

