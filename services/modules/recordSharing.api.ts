import { get, put } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type ShareableRecordType = 'lab' | 'imaging' | 'boarding' | 'inpatient' | 'grooming' | 'surgery';

export interface RecordAccessLogEntry {
  id: string;
  recordType: string;
  recordId: string;
  action: string;
  accessedByClinicId: string;
  accessedByUserId: string | null;
  createdAt: string;
}

export const recordSharingAPI = {
  // Set the full partner-clinic allow-list on a record (owner-only).
  setShares: async (recordType: ShareableRecordType, recordId: string | number, clinicIds: (string | number)[], options?: RequestOptions): Promise<ApiResponse<{ recordType: string; recordId: string; allowedClinicIds: string[] }>> =>
    put(ENDPOINTS.RECORD_SHARES.BASE, { recordType, recordId, clinicIds }, { showError: true, ...options }),

  // Who accessed records this clinic owns (audit).
  accessLog: async (options?: RequestOptions): Promise<ApiResponse<{ logs: RecordAccessLogEntry[] }>> =>
    get(ENDPOINTS.RECORD_SHARES.ACCESS_LOG, { cache: false, ...options }),
};
