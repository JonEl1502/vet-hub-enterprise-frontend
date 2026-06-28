import { post } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export interface PetshopSaleItem { inventoryItemId: string | number; quantity: number; unitPrice?: number }
export interface PetshopWalkIn { firstName: string; surname?: string; title?: string; phone?: string; email?: string }

export interface PetshopSalePayload {
  clientId?: string | number;
  walkInData?: PetshopWalkIn;
  items: PetshopSaleItem[];
  paymentMethod: string;
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: number;
}

export interface PetshopSaleResult {
  receiptNumber: string;
  clientId: string | null;
  subtotal: number;
  discount: number;
  total: number;
  transaction: { id: string; amount: number; method: string; status: string; createdAt: string };
  receipt: { id: string; receiptNumber: string; subtotal: number; discount: number; total: number; paymentMethod: string; createdAt: string };
  lines: { inventoryItemId: string; name: string; quantity: number; unitPrice: number; lineTotal: number }[];
}

export const petshopAPI = {
  checkout: async (data: PetshopSalePayload, options?: RequestOptions): Promise<ApiResponse<PetshopSaleResult>> =>
    post(ENDPOINTS.PETSHOP.CHECKOUT, data, { showError: true, ...options }),
};
