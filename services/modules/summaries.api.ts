/**
 * Summaries API — cached dashboard aggregates served from summary_snapshots.
 * Use this on any page that needs revenue / counts / new-clients style numbers
 * for the active scope. Returns either combined totals or a per-scope breakdown.
 */

import { get } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { ApiResponse, RequestOptions } from '../api/types';

export type SummaryScope = 'CLINIC' | 'SUPPLIER' | 'PLATFORM';

export interface SummaryTotals {
  revenue: number;
  expenses: number;
  netProfit: number;
  paidCount: number;
  unpaidCount: number;
  appointmentsTotal: number;
  appointmentsCompleted: number;
  newClients: number;
  newPatients: number;
  activePatients: number;
  lowStockItems: number;
  expiringInventory: number;
}

export interface SummarySeriesPoint {
  day: string; // YYYY-MM-DD
  revenue: number;
  expenses: number;
  netProfit: number;
  paidCount: number;
  unpaidCount: number;
  appointmentsTotal: number;
}

export interface SummaryResponse {
  totals: SummaryTotals;
  series: SummarySeriesPoint[];
}

export interface SummaryBreakdownRow extends SummaryResponse {
  scopeId: string;
  scopeName: string;
}

export interface SummaryBreakdownResponse {
  rows: SummaryBreakdownRow[];
}

export interface GetSummariesOptions {
  scope?: SummaryScope;
  scopeId?: string | number | null;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  breakdown?: boolean;
}

const buildQuery = (opts: GetSummariesOptions) => {
  const q = new URLSearchParams();
  if (opts.scope) q.set('scope', opts.scope);
  if (opts.scopeId !== undefined && opts.scopeId !== null) q.set('scopeId', String(opts.scopeId));
  if (opts.from) q.set('from', opts.from);
  if (opts.to) q.set('to', opts.to);
  if (opts.breakdown) q.set('breakdown', 'true');
  const s = q.toString();
  return s ? `?${s}` : '';
};

/** Live operational stats for one clinic over [from,to] — Clinic Statistics page. */
export interface ClinicStats {
  visits: number;
  appointments: number; // bookings
  reminders: number;
  newClients: number;
  newPatients: number;
  surgeries: number;
  boarding: number;     // created in range
  inpatient: number;    // created in range (onboarding)
  boardingActive: number;   // admitted now
  inpatientActive: number;  // admitted now
  transactions: number;
  revenue: number;
}

/** Finance BI splits for the Reports & Analytics dashboard. */
export interface FinanceBI {
  paymentMethods: { method: string; amount: number; count: number }[];
  revenueByCategory: { category: string; amount: number }[];
  topStaff: { userId: string; name: string; avatarUrl: string | null; revenue: number; visits: number; deltaPct: number | null }[];
  clientGrowth: { newClients: number; newClientsPrev: number; returningClients: number; lostClients: number; totalActiveClients: number };
  compare: { from: string; to: string };
}

export const summariesAPI = {
  /** Aggregated totals + daily series for the requested scope. */
  get: async (
    opts: GetSummariesOptions = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<SummaryResponse>> =>
    get(`${ENDPOINTS.SUMMARIES.BASE}${buildQuery({ ...opts, breakdown: false })}`, { cache: true, ...options }),

  /** Live clinic statistics over a date range (call twice to compare ranges). */
  clinicStats: async (
    opts: { scopeId: string | number; from?: string; to?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<ClinicStats>> => {
    const q = new URLSearchParams({ scopeId: String(opts.scopeId) });
    if (opts.from) q.set('from', opts.from);
    if (opts.to) q.set('to', opts.to);
    return get(`${ENDPOINTS.SUMMARIES.CLINIC_STATS}?${q.toString()}`, { cache: false, ...options });
  },

  /** Daily conversion pulse — visits done, booking→visit, reminder→visit, cross-sell. */
  conversions: async (
    // `start`/`end` are LOCAL YYYY-MM-DD (the dashboard day picker, 2026-08-04)
    // and replace the rolling `days` window server-side when both are given.
    opts: { scopeId: string | number; days?: number; start?: string; end?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{
    days: { date: string; visitsTotal: number; visitsDone: number; bookings: number; bookingsConverted: number; remindersDue: number; remindersConverted: number; remindersClosed: number; crossSell: number }[];
    totals: { visitsTotal: number; visitsDone: number; bookings: number; bookingsConverted: number; remindersDue: number; remindersConverted: number; remindersClosed: number; crossSell: number };
    crossSellPairs: Record<string, number>;
    /** What the payload actually covers — echoed back so the UI can label it. */
    window?: { start: string; end: string; days: number; explicit: boolean };
  }>> => {
    const q = new URLSearchParams({ scopeId: String(opts.scopeId) });
    if (opts.days) q.set('days', String(opts.days));
    if (opts.start && opts.end) { q.set('start', opts.start); q.set('end', opts.end); }
    return get(`${ENDPOINTS.SUMMARIES.CLINIC_STATS.replace('clinic-stats', 'conversions')}?${q.toString()}`, { cache: false, ...options });
  },

  /** Finance BI splits — payment methods, category revenue, staff revenue, client growth. */
  financeBI: async (
    opts: { scopeId: string | number; from?: string; to?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<FinanceBI>> => {
    const q = new URLSearchParams({ scopeId: String(opts.scopeId) });
    if (opts.from) q.set('from', opts.from);
    if (opts.to) q.set('to', opts.to);
    return get(`${ENDPOINTS.SUMMARIES.CLINIC_STATS.replace('clinic-stats', 'finance-bi')}?${q.toString()}`, { cache: false, ...options });
  },

  /** Per-scope rows so the dashboard can render a per-clinic table. */
  getBreakdown: async (
    opts: GetSummariesOptions = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<SummaryBreakdownResponse>> =>
    get(`${ENDPOINTS.SUMMARIES.BASE}${buildQuery({ ...opts, breakdown: true })}`, { cache: true, ...options }),
};
