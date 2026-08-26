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
  audience?: 'clinic' | 'supplier';
}

export const publicAPI = {
  // Bootstrap config read on app load (drives the signup-vs-demo switch).
  getConfig: (options?: RequestOptions): Promise<ApiResponse<PublicConfig>> =>
    get('/public/config', { cache: false, ...options }),

  // "Contact us for a demo" lead submission.
  requestDemo: (data: DemoRequestPayload, options?: RequestOptions): Promise<ApiResponse<{ received: boolean }>> =>
    post('/public/request-demo', data, { showError: true, ...options }),
};
