import { describe, expect, it } from 'vitest';
import type {
  PublicCoverTone,
  PublicPostSummary,
  PublicPostDetail,
  PublicNeighborPost,
  PublicPostNeighbors,
  PublicPostListResponse,
} from './index';
import {
  onRequest as postsRoute,
  publicPost,
  publicPostSummary,
} from '../../../functions/api/public/posts';
import { onRequest as searchRoute } from '../../../functions/api/public/search';
import { onRequest as neighborsRoute } from '../../../functions/api/public/neighbors';
import type { KnowledgeBaseEnv } from '../../../functions/env';

type QueryRecord = {
  sql: string;
  values: unknown[];
};

type MockDbOptions = {
  rows?: Record<string, unknown>[];
  targetRow?: Record<string, unknown> | null;
  prevRow?: Record<string, unknown> | null;
  nextRow?: Record<string, unknown> | null;
  count?: number;
  fail?: boolean;
  handleQuery?: (
    sql: string,
    values: unknown[],
  ) => { rows?: Record<string, unknown>[]; first?: unknown } | undefined;
};

function createMockDb(options: MockDbOptions = {}) {
  const statements: QueryRecord[] = [];

  const prepare = (sql: string) => {
    const statement = (values: unknown[] = []) => ({
      async all<T = Record<string, unknown>>() {
        if (options.fail) throw new Error('D1 mock query failure');
        statements.push({ sql, values });
        const custom = options.handleQuery?.(sql, values);
        if (custom?.rows !== undefined) {
          return { results: custom.rows as T[] };
        }
        return { results: (options.rows ?? []) as T[] };
      },
      async first<T = Record<string, unknown>>() {
        if (options.fail) throw new Error('D1 mock query failure');
        statements.push({ sql, values });
        const custom = options.handleQuery?.(sql, values);
        if (custom?.first !== undefined) {
          return custom.first as T;
        }
        if (sql.includes('COUNT(*)')) {
          return { count: options.count ?? options.rows?.length ?? 0 } as T;
        }
        if (sql.includes('ORDER BY meta.published_at ASC, meta.slug ASC LIMIT 1')) {
          return (options.prevRow ?? null) as T | null;
        }
        if (sql.includes('ORDER BY meta.published_at DESC, meta.slug DESC LIMIT 1')) {
          return (options.nextRow ?? null) as T | null;
        }
        if (sql.includes('SELECT meta.slug, meta.published_at')) {
          return (options.targetRow ?? null) as T | null;
        }
        return (options.rows?.[0] ?? null) as T | null;
      },
    });

    return {
      ...statement([]),
      bind: (...values: unknown[]) => statement(values),
    };
  };

  return {
    db: { prepare } as unknown as D1Database,
    statements,
  };
}

function createContext(request: Request, db: unknown) {
  return {
    request,
    env: { DB: db } as unknown as KnowledgeBaseEnv,
  };
}

describe('Public Content Shared Contracts', () => {
  it('validates contract types and mapping helper behavior', () => {
    const rawRow = {
      public_slug: 'linear-algebra-notes',
      public_category: 'Mathematics',
      public_tags_json: '["matrix", "vector"]',
      public_is_featured: 1,
      published_title: 'Linear Algebra Fundamentals',
      published_summary: 'Core concepts in linear algebra',
      public_published_at: '2026-10-01T10:00:00Z',
      content_len: 1200,
    };

    const summary: PublicPostSummary = publicPostSummary(rawRow);
    expect(summary).toEqual({
      slug: 'linear-algebra-notes',
      title: 'Linear Algebra Fundamentals',
      summary: 'Core concepts in linear algebra',
      category: 'Mathematics',
      tags: ['matrix', 'vector'],
      publishedAt: '2026-10-01T10:00:00Z',
      readingTime: 3, // ceil(1200 / 400) = 3
      selected: true,
      cover: {
        alt: 'Linear Algebra Fundamentals',
        tone: 'blue' as PublicCoverTone,
      },
    });

    // Detail mapper
    const rawDetailRow = {
      ...rawRow,
      published_content_json: '{"type":"doc","content":[{"type":"paragraph","text":"Hello world"}]}',
      published_content_text: 'Hello world'.repeat(50), // 550 chars
    };

    const detail: PublicPostDetail = publicPost(rawDetailRow);
    expect(detail.body).toBe('Hello world'.repeat(50));
    expect(detail.contentJson).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', text: 'Hello world' }],
    });
    expect(detail.readingTime).toBe(2); // ceil(550 / 400) = 2

    // Neighbor post contracts
    const neighbor: PublicNeighborPost = { slug: 'next-post', title: 'Next Post' };
    const neighbors: PublicPostNeighbors = { previous: undefined, next: neighbor };
    expect(neighbors.next?.slug).toBe('next-post');

    // List response contract
    const listResponse: PublicPostListResponse = {
      items: [summary],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    };
    expect(listResponse.items).toHaveLength(1);
  });

  it('handles corrupted json and fallback values gracefully in mappers', () => {
    const fallbackRow = {
      public_slug: 'fallback-slug',
      public_tags_json: 'invalid json',
      published_content_json: 'corrupted json',
      content_len: 0,
    };

    const summary = publicPostSummary(fallbackRow);
    expect(summary.tags).toEqual([]);
    expect(summary.readingTime).toBe(1); // Math.max(1, 0)

    const detail = publicPost(fallbackRow);
    expect(detail.tags).toEqual([]);
    expect(detail.contentJson).toBeUndefined();
  });
});

describe('GET /api/public/posts Endpoint', () => {
  it('lists published post summaries without full content when slug is not provided', async () => {
    const row = {
      public_slug: 'post-1',
      public_category: 'Engineering',
      public_tags_json: '["ts"]',
      public_is_featured: 1,
      published_title: 'Post One',
      published_summary: 'Summary One',
      public_published_at: '2026-10-02T12:00:00Z',
      content_len: 850,
    };

    const mock = createMockDb({ rows: [row], count: 1 });
    const response = await postsRoute(
      createContext(new Request('https://blog.test/api/public/posts?page=1&pageSize=10'), mock.db),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.page).toBe(1);
    expect(json.data.pageSize).toBe(10);
    expect(json.data.totalItems).toBe(1);
    expect(json.data.totalPages).toBe(1);
    expect(json.data.items).toHaveLength(1);

    const item = json.data.items[0];
    expect(item.slug).toBe('post-1');
    expect(item.readingTime).toBe(3); // ceil(850 / 400) = 3
    expect(item).not.toHaveProperty('body');
    expect(item).not.toHaveProperty('contentJson');

    // Verify SQL query
    expect(mock.statements).toHaveLength(2);
    const selectQuery = mock.statements[0]!;
    const selectColumns = selectQuery.sql.split('FROM')[0] ?? '';
    expect(selectColumns).not.toContain('published_content_json');
    expect(selectColumns).not.toContain('notes.published_content_text, meta');
    expect(selectQuery.sql).toContain('LENGTH(COALESCE(notes.published_content_text, \'\')) AS content_len');
    expect(selectQuery.sql).toContain('ORDER BY meta.published_at DESC, meta.slug DESC');
    expect(selectQuery.values).toEqual([10, 0]);
  });

  it('retrieves full post detail with body and contentJson when slug is provided', async () => {
    const row = {
      public_slug: 'detail-slug',
      public_category: 'Architecture',
      public_tags_json: '["d1", "workers"]',
      public_is_featured: 0,
      published_title: 'Detail Title',
      published_summary: 'Detail Summary',
      published_content_json: '{"type":"doc"}',
      published_content_text: 'Full markdown body content',
      public_published_at: '2026-10-02T15:00:00Z',
    };

    const mock = createMockDb({ rows: [row], count: 1 });
    const response = await postsRoute(
      createContext(new Request('https://blog.test/api/public/posts?slug=detail-slug'), mock.db),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.items).toHaveLength(1);

    const detail = json.data.items[0];
    expect(detail.slug).toBe('detail-slug');
    expect(detail.body).toBe('Full markdown body content');
    expect(detail.contentJson).toEqual({ type: 'doc' });

    // Verify SQL query includes content_json and binds slug
    const selectQuery = mock.statements[0];
    expect(selectQuery.sql).toContain('notes.published_content_json');
    expect(selectQuery.sql).toContain('notes.published_content_text');
    expect(selectQuery.sql).toContain('meta.slug=?');
    expect(selectQuery.sql).toContain('ORDER BY meta.published_at DESC, meta.slug DESC');
    expect(selectQuery.values[0]).toBe('detail-slug');
  });

  it('returns empty items array when slug does not match any published article', async () => {
    const mock = createMockDb({ rows: [], count: 0 });
    const response = await postsRoute(
      createContext(new Request('https://blog.test/api/public/posts?slug=non-existent'), mock.db),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.items).toEqual([]);
    expect(json.data.totalItems).toBe(0);
  });

  it('rejects non-GET HTTP methods with 405', async () => {
    const mock = createMockDb();
    const response = await postsRoute(
      createContext(new Request('https://blog.test/api/public/posts', { method: 'POST' }), mock.db),
    );
    expect(response.status).toBe(405);
    const json = await response.json();
    expect(json.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('maps database query failures to 500 CONTENT_UNAVAILABLE', async () => {
    const mock = createMockDb({ fail: true });
    const response = await postsRoute(
      createContext(new Request('https://blog.test/api/public/posts'), mock.db),
    );
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error.code).toBe('CONTENT_UNAVAILABLE');
  });
});

describe('GET /api/public/search Endpoint', () => {
  it('searches published notes with keyword matching multiple fields', async () => {
    const searchRow = {
      public_slug: 'linear-systems',
      public_category: 'Signals',
      public_tags_json: '["lti", "convolution"]',
      public_is_featured: 1,
      published_title: 'Linear Time-Invariant Systems',
      published_summary: 'Signals and systems analysis',
      public_published_at: '2026-10-01T08:00:00Z',
      content_len: 400,
    };

    const mock = createMockDb({ rows: [searchRow], count: 1 });
    const response = await searchRoute(
      createContext(
        new Request('https://blog.test/api/public/search?q=Signals&page=1&pageSize=5'),
        mock.db,
      ),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.items).toHaveLength(1);
    expect(json.data.page).toBe(1);
    expect(json.data.pageSize).toBe(5);
    expect(json.data.totalItems).toBe(1);
    expect(json.data.items[0].slug).toBe('linear-systems');
    expect(json.data.items[0]).not.toHaveProperty('body');

    // Verify SQL query structure
    expect(mock.statements).toHaveLength(2);
    const selectQuery = mock.statements[0];
    expect(selectQuery.sql).toContain("notes.status='published'");
    expect(selectQuery.sql).toContain('notes.published_title IS NOT NULL');
    expect(selectQuery.sql).toContain('notes.published_content_json IS NOT NULL');
    expect(selectQuery.sql).toContain('notes.published_title LIKE ?');
    expect(selectQuery.sql).toContain('notes.published_summary LIKE ?');
    expect(selectQuery.sql).toContain('notes.published_content_text LIKE ?');
    expect(selectQuery.sql).toContain('meta.category LIKE ?');
    expect(selectQuery.sql).toContain('meta.tags_json LIKE ?');
    expect(selectQuery.sql).toContain('ORDER BY meta.published_at DESC, meta.slug DESC');
    expect(selectQuery.sql).toContain('LENGTH(COALESCE(notes.published_content_text, \'\')) AS content_len');

    // Verify parameters: 5 LIKE params + pageSize + offset
    expect(selectQuery.values).toEqual(['%Signals%', '%Signals%', '%Signals%', '%Signals%', '%Signals%', 5, 0]);
  });

  it('returns empty result set immediately when search query is empty or whitespace', async () => {
    const mock = createMockDb();
    const response = await searchRoute(
      createContext(new Request('https://blog.test/api/public/search?q=%20%20'), mock.db),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.items).toEqual([]);
    expect(json.data.totalItems).toBe(0);
    expect(mock.statements).toHaveLength(0); // DB was not called
  });

  it('rejects non-GET method on search endpoint', async () => {
    const mock = createMockDb();
    const response = await searchRoute(
      createContext(new Request('https://blog.test/api/public/search?q=test', { method: 'DELETE' }), mock.db),
    );
    expect(response.status).toBe(405);
    const json = await response.json();
    expect(json.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('maps search database errors to 500 SEARCH_FAILED', async () => {
    const mock = createMockDb({ fail: true });
    const response = await searchRoute(
      createContext(new Request('https://blog.test/api/public/search?q=fail'), mock.db),
    );
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error.code).toBe('SEARCH_FAILED');
  });
});

describe('GET /api/public/neighbors Endpoint', () => {
  it('returns previous (newer) and next (older) adjacent articles in reverse chronological order', async () => {
    const targetPost = {
      slug: 'current-post',
      published_at: '2026-10-02T12:00:00Z',
    };
    const prevPost = {
      slug: 'newer-post',
      title: 'Newer Article',
    };
    const nextPost = {
      slug: 'older-post',
      title: 'Older Article',
    };

    const mock = createMockDb({
      targetRow: targetPost,
      prevRow: prevPost,
      nextRow: nextPost,
    });

    const response = await neighborsRoute(
      createContext(new Request('https://blog.test/api/public/neighbors?slug=current-post'), mock.db),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual({
      previous: { slug: 'newer-post', title: 'Newer Article' },
      next: { slug: 'older-post', title: 'Older Article' },
    });

    // Verify statements
    expect(mock.statements).toHaveLength(3);

    // 1. Target lookup
    expect(mock.statements[0].sql).toContain('WHERE notes.status=\'published\'');
    expect(mock.statements[0].sql).toContain('meta.slug=?');
    expect(mock.statements[0].values).toEqual(['current-post']);

    // 2. Previous (newer post in reverse chronological list)
    expect(mock.statements[1].sql).toContain('meta.published_at > ? OR (meta.published_at = ? AND meta.slug > ?)');
    expect(mock.statements[1].sql).toContain('ORDER BY meta.published_at ASC, meta.slug ASC LIMIT 1');
    expect(mock.statements[1].values).toEqual([targetPost.published_at, targetPost.published_at, targetPost.slug]);

    // 3. Next (older post in reverse chronological list)
    expect(mock.statements[2].sql).toContain('meta.published_at < ? OR (meta.published_at = ? AND meta.slug < ?)');
    expect(mock.statements[2].sql).toContain('ORDER BY meta.published_at DESC, meta.slug DESC LIMIT 1');
    expect(mock.statements[2].values).toEqual([targetPost.published_at, targetPost.published_at, targetPost.slug]);
  });

  it('handles boundary cases: newest article has no previous, oldest article has no next', async () => {
    // Newest post: no previous
    const mockNewest = createMockDb({
      targetRow: { slug: 'newest', published_at: '2026-10-03T00:00:00Z' },
      prevRow: null,
      nextRow: { slug: 'middle', title: 'Middle Post' },
    });
    const newestRes = await neighborsRoute(
      createContext(new Request('https://blog.test/api/public/neighbors?slug=newest'), mockNewest.db),
    );
    expect(newestRes.status).toBe(200);
    const newestJson = await newestRes.json();
    expect(newestJson.data.previous).toBeUndefined();
    expect(newestJson.data.next).toEqual({ slug: 'middle', title: 'Middle Post' });

    // Oldest post: no next
    const mockOldest = createMockDb({
      targetRow: { slug: 'oldest', published_at: '2026-10-01T00:00:00Z' },
      prevRow: { slug: 'middle', title: 'Middle Post' },
      nextRow: null,
    });
    const oldestRes = await neighborsRoute(
      createContext(new Request('https://blog.test/api/public/neighbors?slug=oldest'), mockOldest.db),
    );
    expect(oldestRes.status).toBe(200);
    const oldestJson = await oldestRes.json();
    expect(oldestJson.data.previous).toEqual({ slug: 'middle', title: 'Middle Post' });
    expect(oldestJson.data.next).toBeUndefined();
  });

  it('returns 404 when target post slug is not found or missing', async () => {
    // Slug not found in DB
    const mockNotFound = createMockDb({ targetRow: null });
    const notFoundRes = await neighborsRoute(
      createContext(new Request('https://blog.test/api/public/neighbors?slug=not-found'), mockNotFound.db),
    );
    expect(notFoundRes.status).toBe(404);
    expect((await notFoundRes.json()).error.code).toBe('NOT_FOUND');

    // Missing slug param in URL
    const missingRes = await neighborsRoute(
      createContext(new Request('https://blog.test/api/public/neighbors'), mockNotFound.db),
    );
    expect(missingRes.status).toBe(404);
    expect((await missingRes.json()).error.code).toBe('NOT_FOUND');
  });

  it('rejects non-GET methods with 405 on neighbors endpoint', async () => {
    const mock = createMockDb();
    const response = await neighborsRoute(
      createContext(new Request('https://blog.test/api/public/neighbors?slug=x', { method: 'POST' }), mock.db),
    );
    expect(response.status).toBe(405);
    const json = await response.json();
    expect(json.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('maps neighbor query database failure to 500 CONTENT_UNAVAILABLE', async () => {
    const mock = createMockDb({ fail: true });
    const response = await neighborsRoute(
      createContext(new Request('https://blog.test/api/public/neighbors?slug=test'), mock.db),
    );
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error.code).toBe('CONTENT_UNAVAILABLE');
  });
});
