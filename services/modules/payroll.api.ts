/**
 * Payroll API — versioned statutory rates, pay runs, payslips.
 *
 * ⚠️ Every endpoint here is OWNER-ONLY and returns salaries by construction.
 * A manager gets 403, by design — see payroll.controller on the server.
 */
import { get, post, put, del } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export type PayRunStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
export type PayslipLineKind = 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';

export interface PayeBand { upTo: number | null; rate: number }

export interface RateConfig {
  currency: string;
  payeBands: PayeBand[];
  personalRelief: number;
  nssf: { enabled: boolean; tier1UpTo: number; tier2UpTo: number; rate: number };
  shif: { enabled: boolean; rate: number; minimum: number };
  housingLevy: { enabled: boolean; employeeRate: number; employerRate: number };
  /** Which statutory deductions come off gross BEFORE PAYE. Changes by law. */
  taxableDeductions: { nssf: boolean; shif: boolean; housingLevy: boolean };
}

export interface RateTable {
  id: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedByName: string | null;
  config: RateConfig;
  notes: string | null;
}

export interface PayRunTotals {
  gross: number; paye: number;
  nssfEmployee: number; nssfEmployer: number;
  shif: number;
  housingEmployee: number; housingEmployer: number;
  otherDeductions: number; net: number;
  /** Gross plus employer contributions — what the clinic actually spends. */
  employerCost: number;
}

export interface PayslipLine {
  id: string; kind: PayslipLineKind; code: string | null;
  label: string; amount: number; isTaxable: boolean;
}

export interface Payslip {
  id: string; userId: string;
  staffName: string; jobTitle: string | null; staffNumber: string | null;
  kraPin: string | null; nssfNumber: string | null; shifNumber: string | null;
  bankName: string | null; bankAccount: string | null;
  daysWorked: number; daysAbsent: number; daysOnLeave: number; hoursWorked: number;
  basicPay: number; grossPay: number; taxablePay: number;
  paye: number; personalRelief: number;
  nssfEmployee: number; nssfEmployer: number;
  shif: number;
  housingEmployee: number; housingEmployer: number;
  otherEarnings: number; otherDeductions: number; netPay: number;
  notes: string | null;
  lines: PayslipLine[];
}

export interface PayRun {
  id: string;
  periodStart: string; periodEnd: string; payDate: string | null;
  status: PayRunStatus;
  headcount: number;
  rateTable: string | null;
  rateTableVerified: boolean | null;
  totals: PayRunTotals;
  approvedAt: string | null;
  approvedByName?: string | null;
  paidAt: string | null;
  notes: string | null;
  expenseId: string | null;
  createdAt: string;
  payslips?: Payslip[];
}

export type BonusStatus = 'PENDING' | 'ON_RUN' | 'PAID' | 'CANCELLED';

export interface Bonus {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  amount: number;
  /** Why it was given. Never blank — the server refuses one without it. */
  reason: string;
  category: string | null;
  awardedOn: string;
  isTaxable: boolean;
  cancelledAt: string | null;
  awardedByName: string | null;
  payRunId: string | null;
  /** Derived server-side from the run it sits on, so it cannot disagree. */
  status: BonusStatus;
  payRunPeriod: { start: string; end: string } | null;
  notes: string | null;
}

export interface StatutoryReturn {
  period: { start: string; end: string };
  status: PayRunStatus;
  totals: { paye: number; nssf: number; shif: number; housingLevy: number };
  rows: {
    staffName: string; kraPin: string | null; nssfNumber: string | null; shifNumber: string | null;
    grossPay: number; taxablePay: number; paye: number; nssf: number; shif: number; housingLevy: number;
  }[];
}

export const payrollAPI = {
  // Rates
  rates: (o?: RequestOptions): Promise<ApiResponse<{ tables: RateTable[] }>> =>
    get('/payroll/rates', { ...o }),
  seedRates: (o?: RequestOptions) =>
    post('/payroll/rates/seed', {}, { showError: true, ...o }),
  createRates: (data: { name: string; effectiveFrom: string; effectiveTo?: string | null; config: RateConfig; notes?: string }, o?: RequestOptions) =>
    post('/payroll/rates', data, { showError: true, ...o }),
  updateRates: (id: string, data: any, o?: RequestOptions) =>
    put(`/payroll/rates/${id}`, data, { showError: true, ...o }),
  verifyRates: (id: string, o?: RequestOptions) =>
    post(`/payroll/rates/${id}/verify`, {}, { showError: true, ...o }),

  // Bonuses
  bonuses: (params?: { userId?: string; from?: string; to?: string; unpaidOnly?: boolean }, o?: RequestOptions): Promise<ApiResponse<{ bonuses: Bonus[] }>> => {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return get(`/payroll/bonuses${q.toString() ? `?${q}` : ''}`, { ...o });
  },
  awardBonus: (data: { userId: string; amount: number; reason: string; category?: string; awardedOn?: string; isTaxable?: boolean; notes?: string }, o?: RequestOptions) =>
    post('/payroll/bonuses', data, { showError: true, ...o }),
  updateBonus: (id: string, data: Partial<Bonus> & { cancel?: boolean }, o?: RequestOptions) =>
    put(`/payroll/bonuses/${id}`, data, { showError: true, ...o }),

  // Runs
  runs: (o?: RequestOptions): Promise<ApiResponse<{ runs: PayRun[] }>> =>
    get('/payroll/runs', { ...o }),
  run: (id: string, o?: RequestOptions): Promise<ApiResponse<PayRun>> =>
    get(`/payroll/runs/${id}`, { ...o }),
  createRun: (data: { periodStart: string; periodEnd: string; payDate?: string; notes?: string }, o?: RequestOptions): Promise<ApiResponse<PayRun>> =>
    post('/payroll/runs', data, { showError: true, ...o }),
  computeRun: (id: string, o?: RequestOptions): Promise<ApiResponse<PayRun>> =>
    post(`/payroll/runs/${id}/compute`, {}, { showError: true, ...o }),
  approveRun: (id: string, o?: RequestOptions) =>
    post(`/payroll/runs/${id}/approve`, {}, { showError: true, ...o }),
  markPaid: (id: string, data: { paidOn?: string; paidVia?: string }, o?: RequestOptions) =>
    post(`/payroll/runs/${id}/paid`, data, { showError: true, ...o }),
  cancelRun: (id: string, o?: RequestOptions) =>
    del(`/payroll/runs/${id}`, { showError: true, ...o }),
  statutory: (id: string, o?: RequestOptions): Promise<ApiResponse<StatutoryReturn>> =>
    get(`/payroll/runs/${id}/statutory`, { ...o }),

  setPayslipLines: (payslipId: string, lines: Partial<PayslipLine>[], o?: RequestOptions) =>
    put(`/payroll/payslips/${payslipId}/lines`, { lines }, { showError: true, ...o }),

  payslipsFor: (userId: string, o?: RequestOptions) =>
    get(`/payroll/staff/${userId}/payslips`, { ...o }),
};

export default payrollAPI;
