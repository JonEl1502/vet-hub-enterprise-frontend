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

export const summariesAPI = {
  /** Aggregated totals + daily series for the requested scope. */
  get: async (
    opts: GetSummariesOptions = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<SummaryResponse>> =>
    get(`${ENDPOINTS.SUMMARIES.BASE}${buildQuery({ ...opts, breakdown: false })}`, { cache: true, ...options }),

  /** Per-scope rows so the dashboard can render a per-clinic table. */
  getBreakdown: async (
    opts: GetSummariesOptions = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<SummaryBreakdownResponse>> =>
    get(`${ENDPOINTS.SUMMARIES.BASE}${buildQuery({ ...opts, breakdown: true })}`, { cache: true, ...options }),
};
