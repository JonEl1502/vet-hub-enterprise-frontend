/**
 * Subscription/payment support tickets.
 * Clinic users create + list their own; SUPER_ADMINs triage from the console.
 * The request interceptor adds the x-clinic-id header automatically.
 */
import { get, post, put } from '../api/client';
import { ApiResponse } from '../api/types';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

/**
 * What kind of issue a ticket is (226). This table was payment-only, so a row
 * with no kind IS a payment ticket — the server defaults it, and nothing on
 * the clinic side has to migrate.
 */
export type TicketKind = 'PAYMENT' | 'BUG' | 'DATA' | 'ACCESS' | 'FEATURE' | 'OTHER';

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
  kind: TicketKind;
  /** Whatever the reporter tagged, plus the route / viewport / browser. */
  context: Record<string, any> | null;
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
  kind?: TicketKind;
  context?: Record<string, unknown> | null;
}

export const supportTicketsAPI = {
  create: (input: CreateTicketInput): Promise<ApiResponse<SubscriptionTicket>> =>
    post('/subscriptions/tickets', input, { showError: true }),

  listMine: (): Promise<ApiResponse<{ tickets: SubscriptionTicket[] }>> =>
    get('/subscriptions/tickets', { cache: false }),

  adminList: (status?: TicketStatus, kind?: TicketKind): Promise<ApiResponse<{ rows: SubscriptionTicket[]; total: number }>> => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (kind) q.set('kind', kind);
    const qs = q.toString();
    return get(`/admin/support/tickets${qs ? `?${qs}` : ''}`, { cache: false });
  },

  adminUpdate: (id: string, patch: { status?: TicketStatus; adminNotes?: string }): Promise<ApiResponse<SubscriptionTicket>> =>
    put(`/admin/support/tickets/${id}`, patch, { showError: true }),
};
