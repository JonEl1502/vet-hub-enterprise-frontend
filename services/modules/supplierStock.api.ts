import { get, post, put, del } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

/**
 * The supplier's stockroom — the counterpart to the clinic's inventory API.
 *
 * ⚠️ Quantities here are per BRANCH. `SupplierProduct.stockQty` is a rollup the
 * marketplace reads; nothing in this module should be used to display "how much
 * do we have" without saying at which branch.
 */

export type SupplierStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type SupplierSourceType = 'SUPPLIER' | 'MERCHANDISER' | 'MANUFACTURER';
export type StockMovementType =
  | 'USED_IN_APPOINTMENT' | 'SOLD' | 'RESTOCKED' | 'ADJUSTED' | 'EXPIRED'
  | 'DAMAGED' | 'RETURNED' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'SOLD_AT_POS';

export interface SupplierStockRow {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  category: string;
  unit: string;
  sellPrice: number;
  costPrice: number;
  manufacturer?: string | null;
  quantity: number;
  reorderPoint: number;
  maxLevel?: number | null;
  binLocation?: string | null;
  defaultSource?: { id: string; name: string; type: SupplierSourceType } | null;
  batchCount: number;
  nextExpiry?: string | null;
  status: SupplierStockStatus;
  expiringSoon: boolean;
  expired: boolean;
}

export interface SupplierMovement {
  id: string;
  productName: string;
  sku: string;
  unit: string;
  branch: string;
  movementType: StockMovementType;
  quantity: number;
  quantityBefore: number | null;
  quantityAfter: number | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  costPrice?: number | null;
  notes?: string | null;
  saleNumber?: string | null;
  by?: string | null;
  createdAt: string;
}

export interface SupplierBatch {
  id: string;
  productName: string;
  sku: string;
  unit: string;
  branch: string;
  batchNumber: string;
  expiryDate?: string | null;
  quantityReceived: number;
  quantityRemaining: number;
  costPrice?: number | null;
  source?: { name: string; type: SupplierSourceType } | null;
  receivedAt: string;
  expired: boolean;
  daysToExpiry: number | null;
}

export interface SupplierSource {
  id: string;
  name: string;
  type: SupplierSourceType;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  leadTimeDays?: number | null;
  outstandingBalance: number;
  notes?: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
}

export interface SupplierProductSource {
  id: string;
  sourceId: string;
  name: string;
  type: SupplierSourceType;
  isDefault: boolean;
  costPrice: number | null;
  costBasis: string;
  costInput: number | null;
  costPackQty: number | null;
  sourceSku?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const supplierStockAPI = {
  getStock: (
    branchId: string,
    filters: { search?: string; category?: string } = {},
    options?: RequestOptions
  ): Promise<ApiResponse<{ stock: SupplierStockRow[]; branchId: string }>> =>
    get(`/supplier-stock${qs({ branchId, ...filters })}`, options),

  getMovements: (
    filters: { branchId?: string; productId?: string; type?: StockMovementType; limit?: number } = {},
    options?: RequestOptions
  ): Promise<ApiResponse<{ movements: SupplierMovement[] }>> =>
    get(`/supplier-stock/movements${qs(filters)}`, options),

  getBatches: (
    filters: { branchId?: string; expiringInDays?: number } = {},
    options?: RequestOptions
  ): Promise<ApiResponse<{ batches: SupplierBatch[] }>> =>
    get(`/supplier-stock/batches${qs(filters)}`, options),

  getReorder: (branchId: string, options?: RequestOptions):
    Promise<ApiResponse<{ items: (SupplierStockRow & { suggestedOrder: number })[] }>> =>
    get(`/supplier-stock/reorder${qs({ branchId })}`, options),

  receive: (
    payload: {
      branchId: string;
      sourceId?: string;
      notes?: string;
      items: { supplierProductId: string; quantity: number; costPrice?: number; batchNumber?: string; expiryDate?: string }[];
    },
    options?: RequestOptions
  ): Promise<ApiResponse<any>> => post('/supplier-stock/receive', payload, options),

  adjust: (
    payload: {
      branchId: string;
      supplierProductId: string;
      delta: number;
      reason: string;
      movementType?: StockMovementType;
      allowNegative?: boolean;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<any>> => post('/supplier-stock/adjust', payload, options),

  transfer: (
    payload: { fromBranchId: string; toBranchId: string; supplierProductId: string; quantity: number; notes?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<any>> => post('/supplier-stock/transfer', payload, options),

  stockTake: (
    payload: { branchId: string; counts: { supplierProductId: string; counted: number }[]; notes?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<{ changes: { productId: string; was: number; now: number; delta: number }[] }>> =>
    post('/supplier-stock/stock-take', payload, options),

  setSettings: (
    productId: string,
    payload: { branchId: string; reorderPoint?: number | null; maxLevel?: number | null; binLocation?: string | null },
    options?: RequestOptions
  ): Promise<ApiResponse<any>> => put(`/supplier-stock/${productId}/settings`, payload, options),

  // ── Sources ─────────────────────────────────────────────────────────────
  listSources: (
    filters: { type?: SupplierSourceType; includeInactive?: boolean } = {},
    options?: RequestOptions
  ): Promise<ApiResponse<{ sources: SupplierSource[] }>> =>
    get(`/supplier-stock/sources/all${qs(filters)}`, options),

  createSource: (payload: Partial<SupplierSource>, options?: RequestOptions): Promise<ApiResponse<any>> =>
    post('/supplier-stock/sources', payload, options),

  updateSource: (id: string, payload: Partial<SupplierSource>, options?: RequestOptions): Promise<ApiResponse<any>> =>
    put(`/supplier-stock/sources/${id}`, payload, options),

  deleteSource: (id: string, options?: RequestOptions): Promise<ApiResponse<{ deactivated: boolean; reason?: string }>> =>
    del(`/supplier-stock/sources/${id}`, options),

  listProductSources: (productId: string, options?: RequestOptions):
    Promise<ApiResponse<{ sources: SupplierProductSource[] }>> =>
    get(`/supplier-stock/${productId}/sources`, options),

  linkProductSource: (
    productId: string,
    payload: {
      sourceId: string; costInput?: number | null; costBasis?: string;
      costPackQty?: number | null; sourceSku?: string; leadTimeDays?: number | null;
      notes?: string; isDefault?: boolean;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<any>> => post(`/supplier-stock/${productId}/sources`, payload, options),

  unlinkProductSource: (productId: string, sourceId: string, options?: RequestOptions): Promise<ApiResponse<any>> =>
    del(`/supplier-stock/${productId}/sources/${sourceId}`, options),
};
