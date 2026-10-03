import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest as notesRoute } from '../../../functions/api/notes/[[path]]';
import { onRequest as accessMiddleware } from '../../../functions/_middleware';

type Row = Record<string, unknown>;
function mockDb(rows: Row[] = [], fail = false, failVersionInsert = false) {
  const batches: Array<Array<{ sql: string; values: unknown[] }>> = [];
  const runs: Array<{ sql: string; values: unknown[] }> = [];
  const prepare = (sql: string) => ({
    bind: (...values: unknown[]) => ({
      async all() {
        if (fail) throw new Error('db');
        if (sql.includes('note_versions')) {
          const noteId = values[0];
          return {
            results: rows.filter(
              (row) => row.note_id === noteId || row.id?.toString().startsWith('v'),
            ),
          };
        }
        return { results: rows };
      },
      async first() {
        if (fail) throw new Error('db');
        if (sql.includes('COUNT(*)')) {
          return { count: rows.length };
        }
        if (sql.includes('note_versions')) {
          const versionId = values[1] ?? values[0];
          return rows.find((row) => row.id === versionId) ?? null;
        }
        const id = values[0];
        return rows.find((row) => row.id === id) ?? null;
      },
      async run() {
        if (fail) throw new Error('db');
        if (failVersionInsert && sql.includes('INSERT INTO note_versions')) {
          throw new Error('note_versions insert failed');
        }
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
function context(request: Request, db: D1Database, path?: string[]) {
  return { request, env: { DB: db, KB_ASSETS: {} } as never, params: { path } };
}
const body = {
  title: 'New',
  summary: '',
  contentJson:
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello"}]}]}',
  category: 'x',
  status: 'draft',
  isPinned: false,
};
beforeEach(() => vi.stubGlobal('crypto', { randomUUID: () => 'version-id' }));

describe('notes Pages route', () => {
  it('lists notes and maps repository failures', async () => {
    const row = {
      id: 'a',
      title: 'A',
      slug: 'a',
      summary: '',
      content_json: '{}',
      content_text: '',
      category: '',
      status: 'draft',
      is_pinned: 0,
      review_count: 0,
      created_at: 't',
      updated_at: 't',
      last_reviewed_at: null,
    };
    expect(
      (await notesRoute(context(new Request('http://x/api/notes'), mockDb([row]).db))).status,
    ).toBe(200);
    expect(
      (await notesRoute(context(new Request('http://x/api/notes?page=0'), mockDb([row]).db)))
        .status,
    ).toBe(400);
    expect(
      (await notesRoute(context(new Request('http://x/api/notes?page=10001'), mockDb([row]).db)))
        .status,
    ).toBe(400);
    expect(
      (await notesRoute(context(new Request('http://x/api/notes?status=bad'), mockDb([row]).db)))
        .status,
    ).toBe(400);
    const failed = await notesRoute(
      context(new Request('http://x/api/notes'), mockDb([], true).db),
    );
    expect([await failed.json()]).toEqual([
      {
        success: false,
        error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'Unable to process note request' },
      },
    ]);
  });

  it('creates a note without an implicit version and rejects malformed bodies', async () => {
    const mock = mockDb();
    const response = await notesRoute(
      context(
        new Request('http://x/api/notes', { method: 'POST', body: JSON.stringify(body) }),
        mock.db,
      ),
    );
    expect(response.status).toBe(201);
    expect(mock.batches).toHaveLength(1);
    expect(mock.batches[0]).toHaveLength(1);
    expect(mock.batches[0][0].sql).toContain('INSERT INTO notes');
    expect(mock.batches[0][0].sql).not.toContain('note_versions');
    expect(
      (
        await notesRoute(
          context(new Request('http://x/api/notes', { method: 'POST', body: '{' }), mock.db),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await notesRoute(
          context(new Request('http://x/api/notes', { method: 'POST', body: '{}' }), mock.db),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await notesRoute(
          context(
            new Request('http://x/api/notes', {
              method: 'POST',
              body: JSON.stringify({ ...body, status: 'bad' }),
            }),
            mock.db,
          ),
        )
      ).status,
    ).toBe(400);
    const failedMock = mockDb([], true);
    const failed = await notesRoute(
      context(
        new Request('http://x/api/notes', { method: 'POST', body: JSON.stringify(body) }),
        failedMock.db,
      ),
    );
    expect((await failed.json()).error.code).toBe('NOTE_REPOSITORY_FAILURE');
    expect(failedMock.batches).toHaveLength(0);
  });

  it('patches partially without an implicit version, rejects empty bodies, handles missing, and archives without delete', async () => {
    const row = {
      id: 'a',
      title: 'A',
      slug: 'a',
      summary: 'old',
      content_json: '{}',
      content_text: '',
      category: '',
      status: 'draft',
      is_pinned: 0,
      review_count: 0,
      created_at: 't',
      updated_at: 't',
      last_reviewed_at: null,
    };
    const mock = mockDb([row]);
    const patched = await notesRoute(
      context(
        new Request('http://x/api/notes/a', {
          method: 'PATCH',
          body: JSON.stringify({ title: 'B' }),
        }),
        mock.db,
        ['a'],
      ),
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).data.summary).toBe('old');
    expect(mock.batches[0]).toHaveLength(1);
    expect(
      (
        await notesRoute(
          context(new Request('http://x/api/notes/a', { method: 'PATCH', body: '{' }), mock.db, [
            'a',
          ]),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await notesRoute(
          context(
            new Request('http://x/api/notes/missing', {
              method: 'PATCH',
              body: JSON.stringify({ title: 'B' }),
            }),
            mock.db,
            ['missing'],
          ),
        )
      ).status,
    ).toBe(404);
    const patchFailure = await notesRoute(
      context(
        new Request('http://x/api/notes/a', {
          method: 'PATCH',
          body: JSON.stringify({ title: 'B' }),
        }),
        mockDb([row], true).db,
        ['a'],
      ),
    );
    expect((await patchFailure.json()).error.code).toBe('NOTE_REPOSITORY_FAILURE');
    const updated = await notesRoute(
      context(
        new Request('http://x/api/notes/a', {
          method: 'PATCH',
          body: JSON.stringify({ isPinned: 'wrong' }),
        }),
        mock.db,
        ['a'],
      ),
    );
    expect(updated.status).toBe(400);
    expect(mock.batches).toHaveLength(1);
    const tagged = await notesRoute(
      context(
        new Request('http://x/api/notes/a', {
          method: 'PATCH',
          body: JSON.stringify({ tags: ['method'] }),
        }),
        mock.db,
        ['a'],
      ),
    );
    expect((await tagged.json()).data.tags).toBeUndefined();
    expect(
      (
        await notesRoute(
          context(new Request('http://x/api/notes/a', { method: 'PATCH', body: '{}' }), mock.db, [
            'a',
          ]),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await notesRoute(
          context(new Request('http://x/api/notes/missing', { method: 'DELETE' }), mock.db, [
            'missing',
          ]),
        )
      ).status,
    ).toBe(404);
    const archived = await notesRoute(
      context(new Request('http://x/api/notes/a', { method: 'DELETE' }), mock.db, ['a']),
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()).data.status).toBe('archived');
    const failed = await notesRoute(
      context(new Request('http://x/api/notes/a', { method: 'DELETE' }), mockDb([row], true).db, [
        'a',
      ]),
    );
    expect((await failed.json()).error.code).toBe('NOTE_REPOSITORY_FAILURE');
  });

  it('restores, records reviews, and creates or lists versions through frozen lifecycle routes', async () => {
    const row = {
      id: 'a',
      title: 'A',
      slug: 'a',
      summary: '',
      content_json: '{}',
      content_text: '',
      category: '',
      status: 'archived',
      is_pinned: 0,
      review_count: 2,
      created_at: 't',
      updated_at: 't',
      last_reviewed_at: null,
    };
    const mock = mockDb([row]);
    const restored = await notesRoute(
      context(new Request('http://x/api/notes/a/restore', { method: 'POST' }), mock.db, [
        'a',
        'restore',
      ]),
    );
    expect((await restored.json()).data.status).toBe('draft');
    const reviewed = await notesRoute(
      context(new Request('http://x/api/notes/a/review', { method: 'POST' }), mock.db, [
        'a',
        'review',
      ]),
    );
    expect((await reviewed.json()).data.reviewCount).toBe(3);
    const version = await notesRoute(
      context(new Request('http://x/api/notes/a/versions', { method: 'POST' }), mock.db, [
        'a',
        'versions',
      ]),
    );
    expect(version.status).toBe(201);
    expect(mock.runs.some((statement) => statement.sql.includes('INSERT INTO note_versions'))).toBe(
      true,
    );
    const versions = await notesRoute(
      context(new Request('http://x/api/notes/a/versions'), mock.db, ['a', 'versions']),
    );
    expect(versions.status).toBe(200);
  });

  it('handles publish, unpublish, and archive POST endpoints with proper status flows', async () => {
    const row = {
      id: 'note-pub',
      title: 'Title',
      slug: 'slug-pub',
      summary: 'Summary',
      content_json: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"published body"}]}]}',
      content_text: 'published body',
      published_title: null,
      published_summary: null,
      published_content_json: null,
      published_content_text: null,
      category: 'tech',
      status: 'draft',
      is_pinned: 0,
      is_featured: 0,
      published_at: null,
      review_count: 0,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
      last_reviewed_at: null,
    };
    const mock = mockDb([row]);

    // 1. Publish note
    const publishRes = await notesRoute(
      context(
        new Request('http://x/api/notes/note-pub/publish', { method: 'POST', body: '{}' }),
        mock.db,
        ['note-pub', 'publish'],
      ),
    );
    expect(publishRes.status).toBe(200);
    const publishData = (await publishRes.json()).data;
    expect(publishData.status).toBe('published');
    expect(publishData.publishedTitle).toBe('Title');
    expect(publishData.publishedContentJson).toBe(row.content_json);
    expect(
      mock.batches.flat().some(
        (r) => r.sql.includes('INSERT INTO notes') && r.sql.includes('ON CONFLICT(id) DO UPDATE SET'),
      ),
    ).toBe(true);
    expect(mock.batches.flat().some((r) => r.sql.includes('note_publication_metadata'))).toBe(true);

    // Stale revision check on publish
    const staleRes = await notesRoute(
      context(
        new Request('http://x/api/notes/note-pub/publish', {
          method: 'POST',
          body: JSON.stringify({ expectedUpdatedAt: '2020-01-01T00:00:00.000Z' }),
        }),
        mock.db,
        ['note-pub', 'publish'],
      ),
    );
    expect(staleRes.status).toBe(409);
    expect((await staleRes.json()).error.code).toBe('STALE_REVISION_REJECTED');

    // 2. Unpublish note
    const unpublishRes = await notesRoute(
      context(
        new Request('http://x/api/notes/note-pub/unpublish', { method: 'POST' }),
        mock.db,
        ['note-pub', 'unpublish'],
      ),
    );
    expect(unpublishRes.status).toBe(200);
    expect((await unpublishRes.json()).data.status).toBe('draft');

    // 3. Archive via POST
    const archiveRes = await notesRoute(
      context(
        new Request('http://x/api/notes/note-pub/archive', { method: 'POST' }),
        mock.db,
        ['note-pub', 'archive'],
      ),
    );
    expect(archiveRes.status).toBe(200);
    expect((await archiveRes.json()).data.status).toBe('archived');
  });

  it('VER-01 & VER-02: executes fail-safe restore-version with pre-restore backup, and halts on backup failure', async () => {
    const row = {
      id: 'note-ver',
      title: 'Title',
      slug: 'slug-ver',
      summary: '',
      content_json: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"current draft"}]}]}',
      content_text: 'current draft',
      published_title: null,
      published_summary: null,
      published_content_json: null,
      published_content_text: null,
      category: 'tech',
      status: 'draft',
      is_pinned: 0,
      is_featured: 0,
      published_at: null,
      review_count: 0,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
      last_reviewed_at: null,
    };
    const versionRow = {
      id: 'ver-old',
      note_id: 'note-ver',
      content_json: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"ancient version"}]}]}',
      content_text: 'ancient version',
      created_at: '2026-09-01T00:00:00.000Z',
    };

    // VER-01: When backup creation fails, return 500 PRE_RESTORE_BACKUP_FAILED
    const mockFailing = mockDb([row, versionRow], false, true);
    const failRes = await notesRoute(
      context(
        new Request('http://x/api/notes/note-ver/restore-version', {
          method: 'POST',
          body: JSON.stringify({ versionId: 'ver-old' }),
        }),
        mockFailing.db,
        ['note-ver', 'restore-version'],
      ),
    );
    expect(failRes.status).toBe(500);
    expect((await failRes.json()).error.code).toBe('PRE_RESTORE_BACKUP_FAILED');

    // VER-02: Happy path restore-version
    const mockSuccess = mockDb([row, versionRow]);
    const successRes = await notesRoute(
      context(
        new Request('http://x/api/notes/note-ver/restore-version', {
          method: 'POST',
          body: JSON.stringify({
            versionId: 'ver-old',
            currentDraft: {
              contentJson: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"editor draft"}]}]}',
            },
          }),
        }),
        mockSuccess.db,
        ['note-ver', 'restore-version'],
      ),
    );
    expect(successRes.status).toBe(200);
    const data = (await successRes.json()).data;
    expect(data.contentJson).toBe(versionRow.content_json);
    expect(data.contentText).toBe('ancient version');
    // Pre-restore backup was inserted
    expect(
      mockSuccess.runs.some((r) => r.sql.includes('INSERT INTO note_versions')),
    ).toBe(true);
  });

  it('supports reading projection for published status and sort query options', async () => {
    const publishedRow = {
      id: 'pub-1',
      title: 'Draft Title',
      slug: 'pub-1',
      summary: 'Draft Summary',
      content_json: '{"type":"doc","content":[]}',
      content_text: 'draft text',
      published_title: 'Published Title',
      published_summary: 'Published Summary',
      published_content_json: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"pub"}]}]}',
      published_content_text: 'pub',
      category: 'tech',
      status: 'published',
      is_pinned: 1,
      is_featured: 1,
      published_at: '2026-10-01T00:00:00.000Z',
      review_count: 0,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
      last_reviewed_at: null,
    };
    const mock = mockDb([publishedRow]);

    // Query published notes
    const res = await notesRoute(
      context(new Request('http://x/api/notes?status=published'), mock.db),
    );
    expect(res.status).toBe(200);

    // Query with sorting
    const sortRes = await notesRoute(
      context(new Request('http://x/api/notes?sort=title_asc'), mock.db),
    );
    expect(sortRes.status).toBe(200);

    const badSortRes = await notesRoute(
      context(new Request('http://x/api/notes?sort=bad_sort'), mock.db),
    );
    expect(badSortRes.status).toBe(400);
  });

  it('leaves Access enforcement to global middleware', async () => {
    const denied = await accessMiddleware({
      request: new Request('https://x/api/notes'),
      env: {},
      next: async () => new Response('ok'),
    });
    expect(denied.status).toBe(401);
    const allowed = await accessMiddleware({
      request: new Request('http://localhost/api/notes'),
      env: { LOCAL_AUTH_BYPASS: 'true' },
      next: async () => new Response('ok'),
    });
    expect(allowed.status).toBe(200);
    const productionBypass = await accessMiddleware({
      request: new Request('https://x/api/notes'),
      env: { LOCAL_AUTH_BYPASS: 'true' },
      next: async () => new Response('ok'),
    });
    expect(productionBypass.status).toBe(401);
  });
});
