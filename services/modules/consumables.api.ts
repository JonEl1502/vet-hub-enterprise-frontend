import { get, post, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { InventoryForm } from './inventory.api';

// A consumable/medication used on an appointment (gloves, syringes, tablets,
// ml from a bottle, …). Billable usages add an itemized charge; non-billable
// only subtract stock.
export interface AppointmentConsumable {
  id: string;
  appointmentId: string;
  taskId?: string;
  inventoryItemId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  billable: boolean;
  batchNumber: string | null;
  expiryDate: string | null;
  notes: string | null;
  isDeducted: boolean;
  createdAt: string;
  inventoryItem: {
    id: string; name: string; sku: string; category: string; unit: string; form?: InventoryForm; availableQuantity: number;
    // Batch → supplier/manufacturer backtrace context (migration 084).
    manufacturer?: string | null; imageUrl?: string | null; supplierName?: string | null;
  };
  task?: { id: string; name: string; category: string } | null;
}

export interface LogConsumablePayload {
  inventoryItemId: string | number;
  quantity: number;
  billable?: boolean;
  unitPrice?: number;
  notes?: string;
}

export const consumablesAPI = {
  list: async (appointmentId: string | number, options?: RequestOptions): Promise<ApiResponse<AppointmentConsumable[]>> =>
    get(ENDPOINTS.CONSUMABLES.FOR_APPOINTMENT(appointmentId), { cache: false, ...options }),

  log: async (appointmentId: string | number, data: LogConsumablePayload, options?: RequestOptions): Promise<ApiResponse<{ id: string; taskId: string; billable: boolean; lineCost: number }>> =>
    post(ENDPOINTS.CONSUMABLES.FOR_APPOINTMENT(appointmentId), data, { showError: true, ...options }),

  update: async (id: string | number, data: { billable?: boolean; unitPrice?: number }, options?: RequestOptions): Promise<ApiResponse<{ id: string; billable: boolean; lineCost: number }>> =>
    patch(ENDPOINTS.CONSUMABLES.BY_ID(id), data, { showError: true, ...options }),

  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(ENDPOINTS.CONSUMABLES.BY_ID(id), { showError: true, ...options }),
};
