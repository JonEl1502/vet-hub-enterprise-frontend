/**
 * Community API (207).
 *
 * Reading is open to every signed-in user — clients and farm owners included.
 * Only the write calls can 403, and only for a business without the add-on.
 */
import { get, post, put, del } from '../api/client';
import { RequestOptions, ApiResponse } from '../api/types';

export type CommunityKind = 'ARTICLE' | 'DEAL' | 'MEET';
export type CommunityAuthorKind = 'CLINIC' | 'SUPPLIER' | 'PRACTITIONER';

export interface CommunityPost {
  id: string;
  kind: CommunityKind;
  authorKind: CommunityAuthorKind;
  authorName: string;
  authorLogo: string | null;
  authorClinicId: string | null;
  authorSupplierId: string | null;
  authorUserId: string | null;
  title: string;
  body: string | null;
  mediaUrl: string | null;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'REMOVED';
  publishedAt: string | null;
  price: number | null;
  compareAtPrice: number | null;
  currency: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  viewCount: number;
  /** Products on a DEAL — clickable straight into a pre-filled purchase order. */
  items: CommunityPostItem[];
  /** Targeting. EMPTY AT A LEVEL MEANS EVERYONE THERE. */
  audienceRegions: string[];
  audienceCountries: string[];
  audienceCities: string[];
  /** Paid placement. ALWAYS shown as "Promoted" — never a silent boost. */
  isPromoted: boolean;
  boost: { id: string; status: string; endsAt: string } | null;
  createdAt: string;
}

export interface CommunityPostItem {
  id: string;
  supplierProductId: string;
  quantity: number;
  /** The offer price. Null means "at the supplier's usual price". */
  dealPrice: number | null;
  name: string;
  sku: string | null;
  unit: string | null;
  listPrice: number | null;
  currency: string | null;
  supplierId: string | null;
  imageUrl: string | null;
}

export interface CreateCommunityPost {
  kind: CommunityKind;
  authorKind?: CommunityAuthorKind;
  title: string;
  body?: string;
  mediaUrl?: string;
  tags?: string[];
  price?: number;
  compareAtPrice?: number;
  currency?: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  publish?: boolean;
  audienceRegions?: string[];
  audienceCountries?: string[];
  audienceCities?: string[];
  items?: Array<{ supplierProductId: string | number; quantity?: number; dealPrice?: number }>;
}

export const communityAPI = {
  feed: (
    params: { kind?: string; tag?: string; page?: number; limit?: number } = {},
    options?: RequestOptions,
  ): Promise<ApiResponse<{ posts: CommunityPost[]; total: number; page: number; limit: number }>> => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
    ).toString();
    return get(`/community/posts${qs ? `?${qs}` : ''}`, { cache: false, ...options });
  },

  getById: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ post: CommunityPost }>> =>
    get(`/community/posts/${id}`, { cache: false, ...options }),

  mine: (options?: RequestOptions): Promise<ApiResponse<{ posts: CommunityPost[] }>> =>
    get('/community/posts/mine', { cache: false, ...options }),

  create: (data: CreateCommunityPost, options?: RequestOptions): Promise<ApiResponse<{ post: CommunityPost }>> =>
    post('/community/posts', data, { showError: true, ...options }),

  update: (id: string | number, data: Partial<CreateCommunityPost>, options?: RequestOptions): Promise<ApiResponse<{ post: CommunityPost }>> =>
    put(`/community/posts/${id}`, data, { showError: true, ...options }),

  remove: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ id: string; status: string }>> =>
    del(`/community/posts/${id}`, { showError: true, ...options }),

  /** Creates a PENDING boost — it promotes nothing until payment confirms. */
  boost: (id: string | number, data: { days?: number; amount?: number; currency?: string }, options?: RequestOptions) =>
    post(`/community/posts/${id}/boost`, data, { showError: true, ...options }),
};
