/**
 * Clinic-facing read of a specific client's farms/herds/animals/crop plots —
 * same depth as that client's own portal view, gated by the CLIENT's own
 * subscription rather than the clinic's Farms add-on. Backed by the
 * `/clients/:id/livestock/*` routes.
 */
import { get } from '../api/client';
import { ApiResponse } from '../api/types';

export interface ClientLivestockPackage {
  name: string;
  amount: number;
  currency: string;
  tier: number;
}

export type ClientLivestockAccess =
  | { locked: false; tier: 'FULL'; packageName: string | null }
  | {
      locked: true;
      tier: 'NONE' | 'BASIC';
      requiredFeature: 'livestock:farms';
      currentPackageName: string | null;
      cheapestPackage: ClientLivestockPackage | null;
    };

export interface ClientFarm {
  id: string;
  name: string;
  farmType: string;
  county: string | null;
  location: string | null;
  sizeAcres: number | null;
  clinic: { id: string; name: string; logo: string | null } | null;
  headCount: number;
  animalGroupCount: number;
  cropPlotCount: number;
}

export interface ClientAnimalGroup {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  headCount: number;
  purpose: string | null;
  housing: string | null;
  males: number;
  females: number;
  adults: number;
  young: number;
  pregnant: number;
  lactating: number;
  purposeCounts: Record<string, number>;
}

export interface ClientCropPlot {
  id: string;
  name: string;
  crop: string;
  sizeAcres: number | null;
  plantedOn: string | null;
  expectedHarvestOn: string | null;
}

export interface ClientFarmDetail {
  animalGroups: ClientAnimalGroup[];
  cropPlots: ClientCropPlot[];
}

export interface ClientFarmAnimal {
  id: string;
  farmId: string;
  animalGroupId: string | null;
  animalGroupName: string | null;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  dob: string | null;
  dobIsApprox: boolean;
  purpose: string | null;
  layingSince: string | null;
  tagNumber: string | null;
  rfidNumber: string | null;
  color: string | null;
  markings: string | null;
  weightValue: number | null;
  weightUnit: string;
  weighedOn: string | null;
  isPregnant: boolean;
  isLactating: boolean;
  expectedDueOn: string | null;
  repro?: {
    dueOn: string | null; dueIsEstimate: boolean; daysToDue: number | null; daysPregnant: number | null;
    dryOffOn: string | null; dryOffInDays: number | null; nextMilkingOn: string | null;
    daysInMilk: number | null; driedOffOn: string | null; breedingMethod: string | null;
  };
  status: 'ACTIVE' | 'SOLD' | 'DIED' | 'CULLED' | 'LOST';
  exitedOn: string | null;
  exitNote: string | null;
  acquiredOn: string | null;
  acquiredFrom: string | null;
  avatarUrl: string | null;
  notes: string | null;
  weights: Array<{ id: string; weighedOn: string; weightValue: number; weightUnit: string; notes: string | null }>;
}

export interface ClientAnimalFeedingLog {
  id: string; fedAt: string; quantityKg: number | null; notes: string | null;
}

export interface ClientAnimalProduceRecord {
  id: string; produce: string | null; recordedOn: string; quantity: number; unit: string; notes: string | null;
}

export type ClientFarmAnimalsResult =
  | { locked: true; requiredFeature: 'livestock:farms'; currentPackageName: string | null; cheapestPackage: ClientLivestockPackage | null }
  | { locked: false; animals: ClientFarmAnimal[] };

const BASE = (clientId: string) => `/clients/${clientId}/livestock`;

export const clientLivestockAPI = {
  getAccess: (clientId: string): Promise<ApiResponse<ClientLivestockAccess>> =>
    get(`${BASE(clientId)}/access`, { cache: false }),

  listFarms: (clientId: string): Promise<ApiResponse<ClientFarm[]>> =>
    get(`${BASE(clientId)}/farms`, { cache: false }),

  getFarmDetail: (clientId: string, farmId: string): Promise<ApiResponse<ClientFarmDetail>> =>
    get(`${BASE(clientId)}/farms/${farmId}`, { cache: false }),

  listFarmAnimals: (clientId: string, farmId: string): Promise<ApiResponse<ClientFarmAnimalsResult>> =>
    get(`${BASE(clientId)}/farms/${farmId}/animals`, { cache: false }),

  getFarmAnimal: (clientId: string, animalId: string): Promise<ApiResponse<ClientFarmAnimal>> =>
    get(`${BASE(clientId)}/animals/${animalId}`, { cache: false }),

  listAnimalFeedingLogs: (clientId: string, animalId: string): Promise<ApiResponse<ClientAnimalFeedingLog[]>> =>
    get(`${BASE(clientId)}/animals/${animalId}/feeding-logs`, { cache: false }),

  listAnimalProduceRecords: (clientId: string, animalId: string): Promise<ApiResponse<ClientAnimalProduceRecord[]>> =>
    get(`${BASE(clientId)}/animals/${animalId}/produce-records`, { cache: false }),

  /** Lock state for a page of clients at once — for the client list's badge. */
  getAccessBatch: (clientIds: string[]): Promise<ApiResponse<Record<string, boolean>>> =>
    get(`/clients/subscription-access?ids=${clientIds.join(',')}`, { cache: false }),
};
