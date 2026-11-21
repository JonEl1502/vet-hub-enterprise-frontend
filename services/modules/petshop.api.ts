import { post, get } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export interface PetshopSaleItem { inventoryItemId: string | number; quantity: number; unitPrice?: number }
export interface PetshopWalkIn { firstName: string; surname?: string; title?: string; phone?: string; email?: string }

export interface PetshopSalePayload {
  clientId?: string | number;
  walkInData?: PetshopWalkIn;
  items: PetshopSaleItem[];
  paymentMethod: string;
  walletId?: string | number;
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: number;
  /** Cash handed over (CASH only) — the receipt shows the change. */
  tendered?: number;
  /** M-Pesa code or card slip number. */
  reference?: string;
}

export interface PetshopSaleResult {
  receiptNumber: string;
  clientId: string | null;
  tendered?: number | null;
  change?: number | null;
  reference?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  transaction: { id: string; amount: number; method: string; status: string; createdAt: string };
  receipt: { id: string; receiptNumber: string; subtotal: number; discount: number; total: number; paymentMethod: string; createdAt: string };
  lines: { inventoryItemId: string; name: string; quantity: number; unitPrice: number; lineTotal: number }[];
}

// A client's own Pet Shop purchase history (314) — separate ledger from
// visit billing, same shape as a checkout result's lines/totals.
export interface PetshopSaleRecord {
  id: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
  lines: { id: string; name: string; quantity: number; unitPrice: number; lineTotal: number }[];
}

export const petshopAPI = {
  checkout: async (data: PetshopSalePayload, options?: RequestOptions): Promise<ApiResponse<PetshopSaleResult>> =>
    post(ENDPOINTS.PETSHOP.CHECKOUT, data, { showError: true, ...options }),
  /** Units sold per item over `days` — the till's Best sellers / Never sold tabs. */
  stats: async (days = 30, options?: RequestOptions): Promise<ApiResponse<{ stats: { id: string; sold: number }[]; days: number }>> =>
    get(`${ENDPOINTS.PETSHOP.STATS}?days=${days}`, options),
  clientSales: async (clientId: string | number, options?: RequestOptions): Promise<ApiResponse<PetshopSaleRecord[]>> =>
    get(ENDPOINTS.PETSHOP.CLIENT_SALES(clientId), options),
};
