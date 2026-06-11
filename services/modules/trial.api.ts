import { post } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

export type TrialEntity = 'clinic' | 'supplier' | 'user';

export const trialAPI = {
  // Set the free-trial window to now + `days` (null/0 clears it).
  set: (
    data: { entity: TrialEntity; entityId: string | number; days: number | null },
    options?: RequestOptions
  ): Promise<ApiResponse<{ entity: string; id: string; trialEndsAt: string | null }>> =>
    post('/admin/trial', data, { showError: true, ...options }),
};
