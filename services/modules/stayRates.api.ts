/**
 * Boarding / in-patient rates by species and size (backend 213).
 *
 * Resolution is most-specific-first — species+band, species, band, the clinic's
 * chosen default row, then the old flat clinic rate. The last rung is why a
 * clinic that never opens this screen is unaffected.
 */
import { get, post, del } from '../api/client';
import { ApiResponse, RequestOptions } from '../api/types';

export type StayService = 'BOARDING' | 'INPATIENT';
export type SizeBand = 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE' | 'GIANT';

export interface StayRate {
  id: string;
  service: StayService;
  species: string | null;   // null = any species
  sizeBand: SizeBand | null; // null = any size
  minKg: number | null;
  maxKg: number | null;      // null = open ended (25kg+)
  rate: number;
  isDefault: boolean;
}

export const stayRatesAPI = {
  list: (service?: StayService, options?: RequestOptions): Promise<ApiResponse<StayRate[]>> =>
    get(`/clinics/stay-rates${service ? `?service=${service}` : ''}`, { cache: false, ...options }),

  save: (body: Partial<StayRate> & { service: StayService; rate: number }): Promise<ApiResponse<StayRate>> =>
    post('/clinics/stay-rates', body, { showError: true }),

  remove: (id: string | number): Promise<ApiResponse<{ deleted: boolean }>> =>
    del(`/clinics/stay-rates/${id}`, { showError: true }),

  /** What WOULD this patient be charged — used to show the resolution live. */
  resolve: (params: { service: StayService; species?: string; weightKg?: number; sizeBand?: string }): Promise<ApiResponse<{ rate: number | null; source: string }>> => {
    const q = new URLSearchParams({ service: params.service });
    if (params.species) q.set('species', params.species);
    if (params.weightKg != null) q.set('weightKg', String(params.weightKg));
    if (params.sizeBand) q.set('sizeBand', params.sizeBand);
    return get(`/clinics/stay-rates/resolve?${q.toString()}`, { cache: false });
  },
};
