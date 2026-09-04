import { get, post, patch, del } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * Site Connect (269) — a clinic's own public website talking to VetHub Core.
 * Backend spec: `backend/docs/SPEC_WEBSITE_INTEGRATION.md`.
 */

export interface SiteConnection {
  id: string;
  accountType: 'CLINIC' | 'SUPPLIER';
  clinicId: string | null;
  supplierId: string | null;
  name: string;
  siteUrl: string;
  allowedOrigins: string[];
  environment: 'LIVE' | 'TEST';
  publishableKey: string;
  /** Only the tail. The secret itself is stored as a hash and never returned. */
  secretKeyLast4: string;
  appointmentsEnabled: boolean;
  catalogEnabled: boolean;
  ordersEnabled: boolean;
  webhookUrl: string | null;
  webhookEnabled: boolean;
  hasWebhookSecret: boolean;
  lastSeenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteDelivery {
  id: string;
  eventId: string;
  eventType: string;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'DEAD';
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: string;
  deliveredAt: string | null;
  createdAt: string;
}

export type SiteRequestStatus =
  | 'NEW' | 'ACKNOWLEDGED' | 'ACCEPTED' | 'RESCHEDULE_PROPOSED'
  | 'DECLINED' | 'CANCELLED' | 'SPAM';

export type SitePortalStatus =
  | 'NOT_REQUESTED' | 'REQUESTED' | 'INVITE_SENT' | 'ACTIVE'
  | 'REFUSED_BY_STAFF' | 'INELIGIBLE';

/**
 * Resolved at read time, never stored — a badge computed on the way out cannot
 * go stale against a client file that changed after the request arrived.
 */
export type ClientStatus =
  | 'NEW_TO_THIS_CLINIC'
  | 'EXISTING_CLIENT'
  | 'EXISTING_CLIENT_WITH_PORTAL'
  | 'HAS_PORTAL_ELSEWHERE'
  | 'EMAIL_IS_A_STAFF_ACCOUNT';

export interface SiteRequest {
  id: string;
  reference: string;
  status: SiteRequestStatus;
  connectionId: string;
  connectionName: string | null;
  owner: { name: string; phone: string; phoneE164: string | null; email: string | null };
  pet: {
    name: string; species: string; breed: string | null;
    ageMonths: number | null; sex: string | null;
    /** A SUGGESTION for the accept form. `pets.dob` is NOT NULL and a website
     *  visitor gives an approximate age at best, so staff confirm it. */
    suggestedDob: string | null;
  };
  serviceId: string | null;
  serviceLabel: string | null;
  preferredDate: string;
  preferredTime: string | null;
  isHouseCall: boolean;
  message: string | null;
  consent: Record<string, any>;
  meta: Record<string, any>;
  portal: { optIn: boolean; status: SitePortalStatus; invitedAt: string | null };
  matchedClientId: string | null;
  matchedPetId: string | null;
  appointmentId: string | null;
  clinicNote: string | null;
  internalNote: string | null;
  proposedAt: string | null;
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchCandidate {
  id: string;
  code: string | null;
  name: string;
  phone: string;
  email: string | null;
  hasPortal: boolean;
  pets: { id: string; code: string | null; name: string; species: string; breed: string | null; dob: string }[];
}

export interface SiteRequestDetail {
  request: SiteRequest;
  clientStatus: ClientStatus;
  portal: { canInvite: boolean; reason: string | null };
  candidates: MatchCandidate[];
}

export interface AcceptPayload {
  clientId?: string;
  newClient?: { firstName: string; surname?: string; phone?: string; email?: string };
  petId?: string;
  newPet?: { name: string; species: string; breed?: string; dob: string; gender?: string };
  scheduledAt: string;
  note?: string;
  sendPortalInvite?: boolean;
}

const CONN = '/site-connections';
const REQ = '/site-requests';

export const siteConnectAPI = {
  // ── connections ──────────────────────────────────────────────────────────
  listConnections: (options?: RequestOptions): Promise<ApiResponse<{ connections: SiteConnection[] }>> =>
    get(CONN, { cache: false, ...options }),

  /**
   * ⚠️ The ONLY response that carries `secretKey` and `webhookSecret`. Only a
   * hash is stored, so if the caller does not show them now they are gone.
   */
  createConnection: (
    data: {
      name: string; siteUrl: string; allowedOrigins?: string[];
      environment?: 'LIVE' | 'TEST'; webhookUrl?: string | null;
      appointmentsEnabled?: boolean; catalogEnabled?: boolean; ordersEnabled?: boolean;
    },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ connection: SiteConnection; secretKey: string; webhookSecret: string | null }>> =>
    post(CONN, data, { showError: true, ...options }),

  updateConnection: (
    id: string,
    data: Partial<Pick<SiteConnection, 'name' | 'siteUrl' | 'allowedOrigins' | 'appointmentsEnabled' | 'catalogEnabled' | 'ordersEnabled' | 'webhookUrl' | 'webhookEnabled'>>,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ connection: SiteConnection; webhookSecret?: string }>> =>
    patch(`${CONN}/${id}`, data, { showError: true, ...options }),

  rotateKeys: (id: string, options?: RequestOptions): Promise<ApiResponse<{ connection: SiteConnection; secretKey: string }>> =>
    post(`${CONN}/${id}/rotate`, {}, { showError: true, ...options }),

  revokeConnection: (id: string, options?: RequestOptions): Promise<ApiResponse<{ revoked: boolean }>> =>
    del(`${CONN}/${id}`, { showError: true, ...options }),

  sendTestEvent: (id: string, options?: RequestOptions): Promise<ApiResponse<{ sent: boolean }>> =>
    post(`${CONN}/${id}/test`, {}, { showError: true, ...options }),

  listDeliveries: (id: string, options?: RequestOptions): Promise<ApiResponse<{ deliveries: SiteDelivery[] }>> =>
    get(`${CONN}/${id}/deliveries`, { cache: false, ...options }),

  resendDelivery: (id: string, deliveryId: string, options?: RequestOptions): Promise<ApiResponse<{ queued: boolean }>> =>
    post(`${CONN}/${id}/deliveries/${deliveryId}/resend`, {}, { showError: true, ...options }),

  // ── the request inbox ────────────────────────────────────────────────────
  listRequests: (params: { status?: string; limit?: number } = {}, options?: RequestOptions):
    Promise<ApiResponse<{ requests: SiteRequest[]; counts: Record<string, number> }>> => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return get(`${REQ}${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },

  getRequest: (id: string, options?: RequestOptions): Promise<ApiResponse<SiteRequestDetail>> =>
    get(`${REQ}/${id}`, { cache: false, ...options }),

  acknowledge: (id: string, options?: RequestOptions): Promise<ApiResponse<any>> =>
    post(`${REQ}/${id}/acknowledge`, {}, { ...options }),

  accept: (id: string, data: AcceptPayload, options?: RequestOptions):
    Promise<ApiResponse<{ request: SiteRequest; appointment: any; portal: { invited: boolean; reason?: string } }>> =>
    post(`${REQ}/${id}/accept`, data, { showError: true, ...options }),

  propose: (id: string, data: { proposedAt: string; note?: string }, options?: RequestOptions):
    Promise<ApiResponse<{ request: SiteRequest }>> =>
    post(`${REQ}/${id}/propose`, data, { showError: true, ...options }),

  decline: (id: string, data: { reason?: string }, options?: RequestOptions):
    Promise<ApiResponse<{ request: SiteRequest }>> =>
    post(`${REQ}/${id}/decline`, data, { showError: true, ...options }),

  markSpam: (id: string, options?: RequestOptions): Promise<ApiResponse<{ request: SiteRequest }>> =>
    post(`${REQ}/${id}/spam`, {}, { showError: true, ...options }),

  invitePortal: (id: string, clientId: string, options?: RequestOptions):
    Promise<ApiResponse<{ invited: boolean; reason?: string }>> =>
    post(`${REQ}/${id}/invite-portal`, { clientId }, { showError: true, ...options }),
};
