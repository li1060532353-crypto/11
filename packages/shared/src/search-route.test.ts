import { describe, expect, it } from 'vitest';

import { onRequest as searchRoute } from '../../../functions/api/search';
import { onRequest as statsRoute } from '../../../functions/api/stats';
import { createD1SearchStore } from '../../../functions/lib/search';

type Row = Record<string, unknown>;

function mockDb(options: { rows?: Row[]; total?: number; stats?: Row; roadmapProgress?: number; fail?: boolean } = {}) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const prepare = (sql: string) => {
    const statement = (values: unknown[]) => ({
    async all() {
      if (options.fail) throw new Error('D1 details must not escape');
      statements.push({ sql, values });
      return { results: options.rows ?? [] };
    },
    async first() {
      if (options.fail) throw new Error('D1 details must not escape');
      statements.push({ sql, values });
      if (sql.includes('roadmap_items')) return { roadmap_progress: options.roadmapProgress ?? 0 };
      if (sql.includes('COUNT(*) AS count')) return { count: options.total ?? 0 };
      return options.stats ?? { total: 0, draft: 0, published: 0, archived: 0, pinned: 0 };
    },
    });
    return { ...statement([]), bind: (...values: unknown[]) => statement(values) };
  };
  return { db: { prepare } as unknown as D1Database, statements };
}

function context(request: Request, db: D1Database) {
  return { request, env: { DB: db, KB_ASSETS: {} } as never };
}

const resultRow = {
  id: 'note-1', title: 'Chinese search', summary: 'summary', slug: 'chinese-search',
  category: 'learning', updated_at: '2026-07-19T00:00:00.000Z', excerpt: 'matched text', tag_names: 'core\u001Fmethod',
};

describe('search D1 repository', () => {
  it('escapes LIKE wildcards and paginates parameterized search queries', async () => {
    const mock = mockDb({ rows: [resultRow], total: 3 });
    const result = await createD1SearchStore(mock.db).search({ q: '100%_\\', page: 2, pageSize: 5 });

    expect(result).toMatchObject({ page: 2, pageSize: 5, totalItems: 3, totalPages: 1 });
    expect(result.items[0]).toEqual({ id: 'note-1', title: 'Chinese search', summary: 'summary', slug: 'chinese-search', category: 'learning', updatedAt: '2026-07-19T00:00:00.000Z', excerpt: 'matched text', tags: ['core', 'method'] });
    expect(mock.statements).toHaveLength(2);
    expect(mock.statements[0].sql).toContain("LIKE ? ESCAPE '\\'");
    expect(mock.statements[0].values).toContain('%100\\%\\_\\\\%');
    expect(mock.statements[0].values.slice(-2)).toEqual([5, 5]);
    expect(mock.statements[0].sql).toContain('n.title LIKE ?');
    expect(mock.statements[0].sql).toContain('n.content_text LIKE ?');
    expect(mock.statements[0].sql).toContain('t_search.name LIKE ?');
    expect(mock.statements[0].values.slice(0, 5)).toEqual(Array(5).fill('%100\\%\\_\\\\%'));
    expect(mock.statements[0].sql).toContain('EXISTS (');
    expect(mock.statements[0].sql).not.toContain('FROM notes n\n        JOIN note_tags');
  });
});

describe('search Pages route', () => {
  it('returns a typed successful paginated response and an empty result', async () => {
    const successful = await searchRoute(context(new Request('http://x/api/search?q=Chinese&page=1&pageSize=10'), mockDb({ rows: [resultRow], total: 1 }).db));
    expect(successful.status).toBe(200);
    expect(await successful.json()).toMatchObject({ success: true, data: { totalItems: 1, items: [{ id: 'note-1', tags: ['core', 'method'] }] } });

    const empty = await searchRoute(context(new Request('http://x/api/search?q=missing'), mockDb().db));
    expect(await empty.json()).toMatchObject({ success: true, data: { items: [], totalItems: 0 } });
  });

  it('rejects invalid query values and maps D1 errors to the stable envelope', async () => {
    for (const url of ['http://x/api/search', 'http://x/api/search?q=%20%20', 'http://x/api/search?q=x&page=0', 'http://x/api/search?q=x&page=10001', 'http://x/api/search?q=x&page=9007199254740992', 'http://x/api/search?q=x&pageSize=0']) {
      expect((await searchRoute(context(new Request(url), mockDb().db))).status).toBe(400);
    }
    const response = await searchRoute(context(new Request('http://x/api/search?q=x'), mockDb({ fail: true }).db));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'Unable to process search request' } });
  });

  it('caps the requested page size at the supported maximum', async () => {
    const mock = mockDb();
    const response = await searchRoute(context(new Request('http://x/api/search?q=x&pageSize=101'), mock.db));

    expect(await response.json()).toMatchObject({ success: true, data: { pageSize: 100 } });
    expect(mock.statements[0].values.slice(-2)).toEqual([100, 0]);
  });
});

describe('statistics Pages route', () => {
  it('returns D1 counts and active-roadmap progress', async () => {
    const mock = mockDb({ stats: { total: 6, draft: 1, published: 3, archived: 2, pinned: 2 }, roadmapProgress: 58 });
    const response = await statsRoute(context(new Request('http://x/api/stats'), mock.db));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { total: 6, draft: 1, published: 3, archived: 2, pinned: 2, roadmapProgress: 58 } });
    expect(mock.statements[0].sql).toContain("status = 'archived'");
  });

  it('maps D1 statistics failures to the stable envelope', async () => {
    const response = await statsRoute(context(new Request('http://x/api/stats'), mockDb({ fail: true }).db));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'Unable to load statistics' } });
  });
});
