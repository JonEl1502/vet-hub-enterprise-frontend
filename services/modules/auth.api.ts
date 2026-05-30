/**
 * Authentication API Module
 */

import { get, post } from '../api/client';
import { ENDPOINTS, API_BASE_URL } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * Login request data
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response data
 */
export interface LoginResponse {
  user: any;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

/**
 * Signup request data
 */
export interface SignupRequest {
  user: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  };
  clinic: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    logo?: string | null;
    latitude?: number;
    longitude?: number;
    isDemo?: boolean;
  };
}

/**
 * Authentication API
 */
export const authAPI = {
  /**
   * Login with email and password
   */
  login: async (
    email: string,
    password: string,
    options?: RequestOptions
  ): Promise<ApiResponse<LoginResponse>> => {
    return post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, { email, password }, {
      showError: true,
      ...options,
    });
  },

  /**
   * Signup with user and clinic data
   */
  signup: async (
    userData: SignupRequest['user'],
    clinicData: SignupRequest['clinic'],
    options?: RequestOptions
  ): Promise<ApiResponse<LoginResponse>> => {
    return post<LoginResponse>(ENDPOINTS.AUTH.SIGNUP, {
      user: userData,
      clinic: clinicData,
    }, {
      showError: true,
      ...options,
    });
  },

  /**
   * Forgot password - Request OTP
   */
  forgotPassword: async (
    email: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email }, {
      showError: true,
      ...options,
    });
  },

  /**
   * Verify the password-reset OTP emailed to the user
   */
  verifyResetOtp: async (
    email: string,
    code: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return post(ENDPOINTS.AUTH.VERIFY_RESET_OTP, { email, code }, {
      showError: true,
      ...options,
    });
  },

  /**
   * Reset password with email + new password (requires verified OTP)
   */
  resetPassword: async (
    email: string,
    password: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return post(ENDPOINTS.AUTH.RESET_PASSWORD, { email, password }, {
      showError: true,
      ...options,
    });
  },

  /**
   * Get current user
   */
  getCurrentUser: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ user: any }>> => {
    return get(ENDPOINTS.AUTH.ME, {
      cache: true,
      cacheDuration: 60000, // Cache for 1 minute
      ...options,
    });
  },

  /**
   * Logout
   */
  logout: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return post(ENDPOINTS.AUTH.LOGOUT, undefined, {
      showError: true,
      ...options,
    });
  },

  /**
   * Refresh access token
   */
  refreshToken: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }>> => {
    return post(ENDPOINTS.AUTH.REFRESH, undefined, {
      silent: true, // Don't show errors for token refresh
      ...options,
    });
  },

  /**
   * Google OAuth - Redirect to Google login
   */
  googleLogin: (): void => {
    window.location.href = `${API_BASE_URL}${ENDPOINTS.AUTH.GOOGLE}`;
  },
};

