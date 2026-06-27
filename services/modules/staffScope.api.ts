import { get, put } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export interface CategoryScope {
  scopedToCategories: boolean;
  categoryIds: string[];
  categoryNames: string[];
}

export const staffScopeAPI = {
  // Current user's scope for the active clinic (drives category-scoped nav).
  myScope: (options?: RequestOptions): Promise<ApiResponse<CategoryScope>> =>
    get('/staff-scope/me', { cache: false, ...options }),
  get: (userId: string | number, options?: RequestOptions): Promise<ApiResponse<CategoryScope>> =>
    get(`/staff-scope/${userId}`, { cache: false, ...options }),
  set: (userId: string | number, categoryIds: (string | number)[], scopedToCategories: boolean, options?: RequestOptions): Promise<ApiResponse<CategoryScope>> =>
    put(`/staff-scope/${userId}`, { categoryIds, scopedToCategories }, { showError: true, ...options }),
};

// Clinical category name (lowercased) → sidebar menu item id. A scoped staffer
// only sees the module pages for their assigned categories; everything not in
// this map is treated as always-visible core (clients, patients, visits, …).
export const CATEGORY_TO_MENU_ID: Record<string, string> = {
  grooming: 'grooming',
  laboratory: 'laboratory', lab: 'laboratory', pathology: 'laboratory',
  imaging: 'imaging', radiology: 'imaging',
  surgery: 'surgery', surgical: 'surgery',
  boarding: 'boarding',
  inpatient: 'inpatient', hospitalization: 'inpatient', hospitalisation: 'inpatient',
};

// Module menu ids that are category-gated for scoped staff.
export const CATEGORY_GATED_MENU_IDS = new Set(['grooming', 'laboratory', 'imaging', 'surgery', 'boarding', 'inpatient']);
