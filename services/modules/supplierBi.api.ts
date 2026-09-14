import { get } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

/**
 * 298 — supplier business intelligence.
 *
 * ⚠️ Every headline figure arrives with its own prior-period delta, computed
 * server-side against an equally long window immediately before. Comparing a
 * part-month against a whole one is the classic dashboard lie, and doing the
 * comparison here rather than in the component is what stops each screen
 * inventing its own version of it.
 */

export interface BiProduct {
  productId: string | null;
  name: string;
  sku: string;
  category: string | null;
  units: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}

export interface SupplierBiReport {
  range: { from: string; to: string; prevFrom: string; prevTo: string; days: number };
  headline: {
    revenue: number;
    /** Percent change vs the previous window. `null` = no base to compare to. */
    revenueDelta: number | null;
    counterRevenue: number;
    wholesaleRevenue: number;
    /** ⚠️ Counter only — a purchase order carries no cost snapshot. */
    grossProfit: number;
    grossProfitDelta: number | null;
    marginPct: number;
    transactions: number;
    transactionsDelta: number | null;
    avgOrderValue: number;
    avgOrderValueDelta: number | null;
    units: number;
  };
  series: {
    grain: 'day' | 'month';
    points: Array<{ bucket: string; counter: number; wholesale: number; total: number }>;
  };
  products: { byRevenue: BiProduct[]; byMargin: BiProduct[]; workingHardest: BiProduct[] };
  customers: {
    top: Array<{ clinicId: string; name: string; revenue: number; orders: number; lastOrderAt: string | null }>;
    quiet: Array<{
      clinicId: string; name: string; lifetime: number; orders: number;
      lastOrderAt: string; daysSince: number; usualGapDays: number;
    }>;
  };
  stock: {
    valuation: { atCost: number; atRetail: number; skus: number; units: number };
    dead: Array<{ productId: string; name: string; sku: string; onHand: number; tiedUp: number }>;
    runningOut: Array<{ productId: string; name: string; sku: string; onHand: number; perDay: number; daysOfCover: number }>;
    expiring: Array<{
      productId: string; name: string; batchNumber: string; expiryDate: string;
      quantityRemaining: number; value: number; daysLeft: number;
    }>;
  };
  branches: Array<{ branchId: string; name: string; revenue: number; margin: number; marginPct: number; sales: number }>;
  categories: Array<{ category: string; revenue: number; margin: number; marginPct: number; units: number }>;
}

export const supplierBiAPI = {
  report: (
    params: { from?: string; to?: string; branchIds?: string[] } = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<SupplierBiReport>> => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.branchIds?.length) qs.set('branchIds', params.branchIds.join(','));
    const q = qs.toString();
    // ⚠️ `cache: false` — a report read five minutes after a sale that is not
    // in it is worse than a slow one.
    return get(`/supplier-bi${q ? `?${q}` : ''}`, { cache: false, ...options });
  },
};

export default supplierBiAPI;
