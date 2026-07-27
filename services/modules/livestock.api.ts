/**
 * VetHubCore Livestock API — farms, herds/flocks, crop plots, feeding, produce.
 * Backed by migration 109; the whole module is gated on `livestock:farms`.
 */
import { get, post, put, del } from '../api/client';
import { ApiResponse } from '../api/types';

export type FarmType = 'LIVESTOCK' | 'CROP' | 'MIXED';
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

export interface Farm {
  id: string;
  ownerClientId: string;
  ownerClientName: string | null;
  linkedClinicId: string | null;
  linkedClinicName: string | null;
  linkedVetUserId: string | null;
  name: string;
  farmType: FarmType;
  county: string | null;
  location: string | null;
  sizeAcres: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  animalGroupCount?: number;
  cropPlotCount?: number;
  headCount?: number;
}

export interface AnimalGroup {
  id: string;
  farmId: string;
  farmName: string | null;
  name: string;
  species: string;
  breed: string | null;
  headCount: number;
  purpose: string | null;
  housing: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface CropPlot {
  id: string;
  farmId: string;
  farmName: string | null;
  name: string;
  crop: string;
  sizeAcres: number | null;
  plantedOn: string | null;
  expectedHarvestOn: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface FeedingPlan {
  id: string;
  farmId: string;
  farmName: string | null;
  animalGroupId: string | null;
  animalGroupName: string | null;
  name: string;
  feedType: string | null;
  quantityKg: number | null;
  frequency: Frequency;
  timesPerDay: number;
  startsOn: string | null;
  endsOn: string | null;
  notes: string | null;
  isActive: boolean;
  lastFedAt: string | null;
}

export interface FeedingLog {
  id: string;
  feedingPlanId: string;
  fedAt: string;
  quantityKg: number | null;
  fedByUserId: string | null;
  notes: string | null;
}

export interface ProduceSchedule {
  id: string;
  farmId: string;
  farmName: string | null;
  animalGroupId: string | null;
  animalGroupName: string | null;
  cropPlotId: string | null;
  cropPlotName: string | null;
  produce: string;
  unit: string;
  expectedQty: number | null;
  frequency: Frequency;
  nextDueOn: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface ProduceRecord {
  id: string;
  produceScheduleId: string | null;
  farmId: string;
  recordedOn: string;
  quantity: number;
  unit: string;
  notes: string | null;
}

export interface LivestockDashboard {
  farms: number;
  animalGroups: number;
  totalHead: number;
  cropPlots: number;
  activeFeedingPlans: number;
  produceDue: ProduceSchedule[];
  recentProduce: ProduceRecord[];
}

const BASE = '/livestock';
const qs = (params: Record<string, any>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const livestockAPI = {
  dashboard: (): Promise<ApiResponse<LivestockDashboard>> =>
    get(`${BASE}/dashboard`, { cache: false }),

  // ── Farms ────────────────────────────────────────────────────────────────
  listFarms: (opts: { search?: string; includeInactive?: boolean } = {}): Promise<ApiResponse<{ farms: Farm[] }>> =>
    get(`${BASE}/farms${qs(opts)}`, { cache: false }),
  getFarm: (id: string): Promise<ApiResponse<{ farm: Farm }>> =>
    get(`${BASE}/farms/${id}`, { cache: false }),
  createFarm: (data: Partial<Farm> & { name: string; ownerClientId: string }): Promise<ApiResponse<{ farm: Farm }>> =>
    post(`${BASE}/farms`, data, { showError: true }),
  updateFarm: (id: string, data: Partial<Farm>): Promise<ApiResponse<{ farm: Farm }>> =>
    put(`${BASE}/farms/${id}`, data, { showError: true }),
  deleteFarm: (id: string): Promise<ApiResponse<{ ok: boolean }>> =>
    del(`${BASE}/farms/${id}`, { showError: true }),

  // ── Herds & flocks ───────────────────────────────────────────────────────
  listAnimalGroups: (farmId?: string): Promise<ApiResponse<{ groups: AnimalGroup[] }>> =>
    get(`${BASE}/animal-groups${qs({ farmId })}`, { cache: false }),
  createAnimalGroup: (data: Partial<AnimalGroup> & { name: string; farmId: string }): Promise<ApiResponse<{ group: AnimalGroup }>> =>
    post(`${BASE}/animal-groups`, data, { showError: true }),
  updateAnimalGroup: (id: string, data: Partial<AnimalGroup>): Promise<ApiResponse<{ group: AnimalGroup }>> =>
    put(`${BASE}/animal-groups/${id}`, data, { showError: true }),
  deleteAnimalGroup: (id: string): Promise<ApiResponse<{ ok: boolean }>> =>
    del(`${BASE}/animal-groups/${id}`, { showError: true }),

  // ── Crop plots ───────────────────────────────────────────────────────────
  listCropPlots: (farmId?: string): Promise<ApiResponse<{ plots: CropPlot[] }>> =>
    get(`${BASE}/crop-plots${qs({ farmId })}`, { cache: false }),
  createCropPlot: (data: Partial<CropPlot> & { name: string; crop: string; farmId: string }): Promise<ApiResponse<{ plot: CropPlot }>> =>
    post(`${BASE}/crop-plots`, data, { showError: true }),
  updateCropPlot: (id: string, data: Partial<CropPlot>): Promise<ApiResponse<{ plot: CropPlot }>> =>
    put(`${BASE}/crop-plots/${id}`, data, { showError: true }),
  deleteCropPlot: (id: string): Promise<ApiResponse<{ ok: boolean }>> =>
    del(`${BASE}/crop-plots/${id}`, { showError: true }),

  // ── Feeding ──────────────────────────────────────────────────────────────
  listFeedingPlans: (farmId?: string): Promise<ApiResponse<{ plans: FeedingPlan[] }>> =>
    get(`${BASE}/feeding-plans${qs({ farmId })}`, { cache: false }),
  createFeedingPlan: (data: Partial<FeedingPlan> & { name: string; farmId: string }): Promise<ApiResponse<{ plan: FeedingPlan }>> =>
    post(`${BASE}/feeding-plans`, data, { showError: true }),
  updateFeedingPlan: (id: string, data: Partial<FeedingPlan>): Promise<ApiResponse<{ plan: FeedingPlan }>> =>
    put(`${BASE}/feeding-plans/${id}`, data, { showError: true }),
  deleteFeedingPlan: (id: string): Promise<ApiResponse<{ ok: boolean }>> =>
    del(`${BASE}/feeding-plans/${id}`, { showError: true }),
  listFeedingLogs: (planId: string): Promise<ApiResponse<{ logs: FeedingLog[] }>> =>
    get(`${BASE}/feeding-plans/${planId}/logs`, { cache: false }),
  /** Omit quantityKg to default to the plan's own ration — the one-tap case. */
  logFeeding: (planId: string, data: { quantityKg?: number; fedAt?: string; notes?: string } = {}): Promise<ApiResponse<{ log: FeedingLog }>> =>
    post(`${BASE}/feeding-plans/${planId}/logs`, data, { showError: true }),

  // ── Produce ──────────────────────────────────────────────────────────────
  listProduceSchedules: (farmId?: string): Promise<ApiResponse<{ schedules: ProduceSchedule[] }>> =>
    get(`${BASE}/produce-schedules${qs({ farmId })}`, { cache: false }),
  createProduceSchedule: (data: Partial<ProduceSchedule> & { produce: string; farmId: string }): Promise<ApiResponse<{ schedule: ProduceSchedule }>> =>
    post(`${BASE}/produce-schedules`, data, { showError: true }),
  updateProduceSchedule: (id: string, data: Partial<ProduceSchedule>): Promise<ApiResponse<{ schedule: ProduceSchedule }>> =>
    put(`${BASE}/produce-schedules/${id}`, data, { showError: true }),
  deleteProduceSchedule: (id: string): Promise<ApiResponse<{ ok: boolean }>> =>
    del(`${BASE}/produce-schedules/${id}`, { showError: true }),
  listProduceRecords: (opts: { farmId?: string; scheduleId?: string; limit?: number } = {}): Promise<ApiResponse<{ records: ProduceRecord[] }>> =>
    get(`${BASE}/produce-records${qs(opts)}`, { cache: false }),
  recordProduce: (data: { farmId: string; produceScheduleId?: string; quantity: number; unit?: string; recordedOn?: string; notes?: string }): Promise<ApiResponse<{ record: ProduceRecord }>> =>
    post(`${BASE}/produce-records`, data, { showError: true }),
};
