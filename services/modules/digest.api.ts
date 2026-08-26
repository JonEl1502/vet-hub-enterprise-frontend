/**
 * Daily summary email (255).
 *
 * One evening email per clinic: the day that is closing, then the day that is
 * coming. This module is the clinic's control over it — the switch, the hour,
 * a read-only preview of the numbers, and a test send.
 *
 * ⚠️ The hour is in the CLINIC'S timezone, not the browser's. A manager in
 * London setting "18" for a Nairobi clinic is choosing 6pm Nairobi, and the UI
 * has to say so or the setting means two different things to two people.
 */

import { get, post, put } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

/** Someone who can receive the summary. */
export interface DigestPerson {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Ticked. Always true for the owner, who cannot be unticked. */
  selected: boolean;
}

export interface DigestSettings {
  enabled: boolean;
  /** 0–23, in `timezone`. */
  hour: number;
  timezone: string;
  /** Local day (YYYY-MM-DD) last sent for, or null if never. */
  lastSentOn: string | null;
  /**
   * Always included, never unticked — an owner who could remove themselves
   * could leave the summary switched on and going nowhere. Null only when the
   * clinic has no owner account with an email.
   */
  owner: DigestPerson | null;
  /** Everyone else at the clinic with an email; `selected` says who is ticked. */
  staff: DigestPerson[];
  /** The addresses one send resolves to right now. Derived, read-only. */
  recipients: string[];
  /** False when the server has no RESEND_API_KEY — nothing will send. */
  emailConfigured: boolean;
}

export interface DigestRow {
  time: string | null;
  pet: string;
  client: string;
  detail: string;
}

export interface DigestData {
  clinicId: string;
  clinicName: string;
  timezone: string;
  today: string;
  tomorrow: string;
  recap: {
    visitsTotal: number;
    completed: number;
    inProgress: number;
    awaitingPayment: number;
    /** Still SCHEDULED at the end of its own day — the animal never arrived. */
    neverArrived: number;
    cancelled: number;
    remindersDone: number;
    remindersMissed: number;
    bookingsConverted: number;
    bookingsNoShow: number;
    openVisits: DigestRow[];
    missedReminders: DigestRow[];
  };
  outlook: {
    appointments: number;
    scheduledVisits: number;
    remindersDue: number;
    checkouts: number;
    /** Boarding + inpatient animals in the building overnight. */
    staying: number;
    appointmentRows: DigestRow[];
    checkoutRows: DigestRow[];
    reminderRows: DigestRow[];
  };
  /** PENDING and due before today. Neither today's nor tomorrow's list. */
  overdueReminders: number;
}

export const digestAPI = {
  getSettings: (options?: RequestOptions): Promise<ApiResponse<DigestSettings>> =>
    get(ENDPOINTS.DIGEST.SETTINGS, { silent: true, ...options }),

  /** `recipientIds` is the EXTRA staff — never the owner, who is always sent. */
  saveSettings: (data: { enabled?: boolean; hour?: number; recipientIds?: string[] }, options?: RequestOptions): Promise<ApiResponse<DigestSettings>> =>
    put(ENDPOINTS.DIGEST.SETTINGS, data, { showError: true, ...options }),

  /** The numbers without sending anything. `day` defaults to today. */
  preview: (day?: string, options?: RequestOptions): Promise<ApiResponse<DigestData>> =>
    get(`${ENDPOINTS.DIGEST.PREVIEW}${day ? `?day=${day}` : ''}`, { silent: true, ...options }),

  /** Sends to the signed-in user only, and does not consume the day's send. */
  sendTest: (day?: string, options?: RequestOptions): Promise<ApiResponse<{ sent: boolean; recipients: string[] }>> =>
    post(ENDPOINTS.DIGEST.TEST, day ? { day } : undefined, { showError: true, ...options }),
};

export default digestAPI;
