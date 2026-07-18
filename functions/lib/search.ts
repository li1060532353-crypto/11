import type { ApiRequestFor, ApiResponseFor, KnowledgeStats, SearchResult } from '../../packages/shared/src/index';

import { NoteDomainError } from './notes';

type SearchStore = {
  search(query: ApiRequestFor<'GET /api/search'>): Promise<ApiResponseFor<'GET /api/search'>>;
  stats(): Promise<ApiResponseFor<'GET /api/stats'>>;
};

type SearchRow = Record<string, unknown>;

const searchWhere = `(
  n.title LIKE ? ESCAPE '\\'
  OR n.summary LIKE ? ESCAPE '\\'
  OR n.category LIKE ? ESCAPE '\\'
  OR n.content_text LIKE ? ESCAPE '\\'
  OR EXISTS (
    SELECT 1 FROM note_tags nt_search
    JOIN tags t_search ON t_search.id = nt_search.tag_id
    WHERE nt_search.note_id = n.id AND t_search.name LIKE ? ESCAPE '\\'
  )
)`;
const maximumPage = 10_000;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, '\\$&');
}

function mapSearchRow(row: SearchRow): SearchResult {
  const tagNames = String(row.tag_names ?? '');
  return {
    id: String(row.id),
    title: String(row.title),
    summary: String(row.summary),
    slug: String(row.slug),
    category: String(row.category),
    updatedAt: String(row.updated_at),
    excerpt: String(row.excerpt ?? ''),
    tags: tagNames ? tagNames.split('\u001F') : [],
  };
}

export function parseSearchQuery(request: Request): ApiRequestFor<'GET /api/search'> {
  const params = new URL(request.url).searchParams;
  const q = params.get('q');
  if (!q?.trim()) throw new NoteDomainError('VALIDATION_ERROR', 'Search query is required');

  const result: { q: string; page?: number; pageSize?: number } = { q: q.trim() };
  for (const key of ['page', 'pageSize'] as const) {
    if (!params.has(key)) continue;
    const value = Number(params.get(key));
    if (!Number.isSafeInteger(value) || value < 1 || (key === 'page' && value > maximumPage)) {
      throw new NoteDomainError('VALIDATION_ERROR', `Invalid ${key}`);
    }
    result[key] = value;
  }
  return result;
}

export function createD1SearchStore(db: D1Database): SearchStore {
  return {
    async search(query) {
      const page = query.page ?? 1;
      const pageSize = Math.min(100, query.pageSize ?? 20);
      const pattern = `%${escapeLike(query.q)}%`;
      const values = [pattern, pattern, pattern, pattern, pattern];
      const rows = await db.prepare(`
        SELECT n.id, n.title, n.summary, n.slug, n.category, n.updated_at,
          substr(n.content_text, 1, 240) AS excerpt,
          COALESCE((
            SELECT GROUP_CONCAT(t.name, char(31))
            FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
            WHERE nt.note_id = n.id
          ), '') AS tag_names
        FROM notes n
        WHERE ${searchWhere}
        ORDER BY n.updated_at DESC
        LIMIT ? OFFSET ?
      `).bind(...values, pageSize, (page - 1) * pageSize).all<SearchRow>();
      const count = await db.prepare(`SELECT COUNT(*) AS count FROM notes n WHERE ${searchWhere}`)
        .bind(...values)
        .first<{ count: number }>();
      const totalItems = Number(count?.count ?? 0);
      return {
        items: rows.results.map(mapSearchRow),
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      };
    },
    async stats(): Promise<KnowledgeStats> {
      const counts = await db.prepare(`
        SELECT COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft,
          COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published,
          COALESCE(SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END), 0) AS archived,
          COALESCE(SUM(CASE WHEN is_pinned = 1 THEN 1 ELSE 0 END), 0) AS pinned
        FROM notes
      `).first<Record<string, unknown>>();
      const roadmap = await db.prepare(`
        SELECT COALESCE(ROUND(AVG(ri.progress)), 0) AS roadmap_progress
        FROM roadmap_items ri
        JOIN roadmaps r ON r.id = ri.roadmap_id
        WHERE r.status = 'active'
      `).first<{ roadmap_progress: number }>();
      return {
        total: Number(counts?.total ?? 0),
        draft: Number(counts?.draft ?? 0),
        published: Number(counts?.published ?? 0),
        archived: Number(counts?.archived ?? 0),
        pinned: Number(counts?.pinned ?? 0),
        roadmapProgress: Number(roadmap?.roadmap_progress ?? 0),
      };
    },
  };
}
