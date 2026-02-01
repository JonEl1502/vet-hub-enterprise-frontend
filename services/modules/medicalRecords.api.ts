/**
 * Medical Records API Module
 */

import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { PaginationParams, PaginationMeta, buildPaginationQuery } from '../types/pagination';

/**
 * Medical Record data type
 */
export interface MedicalRecord {
  id: string;
  petId: string;
  appointmentId?: string;
  clinicId: string;
  diagnosis: string;
  treatment: string;
  medications: string[];
  serviceNotes: string[];
  files: string[];
  sharedWithClinicIds: string[];
  originReferralId?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
  pet?: {
    id: string;
    name: string;
    species: string;
    breed?: string;
  };
  clinic?: {
    id: string;
    name: string;
  };
  appointment?: {
    id: string;
    scheduledAt: string;
    status: string;
  };
}

/**
 * Medical Records API
 */
export const medicalRecordsAPI = {
  /**
   * Get all medical records with pagination
   */
  getAll: async (
    params?: PaginationParams & { petId?: string },
    options?: RequestOptions
  ): Promise<ApiResponse<{ medicalRecords: MedicalRecord[]; pagination: PaginationMeta }>> => {
    const { petId, ...paginationParams } = params || {};
    let query = buildPaginationQuery(paginationParams);

    if (petId) {
      const additionalParams = new URLSearchParams();
      additionalParams.append('petId', petId);
      const additionalQuery = additionalParams.toString();
      query = query ? `${query}&${additionalQuery}` : `?${additionalQuery}`;
    }

    return get(`${ENDPOINTS.MEDICAL_RECORDS.BASE}${query}`, {
      cache: true,
      cacheDuration: 60000, // Cache for 1 minute
      ...options,
    });
  },

  /**
   * Get medical record by ID
   */
  getById: async (
    id: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ medicalRecord: MedicalRecord }>> => {
    return get(ENDPOINTS.MEDICAL_RECORDS.BY_ID(parseInt(id)), {
      cache: true,
      ...options,
    });
  },

  /**
   * Get medical records for a pet
   */
  getByPetId: async (
    petId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ medicalRecords: MedicalRecord[] }>> => {
    return get(`/pets/${petId}/medical-records`, {
      cache: true,
      cacheDuration: 60000,
      ...options,
    });
  },

  /**
   * Create new medical record
   */
  create: async (
    data: Partial<MedicalRecord>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ medicalRecord: MedicalRecord }>> => {
    return post(ENDPOINTS.MEDICAL_RECORDS.BASE, data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Update medical record
   */
  update: async (
    id: string,
    data: Partial<MedicalRecord>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ medicalRecord: MedicalRecord }>> => {
    return put(ENDPOINTS.MEDICAL_RECORDS.BY_ID(parseInt(id)), data, {
      showError: true,
      ...options,
    });
  },

  /**
   * Delete medical record
   */
  delete: async (
    id: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return del(ENDPOINTS.MEDICAL_RECORDS.BY_ID(parseInt(id)), {
      showError: true,
      ...options,
    });
  },

  /**
   * Generate medical record from appointment
   */
  generateFromAppointment: async (
    appointmentId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<{ medicalRecord: MedicalRecord }>> => {
    return post(`${ENDPOINTS.MEDICAL_RECORDS.BASE}/from-appointment/${appointmentId}`, {}, {
      showError: true,
      ...options,
    });
  },
};

