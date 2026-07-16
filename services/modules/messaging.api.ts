/**
 * Staff Platform-Messaging API Module
 *
 * The clinic side of the thread pet owners see in the portal (Messages page).
 * Same `messages` table underneath — staff replies land in the owner's portal
 * chat, owner messages surface on the client profile's Messaging tab.
 */

import { get, post } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export interface PlatformMessage {
  id: string;
  clientId: string;
  petId: string | null;
  fromOwner: boolean;
  senderName: string | null;
  subject: string | null;
  body: string;
  isRead: boolean;
  sentAt: string;
  channel: string;
}

export const messagingAPI = {
  clientThread: (clientId: string | number, options?: RequestOptions): Promise<ApiResponse<{ messages: PlatformMessage[] }>> =>
    get(ENDPOINTS.MESSAGING.CLIENT_THREAD(clientId), { ...options }),

  send: (
    data: { clientId: string | number; petId?: string | number; subject?: string; body: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ message: { id: string; sentAt: string } }>> =>
    post(ENDPOINTS.MESSAGING.SEND, data, { showError: true, ...options }),

  markClientRead: (clientId: string | number, options?: RequestOptions): Promise<ApiResponse<{ updated: number }>> =>
    post(ENDPOINTS.MESSAGING.CLIENT_READ(clientId), undefined, { silent: true, ...options }),

  unread: (options?: RequestOptions): Promise<ApiResponse<{ perClient: Record<string, number>; total: number }>> =>
    get(ENDPOINTS.MESSAGING.UNREAD, { silent: true, ...options }),
};

export default messagingAPI;
