import type { KnowledgeBaseEnv } from '../../env';
import type { PublicPostNeighbors } from '../../../packages/shared/src/public-content';

export const onRequest = async (context: { request: Request; env: KnowledgeBaseEnv }) => {
  if (context.request.method !== 'GET') {
    return Response.json(
      { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Read only' } },
      { status: 405 }
    );
  }

  try {
    const url = new URL(context.request.url);
    const slug = url.searchParams.get('slug');
    if (!slug) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } },
        { status: 404 }
      );
    }

    const target = await context.env.DB.prepare(
      `SELECT meta.slug, meta.published_at FROM notes JOIN note_publication_metadata meta ON meta.note_id=notes.id WHERE notes.status='published' AND notes.published_title IS NOT NULL AND meta.slug=?`
    ).bind(slug).first<{ slug: string; published_at: string }>();

    if (!target) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } },
        { status: 404 }
      );
    }

    const prevRow = await context.env.DB.prepare(
      `SELECT meta.slug, notes.published_title AS title FROM notes JOIN note_publication_metadata meta ON meta.note_id=notes.id WHERE notes.status='published' AND notes.published_title IS NOT NULL AND (meta.published_at > ? OR (meta.published_at = ? AND meta.slug > ?)) ORDER BY meta.published_at ASC, meta.slug ASC LIMIT 1`
    ).bind(target.published_at, target.published_at, target.slug).first<{ slug: string; title: string }>();

    const nextRow = await context.env.DB.prepare(
      `SELECT meta.slug, notes.published_title AS title FROM notes JOIN note_publication_metadata meta ON meta.note_id=notes.id WHERE notes.status='published' AND notes.published_title IS NOT NULL AND (meta.published_at < ? OR (meta.published_at = ? AND meta.slug < ?)) ORDER BY meta.published_at DESC, meta.slug DESC LIMIT 1`
    ).bind(target.published_at, target.published_at, target.slug).first<{ slug: string; title: string }>();

    const data: PublicPostNeighbors = {
      previous: prevRow ? { slug: String(prevRow.slug), title: String(prevRow.title) } : undefined,
      next: nextRow ? { slug: String(nextRow.slug), title: String(nextRow.title) } : undefined,
    };

    return Response.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return Response.json(
      { success: false, error: { code: 'CONTENT_UNAVAILABLE', message: 'Unable to load post neighbors' } },
      { status: 500 }
    );
  }
};
