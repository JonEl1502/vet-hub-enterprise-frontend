/**
 * Inter-clinic stock transfers (migration 129).
 * A transfer is executed server-side in one transaction; the client just
 * describes what should move.
 */
import { get, post } from '../api/client';
import { ApiResponse } from '../api/types';

export interface StockTransferLine {
  id: string;
  sourceItemId: string;
  destItemId: string | null;
  name: string | null;
  sku: string | null;
  unit: string | null;
  quantity: number;
  batchNumber: string | null;
  expiryDate: string | null;
  unitCost: number | null;
}

export interface StockTransfer {
  id: string;
  fromClinicId: string;
  fromClinicName: string | null;
  toClinicId: string;
  toClinicName: string | null;
  status: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  items: StockTransferLine[];
  itemCount: number;
}

export interface CreateTransferInput {
  fromClinicId: string;
  toClinicId: string;
  notes?: string;
  items: Array<{ sourceItemId: string; quantity: number; batchNumber?: string | null }>;
}

const BASE = '/stock-transfers';

export const stockTransfersAPI = {
  list: (): Promise<ApiResponse<{ transfers: StockTransfer[] }>> =>
    get(BASE, { cache: false }),

  getById: (id: string): Promise<ApiResponse<{ transfer: StockTransfer }>> =>
    get(`${BASE}/${id}`, { cache: false }),

  create: (data: CreateTransferInput): Promise<ApiResponse<{ transfer: StockTransfer }>> =>
    post(BASE, data, { showError: true }),
};

export default stockTransfersAPI;
