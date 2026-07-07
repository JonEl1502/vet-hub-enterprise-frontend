/**
 * Boarding API Module — multi-day boarding stays + daily care logs.
 * Shapes mirror the backend boarding.service transforms.
 */
import { get, post, patch } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';

export type BoardingStatus = 'ADMITTED' | 'CHECKED_OUT' | 'CANCELLED';

export interface BoardingDailyLog {
  id: string;
  boardingStayId: string;
  logDate: string;
  fedAm: boolean;
  fedPm: boolean;
  walked: boolean;
  medicationGiven: boolean;
  stool: string | null;
  appetite: string | null;
  notes: string | null;
  mealPhoto: string | null;
  foodNotes: string | null;
  createdAt: string;
}

export interface BoardingStay {
  id: string;
  displayFormat?: string;
  clinicId: string;
  petId: string;
  clientId: string;
  appointmentId: string | null;
  status: BoardingStatus;
  dropOffAt: string;
  expectedPickupAt: string | null;
  actualPickupAt: string | null;
  kennel: string | null;
  dailyRate: number | null;
  intakeWeight: number | null;
  dischargeWeight: number | null;
  weightChange: number | null;
  vaccineChecklist: Record<string, boolean>;
  foodProgram: Record<string, any>;
  specialInstructions: string | null;
  feedingInstructions: string | null;
  medicationInstructions: string | null;
  // Belongings log (077): items the pet arrives with.
  belongings: string | null;
  emergencyContact: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  pet: { id: string; name: string; species: string; breed: string; avatarUrl: string | null } | null;
  client: { id: string; name: string; phone: string } | null;
  billing: { appointmentId: string; totalCost: number; isPaid: boolean; status: string; hasReminder?: boolean } | null;
  allowedClinicIds?: string[];
  dailyLogs?: BoardingDailyLog[];
}

export interface BoardingOccupancy {
  activeStays: number;
  pickupsDueToday: number;
}

export interface CreateBoardingPayload {
  petId: string | number;
  clientId: string | number;
  appointmentId?: string | number;
  dropOffAt?: string;
  expectedPickupAt?: string;
  kennel?: string;
  dailyRate?: number;
  intakeWeight?: number;
  dischargeWeight?: number;
  vaccineChecklist?: Record<string, boolean>;
  foodProgram?: Record<string, any>;
  specialInstructions?: string;
  feedingInstructions?: string;
  medicationInstructions?: string;
  belongings?: string;
  emergencyContact?: string;
  notes?: string;
}

export const boardingAPI = {
  occupancy: async (options?: RequestOptions): Promise<ApiResponse<BoardingOccupancy>> =>
    get(ENDPOINTS.BOARDING.OCCUPANCY, { cache: false, ...options }),

  list: async (status: 'active' | 'all' = 'active', options?: RequestOptions): Promise<ApiResponse<{ stays: BoardingStay[] }>> =>
    get(`${ENDPOINTS.BOARDING.BASE}?status=${status}`, { cache: false, ...options }),

  getById: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ stay: BoardingStay }>> =>
    get(ENDPOINTS.BOARDING.BY_ID(id), { cache: false, ...options }),

  create: async (data: CreateBoardingPayload, options?: RequestOptions): Promise<ApiResponse<{ stay: BoardingStay }>> =>
    post(ENDPOINTS.BOARDING.BASE, data, { showError: true, ...options }),

  update: async (id: string | number, data: Partial<CreateBoardingPayload> & { status?: BoardingStatus; actualPickupAt?: string; reminder?: { serviceType?: string; title?: string; notes?: string; dueAt: string } | null }, options?: RequestOptions): Promise<ApiResponse<{ stay: BoardingStay }>> =>
    patch(ENDPOINTS.BOARDING.BY_ID(id), data, { showError: true, ...options }),

  checkOut: async (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ stay: BoardingStay }>> =>
    patch(ENDPOINTS.BOARDING.BY_ID(id), { status: 'CHECKED_OUT' }, { showError: true, ...options }),

  // Materialize the bill + finalize the appointment; returns the appointment id to settle.
  bill: async (id: string | number, reminder?: { serviceType?: string; title?: string; notes?: string; dueAt: string } | null, options?: RequestOptions): Promise<ApiResponse<{ appointmentId: string | null }>> =>
    post(ENDPOINTS.BOARDING.BILL(id), reminder ? { reminder } : {}, { showError: true, ...options }),

  addLog: async (
    id: string | number,
    data: Partial<Omit<BoardingDailyLog, 'id' | 'boardingStayId' | 'createdAt'>>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ log: BoardingDailyLog }>> =>
    post(ENDPOINTS.BOARDING.LOGS(id), data, { showError: true, ...options }),
};
