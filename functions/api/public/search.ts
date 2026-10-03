import type { KnowledgeBaseEnv } from '../../env';
import type { PublicPostSummary } from '../../../packages/shared/src/public-content';
import { publicPostSummary } from './posts';

export const onRequest = async (context: { request: Request; env: KnowledgeBaseEnv }) => {
  if (context.request.method !== 'GET') {
    return Response.json(
      { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Read only' } },
      { status: 405 }
    );
  }

  try {
    const url = new URL(context.request.url);
    const rawQuery = url.searchParams.get('q');
    const keyword = (rawQuery ?? '').trim();
    const page = Math.max(1, Math.min(1000, Math.floor(Number(url.searchParams.get('page')) || 1)));
    const pageSize = Math.max(1, Math.min(100, Math.floor(Number(url.searchParams.get('pageSize')) || 20)));

    if (!keyword) {
      return Response.json(
        {
          success: true,
          data: {
            items: [],
            page,
            pageSize,
            totalItems: 0,
            totalPages: 1,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const likeParam = `%${keyword}%`;
    const clause = `notes.status='published' AND notes.published_title IS NOT NULL AND notes.published_content_json IS NOT NULL AND (notes.published_title LIKE ? OR notes.published_summary LIKE ? OR notes.published_content_text LIKE ? OR meta.category LIKE ? OR meta.tags_json LIKE ?)`;

    const rows = await context.env.DB.prepare(
      `SELECT meta.slug AS public_slug, meta.category AS public_category, meta.tags_json AS public_tags_json, meta.is_featured AS public_is_featured, notes.published_title, notes.published_summary, meta.published_at AS public_published_at, LENGTH(COALESCE(notes.published_content_text, '')) AS content_len FROM notes JOIN note_publication_metadata meta ON meta.note_id=notes.id WHERE ${clause} ORDER BY meta.published_at DESC, meta.slug DESC LIMIT ? OFFSET ?`
    )
      .bind(likeParam, likeParam, likeParam, likeParam, likeParam, pageSize, (page - 1) * pageSize)
      .all<Record<string, unknown>>();

    const count = await context.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM notes JOIN note_publication_metadata meta ON meta.note_id=notes.id WHERE ${clause}`
    )
      .bind(likeParam, likeParam, likeParam, likeParam, likeParam)
      .first<{ count: number }>();

    const items: PublicPostSummary[] = rows.results.map((row) => publicPostSummary(row));
    const totalItems = Number(count?.count ?? 0);
    return Response.json(
      {
        success: true,
        data: {
          items,
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return Response.json(
      { success: false, error: { code: 'SEARCH_FAILED', message: 'Unable to search published articles' } },
      { status: 500 }
    );
  }
};
