/**
 * AI API Module — multi-turn chat + note generation.
 *
 * Conversations are persisted per appointment (and optionally per task) so
 * staff can resume them across reloads. Each call to chat() with a
 * conversationId continues that thread; without one it starts a new convo.
 */

import { get, post, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { ApiResponse } from '../api/types';

export type ChatRole = 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface AIConversation {
  id: string;
  appointmentId: string | null;
  taskId: string | null;
  messages: ChatMessage[];
  summary: string | null;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface ChatInput {
  message: string;
  appointmentId?: string | number;
  taskId?: string | number;
  conversationId?: string | number;
}

export interface ChatResult {
  conversationId: string;
  appointmentId: string | null;
  taskId: string | null;
  messages: ChatMessage[];
  summary?: string | null;
  status?: 'open' | 'closed';
  fallback?: boolean;
}

export interface ServiceNoteInput {
  taskName: string;
  sentiment?: string;
  phrases: string[];
  appointmentId?: string | number;
  taskId?: string | number;
}

export interface ServiceNoteResult {
  note: string;
  fallback: boolean;
}

export const aiAPI = {
  chat: (input: ChatInput): Promise<ApiResponse<ChatResult>> =>
    post<ChatResult>(ENDPOINTS.AI.CHAT, input),

  listConversations: (params: {
    appointmentId?: string | number;
    taskId?: string | number;
  }): Promise<ApiResponse<{ conversations: AIConversation[] }>> => {
    const qs = new URLSearchParams();
    if (params.appointmentId) qs.set('appointmentId', String(params.appointmentId));
    if (params.taskId) qs.set('taskId', String(params.taskId));
    return get(`${ENDPOINTS.AI.CONVERSATIONS}?${qs.toString()}`);
  },

  summariseConversation: (id: string | number): Promise<ApiResponse<{ conversationId: string; summary: string; status: string }>> =>
    post(ENDPOINTS.AI.CONVERSATION_SUMMARY(id), {}),

  generateServiceNote: (input: ServiceNoteInput): Promise<ApiResponse<ServiceNoteResult>> =>
    post<ServiceNoteResult>(ENDPOINTS.AI.SERVICE_NOTE, input),

  analyzeObservations: (input: {
    serviceName: string;
    serviceCategory: string;
    observations: string;
    petSpecies?: string;
    petAge?: number;
    appointmentId?: string | number;
  }): Promise<ApiResponse<{ fullAnalysis: string; fallback: boolean }>> =>
    post(ENDPOINTS.AI.ANALYZE, input),
};

export interface TaskAttachment {
  url: string;
  key?: string | null;
  kind: 'XRAY' | 'MRI' | 'ULTRASOUND' | 'PHOTO' | 'LAB' | 'DOC' | 'OTHER';
  contentType?: string | null;
  sizeBytes?: number | null;
  label?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export const taskAttachmentsAPI = {
  add: (
    appointmentId: string | number,
    taskId: string | number,
    payload: Omit<TaskAttachment, 'createdAt' | 'createdBy'>,
  ): Promise<ApiResponse<{ taskId: string; attachments: TaskAttachment[] }>> =>
    post(ENDPOINTS.TASK_ATTACHMENTS.ADD(appointmentId, taskId), payload),

  remove: (
    appointmentId: string | number,
    taskId: string | number,
    index: number,
  ): Promise<ApiResponse<{ taskId: string; attachments: TaskAttachment[] }>> =>
    del(ENDPOINTS.TASK_ATTACHMENTS.REMOVE(appointmentId, taskId, index)),
};
