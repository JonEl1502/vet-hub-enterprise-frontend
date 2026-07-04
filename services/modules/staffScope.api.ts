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
  // Vaccination records + certificate live on their own full page (not a
  // sidebar module) — App routes the 'vaccinations' view per visit.
  vaccination: 'vaccinations', vaccine: 'vaccinations', immunization: 'vaccinations',
  laboratory: 'laboratory', lab: 'laboratory', pathology: 'laboratory',
  // The canonical imaging category is named "Diagnostics" (X-Ray, Ultrasound,
  // CT, MRI, Endoscopy…). Keep the imaging/radiology aliases too.
  diagnostics: 'imaging', imaging: 'imaging', radiology: 'imaging', 'x-ray': 'imaging', xray: 'imaging',
  // Dental studies (X-rays…) live on the Imaging page (body part: Dental)
  // until a dedicated dental module ships.
  dental: 'imaging',
  surgery: 'surgery', surgical: 'surgery',
  boarding: 'boarding',
  inpatient: 'inpatient', hospitalization: 'inpatient', hospitalisation: 'inpatient',
};

// Module menu ids that are category-gated for scoped staff.
export const CATEGORY_GATED_MENU_IDS = new Set(['grooming', 'laboratory', 'imaging', 'surgery', 'boarding', 'inpatient']);

// Resolve a service CATEGORY (by display name or slug) to its module page id.
// Category display names drift ("Diagnostics", "Dental Care", "Laboratory
// Services") so we match exactly first, then fall back to a substring of any
// map key. Single source of truth — visit routing AND scoped-staff nav gating
// must agree, else a service opens a page the staffer can't see (or vice-versa).
export function resolveCategoryMenuId(name?: string | null): string | undefined {
  const lc = (name || '').trim().toLowerCase();
  if (!lc) return undefined;
  return CATEGORY_TO_MENU_ID[lc] || Object.entries(CATEGORY_TO_MENU_ID).find(([k]) => lc.includes(k))?.[1];
}
