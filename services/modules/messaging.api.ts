/**
 * Staff Platform-Messaging API Module
 *
 * The clinic side of the thread pet owners see in the portal (Messages page).
 * Same `messages` table underneath — staff replies land in the owner's portal
 * chat, owner messages surface on the client profile's Messaging tab.
 *
 * Since migration 253 the same thread also carries **WhatsApp**, in both
 * directions. Two consequences for anything rendering it:
 *
 *  · `fromOwner` comes from the stored `direction` column. It is no longer
 *    inferable from a sender id — an inbound WhatsApp message has none.
 *  · `status` is WhatsApp-only and NULL on portal/email rows. Do not render a
 *    delivery tick for a message that was never "delivered" anywhere.
 */

import { get, post } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

/** WhatsApp delivery state. NULL on portal/email rows. */
export type MessageDeliveryStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface PlatformMessage {
  id: string;
  clientId: string;
  petId: string | null;
  /** From the stored `direction` column, not inferred from a sender id. */
  fromOwner: boolean;
  senderName: string | null;
  subject: string | null;
  body: string;
  isRead: boolean;
  sentAt: string;
  channel: string;
  /** WhatsApp only — NULL for portal/email, which have no delivery concept. */
  status: MessageDeliveryStatus | null;
  /** Meta's error code on a failed send, e.g. '131047' (window closed). */
  errorCode: string | null;
  errorDetail: string | null;
  /** Set when an inbound WhatsApp message carried an attachment. */
  mediaType: string | null;
  /**
   * OUR stored copy of that attachment. Meta's own URL needs a bearer token
   * and expires after 30 days, so it can never be rendered directly.
   * A mediaType with a null mediaUrl means we knew about a file but could not
   * keep it — which the UI must say, rather than showing text only.
   */
  mediaUrl: string | null;
}

export interface WhatsappStatus {
  /** Does this clinic have a channel at all (own WABA, or the platform number)? */
  configured: boolean;
  /**
   * Is Meta's 24-hour customer-service window open? When false, free text is
   * rejected (131047) and only an approved template can be sent.
   */
  windowOpen: boolean;
  windowExpiresAt: string | null;
  /** 'clinic' = the clinic's own number, 'platform' = VetHub's. */
  tier: 'clinic' | 'platform' | null;
}

export const messagingAPI = {
  clientThread: (clientId: string | number, options?: RequestOptions): Promise<ApiResponse<{ messages: PlatformMessage[] }>> =>
    get(ENDPOINTS.MESSAGING.CLIENT_THREAD(clientId), { ...options }),

  /**
   * Staff -> client. `channel` picks where it lands; anything other than an
   * explicit 'whatsapp' stays on the portal, so an unrecognised value can never
   * silently send to a real phone.
   *
   * `templateParams` is POSITIONAL — Meta matches template variables by order,
   * not by name.
   */
  send: (
    data: {
      clientId: string | number;
      petId?: string | number;
      subject?: string;
      body: string;
      channel?: 'portal' | 'whatsapp';
      templateName?: string;
      templateLanguage?: string;
      templateParams?: string[];
    },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ message: { id: string; sentAt: string } }>> =>
    post(ENDPOINTS.MESSAGING.SEND, data, { showError: true, ...options }),

  whatsappStatus: (clientId: string | number, options?: RequestOptions): Promise<ApiResponse<WhatsappStatus>> =>
    get(ENDPOINTS.MESSAGING.WHATSAPP_STATUS(clientId), { silent: true, ...options }),

  markClientRead: (clientId: string | number, options?: RequestOptions): Promise<ApiResponse<{ updated: number }>> =>
    post(ENDPOINTS.MESSAGING.CLIENT_READ(clientId), undefined, { silent: true, ...options }),

  unread: (options?: RequestOptions): Promise<ApiResponse<{ perClient: Record<string, number>; total: number }>> =>
    get(ENDPOINTS.MESSAGING.UNREAD, { silent: true, ...options }),

  // Recent inbound (client -> clinic) messages for the staff notification bell.
  inbox: (options?: RequestOptions): Promise<ApiResponse<{ messages: InboxMessage[]; unread: number }>> =>
    get(ENDPOINTS.MESSAGING.INBOX, { silent: true, ...options }),
};

export interface InboxMessage {
  id: string;
  clientId: string;
  clientName: string;
  subject: string | null;
  body: string;
  isRead: boolean;
  sentAt: string;
  /** 'whatsapp' | 'portal' | … — where the client reached the clinic from. */
  channel: string;
}

export default messagingAPI;
