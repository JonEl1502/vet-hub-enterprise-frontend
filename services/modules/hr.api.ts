/**
 * HR API — employment files, leave, rota and attendance for the active clinic.
 *
 * ⚠️ Pay fields (`basicSalary`, bank details, statutory numbers) are ABSENT
 * from the response, not null, when the caller is not an owner/admin. Render
 * on `'basicSalary' in record`, never on a truthiness check — a manager would
 * otherwise see an empty salary box and fill it in, and the save would drop it.
 */
import { get, post, put, del } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export type HrContractType = 'PERMANENT' | 'FIXED_TERM' | 'LOCUM' | 'CASUAL' | 'INTERN' | 'ATTACHMENT';
export type HrEmploymentStatus = 'PROBATION' | 'ACTIVE' | 'SUSPENDED' | 'ON_NOTICE' | 'TERMINATED' | 'RESIGNED';
export type HrLeaveStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
export type HrShiftStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'MISSED' | 'CANCELLED';
export type HrAttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'OFF_DUTY';

export interface HrEmploymentRecord {
  id: string;
  userId: string;
  staffNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  contractType: HrContractType;
  status: HrEmploymentStatus;
  startedOn: string | null;
  probationEndsOn: string | null;
  endedOn: string | null;
  endReason: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  nextOfKinRelation: string | null;
  notes: string | null;
  // Present ONLY for owner/admin — see the file header.
  basicSalary?: number | null;
  payFrequency?: string;
  kraPin?: string | null;
  nssfNumber?: string | null;
  shifNumber?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccount?: string | null;
}

export interface HrPerson {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  phone: string | null;
  role: string | null;
  joinedAt: string;
  hasRecord: boolean;
  record: HrEmploymentRecord | null;
}

export interface HrLeaveType {
  id: string;
  name: string;
  daysPerYear: number;
  isPaid: boolean;
  carryOverMax: number;
  color: string | null;
  isActive: boolean;
}

export interface HrBalanceRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  balances: {
    leaveTypeId: string; leaveType: string; color: string | null; isPaid: boolean;
    entitled: number; carried: number; taken: number; pending: number; remaining: number; stored: boolean;
  }[];
}

export interface HrLeaveRequest {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  leaveType: string | null;
  leaveTypeId: string;
  color: string | null;
  isPaid: boolean;
  startsOn: string;
  endsOn: string;
  days: number;
  halfDay: boolean;
  reason: string | null;
  status: HrLeaveStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  decidedByName: string | null;
  createdAt: string;
}

export interface HrShiftTemplate {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  spansMidnight: boolean;
  breakMinutes: number;
  color: string | null;
  isActive: boolean;
}

export interface HrShift {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  workDate: string;
  startsAt: string;
  endsAt: string;
  spansMidnight: boolean;
  breakMinutes: number;
  label: string | null;
  color: string | null;
  status: HrShiftStatus;
  notes: string | null;
}

export interface HrRota {
  from: string;
  to: string;
  shifts: HrShift[];
  onLeave: { userId: string; name: string; leaveType: string | null; color: string | null; startsOn: string; endsOn: string; halfDay: boolean }[];
}

export interface HrAttendanceRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  scheduled: { shiftId: string; startsAt: string; endsAt: string; label: string | null } | null;
  onLeave: string | null;
  attendance: {
    id: string; clockIn: string | null; clockOut: string | null;
    minutesWorked: number; lateMinutes: number; status: HrAttendanceStatus; notes: string | null;
  } | null;
}

export interface HrTimesheetRow {
  userId: string; name: string; avatarUrl: string | null;
  daysPresent: number; daysLate: number; daysAbsent: number; daysOnLeave: number;
  minutesWorked: number; lateMinutes: number; hoursWorked: number;
}

export interface HrOverview {
  headcount: number;
  withRecord: number;
  missingRecord: number;
  byStatus: Record<string, number>;
  pendingLeave: number;
  onDutyToday: number;
  offToday: { userId: string; name: string; leaveType: string | null; color: string | null; endsOn: string }[];
  probationEnding: { userId: string; name: string; probationEndsOn: string | null }[];
  expiringCertifications: { userId: string; name: string; certification: string; expiresAt: string | null }[];
}

export const hrAPI = {
  overview: (o?: RequestOptions): Promise<ApiResponse<HrOverview>> =>
    get('/hr/overview', { ...o }),

  // People
  people: (o?: RequestOptions): Promise<ApiResponse<{ people: HrPerson[] }>> =>
    get('/hr/people', { ...o }),
  person: (userId: string, o?: RequestOptions): Promise<ApiResponse<HrPerson>> =>
    get(`/hr/people/${userId}`, { ...o }),
  saveEmployment: (userId: string, data: Partial<HrEmploymentRecord>, o?: RequestOptions): Promise<ApiResponse<{ record: HrEmploymentRecord }>> =>
    put(`/hr/people/${userId}`, data, { showError: true, ...o }),

  // Leave policy
  leaveTypes: (includeInactive = false, o?: RequestOptions): Promise<ApiResponse<{ types: HrLeaveType[] }>> =>
    get(`/hr/leave-types${includeInactive ? '?includeInactive=true' : ''}`, { ...o }),
  createLeaveType: (data: Partial<HrLeaveType>, o?: RequestOptions): Promise<ApiResponse<{ type: HrLeaveType }>> =>
    post('/hr/leave-types', data, { showError: true, ...o }),
  updateLeaveType: (id: string, data: Partial<HrLeaveType>, o?: RequestOptions): Promise<ApiResponse<{ type: HrLeaveType }>> =>
    put(`/hr/leave-types/${id}`, data, { showError: true, ...o }),
  deactivateLeaveType: (id: string, o?: RequestOptions): Promise<ApiResponse<{ deactivated: boolean }>> =>
    del(`/hr/leave-types/${id}`, { showError: true, ...o }),

  // Balances
  balances: (year?: number, userId?: string, o?: RequestOptions): Promise<ApiResponse<{ year: number; rows: HrBalanceRow[] }>> => {
    const q = new URLSearchParams();
    if (year) q.set('year', String(year));
    if (userId) q.set('userId', userId);
    return get(`/hr/leave-balances${q.toString() ? `?${q}` : ''}`, { ...o });
  },
  setBalance: (userId: string, leaveTypeId: string, data: { year?: number; entitledDays?: number; carriedOver?: number }, o?: RequestOptions) =>
    put(`/hr/leave-balances/${userId}/${leaveTypeId}`, data, { showError: true, ...o }),

  // Requests
  leave: (params?: { status?: string; userId?: string; from?: string; to?: string }, o?: RequestOptions): Promise<ApiResponse<{ requests: HrLeaveRequest[] }>> => {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return get(`/hr/leave${q.toString() ? `?${q}` : ''}`, { ...o });
  },
  requestLeave: (data: { userId?: string; leaveTypeId: string; startsOn: string; endsOn: string; halfDay?: boolean; reason?: string }, o?: RequestOptions) =>
    post('/hr/leave', data, { showError: true, ...o }),
  decideLeave: (id: string, decision: 'APPROVED' | 'DECLINED' | 'CANCELLED', note?: string, o?: RequestOptions) =>
    post(`/hr/leave/${id}/decision`, { decision, note }, { showError: true, ...o }),

  // Shift templates
  shiftTemplates: (includeInactive = false, o?: RequestOptions): Promise<ApiResponse<{ templates: HrShiftTemplate[] }>> =>
    get(`/hr/shift-templates${includeInactive ? '?includeInactive=true' : ''}`, { ...o }),
  createShiftTemplate: (data: Partial<HrShiftTemplate>, o?: RequestOptions): Promise<ApiResponse<{ template: HrShiftTemplate }>> =>
    post('/hr/shift-templates', data, { showError: true, ...o }),
  updateShiftTemplate: (id: string, data: Partial<HrShiftTemplate>, o?: RequestOptions): Promise<ApiResponse<{ template: HrShiftTemplate }>> =>
    put(`/hr/shift-templates/${id}`, data, { showError: true, ...o }),
  deactivateShiftTemplate: (id: string, o?: RequestOptions) =>
    del(`/hr/shift-templates/${id}`, { showError: true, ...o }),

  // Rota
  rota: (from: string, to: string, o?: RequestOptions): Promise<ApiResponse<HrRota>> =>
    get(`/hr/rota?from=${from}&to=${to}`, { ...o }),
  createShift: (data: { userId: string; workDate: string; templateId?: string; startsAt?: string; endsAt?: string; label?: string; notes?: string }, o?: RequestOptions) =>
    post('/hr/shifts', data, { showError: true, ...o }),
  updateShift: (id: string, data: any, o?: RequestOptions) =>
    put(`/hr/shifts/${id}`, data, { showError: true, ...o }),
  deleteShift: (id: string, o?: RequestOptions) =>
    del(`/hr/shifts/${id}`, { showError: true, ...o }),

  // Attendance
  attendance: (date: string, o?: RequestOptions): Promise<ApiResponse<{ date: string; rows: HrAttendanceRow[] }>> =>
    get(`/hr/attendance?date=${date}`, { ...o }),
  markAttendance: (userId: string, data: { workDate: string; clockIn?: string | null; clockOut?: string | null; status?: HrAttendanceStatus; notes?: string }, o?: RequestOptions) =>
    put(`/hr/attendance/${userId}`, data, { showError: true, ...o }),
  timesheet: (from: string, to: string, o?: RequestOptions): Promise<ApiResponse<{ from: string; to: string; rows: HrTimesheetRow[] }>> =>
    get(`/hr/timesheet?from=${from}&to=${to}`, { ...o }),
};

export default hrAPI;
