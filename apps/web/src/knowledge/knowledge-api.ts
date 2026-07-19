import type { ApiRequestFor, ApiResponse, ApiResponseFor, NoteRecord, NoteVersionRecord } from '@namdw/shared';

export type KnowledgeApiFailure = { kind: 'access' | 'validation' | 'not-found' | 'conflict' | 'repository' | 'request' | 'malformed' | 'network' };
const fail = (kind: KnowledgeApiFailure['kind']): KnowledgeApiFailure => ({ kind });

function record(value: unknown): Record<string, unknown> | null { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null; }
function string(value: unknown): value is string { return typeof value === 'string'; }
function date(value: unknown): boolean { return string(value) && !Number.isNaN(Date.parse(value)); }
function integer(value: unknown): boolean { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function isNote(value: unknown): value is NoteRecord { const item = record(value); return !!item && string(item.id) && item.id.length > 0 && string(item.title) && string(item.slug) && string(item.summary) && string(item.category) && string(item.contentJson) && string(item.contentText) && ['draft', 'published', 'archived'].includes(String(item.status)) && typeof item.isPinned === 'boolean' && integer(item.reviewCount) && date(item.createdAt) && date(item.updatedAt) && (item.lastReviewedAt === null || date(item.lastReviewedAt)); }
function isVersion(value: unknown): value is NoteVersionRecord { const item = record(value); return !!item && string(item.id) && string(item.contentJson) && string(item.contentText) && date(item.createdAt); }
function isSearchResult(value: unknown): boolean { const item = record(value); return !!item && string(item.id) && item.id.length > 0 && string(item.title) && string(item.slug) && string(item.summary) && string(item.category) && date(item.updatedAt) && string(item.excerpt) && Array.isArray(item.tags) && item.tags.every(string); }
function isPage(value: unknown, itemValidator: (item: unknown) => boolean): value is { items: readonly unknown[]; page: number; pageSize: number; totalItems: number; totalPages: number } { const page = record(value); return !!page && Array.isArray(page.items) && page.items.every(itemValidator) && integer(page.page) && Number(page.page) >= 1 && integer(page.pageSize) && Number(page.page) >= 1 && integer(page.totalItems) && integer(page.totalPages); }
function isStats(value: unknown): boolean { return typeof value === 'object' && value !== null && ['total', 'draft', 'published', 'archived', 'pinned', 'roadmapProgress'].every((key) => typeof (value as Record<string, unknown>)[key] === 'number'); }
function isEnvelope(value: unknown): value is ApiResponse<unknown> { const envelope = record(value); return !!envelope && (envelope.success === true ? 'data' in envelope : envelope.success === false && record(envelope.error) !== null && string(record(envelope.error)?.code) && string(record(envelope.error)?.message)); }
function failureKind(status: number, envelope?: ApiResponse<unknown>): KnowledgeApiFailure['kind'] {
  const code = envelope && !envelope.success ? envelope.error.code : '';
  if (status === 401 || status === 403) return 'access';
  if (status === 404 || code === 'NOTE_NOT_FOUND') return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 400 || code === 'VALIDATION_ERROR') return 'validation';
  if (status >= 500 || code === 'NOTE_REPOSITORY_FAILURE') return 'repository';
  return 'request';
}

async function jsonRequest<T>(path: string, method: 'GET' | 'POST' | 'PATCH', validator: (value: unknown) => value is T, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { method, headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...(signal ? { signal } : {}) }); } catch { throw fail('network'); }
  let envelope: unknown;
  try { envelope = await response.json(); } catch { if (response.ok) throw fail('malformed'); throw fail(failureKind(response.status)); }
  if (!isEnvelope(envelope)) throw fail(response.ok ? 'malformed' : failureKind(response.status));
  if (!response.ok || !envelope.success) throw fail(failureKind(response.status, envelope));
  if (!validator(envelope.data)) throw fail('malformed');
  return envelope.data;
}
function toQuery(values: Record<string, string | number | boolean | undefined>) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(key, String(value)); return params.toString(); }

export type KnowledgeNotesQuery = ApiRequestFor<'GET /api/notes'> & { q?: string };
export async function loadKnowledgeNotes(input: KnowledgeNotesQuery) { const q = input.q?.trim(); const data = q ? await jsonRequest(`/api/search?${toQuery({ q, page: input.page, pageSize: input.pageSize })}`, 'GET', (value): value is ApiResponseFor<'GET /api/search'> => isPage(value, isSearchResult)) : await jsonRequest(`/api/notes?${toQuery(input)}`, 'GET', (value): value is ApiResponseFor<'GET /api/notes'> => isPage(value, isNote)); return data; }
export async function loadKnowledgeStats() { return jsonRequest('/api/stats', 'GET', (value): value is ApiResponseFor<'GET /api/stats'> => isStats(value)); }
export async function getKnowledgeNote(noteId: string, signal?: AbortSignal) { return jsonRequest(`/api/notes/${encodeURIComponent(noteId)}`, 'GET', isNote, undefined, signal); }
export async function createKnowledgeNote(input: ApiRequestFor<'POST /api/notes'>, signal?: AbortSignal) { return jsonRequest('/api/notes', 'POST', isNote, input, signal); }
export async function updateKnowledgeNote(noteId: string, input: ApiRequestFor<'PATCH /api/notes/:id'>, signal?: AbortSignal) { return jsonRequest(`/api/notes/${encodeURIComponent(noteId)}`, 'PATCH', isNote, input, signal); }
export async function createKnowledgeNoteVersion(noteId: string, signal?: AbortSignal) { return jsonRequest(`/api/notes/${encodeURIComponent(noteId)}/versions`, 'POST', isVersion, undefined, signal); }
