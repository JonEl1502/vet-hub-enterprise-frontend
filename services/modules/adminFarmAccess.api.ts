/**
 * 233 — admin control over who is offered the FARMER rungs on the client
 * plan ladder.
 *
 * The platform-wide mode lives on platformSettings (`clientFarmPlansMode`);
 * this module is the per-account override that beats it in either direction.
 */
import { get, put } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export interface FarmAccessClient {
  clientId: string;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  clinicName: string | null;
  isLivestock: boolean;
  /** null = follow the rules, true = always offer, false = never offer. */
  farmPlansOverride: boolean | null;
  farmCount: number;
}

const BASE = '/admin/farm-access';

export const adminFarmAccessAPI = {
  /** Every account explicitly granted or withheld. */
  list: (options?: RequestOptions): Promise<ApiResponse<{ clients: FarmAccessClient[] }>> =>
    get(BASE, { cache: false, ...options }),

  /** Portal clients matching a name / email / phone. Needs 2+ characters. */
  search: (q: string, options?: RequestOptions): Promise<ApiResponse<{ clients: FarmAccessClient[] }>> =>
    get(`${BASE}/search?q=${encodeURIComponent(q)}`, { cache: false, ...options }),

  /**
   * Grant (true), withhold (false) or hand back to the rules (null).
   * Applied across every Client row the login owns.
   */
  setOverride: (
    clientId: string,
    override: boolean | null,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ updated: number; clients: FarmAccessClient[] }>> =>
    put(`${BASE}/${clientId}`, { override }, { showError: true, ...options }),
};

export default adminFarmAccessAPI;
