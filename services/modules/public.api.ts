import { get, post } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

// Unauthenticated endpoints the marketing / auth screens hit before login.

export interface PublicConfig {
  signupsEnabled: boolean;
}

export interface DemoRequestPayload {
  name: string;
  email: string;
  clinicName?: string;
  phone?: string;
  message?: string;
}

export const publicAPI = {
  // Bootstrap config read on app load (drives the signup-vs-demo switch).
  getConfig: (options?: RequestOptions): Promise<ApiResponse<PublicConfig>> =>
    get('/public/config', { cache: false, ...options }),

  // "Contact us for a demo" lead submission.
  requestDemo: (data: DemoRequestPayload, options?: RequestOptions): Promise<ApiResponse<{ received: boolean }>> =>
    post('/public/request-demo', data, { showError: true, ...options }),
};
