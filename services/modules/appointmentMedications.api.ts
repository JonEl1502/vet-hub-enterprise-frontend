/**
 * ============================================================================
 * DEPRECATED: This API module is deprecated as of 2026-02-09
 * Medications are now stored as nested JSONB objects within appointment tasks
 * Use the appointments API to manage medications as part of task updates
 * This module is kept for backward compatibility only
 * ============================================================================
 */

import { get, post, del } from '../api/client';
import { ApiResponse } from '../api/types';

export interface AppointmentMedication {
  id: string;
  appointmentId: string;
  taskId?: string;
  inventoryItemId: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
  isDeducted: boolean;
  createdAt: string;
  updatedAt: string;
  inventoryItem?: {
    id: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    availableQuantity: number;
    reorderLevel: number;
    unitPrice: number;
  };
  task?: {
    id: string;
    name: string;
    category: string;
  };
}

export interface AddMedicationRequest {
  inventoryItemId: string;
  quantity: number;
  taskId?: string;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
}

export interface AddMedicationResponse extends ApiResponse<AppointmentMedication> {}

export interface GetMedicationsResponse extends ApiResponse<AppointmentMedication[]> {}

export interface RemoveMedicationResponse extends ApiResponse<{ success: boolean }> {}

/**
 * Add a medication to an appointment
 */
export const addMedication = async (
  appointmentId: string | number,
  data: AddMedicationRequest
): Promise<AppointmentMedication> => {
  const response = await post<AddMedicationResponse>(
    `/appointments/${appointmentId}/medications`,
    data
  );
  return response.data;
};

/**
 * Get all medications for an appointment
 */
export const getMedicationsByAppointment = async (
  appointmentId: string | number
): Promise<AppointmentMedication[]> => {
  const response = await get<GetMedicationsResponse>(
    `/appointments/${appointmentId}/medications`
  );
  return response.data;
};

/**
 * Remove a medication from an appointment
 */
export const removeMedication = async (
  medicationId: string | number
): Promise<void> => {
  await del<RemoveMedicationResponse>(
    `/medications/${medicationId}`
  );
};

/**
 * Appointment Medications API
 */
export const appointmentMedicationsAPI = {
  addMedication,
  getMedicationsByAppointment,
  removeMedication,
};

