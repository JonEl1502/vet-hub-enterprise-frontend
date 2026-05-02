/**
 * FX API module — talks to /api/v1/fx/* on the backend.
 *
 * Most callers should use the `useFx()` hook from contexts/FxContext rather
 * than calling these directly — the context fetches once at session start
 * and converts in-memory thereafter.
 */

import { get, post } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { ApiResponse, RequestOptions } from '../api/types';

export interface FxRatesPayload {
  base: string;
  /** Map of currency code → rate (1 unit of base = N units of target). */
  rates: Record<string, number>;
  fetchedAt: string;
  source: 'provider' | 'cache' | 'stale' | 'fallback';
}

export interface ConversionResult {
  amount: number;
  from: string;
  to: string;
  /** Null when conversion isn't possible (unknown currency). */
  converted: number | null;
  rate: number | null;
  source: FxRatesPayload['source'];
}

export const fxAPI = {
  /** Fetch the rates table re-based to `base` (default USD). */
  getRates(base?: string, options?: RequestOptions) {
    const url = base ? `${ENDPOINTS.FX.RATES}?base=${encodeURIComponent(base)}` : ENDPOINTS.FX.RATES;
    return get<ApiResponse<FxRatesPayload>>(url, options);
  },

  /** Single-shot conversion via the server. Prefer the in-memory hook for hot paths. */
  convert(amount: number, from: string, to: string, options?: RequestOptions) {
    return post<ApiResponse<ConversionResult>>(ENDPOINTS.FX.CONVERT, { amount, from, to }, options);
  },
};

export default fxAPI;
