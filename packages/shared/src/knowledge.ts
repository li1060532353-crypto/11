export const noteStatuses = ['draft', 'published', 'archived'] as const;
export type NoteStatus = (typeof noteStatuses)[number];

export const highlightKinds = ['core', 'mistake', 'mastered', 'method', 'investigate'] as const;
export type HighlightKind = (typeof highlightKinds)[number];

export const roadmapStatuses = ['active', 'archived'] as const;
export type RoadmapStatus = (typeof roadmapStatuses)[number];

export const roadmapItemStatuses = ['todo', 'doing', 'done'] as const;
export type RoadmapItemStatus = (typeof roadmapItemStatuses)[number];

export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

import type { ApiFailure } from './api';

export type KnowledgeApiRoute = {
  method: ApiMethod;
  path: string;
};

export const knowledgeApiRoutes = [
  { method: 'GET', path: '/api/notes' },
  { method: 'POST', path: '/api/notes' },
  { method: 'GET', path: '/api/notes/:id' },
  { method: 'PATCH', path: '/api/notes/:id' },
  { method: 'DELETE', path: '/api/notes/:id' },
  { method: 'POST', path: '/api/notes/:id/restore' },
  { method: 'POST', path: '/api/notes/:id/review' },
  { method: 'POST', path: '/api/notes/:id/versions' },
  { method: 'GET', path: '/api/notes/:id/versions' },
  { method: 'GET', path: '/api/search' },
  { method: 'GET', path: '/api/stats' },
  { method: 'GET', path: '/api/roadmaps' },
  { method: 'POST', path: '/api/roadmaps' },
  { method: 'GET', path: '/api/roadmaps/:id' },
  { method: 'PATCH', path: '/api/roadmaps/:id' },
  { method: 'DELETE', path: '/api/roadmaps/:id' },
  { method: 'POST', path: '/api/roadmaps/:id/items' },
  { method: 'PATCH', path: '/api/roadmap-items/:id' },
  { method: 'DELETE', path: '/api/roadmap-items/:id' },
  { method: 'POST', path: '/api/roadmaps/:id/reorder' },
  { method: 'POST', path: '/api/import/markdown' },
  { method: 'POST', path: '/api/assets' },
  { method: 'GET', path: '/api/assets/:id' },
  { method: 'DELETE', path: '/api/assets/:id' },
] as const satisfies readonly KnowledgeApiRoute[];

export type JsonRouteContract = {
  transport: 'json';
  method: ApiMethod;
  path: string;
  request: unknown;
  response: unknown;
};

export type MultipartRouteContract = {
  transport: 'multipart';
  method: 'POST';
  path: '/api/assets';
  fields: { file: 'single-file'; noteId?: 'string' };
  response: AssetUploadResult;
};

export type BinaryRouteContract = {
  transport: 'binary';
  method: 'GET';
  path: '/api/assets/:id';
  errorResponse: ApiFailure;
};

export type NoteRecord = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  contentJson: string;
  contentText: string;
  category: string;
  status: NoteStatus;
  isPinned: boolean;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
};

export type RoadmapItemRecord = {
  id: string;
  roadmapId: string;
  noteId: string | null;
  title: string;
  description: string;
  status: RoadmapItemStatus;
  progress: number;
  sortOrder: number;
  targetDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssetRecord = {
  id: string;
  noteId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type Pagination = { page: number; pageSize: number; totalItems: number; totalPages: number };
export type Paginated<T> = Pagination & { items: readonly T[] };
export type NoteListQuery = { page?: number; pageSize?: number; status?: NoteStatus; category?: string; tag?: string; pinned?: boolean };
export type CreateNoteRequest = Pick<NoteRecord, 'title' | 'summary' | 'contentJson' | 'category' | 'status' | 'isPinned'> & { tags?: readonly string[] };
export type UpdateNoteRequest = Partial<CreateNoteRequest>;
export type NoteVersionRecord = Pick<NoteRecord, 'id' | 'contentJson' | 'contentText' | 'createdAt'>;
export type SearchResult = Pick<NoteRecord, 'id' | 'title' | 'summary' | 'slug' | 'category' | 'updatedAt'> & { excerpt: string; tags: readonly string[] };
export type KnowledgeStats = { total: number; draft: number; published: number; archived: number; pinned: number; roadmapProgress: number };
export type RoadmapRecord = { id: string; title: string; description: string; status: RoadmapStatus; createdAt: string; updatedAt: string; items?: readonly RoadmapItemRecord[] };
export type CreateRoadmapRequest = Pick<RoadmapRecord, 'title' | 'description'>;
export type UpdateRoadmapRequest = Partial<CreateRoadmapRequest> & { status?: RoadmapStatus };
export type CreateRoadmapItemRequest = Pick<RoadmapItemRecord, 'title' | 'description' | 'noteId' | 'status' | 'progress' | 'sortOrder' | 'targetDate'>;
export type UpdateRoadmapItemRequest = Partial<CreateRoadmapItemRequest>;
export type MarkdownImportRequest = { filename: string; content: string };
export type MarkdownImportResult = { status: 'imported' | 'skipped' | 'failed'; note?: NoteRecord; message?: string };
export type AssetUploadResult = { asset: AssetRecord };
export type AssetUploadRequest = MultipartRouteContract['fields'];
export type ReorderRoadmapRequest = { itemIds: readonly string[] };
export type EmptyResponse = Record<never, never>;
export type SearchQuery = { q: string; page?: number; pageSize?: number };
export type RoadmapListQuery = { status?: RoadmapStatus };
export const assetUploadRoute = {
  transport: 'multipart',
  method: 'POST',
  path: '/api/assets',
  fields: { file: 'single-file', noteId: 'string' },
} as const satisfies Omit<MultipartRouteContract, 'response'>;

export const assetDownloadRoute = {
  transport: 'binary',
  method: 'GET',
  path: '/api/assets/:id',
} as const satisfies Omit<BinaryRouteContract, 'errorResponse'>;

export type ApiRouteContractMap = {
  'GET /api/notes': { request: NoteListQuery; response: Paginated<NoteRecord> };
  'POST /api/notes': { request: CreateNoteRequest; response: NoteRecord };
  'GET /api/notes/:id': { request: EmptyResponse; response: NoteRecord };
  'PATCH /api/notes/:id': { request: UpdateNoteRequest; response: NoteRecord };
  'DELETE /api/notes/:id': { request: EmptyResponse; response: NoteRecord };
  'POST /api/notes/:id/restore': { request: EmptyResponse; response: NoteRecord };
  'POST /api/notes/:id/review': { request: EmptyResponse; response: NoteRecord };
  'POST /api/notes/:id/versions': { request: EmptyResponse; response: NoteVersionRecord };
  'GET /api/notes/:id/versions': { request: EmptyResponse; response: readonly NoteVersionRecord[] };
  'GET /api/search': { request: SearchQuery; response: Paginated<SearchResult> };
  'GET /api/stats': { request: EmptyResponse; response: KnowledgeStats };
  'GET /api/roadmaps': { request: RoadmapListQuery; response: readonly RoadmapRecord[] };
  'POST /api/roadmaps': { request: CreateRoadmapRequest; response: RoadmapRecord };
  'GET /api/roadmaps/:id': { request: EmptyResponse; response: RoadmapRecord };
  'PATCH /api/roadmaps/:id': { request: UpdateRoadmapRequest; response: RoadmapRecord };
  'DELETE /api/roadmaps/:id': { request: EmptyResponse; response: RoadmapRecord };
  'POST /api/roadmaps/:id/items': { request: CreateRoadmapItemRequest; response: RoadmapItemRecord };
  'PATCH /api/roadmap-items/:id': { request: UpdateRoadmapItemRequest; response: RoadmapItemRecord };
  'DELETE /api/roadmap-items/:id': { request: EmptyResponse; response: RoadmapItemRecord };
  'POST /api/roadmaps/:id/reorder': { request: ReorderRoadmapRequest; response: readonly RoadmapItemRecord[] };
  'POST /api/import/markdown': { request: MarkdownImportRequest; response: MarkdownImportResult };
  'POST /api/assets': { request: AssetUploadRequest; response: AssetUploadResult };
  'DELETE /api/assets/:id': { request: EmptyResponse; response: AssetRecord };
};
export type KnowledgeApiContractKey = keyof ApiRouteContractMap;
export type ApiRequestFor<K extends KnowledgeApiContractKey> = ApiRouteContractMap[K]['request'];
export type ApiResponseFor<K extends KnowledgeApiContractKey> = ApiRouteContractMap[K]['response'];

type AssertNever<T extends never> = T;
export type AssetDownloadIsNotJsonContract = AssertNever<Extract<KnowledgeApiContractKey, 'GET /api/assets/:id'>>;
