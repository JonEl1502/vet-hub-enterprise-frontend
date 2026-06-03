/**
 * Verification API Module
 * Owner-facing (clinic/supplier submit business docs) + admin review/approve.
 */

import { get, post, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type VerificationStatus = 'TEMP_ACTIVE' | 'FULL' | 'REJECTED';
export type BusinessDocType = 'BUSINESS_LICENSE' | 'BUSINESS_REGISTRATION' | 'OWNER_ID';
export type DocumentSide = 'FRONT' | 'BACK';

export interface BusinessDocument {
  id: string;
  docType: BusinessDocType;
  side: DocumentSide | null;
  fileUrl: string;
  contentType: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNotes: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
}

export interface VerificationInfo {
  status: VerificationStatus;
  verifiedAt: string | null;
  notes: string | null;
  documents: BusinessDocument[];
}

export interface VerificationQueueItem {
  type: 'clinic' | 'supplier';
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: VerificationStatus;
  verifiedAt: string | null;
  createdAt: string;
  docCount: number;
  pendingDocs: number;
}

interface SubmitDocPayload {
  docType: BusinessDocType;
  side?: DocumentSide;
  fileUrl: string;
  fileKey?: string;
  contentType?: string;
}

export const verificationAPI = {
  // ---- clinic owner ----------------------------------------------------
  getClinic: (clinicId: string | number, o?: RequestOptions): Promise<ApiResponse<VerificationInfo>> =>
    get(ENDPOINTS.VERIFICATION.CLINIC(clinicId), { ...o }),
  submitClinicDoc: (clinicId: string | number, data: SubmitDocPayload, o?: RequestOptions): Promise<ApiResponse<{ document: BusinessDocument }>> =>
    post(ENDPOINTS.VERIFICATION.CLINIC_DOCS(clinicId), data, { showError: true, ...o }),
  deleteClinicDoc: (clinicId: string | number, docId: string | number, o?: RequestOptions): Promise<ApiResponse<any>> =>
    del(ENDPOINTS.VERIFICATION.CLINIC_DOC(clinicId, docId), { showError: true, ...o }),

  // ---- supplier owner --------------------------------------------------
  getSupplier: (supplierId: string | number, o?: RequestOptions): Promise<ApiResponse<VerificationInfo>> =>
    get(ENDPOINTS.VERIFICATION.SUPPLIER(supplierId), { ...o }),
  submitSupplierDoc: (supplierId: string | number, data: SubmitDocPayload, o?: RequestOptions): Promise<ApiResponse<{ document: BusinessDocument }>> =>
    post(ENDPOINTS.VERIFICATION.SUPPLIER_DOCS(supplierId), data, { showError: true, ...o }),
  deleteSupplierDoc: (supplierId: string | number, docId: string | number, o?: RequestOptions): Promise<ApiResponse<any>> =>
    del(ENDPOINTS.VERIFICATION.SUPPLIER_DOC(supplierId, docId), { showError: true, ...o }),

  // ---- admin -----------------------------------------------------------
  adminList: (params?: { type?: 'clinic' | 'supplier'; status?: string }, o?: RequestOptions): Promise<ApiResponse<{ items: VerificationQueueItem[] }>> =>
    get(ENDPOINTS.VERIFICATION.ADMIN_LIST, { params, ...o }),
  adminGetEntity: (type: string, id: string | number, o?: RequestOptions): Promise<ApiResponse<VerificationInfo>> =>
    get(ENDPOINTS.VERIFICATION.ADMIN_ENTITY(type, id), { ...o }),
  adminApprove: (type: string, id: string | number, notes?: string, o?: RequestOptions): Promise<ApiResponse<{ status: string }>> =>
    post(ENDPOINTS.VERIFICATION.ADMIN_APPROVE(type, id), { notes }, { showError: true, ...o }),
  adminReject: (type: string, id: string | number, reason: string, o?: RequestOptions): Promise<ApiResponse<{ status: string }>> =>
    post(ENDPOINTS.VERIFICATION.ADMIN_REJECT(type, id), { reason }, { showError: true, ...o }),
};

export default verificationAPI;
