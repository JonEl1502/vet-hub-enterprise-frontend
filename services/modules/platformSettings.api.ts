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
  // Platform-wide UI display currency (KES by default). Affects every
  // monetary value the frontend formats — admin reports, clinic billing,
  // plan cards, etc.
  displayCurrency: string;
  // Public self-serve signup switch. When false the marketing site routes
  // signup CTAs to the "Contact us for a demo" form instead of the wizard.
  signupsEnabled: boolean;
  hasMpesaConsumerKey: boolean;
  hasMpesaConsumerSecret: boolean;
  hasMpesaPasskey: boolean;
  hasPesapalConsumerKey: boolean;
  hasPesapalConsumerSecret: boolean;
  // Lipana — one API key drives STK + payment links; webhook secret is a
  // separate value that confirms payment. Amounts come from the package
  // table, so there's no amount config here.
  lipanaPublishableKey: string | null;
  lipanaCallbackBaseUrl: string | null;
  lipanaTestMode: boolean;
  hasLipanaSecretKey: boolean;
  hasLipanaWebhookSecret: boolean;
  // Paystack — a single secret key is enough; Paystack signs webhooks with
  // it, and we use the hosted-redirect flow (no public key needed).
  paystackPublicKey: string | null;
  paystackCallbackBaseUrl: string | null;
  paystackTestMode: boolean;
  hasPaystackSecretKey: boolean;
  hasPaystackWebhookSecret: boolean;
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
  lipanaSecretKey?: string | null;
  lipanaWebhookSecret?: string | null;
  lipanaPublishableKey?: string | null;
  lipanaCallbackBaseUrl?: string | null;
  lipanaTestMode?: boolean;
  paystackSecretKey?: string | null;
  paystackWebhookSecret?: string | null;
  paystackPublicKey?: string | null;
  paystackCallbackBaseUrl?: string | null;
  paystackTestMode?: boolean;
  usdToKesRate?: number;
  displayCurrency?: string;
  signupsEnabled?: boolean;
  aiProvider?: AiProvider;
  anthropicApiKey?: string | null;
  anthropicModel?: string | null;
  openaiApiKey?: string | null;
  openaiModel?: string | null;
  groqApiKey?: string | null;
  groqModel?: string | null;
}

const BASE = '/admin/platform-settings';

export interface DisplayConfig {
  displayCurrency: string;
  usdToKesRate: number;
}

export const platformSettingsAPI = {
  get: (options?: RequestOptions): Promise<ApiResponse<PlatformSettings>> =>
    get(BASE, { cache: false, ...options }),
  update: (data: PlatformSettingsUpdate, options?: RequestOptions): Promise<ApiResponse<PlatformSettings>> =>
    put(BASE, data, { showError: true, ...options }),
  // Lightweight read for any authenticated user (clinic, supplier, admin).
  // Powers useDisplayCurrency() so prices format in the platform-chosen
  // currency everywhere.
  getDisplayConfig: (options?: RequestOptions): Promise<ApiResponse<DisplayConfig>> =>
    get(`${BASE}/display-config`, { cache: false, ...options }),
};
