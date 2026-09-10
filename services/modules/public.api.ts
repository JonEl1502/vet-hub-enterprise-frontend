import { get, post } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

// Unauthenticated endpoints the marketing / auth screens hit before login.

export interface PublicConfig {
  signupsEnabled: boolean;
}

export interface DemoRequestPayload {
  name: string;
  email: string;
  /** Org name. Called `clinicName` because that is the lead column; a supplier
   *  lead puts the company here and the server relabels it. */
  clinicName?: string;
  phone?: string;
  message?: string;
  /**
   * Who is asking. The server maps this to the lead's `source`
   * (`SUPPLIER_SIGNUP` / `LANDING`) — deliberately NOT sent as a `source`,
   * because that column is the axis the admin lead queues split on and a
   * public form must not be able to write into it.
   */
  /**
   * WHO is asking, said by the visitor rather than assumed by the caller. The
   * server maps this to `segment`; it deliberately cannot write `source`, which
   * is the axis the lead queues split on.
   */
  audience?: 'clinic' | 'practitioner' | 'boarding' | 'counter' | 'supplier';
}

/** 297 — the narrow projection behind a QR scan. Nothing here that is not
 *  already on the clinic's own signage. */
export interface PublicClinic {
  id: string;
  name: string;
  slogan: string | null;
  logo: string | null;
  city: string | null;
  countryCode: string | null;
  subdomain: string;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export const publicAPI = {
  // Bootstrap config read on app load (drives the signup-vs-demo switch).
  getConfig: (options?: RequestOptions): Promise<ApiResponse<PublicConfig>> =>
    get('/public/config', { cache: false, ...options }),

  /**
   * 297 — resolve the clinic behind a QR code, for the client landing at
   * `/c/:slug`. Unauthenticated: whoever scanned it has no account yet.
   * `silent` because a 404 here is a normal outcome (a stale poster), and the
   * landing renders its own "we couldn't find that clinic" rather than a toast.
   */
  clinicBySlug: (
    slug: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ clinic: PublicClinic }>> =>
    get(`/public/clinic/${encodeURIComponent(slug)}`, { cache: false, silent: true, ...options }),

  // "Contact us for a demo" lead submission.
  requestDemo: (data: DemoRequestPayload, options?: RequestOptions): Promise<ApiResponse<{ received: boolean }>> =>
    post('/public/request-demo', data, { showError: true, ...options }),
};
