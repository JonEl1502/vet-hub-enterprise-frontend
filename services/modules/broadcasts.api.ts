/**
 * Broadcasts API Module — admin email campaigns to clients.
 */

import { get, post } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type BroadcastAudienceType = 'all' | 'clientType' | 'ids' | 'portal';

export interface BroadcastAudience {
  type: BroadcastAudienceType;
  clientType?: string;
  clientIds?: (string | number)[];
  // With type 'portal': true = only accounts active in the last 30 days.
  portalOnlyActive?: boolean;
}

export interface Broadcast {
  id: string;
  clinicId: string;
  senderId?: string | null;
  channel: 'email' | 'sms' | 'whatsapp';
  subject?: string | null;
  body: string;
  audience: BroadcastAudience;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  createdAt: string;
}

export const broadcastsAPI = {
  /** How many opted-in clients an audience resolves to. */
  recipientCount: async (
    audience: BroadcastAudience,
    options?: RequestOptions
  ): Promise<ApiResponse<{ count: number }>> => {
    return post(ENDPOINTS.BROADCASTS.RECIPIENT_COUNT, { audience }, { ...options });
  },

  /** Send a broadcast to the active clinic's clients. */
  send: async (
    data: { subject: string; body: string; audience: BroadcastAudience },
    options?: RequestOptions
  ): Promise<ApiResponse<{ broadcast: Broadcast }>> => {
    return post(ENDPOINTS.BROADCASTS.BASE, data, { showError: true, ...options });
  },

  /** Recent campaigns for the active clinic. */
  list: async (
    options?: RequestOptions
  ): Promise<ApiResponse<{ broadcasts: Broadcast[] }>> => {
    return get(ENDPOINTS.BROADCASTS.BASE, { ...options });
  },
};
