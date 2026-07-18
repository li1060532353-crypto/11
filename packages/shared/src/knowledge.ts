export const noteStatuses = ['draft', 'published', 'archived'] as const;
export type NoteStatus = (typeof noteStatuses)[number];

export const roadmapStatuses = ['active', 'archived'] as const;
export type RoadmapStatus = (typeof roadmapStatuses)[number];

export const roadmapItemStatuses = ['todo', 'doing', 'done'] as const;
export type RoadmapItemStatus = (typeof roadmapItemStatuses)[number];

export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

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
export type AssetUploadRequest = { noteId?: string; originalName: string; mimeType: string; sizeBytes: number };
export type AssetUploadResult = { asset: AssetRecord };
export type ReorderRoadmapRequest = { itemIds: readonly string[] };
export type EmptyResponse = Record<never, never>;
export type KnowledgeRouteContract = KnowledgeApiRoute & { request: string | undefined; response: string };
export const knowledgeRouteContracts = knowledgeApiRoutes.map((route): KnowledgeRouteContract => ({
  ...route,
  request: route.method === 'GET' || route.method === 'DELETE' ? undefined : route.path.includes('reorder') ? 'ReorderRoadmapRequest' : 'Route mutation payload',
  response: route.path === '/api/notes' && route.method === 'GET' ? 'Paginated<NoteRecord>' : route.path === '/api/search' ? 'Paginated<SearchResult>' : route.path === '/api/stats' ? 'KnowledgeStats' : route.path.includes('versions') ? 'NoteVersionRecord or readonly NoteVersionRecord[]' : route.path.includes('roadmaps') ? 'RoadmapRecord or readonly RoadmapRecord[]' : route.path.includes('assets') ? 'AssetRecord or asset stream' : 'NoteRecord or EmptyResponse',
}));
