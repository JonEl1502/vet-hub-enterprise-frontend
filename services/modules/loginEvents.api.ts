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
  city: string | null;
  /**
   * ⚠️ The CENTROID of the IP's city/region — NOT where the person was. Present
   * for impossible-travel detection only; do not render it as a location or as
   * a pin on a map. See backend migration 251.
   */
  latitude: number | null;
  longitude: number | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null; role: string } | null;
}

/** Two sign-ins too far apart, too close in time. A prompt to look, not a verdict. */
export interface ImpossibleTravel {
  userId: string;
  email: string;
  fromPlace: string;
  toPlace: string;
  fromIp: string | null;
  toIp: string | null;
  km: number;
  minutesApart: number;
  impliedKmh: number;
  at: string;
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

  adminImpossibleTravel: (
    hours = 168,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ hits: ImpossibleTravel[] }>> =>
    get(`/admin/login-events/impossible-travel?hours=${hours}`, { cache: false, ...options }),
};

export default loginEventsAPI;
