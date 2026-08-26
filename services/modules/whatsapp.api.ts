/**
 * Clinic-side WhatsApp API Module
 *
 * Three things live here: the clinic's own WhatsApp Business credentials
 * (BYOK), the queue of enquiries from numbers with no matching client, and the
 * on-demand bill notice.
 *
 * ⚠️ Secrets are WRITE-ONLY. Reads return the last four characters, masked —
 * a settings screen that can display a permanent access token is a settings
 * screen that leaks it to anyone who gets one look at the browser. Sending a
 * blank secret means "keep what is stored", which is what lets the form submit
 * masked placeholders for fields nobody retyped.
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

/**
 * The purposes Meta must approve a template for.
 *
 * `default` is the one most clinics will ever fill in: a single generic
 * notification template that stands in for the three utility purposes, so
 * going live means one Meta review instead of three.
 *
 * ⚠️ `clinic_broadcast` NEVER falls back to `default` — a broadcast is
 * MARKETING and the rest are UTILITY, and sending marketing through a utility
 * template is how a number gets reclassified or its quality rating dropped.
 */
export type WhatsappPurpose = 'default' | 'appointment_reminder' | 'bill_due' | 'vaccination_due' | 'clinic_broadcast';

export interface WhatsappTemplateRef {
  name: string;
  language: string;
}

export interface WhatsappConfigView {
  /** True when this clinic can send at all — on its own number or VetHub's. */
  configured: boolean;
  /** 'clinic' = own WABA · 'platform' = riding on VetHub's · 'none' = nothing set up. */
  tier: 'clinic' | 'platform' | 'none';
  phoneNumberId: string | null;
  wabaId: string | null;
  displayPhone: string | null;
  isActive: boolean;
  /** Masked to the last 4 characters. Never the real value. */
  secrets: { accessToken: string | null; appSecret: string | null; verifyToken: string | null };
  /** This clinic's overrides. Empty means it uses platformTemplates. */
  templates: Partial<Record<WhatsappPurpose, WhatsappTemplateRef>>;
  platformTemplates: Partial<Record<WhatsappPurpose, WhatsappTemplateRef>>;
  /** Lets the reminder cron message clients with no human pressing send. */
  autoReminders: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
  /** Paste this into Meta's webhook configuration. */
  webhookUrl: string;
}

export interface WhatsappTestResult {
  ok: boolean;
  detail: string;
  displayPhone?: string;
  /** Meta's own rating. Falls when recipients block or report. */
  qualityRating?: string;
}

/** One enquiry message from an unrecognised number. */
export interface UnmatchedMessage {
  id: string;
  body: string;
  receivedAt: string;
  mediaType: string | null;
  /** Our stored copy — Meta's original expires after 30 days. */
  mediaUrl: string | null;
}

/**
 * Enquiries grouped BY SENDER. Someone who messages four times is one
 * prospect, not four leads.
 */
export interface UnmatchedSender {
  fromPhone: string;
  profileName: string | null;
  messageCount: number;
  firstAt: string;
  lastAt: string;
  ids: string[];
  messages: UnmatchedMessage[];
}

export const whatsappAPI = {
  getConfig: (options?: RequestOptions): Promise<ApiResponse<WhatsappConfigView>> =>
    get(ENDPOINTS.WHATSAPP.CONFIG, { silent: true, ...options }),

  /** Omit or blank a secret to keep the stored one. */
  saveConfig: (
    data: {
      phoneNumberId?: string;
      wabaId?: string;
      displayPhone?: string;
      accessToken?: string;
      appSecret?: string;
      verifyToken?: string;
      isActive?: boolean;
      templates?: Partial<Record<WhatsappPurpose, { name: string; language: string }>>;
    },
    options?: RequestOptions,
  ): Promise<ApiResponse<WhatsappConfigView>> =>
    put(ENDPOINTS.WHATSAPP.CONFIG, data, { showError: true, ...options }),

  /** Read-only check against Meta. Deliberately not a test SEND. */
  testConfig: (options?: RequestOptions): Promise<ApiResponse<WhatsappTestResult>> =>
    post(ENDPOINTS.WHATSAPP.CONFIG_TEST, undefined, { showError: true, ...options }),

  /** Falls back to the VetHub number rather than losing WhatsApp entirely. */
  removeConfig: (options?: RequestOptions): Promise<ApiResponse<WhatsappConfigView>> =>
    del(ENDPOINTS.WHATSAPP.CONFIG, { showError: true, ...options }),

  setAutoReminders: (enabled: boolean, options?: RequestOptions): Promise<ApiResponse<WhatsappConfigView>> =>
    post(ENDPOINTS.WHATSAPP.AUTO_REMINDERS, { enabled }, { showError: true, ...options }),

  listUnmatched: (
    status?: 'NEW' | 'CONVERTED' | 'DISMISSED',
    options?: RequestOptions,
  ): Promise<ApiResponse<{ senders: UnmatchedSender[]; total: number }>> =>
    get(`${ENDPOINTS.WHATSAPP.UNMATCHED}${status ? `?status=${status}` : ''}`, { silent: true, ...options }),

  /** Counts PEOPLE waiting, not messages — it drives a badge. */
  unmatchedCount: (options?: RequestOptions): Promise<ApiResponse<{ senders: number; messages: number }>> =>
    get(ENDPOINTS.WHATSAPP.UNMATCHED_COUNT, { silent: true, ...options }),

  /**
   * Create a real client from an enquiry and move that sender's whole backlog.
   * The name is typed by a person on purpose — a WhatsApp profile name makes a
   * poor client record.
   */
  convertUnmatched: (
    id: string | number,
    data: { firstName: string; surname: string; email?: string; phone?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ clientId: string; created: boolean; closed: number }>> =>
    post(ENDPOINTS.WHATSAPP.UNMATCHED_CONVERT(id), data, { showError: true, ...options }),

  dismissUnmatched: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ dismissed: number }>> =>
    post(ENDPOINTS.WHATSAPP.UNMATCHED_DISMISS(id), undefined, { showError: true, ...options }),

  /** On demand only — there is no cron behind this. */
  sendBillNotice: (billId: string | number, options?: RequestOptions): Promise<ApiResponse<{ sent: boolean }>> =>
    post(ENDPOINTS.WHATSAPP.BILL_NOTICE(billId), undefined, { showError: true, ...options }),
};

export default whatsappAPI;
