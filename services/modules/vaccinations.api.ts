import api from '../api/client';

export interface VaccinationRecord {
  id: string;
  petId: string;
  clinicId: string;
  appointmentId?: string;
  // Visit-task link (two-way status sync); null for a custom/standalone record.
  taskId?: string | null;
  // Added directly in a visit (not from the standard schedule) — UI badges these.
  isCustom?: boolean;
  vaccineName: string;
  /** 329 — the product given, e.g. "Nobivac DHPPi · MSD". */
  vaccineType?: string | null;
  batchNumber?: string;
  /** 329 — expiry of the lot the dose came from (YYYY-MM-DD). */
  batchExpiry?: string | null;
  /** 329 — the stored serial of this visit's vaccination certificate. */
  certificateSerial?: string | null;
  // Dispensed vial's SKU. Set on records created before the stock-linking
  // flow was removed (2026-09-18) — new records never carry one.
  sku?: string | null;
  // Stock link on records created before the stock-linking flow was removed
  // (2026-09-18) — `deleteVaccinationRecord` still restocks these on delete.
  inventoryItemId?: string | null;
  stockDeductedAt?: string | null;
  // Vaccine package this record was expanded from (null for single vaccines).
  sourcePackageName?: string | null;
  administeredById?: string;
  administeredAt?: string;
  expiryDate: string;
  // Next dose due (YYYY-MM-DD). Set by the vet when the dose is given; the
  // backend then raises the follow-up reminder (+ booking if asked).
  nextDueAt?: string | null;
  status: 'SCHEDULED' | 'ADMINISTERED' | 'EXPIRED';
  createdAt: string;
  updatedAt: string;
}

export interface CreateVaccinationData {
  petId: string;
  vaccineName: string;
  batchNumber?: string;
  administeredById?: string;
  administeredAt?: string;
  expiryDate?: string;
  status?: 'SCHEDULED' | 'ADMINISTERED' | 'EXPIRED';
  appointmentId?: string;
  taskId?: string;
  isCustom?: boolean;
  nextDueAt?: string | null;
  vaccineType?: string | null;
  batchExpiry?: string | null;
  // Also raise the appointment for the next-due date (the reminder is always
  // created). Action flag — not stored on the record.
  bookFollowUp?: boolean;
}

export interface UpdateVaccinationData {
  vaccineName?: string;
  batchNumber?: string;
  sku?: string;
  vaccineType?: string | null;
  batchExpiry?: string | null;
  administeredById?: string;
  administeredAt?: string;
  expiryDate?: string;
  // null clears the next-due date; omit to leave it untouched.
  nextDueAt?: string | null;
  bookFollowUp?: boolean;
  status?: 'SCHEDULED' | 'ADMINISTERED' | 'EXPIRED';
}

export const vaccinationsAPI = {
  // Create vaccination record manually
  create: async (data: CreateVaccinationData): Promise<VaccinationRecord> => {
    const response = await api.post('/vaccinations', data);
    return response.data.vaccinationRecord;
  },

  // Update vaccination record
  update: async (id: string, data: UpdateVaccinationData): Promise<VaccinationRecord> => {
    const response = await api.put(`/vaccinations/${id}`, data);
    return response.data.vaccinationRecord;
  },

  // Get vaccination records by appointment
  getByAppointment: async (appointmentId: string): Promise<VaccinationRecord[]> => {
    const response = await api.get(`/vaccinations/by-appointment/${appointmentId}`);
    return response.data.vaccinationRecords;
  },

  // Create vaccination records from appointment
  createFromAppointment: async (appointmentId: string): Promise<VaccinationRecord[]> => {
    const response = await api.post(`/vaccinations/from-appointment/${appointmentId}`);
    return response.data.vaccinationRecords;
  },

  /**
   * 329 — issue (or fetch) the visit's certificate serial. Idempotent: the same
   * visit always gets the same serial; doses given later join it.
   */
  issueCertificate: async (appointmentId: string): Promise<{ serial: string; vaccinationRecords: VaccinationRecord[] }> => {
    const response = await api.post(`/vaccinations/certificate/by-appointment/${appointmentId}`);
    return response.data;
  },

  /** 329 — look a certificate up again by its serial. */
  getCertificate: async (serial: string): Promise<{ serial: string; appointmentId: string | null; pet: any; vaccinationRecords: VaccinationRecord[] }> => {
    const response = await api.get(`/vaccinations/certificate/${encodeURIComponent(serial)}`);
    return response.data;
  },

  // Delete a vaccination record (e.g. a custom vaccine added by mistake)
  remove: async (id: string): Promise<void> => {
    await api.delete(`/vaccinations/${id}`);
  },
};

