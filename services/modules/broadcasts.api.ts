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

// --- Rich segment builder ---------------------------------------------------
export type BroadcastChannel = 'email' | 'portal' | 'whatsapp';

export interface SegmentFilter {
  species?: string[];
  activity?: 'all' | 'active' | 'dormant';
  dormantDays?: number;
  portal?: 'any' | 'with' | 'without' | 'active';
  clientTypes?: string[];
  vaccine?: { mode: 'had' | 'due'; from?: string; to?: string };
  deworming?: { mode: 'had' | 'due'; from?: string; to?: string };
  debtMin?: number;
  debtMax?: number;
}

export interface SegmentBreakdown {
  total: number;
  email: number;
  portal: number;
  whatsapp: number;
}

export interface SegmentSendResult {
  broadcast: Broadcast;
  matched: number;
  results: {
    email: { sent: number; failed: number };
    portal: { sent: number };
    // `queued` is what the server accepted; `sent` is what Meta actually took
    // on the immediate drain. They are kept apart on purpose — counting queued
    // as sent is what used to make this screen report deliveries that never
    // happened. `unreachable` is matched clients whose phone number does not
    // normalise to E.164.
    whatsapp: { queued: number; sent: number; failed: number; unreachable: number };
  };
}

export const broadcastsAPI = {
  /** Count-first preview for the segment builder: total matched + per-channel reach. */
  segmentCount: async (
    filter: SegmentFilter,
    options?: RequestOptions
  ): Promise<ApiResponse<SegmentBreakdown>> => {
    return post(ENDPOINTS.BROADCASTS.SEGMENT_COUNT, { filter }, { showError: false, ...options });
  },

  /** Send a segment broadcast across the chosen channels. */
  segmentSend: async (
    data: {
      subject: string;
      body: string;
      filter: SegmentFilter;
      channels: BroadcastChannel[];
      /**
       * Approved Meta template. A broadcast is outside WhatsApp's 24-hour
       * window for almost every recipient, so without one only clients who
       * messaged the clinic in the last 24 hours will receive it.
       * `params` is POSITIONAL — Meta matches by order, not by name.
       */
      whatsappTemplate?: { name: string; language?: string; params?: string[] };
    },
    options?: RequestOptions
  ): Promise<ApiResponse<SegmentSendResult>> => {
    return post(ENDPOINTS.BROADCASTS.SEGMENT_SEND, data, { showError: true, ...options });
  },

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
