import { get, post, del } from '../api/client';
import { ApiResponse } from '../api/types';

/**
 * Clinic operating expenses (backend 112) — rent, salaries, utilities…
 * The spend that is NOT stock purchases; feeds the BI dashboard's expense
 * figures via the daily summary snapshots.
 */

export interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  incurredAt: string; // yyyy-mm-dd
  paidVia: string | null;
  supplierId: string | null;
  createdAt: string;
}

export interface ExpenseList {
  expenses: Expense[];
  total: number;
  byCategory: Record<string, number>;
}

export const expensesAPI = {
  list: (params: { from?: string; to?: string; category?: string } = {}): Promise<ApiResponse<ExpenseList>> => {
    const q = new URLSearchParams();
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.category) q.set('category', params.category);
    const qs = q.toString();
    return get(`/expenses${qs ? `?${qs}` : ''}`, { cache: false });
  },

  create: (data: {
    category: string; amount: number; incurredAt: string;
    description?: string; paidVia?: string; supplierId?: string | number;
  }): Promise<ApiResponse<{ id: string }>> =>
    post('/expenses', data, { showError: true }),

  remove: (id: string | number): Promise<ApiResponse<{ id: string }>> =>
    del(`/expenses/${id}`, { showError: true }),
};

export default expensesAPI;
