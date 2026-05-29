/**
 * Cancel the clinic's active subscription. Two modes:
 *  - 'NOW'           — deactivate immediately
 *  - 'END_OF_CYCLE'  — stay active until expiresAt, then the backend cron
 *                      flips isActive=false
 *
 * One-way per product spec — cancelling cannot be undone.
 */
import { post } from '../api/client';
import { ApiResponse } from '../api/types';

export type CancellationMode = 'NOW' | 'END_OF_CYCLE';

export interface CancellationResult {
  subscription: {
    id: string;
    isActive: boolean;
    cancellationMode: CancellationMode | null;
    cancellationReason: string | null;
    cancelledAt: string | null;
    cancellationScheduledFor: string | null;
    [k: string]: unknown;
  };
}

export const subscriptionCancelAPI = {
  cancel: (
    clinicId: string,
    args: { mode: CancellationMode; reason?: string },
  ): Promise<ApiResponse<CancellationResult>> =>
    post('/subscriptions/cancel', args, {
      headers: { 'x-clinic-id': clinicId },
      showError: true,
    }),
};
