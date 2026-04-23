/**
 * Imports API — bulk-create rows for clients, pets, inventory, or staff.
 */

import { post } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { ApiResponse, RequestOptions } from '../api/types';

export type ImportEntity = 'clients' | 'pets' | 'inventory' | 'staff';

export interface ImportRowError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportResult {
  entity: ImportEntity;
  total: number;
  created: number;
  failed: number;
  errors: ImportRowError[];
}

export const importsAPI = {
  commit: (
    entity: ImportEntity,
    rows: Record<string, unknown>[],
    options?: RequestOptions,
  ): Promise<ApiResponse<ImportResult>> =>
    post(ENDPOINTS.IMPORTS.FOR_ENTITY(entity), { rows }, { showError: true, ...options }),
};

export default importsAPI;
