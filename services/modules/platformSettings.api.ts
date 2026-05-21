import { get, put } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

export type AiProvider = 'anthropic' | 'openai' | 'groq' | 'none' | 'auto';

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
  // AI provider config — what the admin chose + presence of each key.
  aiProvider: AiProvider;
  anthropicModel: string | null;
  openaiModel: string | null;
  groqModel: string | null;
  hasAnthropicApiKey: boolean;
  hasOpenaiApiKey: boolean;
  hasGroqApiKey: boolean;
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
  aiProvider?: AiProvider;
  anthropicApiKey?: string | null;
  anthropicModel?: string | null;
  openaiApiKey?: string | null;
  openaiModel?: string | null;
  groqApiKey?: string | null;
  groqModel?: string | null;
}

const BASE = '/admin/platform-settings';

export const platformSettingsAPI = {
  get: (options?: RequestOptions): Promise<ApiResponse<PlatformSettings>> =>
    get(BASE, { cache: false, ...options }),
  update: (data: PlatformSettingsUpdate, options?: RequestOptions): Promise<ApiResponse<PlatformSettings>> =>
    put(BASE, data, { showError: true, ...options }),
};
