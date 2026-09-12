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
  /** 216 — the structured venue behind `location`. Null on pre-216 posts. */
  venueMode: 'IN_PERSON' | 'ONLINE' | null;
  venueCountry: string | null;
  venueCity: string | null;
  venueAddress: string | null;
  venueLink: string | null;
  viewCount: number;
  /** Products on a DEAL — clickable straight into a pre-filled purchase order. */
  items: CommunityPostItem[];
  /** Targeting. EMPTY AT A LEVEL MEANS EVERYONE THERE. */
  audienceRegions: string[];
  audienceCountries: string[];
  audienceCities: string[];
  /**
   * 297 — the social counts.
   *
   * ⚠️ `helpfulCount` is the EARNED signal and is what a profile totals and a
   * feed may sort on. `reactionCount` is the animal pack — warmth — and never
   * feeds ranking. Merging the two sorts the feed on cuteness.
   */
  helpfulCount: number;
  thanksCount: number;
  reactionCount: number;
  commentCount: number;
  /** [{ emoji: '🐕', count: 41 }], busiest first. */
  emojis: Array<{ emoji: string; count: number }>;
  /** What THIS reader already pressed. False for a reader we can't identify. */
  viewerHelpful: boolean;
  viewerThanks: boolean;
  viewerEmojis: string[];
  viewerSaved: boolean;
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
  venueMode?: 'IN_PERSON' | 'ONLINE';
  venueCountry?: string;
  venueCity?: string;
  venueAddress?: string;
  venueLink?: string;
  publish?: boolean;
  audienceRegions?: string[];
  audienceCountries?: string[];
  audienceCities?: string[];
  items?: Array<{ supplierProductId: string | number; quantity?: number; dealPrice?: number }>;
}


/**
 * A reply (297).
 *
 * `body` is null when `hidden` — a comment taken down is TOMBSTONED, not
 * dropped, so the reply that answers it does not float alone and the thread
 * does not silently lose a message.
 */
export interface CommunityComment {
  id: string;
  postId: string;
  parentId: string | null;
  authorUserId: string;
  authorName: string;
  authorAvatar: string | null;
  /** What they are, in their own words — "Pet owner", never "CLIENT". */
  authorRole: string;
  body: string | null;
  hidden: boolean;
  helpfulCount: number;
  viewerFoundHelpful: boolean;
  mine: boolean;
  createdAt: string;
}

export interface CommunityProfile {
  kind: CommunityAuthorKind;
  name: string;
  logo: string | null;
  subtitle: string | null;
  clinicId: string | null;
  supplierId: string | null;
  userId: string | null;
  helpfulTotal: number;
  viewTotal: number;
  commentTotal: number;
  postCount: number;
  followers: number;
  viewerFollows: boolean;
}

export interface CommunityFollowing {
  clinics: Array<{ id: string; name: string; logo: string | null; city: string | null }>;
  suppliers: Array<{ id: string; name: string; logo: string | null }>;
  people: Array<{ id: string; name: string; logo: string | null }>;
  tags: string[];
}

/** Who or what is being followed. Exactly one, matching the CHECK in 297. */
export type FollowSubject =
  | { clinicId: string }
  | { supplierId: string }
  | { userId: string }
  | { tag: string };

export const communityAPI = {
  feed: (
    params: {
      kind?: string; tag?: string; page?: number; limit?: number;
      /** Only people and topics this reader follows. */
      following?: boolean;
      /** Only posts this reader saved. Private to them. */
      saved?: boolean;
      /** 'recent' (default) or 'helpful'. */
      sort?: string;
      clinicId?: string; supplierId?: string; userId?: string;
    } = {},
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

  // ──────────────────────────────────────────────────────────────────────
  // 297 — THE SOCIAL LAYER
  //
  // ⚠️ NONE of these need the add-on. The add-on gates BROADCASTING — writing
  // a post that reaches the room. Answering one, agreeing with one, following
  // its author or saving it are free to every signed-in user, clients and farm
  // owners included. They are the reason the room is worth paying to reach.
  // ──────────────────────────────────────────────────────────────────────

  comments: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ comments: CommunityComment[] }>> =>
    get(`/community/posts/${id}/comments`, { cache: false, ...options }),

  addComment: (id: string | number, data: { body: string; parentId?: string | null }, options?: RequestOptions) =>
    post(`/community/posts/${id}/comments`, data, { showError: true, ...options }),

  removeComment: (commentId: string | number, options?: RequestOptions) =>
    del(`/community/comments/${commentId}`, { showError: true, ...options }),

  commentHelpful: (commentId: string | number, options?: RequestOptions): Promise<ApiResponse<{ on: boolean; helpfulCount: number }>> =>
    post(`/community/comments/${commentId}/helpful`, {}, { ...options }),

  /**
   * React to a post. TOGGLES — pressing Helpful twice removes it.
   * `emoji` is required for kind 'EMOJI' and refused on the others.
   */
  react: (
    id: string | number,
    data: { kind: 'HELPFUL' | 'THANKS' | 'EMOJI'; emoji?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<{
    on: boolean; kind: string; emoji: string | null;
    helpfulCount: number; thanksCount: number; reactionCount: number;
    emojis: Array<{ emoji: string; count: number }>;
  }>> => post(`/community/posts/${id}/react`, data, { ...options }),

  /** Save / unsave. PRIVATE — no count is shown to anyone, author included. */
  save: (id: string | number, options?: RequestOptions): Promise<ApiResponse<{ saved: boolean }>> =>
    post(`/community/posts/${id}/save`, {}, { ...options }),

  follow: (subject: FollowSubject, options?: RequestOptions): Promise<ApiResponse<{ following: boolean }>> =>
    post('/community/follow', subject, { showError: true, ...options }),

  following: (options?: RequestOptions): Promise<ApiResponse<CommunityFollowing>> =>
    get('/community/following', { cache: false, ...options }),

  report: (data: { postId?: string; commentId?: string; reason?: string; detail?: string }, options?: RequestOptions) =>
    post('/community/report', data, { showError: true, ...options }),

  profile: (
    subject: { clinicId?: string | null; supplierId?: string | null; userId?: string | null },
    options?: RequestOptions,
  ): Promise<ApiResponse<{ profile: CommunityProfile }>> => {
    const qs = new URLSearchParams(
      Object.entries(subject).filter(([, v]) => v != null && v !== '') as [string, string][],
    ).toString();
    return get(`/community/profile?${qs}`, { cache: false, ...options });
  },

  /**
   * Who has written here lately.
   *
   * ⚠️ "Recently active", NOT "online" — there is no presence signal in the
   * platform, so a live dot would be a guess dressed as a fact. This is derived
   * from what people actually wrote and when.
   */
  activeRecently: (options?: RequestOptions): Promise<ApiResponse<{
    people: Array<{ id: string; name: string; role: string; avatar: string | null; did: string; minutesAgo: number }>;
    total: number; windowMinutes: number;
  }>> => get('/community/active', { cache: false, ...options }),

  topics: (options?: RequestOptions): Promise<ApiResponse<{ topics: Array<{ tag: string; posts: number }> }>> =>
    get('/community/topics', { cache: false, ...options }),
};
