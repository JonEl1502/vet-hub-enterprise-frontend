import { get, put } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

export interface PlatformSettings {
  mpesaShortcode: string | null;
  mpesaCallbackBaseUrl: string | null;
  mpesaTestMode: boolean;
  // Pesapal — Public id is OK to expose; consumer key/secret stay opaque
  // and only have a "set"/"unset" boolean.
  pesapalIpnId: string | null;
  pesapalCallbackBaseUrl: string | null;
  pesapalTestMode: boolean;
  usdToKesRate: number;
  hasMpesaConsumerKey: boolean;
  hasMpesaConsumerSecret: boolean;
  hasMpesaPasskey: boolean;
  hasPesapalConsumerKey: boolean;
  hasPesapalConsumerSecret: boolean;
  updatedAt: string | null;
}

export interface PlatformSettingsUpdate {
  // Pass an empty string to clear a secret; undefined to leave unchanged.
  mpesaConsumerKey?: string | null;
  mpesaConsumerSecret?: string | null;
  mpesaPasskey?: string | null;
  mpesaShortcode?: string | null;
  mpesaCallbackBaseUrl?: string | null;
  mpesaTestMode?: boolean;
  pesapalConsumerKey?: string | null;
  pesapalConsumerSecret?: string | null;
  pesapalIpnId?: string | null;
  pesapalCallbackBaseUrl?: string | null;
  pesapalTestMode?: boolean;
  usdToKesRate?: number;
}

const BASE = '/admin/platform-settings';

export const platformSettingsAPI = {
  get: (options?: RequestOptions): Promise<ApiResponse<PlatformSettings>> =>
    get(BASE, { cache: false, ...options }),
  update: (data: PlatformSettingsUpdate, options?: RequestOptions): Promise<ApiResponse<PlatformSettings>> =>
    put(BASE, data, { showError: true, ...options }),
};
