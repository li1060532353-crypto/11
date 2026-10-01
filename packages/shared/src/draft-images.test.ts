import { describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { parseTiptapDocument, projectTiptapDocumentText } from '../../../functions/lib/notes';
import {
  createAssetService,
  createD1AssetStore,
  type AssetStore,
  type AssetBucket,
} from '../../../functions/lib/assets';

const image = { type: 'image', attrs: { assetId: 'asset-1', alt: 'Diagram' } };
const doc = (node: unknown) => JSON.stringify({ type: 'doc', content: [node] });

describe('persisted editor image contract', () => {
  it('accepts a private asset image and projects its alt text', () => {
    expect(projectTiptapDocumentText(parseTiptapDocument(doc(image)))).toBe('Diagram');
  });
  it.each([
    {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [{ type: 'paragraph' }, image] }],
    },
    {
      type: 'table',
      content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [image] }] }],
    },
  ])('persists images inserted into list items or table cells', (node) => {
    expect(projectTiptapDocumentText(parseTiptapDocument(doc(node)))).toBe('Diagram');
  });
  it.each([
    { ...image, content: [] },
    { ...image, marks: [] },
    { ...image, attrs: { ...image.attrs, src: 'https://example.com/x' } },
    { ...image, attrs: { assetId: '../asset-1', alt: '' } },
  ])('rejects image properties outside the private asset contract', (node) => {
    expect(() => parseTiptapDocument(doc(node))).toThrow();
  });
  it('accepts the null defaults serialized by the real Tiptap link extension', () => {
    const node = {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'link',
          marks: [
            {
              type: 'link',
              attrs: {
                href: '/api/assets/asset-1',
                target: '_blank',
                rel: 'noopener noreferrer nofollow',
                class: null,
                title: null,
              },
            },
          ],
        },
      ],
    };
    expect(() => parseTiptapDocument(doc(node))).not.toThrow();
    node.content[0].marks[0].attrs.href = 'java\nscript:alert(1)';
    expect(() => parseTiptapDocument(doc(node))).toThrow();
  });
});

describe('private image delivery and deletion', () => {
  it('detects exact references in draft, published snapshots and versions using SQLite', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(
      'CREATE TABLE notes(content_json TEXT,published_content_json TEXT); CREATE TABLE note_versions(content_json TEXT)',
    );
    const store = createD1AssetStore({
      prepare: (sql: string) => ({
        bind: (...args: string[]) => ({ first: async () => db.prepare(sql).get(...args) ?? null }),
      }),
    } as unknown as D1Database);
    try {
      for (const source of ['draft', 'published', 'version']) {
        for (const content of [
          doc(image),
          JSON.stringify({ marks: [{ attrs: { href: '/api/assets/asset-1?inline=1' } }] }),
        ]) {
          db.exec('DELETE FROM notes; DELETE FROM note_versions');
          if (source === 'version') db.prepare('INSERT INTO note_versions VALUES (?)').run(content);
          else
            db.prepare('INSERT INTO notes VALUES (?,?)').run(
              source === 'draft' ? content : '{}',
              source === 'published' ? content : null,
            );
          expect(await store.isReferenced('asset-1')).toBe(true);
          expect(await store.isReferenced('asset')).toBe(false);
        }
      }
    } finally {
      db.close();
    }
  });
  const asset = {
    id: 'asset-1',
    noteId: 'note-1',
    r2Key: 'private/key',
    originalName: 'image.png',
    mimeType: 'image/png',
    sizeBytes: 10,
    createdAt: '',
  };
  function setup(referenced = false, mimeType = 'image/png') {
    const store = {
      find: vi.fn(async () => ({ ...asset, mimeType })),
      isReferenced: vi.fn(async () => referenced),
      remove: vi.fn(async () => asset),
    } as unknown as AssetStore;
    const bucket = {
      get: vi.fn(async () => ({ body: new Blob(['image']).stream() })),
      delete: vi.fn(async () => {}),
    } as unknown as AssetBucket;
    return { store, bucket, service: createAssetService(store, bucket) };
  }
  it('serves raster images inline only on explicit request', async () => {
    const { service } = setup();
    expect((await service.download('asset-1', true)).headers['Content-Disposition']).toMatch(
      /^inline;/,
    );
    expect((await service.download('asset-1')).headers['Content-Disposition']).toMatch(
      /^attachment;/,
    );
    expect(
      (await setup(false, 'application/pdf').service.download('asset-1', true)).headers[
        'Content-Disposition'
      ],
    ).toMatch(/^attachment;/);
  });
  it('refuses referenced asset deletion before metadata or object deletion', async () => {
    const { service, store, bucket } = setup(true);
    await expect(service.remove('asset-1')).rejects.toMatchObject({
      code: 'ASSET_IN_USE',
      status: 409,
    });
    expect(store.remove).not.toHaveBeenCalled();
    expect(bucket.delete).not.toHaveBeenCalled();
  });
  it('checks all persisted document sources with bound asset references', async () => {
    const first = vi.fn(async () => ({ found: 1 }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn<(sql: string) => { bind: typeof bind }>(() => ({ bind }));
    const store = createD1AssetStore({ prepare } as unknown as D1Database);
    expect(await store.isReferenced!('asset-1')).toBe(true);
    const sql = prepare.mock.calls[0][0];
    expect(sql).toContain('published_content_json');
    expect(sql).toContain('note_versions');
    expect(sql).toContain('json_tree');
    expect(bind).toHaveBeenCalledWith('asset-1', '/api/assets/asset-1', '/api/assets/asset-1[?#]*');
  });
});
