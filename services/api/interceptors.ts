/**
 * Axios Interceptors for Request/Response Handling
 */

import { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { convertBigIntToString } from '../utils/transformers';
import { handleApiError, isAuthError } from '../utils/errorHandler';
import { toast } from '../utils/toast';
import { dialog } from '../utils/dialog';
import { RequestOptions } from './types';

/**
 * When the user deliberately logs out we clear the token synchronously, which
 * makes any in-flight / background request 401. Without this guard those stray
 * 401s would trip the "session expired" redirect below — a hard page reload
 * that looks like the app refreshing on logout. AuthContext flips this on
 * around clearAuthState() and off shortly after.
 */
let loggingOut = false;
export const setLoggingOut = (value: boolean): void => {
  loggingOut = value;
};

/**
 * Single-flight access-token refresh. When several requests 401 at once
 * (typical on returning to the app after the access token expired), they all
 * await ONE /auth/refresh call; each then retries with the new token. Only if
 * the refresh itself fails does the session-expired redirect fire.
 */
let refreshInFlight: Promise<string | null> | null = null;
const refreshAccessToken = (axiosInstance: AxiosInstance): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const stored = localStorage.getItem('authTokens');
        const refreshToken = stored ? JSON.parse(stored)?.refreshToken : null;
        if (!refreshToken) return null;
        const res = await axiosInstance.post('/auth/refresh', { refreshToken }, {
          // Flag read by the 401 handler so a failing refresh can't recurse.
          _isRefreshCall: true,
        } as any);
        const tokens = (res.data as any)?.data?.tokens || (res.data as any)?.tokens;
        if (!tokens?.accessToken) return null;
        localStorage.setItem('authTokens', JSON.stringify(tokens));
        localStorage.setItem('authToken', tokens.accessToken);
        return tokens.accessToken as string;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
};

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

        // Management-page override: while an admin is on a management page, the
        // "Managing" switcher narrows requests to a SINGLE clinic/supplier
        // (vethub_manage_*_id) without touching the sidebar multi-select. Send
        // it as the singular header and drop the plural so it wins.
        const manageClinic = localStorage.getItem('vethub_manage_clinic_id');
        if (manageClinic) {
          config.headers['X-Clinic-Id'] = manageClinic;
          delete config.headers['X-Clinic-Ids'];
        }
        const manageSupplier = localStorage.getItem('vethub_manage_supplier_id');
        if (manageSupplier) {
          config.headers['X-Supplier-Id'] = manageSupplier;
          delete config.headers['X-Supplier-Ids'];
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

      // The refresh call failing is handled by its awaiting callers (they fall
      // through to the session-expired path) — no toast/redirect of its own.
      if ((error.config as any)?._isRefreshCall) {
        return Promise.reject(error);
      }

      // Handle authentication errors (401)
      if (isAuthError(error)) {
        const reqUrl = error.config?.url || '';
        // A 401 from the login/signup request itself is a failed *attempt*
        // (bad credentials, deactivated clinic/supplier) — surface the real
        // server message inline and do NOT clear the session or reload the page.
        const isAuthAttempt = /\/(auth|portal)\/(login|signup)/.test(reqUrl);
        const serverMessage = (error.response?.data as any)?.message as string | undefined;

        // Deliberate logout in progress — swallow racing 401s silently so we
        // don't fire a spurious "session expired" toast or hard redirect.
        if (loggingOut) {
          return Promise.reject(error);
        }

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

        // Expired access token? Refresh + retry ONCE before treating it as a
        // dead session — returning users were bounced to /login on every load
        // because nothing ever exercised the refresh token.
        const original: any = error.config;
        if (original && !original._isRefreshCall && !original._retriedAfterRefresh) {
          const newToken = await refreshAccessToken(axiosInstance);
          if (newToken) {
            original._retriedAfterRefresh = true;
            original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
            return axiosInstance.request(original);
          }
        }

        // Otherwise this is an authenticated request being rejected. If we're
        // already sitting on a public auth page (e.g. /login), the user simply
        // isn't logged in yet — a background 401 (staff-scope/me) is expected,
        // not a session expiry. Swallow it silently: no "session expired" toast
        // and, critically, no redirect to /login (which would hard-reload the
        // page, re-fire the request and loop forever).
        // '/' is the marketing landing page — the logged-in app lives under
        // /app/*, so a 401 here is just a stale token from an old session, not
        // a live session expiring. Without it, visiting the landing page with
        // leftover tokens bounced to /login after ~1.5s.
        const PUBLIC_AUTH_PATHS = [
          '/', '/login', '/signup', '/supplier-signup',
          '/forgot-password', '/reset-password',
          '/client/login', '/client/signup',
        ];
        const onPublicAuth = PUBLIC_AUTH_PATHS.includes(window.location.pathname);
        if (onPublicAuth) {
          localStorage.removeItem('authToken');
          return Promise.reject(error);
        }

        // A genuine mid-session expiry/suspension on a protected page — clear
        // and redirect, showing the server's reason (e.g. "Your clinic has been
        // deactivated").
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

      // Surface the error if enabled and not silent. Permission errors (403) go
      // to the branded VetHub modal (dialog.alert) instead of a transient toast.
      if (!requestOptions?.silent && requestOptions?.showError !== false) {
        if (error.response?.status === 403) {
          dialog.alert({
            title: 'Permission needed',
            message: apiError.message || "You don't have permission to do that. Ask a clinic owner or manager to grant it.",
            variant: 'warning',
            confirmLabel: 'Got it',
          });
        } else {
          toast.error(apiError.message);
        }
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

