/**
 * 250 — the login audit trail.
 *
 * Two audiences, two endpoints, deliberately not one parameterised call:
 *   • `myHistory()` reads YOUR OWN sign-ins and takes no user argument, so it
 *     cannot become a way to look up where a colleague logs in from.
 *   • `adminList()` / `adminSuspicious()` are SUPER_ADMIN only.
 */
import { get } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * ⚠️ `NO_SUCH_USER` vs `BAD_PASSWORD` is the distinction the login RESPONSE
 * deliberately hides, so it cannot be used to discover which emails exist.
 * It appears here only on admin-scoped reads.
 */
export type LoginOutcome = 'SUCCESS' | 'BAD_PASSWORD' | 'NO_SUCH_USER' | 'GOOGLE_ONLY' | 'SUSPENDED';
export type LoginMethod = 'PASSWORD' | 'GOOGLE' | 'OTP' | 'PORTAL';

export interface LoginEvent {
  id: string;
  userId: string | null;
  email: string;
  outcome: LoginOutcome;
  method: LoginMethod;
  ipAddress: string | null;
  countryCode: string | null;
  countryName: string | null;
  /** Reserved — Cloudflare's free plan sends no city, so this is null today. */
  city: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null; role: string } | null;
}

export interface SuspiciousOrigin {
  ip: string;
  country: string | null;
  failures: number;
  accountsTargeted: number;
  lastAt: string;
}

export const loginEventsAPI = {
  myHistory: (limit = 50, options?: RequestOptions): Promise<ApiResponse<{ events: LoginEvent[] }>> =>
    get(`/auth/me/login-history?limit=${limit}`, { cache: false, ...options }),

  adminList: (
    params: { limit?: number; failedOnly?: boolean; email?: string; ip?: string; outcome?: string } = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<{ events: LoginEvent[] }>> => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.failedOnly) q.set('failedOnly', 'true');
    if (params.email) q.set('email', params.email);
    if (params.ip) q.set('ip', params.ip);
    if (params.outcome) q.set('outcome', params.outcome);
    return get(`/admin/login-events?${q.toString()}`, { cache: false, ...options });
  },

  adminSuspicious: (
    hours = 24,
    minFailures = 5,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ offenders: SuspiciousOrigin[] }>> =>
    get(`/admin/login-events/suspicious?hours=${hours}&minFailures=${minFailures}`, { cache: false, ...options }),
};

export default loginEventsAPI;
