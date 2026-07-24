/**
 * Ratings API — staff-facing dashboard of pet-owner visit ratings.
 */
import { get } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export interface RatingsDashboard {
  overall: { avg: number; ratings: number; visits: number };
  facets: Record<string, { avg: number; count: number }>;
  perVet: { id: string; name: string; avg: number; count: number }[];
  comments: { comment: string; stars: number; at: string }[];
  distribution: { star: number; count: number }[];
}

export const ratingsAPI = {
  /** Ratings dashboard for the active clinic (manager/owner). */
  dashboard: (options?: RequestOptions): Promise<ApiResponse<RatingsDashboard>> =>
    get('/ratings/dashboard', { ...options }),
};

export default ratingsAPI;
