/**
 * Subscription/payment support tickets.
 * Clinic users create + list their own; SUPER_ADMINs triage from the console.
 * The request interceptor adds the x-clinic-id header automatically.
 */
import { get, post, put } from '../api/client';
import { ApiResponse } from '../api/types';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface SubscriptionTicket {
  id: string;
  clinicId: string;
  clinicName?: string;
  raisedBy: string | null;
  provider: string | null;
  attemptReference: string | null;
  amount: number | null;
  currency: string | null;
  message: string;
  screenshotUrl: string | null;
  status: TicketStatus;
  adminNotes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  provider?: string;
  attemptReference?: string;
  amount?: number;
  currency?: string;
  message: string;
  screenshotUrl?: string;
  screenshotKey?: string;
}

export const supportTicketsAPI = {
  create: (input: CreateTicketInput): Promise<ApiResponse<SubscriptionTicket>> =>
    post('/subscriptions/tickets', input, { showError: true }),

  listMine: (): Promise<ApiResponse<{ tickets: SubscriptionTicket[] }>> =>
    get('/subscriptions/tickets', { cache: false }),

  adminList: (status?: TicketStatus): Promise<ApiResponse<{ rows: SubscriptionTicket[]; total: number }>> =>
    get(`/admin/support/tickets${status ? `?status=${status}` : ''}`, { cache: false }),

  adminUpdate: (id: string, patch: { status?: TicketStatus; adminNotes?: string }): Promise<ApiResponse<SubscriptionTicket>> =>
    put(`/admin/support/tickets/${id}`, patch, { showError: true }),
};
