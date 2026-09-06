/**
 * 284 — entitlement grants: entitlements that did not come from a plan.
 *
 * The surgical alternative to extending an org's trial, which resolves to
 * `['*']` and hands over the whole platform just to unlock one module.
 */
import { get, post, del } from '../api/client';
import { ApiResponse } from '../api/types';

export type GrantSubjectKind = 'CLINIC' | 'SUPPLIER' | 'CLIENT';
export type GrantSource = 'PROMO' | 'BUNDLE' | 'ADMIN' | 'COMPENSATION' | 'PILOT' | 'MIGRATION';

export interface EntitlementGrant {
  id: string;
  subjectKind: GrantSubjectKind;
  subjectId: string;
  featureKey: string;
  source: GrantSource;
  sourceRef: string | null;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  reason: string;
  createdAt: string;
  /** Live right now — the only status that matters at a glance. */
  isLive: boolean;
}

export interface CreateGrantPayload {
  subjectKind: GrantSubjectKind;
  subjectId: string;
  featureKey: string;
  source: GrantSource;
  sourceRef?: string | null;
  /** A plain day count — what an admin actually thinks in ("boarding for a month"). */
  days?: number | null;
  endsAt?: string | null;
  reason: string;
}

export const entitlementGrantsAPI = {
  listForSubject: (kind: GrantSubjectKind, id: string): Promise<ApiResponse<{ grants: EntitlementGrant[] }>> =>
    get(`/entitlement-grants/${kind}/${id}`),
  create: (payload: CreateGrantPayload): Promise<ApiResponse<{ grant: EntitlementGrant }>> =>
    post('/entitlement-grants', payload),
  /** Soft revoke — the row survives, because the audit trail is the point. */
  revoke: (id: string): Promise<ApiResponse<{ grant: EntitlementGrant }>> =>
    del(`/entitlement-grants/${id}`),
};

export default entitlementGrantsAPI;
