/**
 * 285 — bundle rules: declarative rows that mint `source=BUNDLE` grants while a
 * condition holds, and revoke them when it stops.
 *
 * ⚠️ The language is deliberately weak — set membership plus a tier floor, and
 * that is all. No OR, no NOT, no nesting. "Why does this clinic have boarding?"
 * has to stay answerable by pointing at one row.
 */
import { get, post, put } from '../api/client';
import { ApiResponse } from '../api/types';

export interface BundleRule {
  id: string;
  label: string;
  notes: string | null;
  audience: string | null;
  isActive: boolean;
  whenAllOf: string[];
  whenMinTier: number;
  thenGrant: string[];
  /** null = for as long as the condition holds. */
  durationDays: number | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface ReconcileResult {
  granted?: string[];
  revoked?: string[];
  scanned?: number;
}

export const bundleRulesAPI = {
  list: (): Promise<ApiResponse<{ rules: BundleRule[] }>> => get('/bundle-rules'),
  create: (payload: Partial<BundleRule> & { allowUnconditional?: boolean }): Promise<ApiResponse<{ rule: BundleRule }>> =>
    post('/bundle-rules', payload),
  update: (id: string, payload: Partial<BundleRule>): Promise<ApiResponse<{ rule: BundleRule }>> =>
    put(`/bundle-rules/${id}`, payload),
  /**
   * Run the reconciler now. Rules otherwise only take effect on the next
   * subscription change or the hourly sweep, and waiting an hour to find out
   * whether a rule works is a bad way to author one.
   */
  reconcile: (subject?: { subjectKind: string; subjectId: string }): Promise<ApiResponse<{ result: ReconcileResult }>> =>
    post('/bundle-rules/reconcile', subject ?? {}),
};

export default bundleRulesAPI;
