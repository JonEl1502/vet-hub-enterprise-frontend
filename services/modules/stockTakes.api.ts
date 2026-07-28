/**
 * Stock takes — physical counts (migration 130).
 * DRAFT while shelves are walked; COMPLETED posts the variances in one go.
 */
import { get, post, put } from '../api/client';
import { ApiResponse } from '../api/types';

export interface StockTakeLine {
  id: string;
  inventoryItemId: string;
  name: string | null;
  sku: string | null;
  unit: string | null;
  category: string | null;
  expectedQty: number;
  /** null = not counted yet. Distinct from 0 ("counted, none there"). */
  countedQty: number | null;
  variance: number | null;
  notes: string | null;
}

export interface StockTake {
  id: string;
  clinicId: string;
  reference: string | null;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED' | string;
  category: string | null;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  items: StockTakeLine[];
  totalLines: number;
  countedLines: number;
  varianceLines: number;
}

const BASE = '/stock-takes';

export const stockTakesAPI = {
  list: (): Promise<ApiResponse<{ stockTakes: StockTake[] }>> =>
    get(BASE, { cache: false }),

  getById: (id: string): Promise<ApiResponse<{ stockTake: StockTake }>> =>
    get(`${BASE}/${id}`, { cache: false }),

  create: (data: { category?: string; notes?: string } = {}): Promise<ApiResponse<{ stockTake: StockTake }>> =>
    post(BASE, data, { showError: true }),

  saveCounts: (
    id: string,
    lines: Array<{ itemId: string; countedQty: number | null; notes?: string }>,
  ): Promise<ApiResponse<{ stockTake: StockTake }>> =>
    put(`${BASE}/${id}/counts`, { lines }, { showError: true }),

  complete: (id: string): Promise<ApiResponse<{ stockTake: StockTake }>> =>
    post(`${BASE}/${id}/complete`, {}, { showError: true }),

  cancel: (id: string): Promise<ApiResponse<{ ok: boolean }>> =>
    post(`${BASE}/${id}/cancel`, {}, { showError: true }),
};

export default stockTakesAPI;
