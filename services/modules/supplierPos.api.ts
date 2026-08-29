import { get, post } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { ApiResponse, RequestOptions } from '../api/types';

/**
 * The supplier till.
 *
 * ⚠️ NOTHING HERE ADDS UP MONEY. Every total the POS shows comes from
 * `previewSale` or `createSale`; the client only ever sends product ids and
 * quantities. If a total is ever computed in the browser, the number the
 * cashier reads and the number the customer is charged can drift apart.
 */

export type PosPaymentMethod = 'CASH' | 'MPESA' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT';
export type PosSaleStatus = 'DRAFT' | 'PENDING_PAYMENT' | 'COMPLETED' | 'VOIDED';

export interface PosProduct {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  sku: string;
  barcode?: string | null;
  price: number;
  currency: string;
  unit: string;
  packSize?: number | null;
  imageUrl?: string | null;
  manufacturer?: string | null;
  binLocation?: string | null;
  stock: number;
  lowStockThreshold: number;
  inStock: boolean;
  isLowStock: boolean;
  sellable: boolean;
}

/** The flags behind the smart tabs. Keyed by product id. */
export interface PosProductStat {
  id: string;
  sold: number;
  bestSeller: boolean;
  lowStock: boolean;
  outOfStock: boolean;
  neverSold: boolean;
  /** It sells AND it is nearly gone — the pair that actually costs money. */
  starved: boolean;
}

export interface PosTill {
  userId: string;
  supplierId: string;
  supplierRole: 'OWNER' | 'MANAGER' | 'SALES' | 'CASHIER' | 'DELIVERY_DRIVER';
  /** Non-null means this person sells from one branch and cannot switch. */
  boundBranchId: string | null;
  canOverride: boolean;
}

export interface PosBranch {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  currency: string;
}

export interface PosShopBrand {
  id: string;
  name: string;
  currency: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export interface PosLineInput {
  supplierProductId: string;
  quantity: number;
  discount?: number;
  unitPriceOverride?: number;
}

export interface PosPreviewLine {
  supplierProductId: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  available: number;
  /** The till greys the line and refuses to tender while this is true. */
  insufficientStock: boolean;
}

export interface PosPreview {
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  items: PosPreviewLine[];
}

export interface PosPaymentInput {
  method: PosPaymentMethod;
  amount: number;
  tendered?: number;
  reference?: string;
}

export interface PosSaleSummary {
  id: string;
  saleNumber: string;
  status: PosSaleStatus;
  total: number;
  currency: string;
  customerName?: string | null;
  customerPhone?: string | null;
  itemCount: number;
  methods: PosPaymentMethod[];
  branch?: { id: string; name: string } | null;
  cashier?: string | null;
  createdAt: string;
  completedAt?: string | null;
  voidedAt?: string | null;
}

export interface PosShift {
  from: string;
  to: string;
  currency: string;
  salesCount: number;
  voidedCount: number;
  gross: number;
  byMethod: Partial<Record<PosPaymentMethod, number>>;
}

export const supplierPosAPI = {
  /**
   * Who is on the till, and where they may sell. The FIRST call the POS makes —
   * it settles the branch before anything asks for a catalogue.
   */
  whoAmI: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ till: PosTill; branches: { supplier: PosShopBrand; branches: PosBranch[]; canSwitchBranch: boolean } }>> =>
    get(ENDPOINTS.SUPPLIER_POS.ME, options),

  getCatalog: async (
    branchId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ products: PosProduct[]; branchId: string }>> =>
    get(`${ENDPOINTS.SUPPLIER_POS.CATALOG}?branchId=${branchId}`, options),

  getCategories: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ categories: { id: string; name: string; count: number }[] }>> =>
    get(ENDPOINTS.SUPPLIER_POS.CATEGORIES, { cache: true, cacheDuration: 5 * 60 * 1000, ...options }),

  getProductStats: async (
    branchId: string,
    days = 30,
    options?: RequestOptions
  ): Promise<ApiResponse<{ stats: PosProductStat[]; days: number }>> =>
    get(`${ENDPOINTS.SUPPLIER_POS.PRODUCT_STATS}?branchId=${branchId}&days=${days}`, options),

  /**
   * Barcode or SKU. The hottest path at the counter — a scanner is a keyboard
   * that types the code and presses Enter, so this runs on every scan.
   */
  scan: async (
    code: string,
    branchId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ product: { id: string; name: string; price: number; unit: string; stock: number; sellable: boolean } }>> =>
    get(`${ENDPOINTS.SUPPLIER_POS.SCAN(code)}?branchId=${branchId}`, options),

  /** Re-price the basket. Called on every cart change; never cached. */
  previewSale: async (
    branchId: string,
    items: PosLineInput[],
    options?: RequestOptions
  ): Promise<ApiResponse<PosPreview>> =>
    post(ENDPOINTS.SUPPLIER_POS.PREVIEW, { branchId, items }, options),

  createSale: async (
    payload: {
      branchId: string;
      items: PosLineInput[];
      payments: PosPaymentInput[];
      customerName?: string;
      customerPhone?: string;
      notes?: string;
      allowNegativeStock?: boolean;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<{ sale: any }>> =>
    post(ENDPOINTS.SUPPLIER_POS.SALES, payload, options),

  voidSale: async (
    saleId: string,
    reason: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ sale: any }>> =>
    post(ENDPOINTS.SUPPLIER_POS.VOID(saleId), { reason }, options),

  listSales: async (
    params: { date?: 'today'; mine?: boolean; branchId?: string; limit?: number } = {},
    options?: RequestOptions
  ): Promise<ApiResponse<{ sales: PosSaleSummary[] }>> => {
    const q = new URLSearchParams();
    if (params.date) q.set('date', params.date);
    if (params.mine) q.set('mine', 'true');
    if (params.branchId) q.set('branchId', params.branchId);
    if (params.limit) q.set('limit', String(params.limit));
    return get(`${ENDPOINTS.SUPPLIER_POS.SALES}?${q.toString()}`, options);
  },

  getSale: async (saleId: string, options?: RequestOptions): Promise<ApiResponse<{ sale: any }>> =>
    get(ENDPOINTS.SUPPLIER_POS.SALE_BY_ID(saleId), options),

  getShift: async (
    branchId: string,
    mine = false,
    options?: RequestOptions
  ): Promise<ApiResponse<{ summary: PosShift; scope: 'me' | 'branch' }>> =>
    get(`${ENDPOINTS.SUPPLIER_POS.SHIFT}?branchId=${branchId}${mine ? '&mine=true' : ''}`, options),
};
