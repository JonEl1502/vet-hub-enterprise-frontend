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
  batchNumber?: string;
  administeredById?: string;
  administeredAt?: string;
  expiryDate: string;
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
}

export interface UpdateVaccinationData {
  vaccineName?: string;
  batchNumber?: string;
  administeredById?: string;
  administeredAt?: string;
  expiryDate?: string;
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

  // Delete a vaccination record (e.g. a custom vaccine added by mistake)
  remove: async (id: string): Promise<void> => {
    await api.delete(`/vaccinations/${id}`);
  },
};

