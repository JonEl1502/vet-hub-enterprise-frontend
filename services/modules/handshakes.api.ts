/**
 * Handshakes API Module
 * Clinic-to-clinic partnership requests
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type HandshakeStatusValue = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface HandshakeClinicSummary {
  id: string;
  name: string;
  logo?: string | null;
  subdomain?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface Handshake {
  id: string;
  requesterClinicId: string;
  receiverClinicId: string;
  status: HandshakeStatusValue;
  allowedServices: string[];
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  requesterClinic?: HandshakeClinicSummary;
  receiverClinic?: HandshakeClinicSummary;
}

export interface HandshakeList {
  sent: Handshake[];
  received: Handshake[];
}

export interface CreateHandshakeData {
  receiverClinicId: number | string;
  allowedServices: string[];
  note?: string;
}

export interface UpdateHandshakeData {
  status?: HandshakeStatusValue;
  allowedServices?: string[];
  note?: string;
}

export const handshakesAPI = {
  /** Get sent + received handshakes for the active clinic (uses X-Clinic-Id) */
  getAll: async (options?: RequestOptions): Promise<ApiResponse<HandshakeList>> =>
    get(ENDPOINTS.HANDSHAKES.BASE, { cache: false, ...options }),

  /** Get one handshake by ID */
  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ handshake: Handshake }>> =>
    get(ENDPOINTS.HANDSHAKES.BY_ID(id), { cache: false, ...options }),

  /** Create a new partnership request */
  create: async (data: CreateHandshakeData, options?: RequestOptions): Promise<ApiResponse<{ handshake: Handshake }>> =>
    post(ENDPOINTS.HANDSHAKES.BASE, data, { showError: true, ...options }),

  /** Update handshake fields (status, services, note) */
  update: async (id: string | number, data: UpdateHandshakeData, options?: RequestOptions): Promise<ApiResponse<{ handshake: Handshake }>> =>
    put(ENDPOINTS.HANDSHAKES.BY_ID(id), data, { showError: true, ...options }),

  /** Delete a handshake */
  delete: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ message: string }>> =>
    del(ENDPOINTS.HANDSHAKES.BY_ID(id), { showError: true, ...options }),

  /** Accept an incoming handshake */
  accept: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ handshake: Handshake }>> =>
    post(ENDPOINTS.HANDSHAKES.ACCEPT(id), {}, { showError: true, ...options }),

  /** Reject an incoming handshake */
  reject: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ handshake: Handshake }>> =>
    post(ENDPOINTS.HANDSHAKES.REJECT(id), {}, { showError: true, ...options }),
};
