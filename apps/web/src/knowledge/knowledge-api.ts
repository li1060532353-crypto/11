import type { ApiRequestFor, ApiResponse, ApiResponseFor } from '@namdw/shared';

export type KnowledgeApiFailure = { kind: 'access' | 'request' | 'malformed' | 'network' };
const fail = (kind: KnowledgeApiFailure['kind']): KnowledgeApiFailure => ({ kind });

async function get<K extends 'GET /api/notes' | 'GET /api/search' | 'GET /api/stats'>(path: string): Promise<ApiResponseFor<K>> {
  let response: Response;
  try { response = await fetch(path, { method: 'GET', headers: { Accept: 'application/json' } }); } catch { throw fail('network'); }
  if (response.status === 401 || response.status === 403) throw fail('access');
  if (!response.ok) throw fail('request');
  let envelope: unknown;
  try { envelope = await response.json(); } catch { throw fail('malformed'); }
  if (!isEnvelope(envelope)) throw fail('malformed');
  if (!envelope.success) throw fail('request');
  return envelope.data as ApiResponseFor<K>;
}
function isEnvelope(value: unknown): value is ApiResponse<unknown> { return typeof value === 'object' && value !== null && 'success' in value && ((value as { success: unknown }).success === true ? 'data' in value : (value as { success: unknown }).success === false && 'error' in value); }
function toQuery(values: Record<string, string | number | boolean | undefined>) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(key, String(value)); return params.toString(); }
export type KnowledgeNotesQuery = ApiRequestFor<'GET /api/notes'> & { q?: string };
function record(value: unknown): Record<string, unknown> | null { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null; }
function string(value: unknown): value is string { return typeof value === 'string'; }
function date(value: unknown): boolean { return string(value) && !Number.isNaN(Date.parse(value)); }
function integer(value: unknown): boolean { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function isNote(value: unknown): boolean { const item = record(value); return !!item && string(item.id) && item.id.length > 0 && string(item.title) && string(item.slug) && string(item.summary) && string(item.category) && string(item.contentJson) && string(item.contentText) && ['draft', 'published', 'archived'].includes(String(item.status)) && typeof item.isPinned === 'boolean' && integer(item.reviewCount) && date(item.createdAt) && date(item.updatedAt) && (item.lastReviewedAt === null || date(item.lastReviewedAt)); }
function isSearchResult(value: unknown): boolean { const item = record(value); return !!item && string(item.id) && item.id.length > 0 && string(item.title) && string(item.slug) && string(item.summary) && string(item.category) && date(item.updatedAt) && string(item.excerpt) && Array.isArray(item.tags) && item.tags.every(string); }
function isPage(value: unknown, itemValidator: (item: unknown) => boolean): value is { items: readonly unknown[]; page: number; pageSize: number; totalItems: number; totalPages: number } { const page = record(value); return !!page && Array.isArray(page.items) && page.items.every(itemValidator) && integer(page.page) && Number(page.page) >= 1 && integer(page.pageSize) && Number(page.pageSize) >= 1 && integer(page.totalItems) && integer(page.totalPages); }
function isStats(value: unknown): boolean { return typeof value === 'object' && value !== null && ['total', 'draft', 'published', 'archived', 'pinned', 'roadmapProgress'].every((key) => typeof (value as Record<string, unknown>)[key] === 'number'); }
export async function loadKnowledgeNotes(input: KnowledgeNotesQuery) { const q = input.q?.trim(); const data = q ? await get<'GET /api/search'>(`/api/search?${toQuery({ q, page: input.page, pageSize: input.pageSize })}`) : await get<'GET /api/notes'>(`/api/notes?${toQuery(input)}`); if (!isPage(data, q ? isSearchResult : isNote)) throw fail('malformed'); return data; }
export async function loadKnowledgeStats() { const data = await get<'GET /api/stats'>('/api/stats'); if (!isStats(data)) throw fail('malformed'); return data; }
