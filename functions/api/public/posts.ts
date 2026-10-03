import type { KnowledgeBaseEnv } from '../../env';
import type { PublicPostDetail, PublicPostSummary } from '../../../packages/shared/src/public-content';

export function publicPost(row: Record<string, unknown>): PublicPostDetail {
  const title = String(row.published_title ?? '');
  const body = String(row.published_content_text ?? '');
  let contentJson: unknown = undefined;
  if (row.published_content_json) {
    try {
      contentJson = typeof row.published_content_json === 'string'
        ? JSON.parse(row.published_content_json)
        : row.published_content_json;
    } catch {
      contentJson = undefined;
    }
  }
  let tags: string[] = [];
  if (row.public_tags_json) {
    try {
      tags = typeof row.public_tags_json === 'string'
        ? JSON.parse(row.public_tags_json)
        : (row.public_tags_json as string[]);
    } catch {
      tags = [];
    }
  }
  return {
    slug: String(row.public_slug ?? ''),
    title,
    summary: String(row.published_summary ?? ''),
    body,
    contentJson,
    category: String(row.public_category ?? ''),
    tags: Array.isArray(tags) ? tags : [],
    publishedAt: String(row.public_published_at ?? ''),
    readingTime: Math.max(1, Math.ceil(body.length / 400)),
    selected: Boolean(row.public_is_featured),
    cover: { alt: title, tone: 'blue' },
  };
}

export function publicPostSummary(row: Record<string, unknown>): PublicPostSummary {
  const title = String(row.published_title ?? '');
  let tags: string[] = [];
  if (row.public_tags_json) {
    try {
      tags = typeof row.public_tags_json === 'string'
        ? JSON.parse(row.public_tags_json)
        : (row.public_tags_json as string[]);
    } catch {
      tags = [];
    }
  }
  const contentLen = Number(row.content_len || 0);
  return {
    slug: String(row.public_slug ?? ''),
    title,
    summary: String(row.published_summary ?? ''),
    category: String(row.public_category ?? ''),
    tags: Array.isArray(tags) ? tags : [],
    publishedAt: String(row.public_published_at ?? ''),
    readingTime: Math.max(1, Math.ceil(contentLen / 400)),
    selected: Boolean(row.public_is_featured),
    cover: { alt: title, tone: 'blue' },
  };
}

export const onRequest = async (context: { request: Request; env: KnowledgeBaseEnv }) => {
  if (context.request.method !== 'GET') {
    return Response.json(
      { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Read only' } },
      { status: 405 }
    );
  }
  try {
    const url = new URL(context.request.url);
    const page = Math.max(1, Math.min(1000, Math.floor(Number(url.searchParams.get('page')) || 1)));
    const pageSize = Math.max(1, Math.min(100, Math.floor(Number(url.searchParams.get('pageSize')) || 100)));
    const slug = url.searchParams.get('slug');

    if (slug) {
      const clause = "notes.status='published' AND notes.published_content_json IS NOT NULL AND notes.published_title IS NOT NULL AND meta.slug=?";
      const rows = await context.env.DB.prepare(
        `SELECT meta.slug AS public_slug, meta.category AS public_category, meta.tags_json AS public_tags_json, meta.is_featured AS public_is_featured, notes.published_title, notes.published_summary, notes.published_content_json, notes.published_content_text, meta.published_at AS public_published_at FROM notes JOIN note_publication_metadata meta ON meta.note_id=notes.id WHERE ${clause} ORDER BY meta.published_at DESC, meta.slug DESC LIMIT ? OFFSET ?`
      ).bind(slug, pageSize, (page - 1) * pageSize).all<Record<string, unknown>>();

      const count = await context.env.DB.prepare(
        `SELECT COUNT(*) AS count FROM notes JOIN note_publication_metadata meta ON meta.note_id=notes.id WHERE ${clause}`
      ).bind(slug).first<{ count: number }>();

      const items: PublicPostDetail[] = rows.results.map((row) => publicPost(row));
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
    }

    const clause = "notes.status='published' AND notes.published_content_json IS NOT NULL AND notes.published_title IS NOT NULL";
    const rows = await context.env.DB.prepare(
      `SELECT meta.slug AS public_slug, meta.category AS public_category, meta.tags_json AS public_tags_json, meta.is_featured AS public_is_featured, notes.published_title, notes.published_summary, meta.published_at AS public_published_at, LENGTH(COALESCE(notes.published_content_text, '')) AS content_len FROM notes JOIN note_publication_metadata meta ON meta.note_id=notes.id WHERE ${clause} ORDER BY meta.published_at DESC, meta.slug DESC LIMIT ? OFFSET ?`
    ).bind(pageSize, (page - 1) * pageSize).all<Record<string, unknown>>();

    const count = await context.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM notes JOIN note_publication_metadata meta ON meta.note_id=notes.id WHERE ${clause}`
    ).first<{ count: number }>();

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
      { success: false, error: { code: 'CONTENT_UNAVAILABLE', message: 'Unable to load published articles' } },
      { status: 500 }
    );
  }
};
