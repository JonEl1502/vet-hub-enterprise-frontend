import { get, post, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * Workflow templates — the dynamic visit form builder (backend migration 136).
 * Spec: backend/docs/DYNAMIC_FORM_BUILDER.md
 *
 * A template is a visit workflow: ordered stages, each holding sections of
 * fields. Fields live in a registry and are referenced from the layout BY KEY,
 * so deactivating one can never break a saved template or an in-flight visit.
 *
 * Ownership: SYSTEM presets (`ownerType: 'SYSTEM'`) are shipped by us and are
 * referenced LIVE — improvements reach every clinic. They cannot be edited;
 * `fork()` gives the clinic an editable copy. A clinic never live-references
 * another clinic's template, so taking one from the shared library also forks.
 */

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'select' | 'seg' | 'checks' | 'date'
  | 'staff' | 'list' | 'normalAbnormal' | 'lab' | 'imaging' | 'service'
  | 'product' | 'native';

export interface FormField {
  id: string;
  clinicId: string | null;   // null = a core field we ship
  key: string;               // STABLE — data is stored under its last segment
  label: string;             // renamable
  fieldType: FieldType;
  options: string[] | { k: string; label: string }[];
  unit: string | null;
  helpText: string | null;
  requiresFeature: string | null;
  isCore: boolean;
  isActive: boolean;
}

export interface PlacedField { fieldKey: string; span?: number; required?: boolean }
export interface LayoutSection { key: string; label: string; icon?: string | null; fields: PlacedField[] }
export interface LayoutStage {
  key: string; label: string; short?: string;
  icon?: string | null; tone?: string | null;
  sections: LayoutSection[];
}

export interface WorkflowTemplate {
  id: string;
  clinicId: string | null;
  ownerType: 'SYSTEM' | 'CLINIC';
  key: string;
  name: string;
  icon: string | null;
  description: string | null;
  version: number;
  basedOnId: string | null;
  baseVersion: number | null;
  visibility: 'PRIVATE' | 'SHARED';
  encounterType: string | null;
  visitType: string | null;
  species: string[];
  requiresFeature: string | null;
  stages: LayoutStage[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present on getById / resolve — the registry rows this layout references. */
  fields?: FormField[];
}

export interface WorkflowTemplatePayload {
  name?: string;
  description?: string | null;
  icon?: string | null;
  encounterType?: string | null;
  visitType?: string | null;
  species?: string[];
  stages?: LayoutStage[];
  isActive?: boolean;
  isDefault?: boolean;
}

export interface FormFieldPayload {
  label: string;
  fieldType: FieldType;
  options?: any;
  unit?: string | null;
  helpText?: string | null;
}

export const workflowTemplatesAPI = {
  /** The clinic's own templates plus every shipped preset. */
  list: async (includeInactive = false, options?: RequestOptions): Promise<ApiResponse<{ templates: WorkflowTemplate[] }>> =>
    get(`${ENDPOINTS.WORKFLOW_TEMPLATES.BASE}${includeInactive ? '?includeInactive=true' : ''}`, options),

  /** Templates other clinics published — the library you fork from. */
  listShared: async (options?: RequestOptions): Promise<ApiResponse<{ templates: WorkflowTemplate[] }>> =>
    get(ENDPOINTS.WORKFLOW_TEMPLATES.SHARED, options),

  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ template: WorkflowTemplate }>> =>
    get(ENDPOINTS.WORKFLOW_TEMPLATES.BY_ID(id), options),

  /**
   * Which template a visit opens on. `template: null` is a valid answer —
   * the caller then uses the built-in entry points, which remain the fallback.
   */
  resolve: async (
    params: { encounterType?: string | null; visitType?: string | null; species?: string | null; entryKey?: string | null },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ template: WorkflowTemplate | null }>> => {
    const q = new URLSearchParams();
    if (params.encounterType) q.set('encounterType', params.encounterType);
    if (params.visitType) q.set('visitType', params.visitType);
    if (params.species) q.set('species', params.species);
    // The entry point the client already resolved — wins server-side.
    if (params.entryKey) q.set('entryKey', params.entryKey);
    const qs = q.toString();
    return get(`${ENDPOINTS.WORKFLOW_TEMPLATES.RESOLVE}${qs ? `?${qs}` : ''}`, options);
  },

  /** Field registry search — backs "search a field, or create it". */
  searchFields: async (q?: string, limit = 50, options?: RequestOptions): Promise<ApiResponse<{ fields: FormField[] }>> => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    p.set('limit', String(limit));
    return get(`${ENDPOINTS.WORKFLOW_TEMPLATES.FIELDS}?${p.toString()}`, options);
  },

  createField: async (data: FormFieldPayload, options?: RequestOptions): Promise<ApiResponse<{ field: FormField }>> =>
    post(ENDPOINTS.WORKFLOW_TEMPLATES.FIELDS, data, options),

  create: async (data: WorkflowTemplatePayload, options?: RequestOptions): Promise<ApiResponse<{ template: WorkflowTemplate }>> =>
    post(ENDPOINTS.WORKFLOW_TEMPLATES.BASE, data, options),

  update: async (id: string | number, data: WorkflowTemplatePayload, options?: RequestOptions): Promise<ApiResponse<{ template: WorkflowTemplate }>> =>
    patch(ENDPOINTS.WORKFLOW_TEMPLATES.BY_ID(id), data, options),

  /** Copy a preset (or a shared template) into this clinic, editable. */
  fork: async (id: string | number, name?: string, options?: RequestOptions): Promise<ApiResponse<{ template: WorkflowTemplate }>> =>
    post(ENDPOINTS.WORKFLOW_TEMPLATES.FORK(id), name ? { name } : {}, options),

  setVisibility: async (id: string | number, visibility: 'PRIVATE' | 'SHARED', options?: RequestOptions): Promise<ApiResponse<{ template: WorkflowTemplate }>> =>
    patch(ENDPOINTS.WORKFLOW_TEMPLATES.VISIBILITY(id), { visibility }, options),

  /** Deactivates — an in-flight visit may still be rendering this layout. */
  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ template: WorkflowTemplate }>> =>
    del(ENDPOINTS.WORKFLOW_TEMPLATES.BY_ID(id), options),
};

export default workflowTemplatesAPI;
