import { get } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

export interface PlatformMetrics {
  clinics: {
    total: number;
    active: number;
    inactive: number;
    verified?: number | null;
    pending?: number | null;
    top?: Array<{ clinicId: string; clinicName: string; clientCount: number }>;
    byCountry: Array<{ countryCode: string | null; count: number }>;
    byCity: Array<{ city: string | null; count: number }>;
    byRegion: Array<{ region: string | null; count: number }>;
  };
  totals?: { clients: number; pets: number };
  suppliers: { total: number; active: number };
  freelancers: { total: number; active: number };
  subscriptions: {
    activeCount: number;
    totalEverPaid: number;
    mrr?: number;
    byPlan: Array<{
      packageId: string;
      packageName: string;
      tier: number;
      activeCount: number;
      lifetimeCount: number;
      lifetimeRevenue: number;
    }>;
    recent: Array<{
      id: string;
      clinicId: string;
      clinicName: string;
      packageName: string;
      amountPaid: number;
      startedAt: string;
    }>;
  };
}

export interface SignupsTimeseriesRow {
  period: string;
  group: null;
  total: number; // signup count for that period (valueOf is always 1 per clinic)
  count: number;
}

const BASE = '/admin/platform-metrics';

export const platformMetricsAPI = {
  get: (options?: RequestOptions): Promise<ApiResponse<PlatformMetrics>> =>
    get(BASE, { cache: false, ...options }),

  /** Clinic signups over time, bucketed (2026-09-27, dashboard polish). */
  signupsTimeseries: (
    opts: { from?: string; to?: string; bucket?: 'day' | 'week' | 'month' | 'year' } = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<SignupsTimeseriesRow[]>> => {
    const q = new URLSearchParams();
    if (opts.from) q.set('from', opts.from);
    if (opts.to) q.set('to', opts.to);
    if (opts.bucket) q.set('bucket', opts.bucket);
    const qs = q.toString();
    return get(`${BASE}/signups-timeseries${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },
};
