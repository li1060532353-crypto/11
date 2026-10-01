import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest as importRoute } from '../../../functions/api/import/markdown';
import type { MarkdownImportResponse } from './knowledge';

type Row = Record<string, unknown>;
function mockDb(rows: Row[] = [], fail = false) {
  const batches: Array<Array<{ sql: string; values: unknown[] }>> = [];
  const runs: Array<{ sql: string; values: unknown[] }> = [];
  const prepare = (sql: string) => ({
    bind: (...values: unknown[]) => ({
      async all() {
        if (fail) throw new Error('db');
        return { results: rows };
      },
      async first() {
        if (fail) throw new Error('db');
        const id = values[0];
        return rows.find((row) => row.id === id) ?? null;
      },
      async run() {
        if (fail) throw new Error('db');
        runs.push({ sql, values });
        return { success: true };
      },
      sql,
      values,
    }),
  });
  return {
    db: {
      prepare,
      async batch(statements: Array<{ sql: string; values: unknown[] }>) {
        if (fail) throw new Error('db');
        batches.push(statements);
        return [];
      },
    } as unknown as D1Database,
    batches,
    runs,
  };
}

function context(request: Request, db: D1Database) {
  return { request, env: { DB: db, KB_ASSETS: {} } as never };
}

beforeEach(() => vi.stubGlobal('crypto', { randomUUID: () => 'import-id-1' }));

describe('POST /api/import/markdown route', () => {
  it('imports markdown content as draft note', async () => {
    const mock = mockDb([]);
    const request = new Request('http://localhost/api/import/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'study-plan.md',
        content: '# 英语学习计划\n\n| 天数 | 任务 |\n|---|---|\n| 第1天 | 单词 |\n',
      }),
    });

    const response = await importRoute(context(request, mock.db));
    expect(response.status).toBe(201);
    const body = (await response.json()) as { success: boolean; data: MarkdownImportResponse };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('imported');
    expect(body.data.note.title).toBe('英语学习计划');
    expect(body.data.note.status).toBe('draft');
    expect(mock.batches.length).toBeGreaterThan(0);
  });

  it('skips duplicate content if exact note already exists', async () => {
    const existing = {
      id: 'existing-1',
      title: '英语学习计划',
      slug: 'english-plan',
      summary: '',
      content_json: '{}',
      content_text: '天数 任务 第1天 单词',
      category: '通用',
      status: 'draft',
      is_pinned: 0,
      is_featured: 0,
      published_at: null,
      review_count: 0,
      created_at: 't',
      updated_at: 't',
      last_reviewed_at: null,
    };
    const mock = mockDb([existing]);

    const request = new Request('http://localhost/api/import/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'study-plan.md',
        content: '# 英语学习计划\n\n| 天数 | 任务 |\n|---|---|\n| 第1天 | 单词 |\n',
      }),
    });

    const response = await importRoute(context(request, mock.db));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; data: MarkdownImportResponse };
    expect(body.data.status).toBe('skipped');
    expect(mock.batches).toHaveLength(0);
  });

  it('rejects GET or malformed body with 405 or 400', async () => {
    const mock = mockDb([]);
    const getRes = await importRoute(
      context(new Request('http://localhost/api/import/markdown', { method: 'GET' }), mock.db),
    );
    expect(getRes.status).toBe(405);

    const badRes = await importRoute(
      context(
        new Request('http://localhost/api/import/markdown', {
          method: 'POST',
          body: 'bad-json',
        }),
        mock.db,
      ),
    );
    expect(badRes.status).toBe(400);
  });
});
