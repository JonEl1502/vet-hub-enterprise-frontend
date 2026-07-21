import { get, post, patch, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * Procedure recipe templates (Billable Items wave, migration 084).
 * A template = clinical recipe: fee/service components + products consumed
 * (billable / deduct-stock / optional flags, fixed / per-kg / manual qty) +
 * dynamic pricing rules. Applying materializes ordinary visit lines.
 */

export type ProcItemType = 'SERVICE' | 'MEDICATION' | 'CONSUMABLE' | 'LAB' | 'IMAGING' | 'FEE';
export type ProcQtyBasis = 'FIXED' | 'PER_KG' | 'MANUAL';

export interface ProcedureStage { key: string; label: string; }

export interface ProcedureFlags { inHeat?: boolean; pregnant?: boolean; emergency?: boolean; outOfHours?: boolean; }

export interface ProcedureTemplateItem {
  id: string;
  itemType: ProcItemType;
  serviceId: string | null;
  inventoryItemId: string | null;
  name: string;
  customName: string | null;
  stageKey: string | null;
  qtyBasis: ProcQtyBasis;
  quantity: number;
  priceOverride: number | null;
  effectivePrice: number;
  billable: boolean;
  deductStock: boolean;
  optional: boolean;
  consultantName: string | null;
  sortOrder: number;
  unit: string | null;
  availableQuantity: number | null;
  batchNumber: string | null;
  supplierName: string | null;
  manufacturer: string | null;
  imageUrl: string | null;
  serviceCategoryName: string | null;
}

export interface ProcedurePricingRule {
  id?: string;
  name: string;
  enabled: boolean;
  conditions: {
    species?: string;
    weightMinKg?: number;
    weightMaxKg?: number;
    ageMinMonths?: number;
    ageMaxMonths?: number;
    inHeat?: boolean;
    pregnant?: boolean;
    emergency?: boolean;
    outOfHours?: boolean;
  };
  effects: { feeAmount?: number; feePercent?: number; label?: string };
  sortOrder?: number;
}

export interface ProcedureTemplate {
  id: string;
  clinicId: string;
  name: string;
  description: string | null;
  code: string | null;
  categoryId: string | null;
  categoryName: string | null;
  species: string[];
  defaultDurationMin: number | null;
  triggerServiceId: string | null;
  triggerServiceName: string | null;
  stages: ProcedureStage[];
  discount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: ProcedureTemplateItem[];
  pricingRules: ProcedurePricingRule[];
  estimatedTotal: number;
}

export interface ProcedureItemPayload {
  itemType: ProcItemType;
  serviceId?: string | number | null;
  inventoryItemId?: string | number | null;
  customName?: string | null;
  stageKey?: string | null;
  qtyBasis?: ProcQtyBasis;
  quantity?: number;
  priceOverride?: number | null;
  billable?: boolean;
  deductStock?: boolean;
  optional?: boolean;
  consultantName?: string | null;
  sortOrder?: number;
}

export interface ProcedureTemplatePayload {
  name: string;
  description?: string;
  code?: string;
  categoryId?: string | number | null;
  species?: string[];
  defaultDurationMin?: number | null;
  triggerServiceId?: string | number | null;
  stages?: ProcedureStage[];
  discount?: number;
  isActive?: boolean;
  items: ProcedureItemPayload[];
  pricingRules?: ProcedurePricingRule[];
}

export interface ProcedurePreview {
  facts: { species: string | null; weightKg: number | null; ageMonths: number | null; flags: ProcedureFlags };
  serviceLines: Array<{ templateItemId: string; itemType: ProcItemType; stageKey: string | null; serviceId: string | null; name: string; category: string; price: number; billable: boolean; listPrice: number }>;
  productLines: Array<{ templateItemId: string; itemType: ProcItemType; stageKey: string | null; inventoryItemId: string; name: string; unit: string; quantity: number; unitPrice: number; lineTotal: number; billable: boolean; deductStock: boolean; manual: boolean; batchNumber: string | null }>;
  adjustments: Array<{ ruleId: string; name: string; amount: number }>;
  optional: ProcedureTemplateItem[];
  skipped: Array<{ itemId: string; name: string; reason: string }>;
  subtotal: number;
  discount: number;
  total: number;
}

export interface ProcedureApplication {
  id: string;
  templateId: string;
  templateName: string | null;
  stages: ProcedureStage[];
  appointmentId: string;
  taskId: string | null;
  weightKg: number | null;
  flags: ProcedureFlags;
  skippedItems: Array<{ itemId?: string; name: string; reason: string }>;
  snapshot: any;
  createdAt: string;
  tasks: Array<{ id: string; name: string; category: string; price: number; status: string; stageKey: string | null }>;
  products: Array<{
    id: string; taskId: string | null; quantity: number; unitPrice: number; billable: boolean; isDeducted: boolean; batchNumber: string | null;
    inventoryItem: { id: string; name: string; unit: string; manufacturer: string | null; imageUrl: string | null; supplierName: string | null };
  }>;
}

export const procedureTemplatesAPI = {
  list: async (includeInactive = false, options?: RequestOptions): Promise<ApiResponse<{ templates: ProcedureTemplate[] }>> =>
    get(`${ENDPOINTS.PROCEDURE_TEMPLATES.BASE}${includeInactive ? '?includeInactive=true' : ''}`, { cache: false, ...options }),

  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ template: ProcedureTemplate }>> =>
    get(ENDPOINTS.PROCEDURE_TEMPLATES.BY_ID(id), { cache: false, ...options }),

  create: async (data: ProcedureTemplatePayload, options?: RequestOptions): Promise<ApiResponse<{ template: ProcedureTemplate }>> =>
    post(ENDPOINTS.PROCEDURE_TEMPLATES.BASE, data, { showError: true, ...options }),

  update: async (id: string | number, data: Partial<ProcedureTemplatePayload>, options?: RequestOptions): Promise<ApiResponse<{ template: ProcedureTemplate }>> =>
    patch(ENDPOINTS.PROCEDURE_TEMPLATES.BY_ID(id), data, { showError: true, ...options }),

  remove: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean; deactivated: boolean }>> =>
    del(ENDPOINTS.PROCEDURE_TEMPLATES.BY_ID(id), { showError: true, ...options }),

  /** Dry-run quote: what would this template produce for a patient / weight / flags? */
  preview: async (id: string | number, body: { petId?: string | number; weightKg?: number; flags?: ProcedureFlags }, options?: RequestOptions): Promise<ApiResponse<{ preview: ProcedurePreview }>> =>
    post(ENDPOINTS.PROCEDURE_TEMPLATES.PREVIEW(id), body, options),

  apply: async (id: string | number, body: { appointmentId: string | number; taskId?: string | number; weightKg?: number; flags?: ProcedureFlags }, options?: RequestOptions): Promise<ApiResponse<{ applied: boolean; applicationId: string; created: { tasks: number; products: number; adjustments: number }; skipped: any[]; total: number }>> =>
    post(ENDPOINTS.PROCEDURE_TEMPLATES.APPLY(id), body, { showError: true, ...options }),

  listApplications: async (appointmentId: string | number, options?: RequestOptions): Promise<ApiResponse<{ applications: ProcedureApplication[] }>> =>
    get(`${ENDPOINTS.PROCEDURE_TEMPLATES.APPLICATIONS}?appointmentId=${appointmentId}`, { cache: false, ...options }),

  reevaluate: async (applicationId: string | number, body: { weightKg?: number; flags?: ProcedureFlags }, options?: RequestOptions): Promise<ApiResponse<{ application: ProcedureApplication }>> =>
    post(ENDPOINTS.PROCEDURE_TEMPLATES.REEVALUATE(applicationId), body, { showError: true, ...options }),

  /** Materialize one optional (recommended) component onto the visit. */
  materializeItem: async (applicationId: string | number, templateItemId: string | number, options?: RequestOptions): Promise<ApiResponse<{ application: ProcedureApplication }>> =>
    post(ENDPOINTS.PROCEDURE_TEMPLATES.APP_ITEMS(applicationId), { templateItemId }, { showError: true, ...options }),

  removeApplication: async (applicationId: string | number, options?: RequestOptions): Promise<ApiResponse<{ success: boolean }>> =>
    del(ENDPOINTS.PROCEDURE_TEMPLATES.APPLICATION(applicationId), { showError: true, ...options }),
};
