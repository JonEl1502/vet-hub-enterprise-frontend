/**
 * Module Catalog API — the server-side replacement for the hardcoded module
 * metadata that used to live in `services/entitlements.ts` (`VIEW_KEY`,
 * `KEY_LABEL`, `FEATURE_COPY`, `BASELINE_KEYS`) and in the four
 * `*_FEATURE_CATALOG` maps in `subscriptionPackages.api.ts`.
 *
 * Migration 280. Those maps stay in the tree as a FALLBACK — see
 * `hydrateModuleCatalog` — so an unreachable API degrades to the old
 * behaviour rather than blanking every label in the app. New modules,
 * however, need only a database row.
 *
 * ⚠️ Prices are deliberately absent from this payload. `module_prices` is an
 * internal price book; a customer never sees a per-module figure.
 */

import { get } from '../api/client';
import { ApiResponse } from '../api/types';

export interface ModuleCatalogEntry {
  key: string;
  name: string;
  blurb: string | null;
  category: string;
  /** VIEW | CAPABILITY | SERVICE */
  kind: string;
  audiences: string[];
  /** Route ids this key gates — the server-side `VIEW_KEY`. */
  routes: string[];
  requires: string[];
  shells: string[];
  isBaseline: boolean;
  sellableStandalone: boolean;
  sortOrder: number;
}

export const moduleCatalogAPI = {
  /** The active catalog, optionally narrowed to one audience. */
  list: (audience?: string): Promise<ApiResponse<{ modules: ModuleCatalogEntry[] }>> =>
    get(`/modules${audience ? `?audience=${encodeURIComponent(audience)}` : ''}`),
};

export default moduleCatalogAPI;
