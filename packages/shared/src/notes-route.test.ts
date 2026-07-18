import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest as notesRoute } from '../../../functions/api/notes/[[path]]';
import { onRequest as accessMiddleware } from '../../../functions/_middleware';

type Row = Record<string, unknown>;
function mockDb(rows: Row[] = [], fail = false) {
  const batches: Array<Array<{ sql: string; values: unknown[] }>> = [];
  const runs: Array<{ sql: string; values: unknown[] }> = [];
  const prepare = (sql: string) => ({ bind: (...values: unknown[]) => ({
    async all() { if (fail) throw new Error('db'); return { results: rows }; },
    async first() { if (fail) throw new Error('db'); const id = values[0]; return rows.find((row) => row.id === id) ?? null; },
    async run() { if (fail) throw new Error('db'); runs.push({ sql, values }); return { success: true }; },
    sql, values,
  }) });
  return { db: { prepare, async batch(statements: Array<{ sql: string; values: unknown[] }>) { if (fail) throw new Error('db'); batches.push(statements); return []; } } as unknown as D1Database, batches, runs };
}
function context(request: Request, db: D1Database, path?: string[]) { return { request, env: { DB: db, KB_ASSETS: {} } as never, params: { path } }; }
const body = { title: 'New', summary: '', contentJson: '{"content":[{"text":"hello"}]}', category: 'x', status: 'draft', isPinned: false };
beforeEach(() => vi.stubGlobal('crypto', { randomUUID: () => 'version-id' }));

describe('notes Pages route', () => {
  it('lists notes and maps repository failures', async () => {
    const row = { id: 'a', title: 'A', slug: 'a', summary: '', content_json: '{}', content_text: '', category: '', status: 'draft', is_pinned: 0, review_count: 0, created_at: 't', updated_at: 't', last_reviewed_at: null };
    expect((await notesRoute(context(new Request('http://x/api/notes'), mockDb([row]).db))).status).toBe(200);
    expect((await notesRoute(context(new Request('http://x/api/notes?page=0'), mockDb([row]).db))).status).toBe(400);
    expect((await notesRoute(context(new Request('http://x/api/notes?page=10001'), mockDb([row]).db))).status).toBe(400);
    expect((await notesRoute(context(new Request('http://x/api/notes?status=bad'), mockDb([row]).db))).status).toBe(400);
    const failed = await notesRoute(context(new Request('http://x/api/notes'), mockDb([], true).db));
    expect([await failed.json()]).toEqual([{ success: false, error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'Unable to process note request' } }]);
  });

  it('creates a note without an implicit version and rejects malformed bodies', async () => {
    const mock = mockDb();
    const response = await notesRoute(context(new Request('http://x/api/notes', { method: 'POST', body: JSON.stringify(body) }), mock.db));
    expect(response.status).toBe(201); expect(mock.batches).toHaveLength(1); expect(mock.batches[0]).toHaveLength(1); expect(mock.batches[0][0].sql).toContain('INSERT INTO notes'); expect(mock.batches[0][0].sql).not.toContain('note_versions');
    expect((await notesRoute(context(new Request('http://x/api/notes', { method: 'POST', body: '{' }), mock.db))).status).toBe(400);
    expect((await notesRoute(context(new Request('http://x/api/notes', { method: 'POST', body: '{}' }), mock.db))).status).toBe(400);
    expect((await notesRoute(context(new Request('http://x/api/notes', { method: 'POST', body: JSON.stringify({ ...body, status: 'bad' }) }), mock.db))).status).toBe(400);
    const failedMock = mockDb([], true); const failed = await notesRoute(context(new Request('http://x/api/notes', { method: 'POST', body: JSON.stringify(body) }), failedMock.db));
    expect((await failed.json()).error.code).toBe('NOTE_REPOSITORY_FAILURE');
    expect(failedMock.batches).toHaveLength(0);
  });

  it('patches partially without an implicit version, rejects empty bodies, handles missing, and archives without delete', async () => {
    const row = { id: 'a', title: 'A', slug: 'a', summary: 'old', content_json: '{}', content_text: '', category: '', status: 'draft', is_pinned: 0, review_count: 0, created_at: 't', updated_at: 't', last_reviewed_at: null };
    const mock = mockDb([row]);
    const patched = await notesRoute(context(new Request('http://x/api/notes/a', { method: 'PATCH', body: JSON.stringify({ title: 'B' }) }), mock.db, ['a']));
    expect(patched.status).toBe(200); expect((await patched.json()).data.summary).toBe('old');
    expect(mock.batches[0]).toHaveLength(1);
    expect((await notesRoute(context(new Request('http://x/api/notes/a', { method: 'PATCH', body: '{' }), mock.db, ['a']))).status).toBe(400);
    expect((await notesRoute(context(new Request('http://x/api/notes/missing', { method: 'PATCH', body: JSON.stringify({ title: 'B' }) }), mock.db, ['missing']))).status).toBe(404);
    const patchFailure = await notesRoute(context(new Request('http://x/api/notes/a', { method: 'PATCH', body: JSON.stringify({ title: 'B' }) }), mockDb([row], true).db, ['a']));
    expect((await patchFailure.json()).error.code).toBe('NOTE_REPOSITORY_FAILURE');
    const updated = await notesRoute(context(new Request('http://x/api/notes/a', { method: 'PATCH', body: JSON.stringify({ isPinned: 'wrong' }) }), mock.db, ['a']));
    expect(updated.status).toBe(400); expect(mock.batches).toHaveLength(1);
    const tagged = await notesRoute(context(new Request('http://x/api/notes/a', { method: 'PATCH', body: JSON.stringify({ tags: ['method'] }) }), mock.db, ['a']));
    expect((await tagged.json()).data.tags).toBeUndefined();
    expect((await notesRoute(context(new Request('http://x/api/notes/a', { method: 'PATCH', body: '{}' }), mock.db, ['a']))).status).toBe(400);
    expect((await notesRoute(context(new Request('http://x/api/notes/missing', { method: 'DELETE' }), mock.db, ['missing']))).status).toBe(404);
    const archived = await notesRoute(context(new Request('http://x/api/notes/a', { method: 'DELETE' }), mock.db, ['a']));
    expect(archived.status).toBe(200); expect((await archived.json()).data.status).toBe('archived');
    const failed = await notesRoute(context(new Request('http://x/api/notes/a', { method: 'DELETE' }), mockDb([row], true).db, ['a']));
    expect((await failed.json()).error.code).toBe('NOTE_REPOSITORY_FAILURE');
  });

  it('restores, records reviews, and creates or lists versions through frozen lifecycle routes', async () => {
    const row = { id: 'a', title: 'A', slug: 'a', summary: '', content_json: '{}', content_text: '', category: '', status: 'archived', is_pinned: 0, review_count: 2, created_at: 't', updated_at: 't', last_reviewed_at: null };
    const mock = mockDb([row]);
    const restored = await notesRoute(context(new Request('http://x/api/notes/a/restore', { method: 'POST' }), mock.db, ['a', 'restore']));
    expect((await restored.json()).data.status).toBe('draft');
    const reviewed = await notesRoute(context(new Request('http://x/api/notes/a/review', { method: 'POST' }), mock.db, ['a', 'review']));
    expect((await reviewed.json()).data.reviewCount).toBe(3);
    const version = await notesRoute(context(new Request('http://x/api/notes/a/versions', { method: 'POST' }), mock.db, ['a', 'versions']));
    expect(version.status).toBe(201);
    expect(mock.runs.some((statement) => statement.sql.includes('INSERT INTO note_versions'))).toBe(true);
    const versions = await notesRoute(context(new Request('http://x/api/notes/a/versions'), mock.db, ['a', 'versions']));
    expect(versions.status).toBe(200);
  });

  it('leaves Access enforcement to global middleware', async () => {
    const denied = await accessMiddleware({ request: new Request('https://x/api/notes'), env: {}, next: async () => new Response('ok') });
    expect(denied.status).toBe(403);
    const allowed = await accessMiddleware({ request: new Request('http://localhost/api/notes'), env: { LOCAL_AUTH_BYPASS: 'true' }, next: async () => new Response('ok') });
    expect(allowed.status).toBe(200);
    const productionBypass = await accessMiddleware({ request: new Request('https://x/api/notes'), env: { LOCAL_AUTH_BYPASS: 'true' }, next: async () => new Response('ok') });
    expect(productionBypass.status).toBe(403);
  });
});
