import { describe, expect, it, vi } from 'vitest';

import {
  createNoteService,
  NoteDomainError,
  parseNoteListQuery,
  parseTiptapDocument,
  projectTiptapDocumentText,
  type NoteStore,
} from '../../../functions/lib/notes';

const base = {
  title: 'First note',
  summary: '',
  contentJson: '{"type":"doc","content":[]}',
  category: 'test',
  status: 'draft' as const,
  isPinned: false,
};

function store() {
  const notes = new Map<
    string,
    ReturnType<ReturnType<typeof createNoteService>['create']> extends Promise<infer T> ? T : never
  >();
  const versions: string[] = [];
  const versionRecords: Array<{
    id: string;
    noteId: string;
    contentJson: string;
    contentText: string;
    createdAt: string;
  }> = [];
  let shouldFailCreateVersion = false;
  let shouldFailSave = false;

  const noteStore: NoteStore = {
    async list(query?: { slug?: string; status?: string; sort?: string }) {
      let all = [...notes.values()];
      if (query?.status) {
        if (query.status === 'published') {
          all = all.filter((n) => n.status === 'published' && n.publishedContentJson != null);
          all = all.map((n) => ({
            ...n,
            title: n.publishedTitle ?? n.title,
            summary: n.publishedSummary ?? n.summary,
            contentJson: n.publishedContentJson ?? n.contentJson,
            contentText: n.publishedContentText ?? n.contentText,
          }));
        } else {
          all = all.filter((n) => n.status === query.status);
        }
      }
      if (query?.slug) {
        all = all.filter((n) => n.slug === query.slug);
      }
      if (query?.sort === 'title_asc') {
        all.sort((a, b) => a.title.localeCompare(b.title));
      } else if (query?.sort === 'published_desc') {
        all.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
      } else if (query?.sort === 'updated_desc') {
        all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }
      return {
        items: all,
        page: 1,
        pageSize: 20,
        totalItems: all.length,
        totalPages: 1,
      };
    },
    async find(id) {
      return notes.get(id) ?? null;
    },
    async save(note) {
      if (shouldFailSave) throw new Error('D1 save failed');
      notes.set(note.id, note);
      return note;
    },
    async saveWithTags(note) {
      if (shouldFailSave) throw new Error('D1 save failed');
      notes.set(note.id, note);
      return note;
    },
    async createVersion(note, versionId) {
      if (shouldFailCreateVersion) throw new Error('D1 createVersion failed');
      versions.push(note.id);
      const record = {
        id: versionId,
        noteId: note.id,
        contentJson: note.contentJson,
        contentText: note.contentText,
        createdAt: note.updatedAt,
      };
      versionRecords.push(record);
      return record;
    },
    async listVersions(noteId: string) {
      return versionRecords.filter((v) => v.noteId === noteId);
    },
    async findVersion(noteId: string, versionId: string) {
      return versionRecords.find((v) => v.noteId === noteId && v.id === versionId) ?? null;
    },
  };
  return {
    noteStore,
    versions,
    versionRecords,
    setFailCreateVersion(fail: boolean) {
      shouldFailCreateVersion = fail;
    },
    setFailSave(fail: boolean) {
      shouldFailSave = fail;
    },
  };
}

describe('note service', () => {
  it('checks raster asset ownership on create, edit, publish and restore', async () => {
    const { noteStore } = store();
    const imageJson = JSON.stringify({
      type: 'doc',
      content: [{ type: 'image', attrs: { assetId: 'asset-1', alt: 'Diagram' } }],
    });
    const findImageAsset = vi.fn(async () => ({ noteId: 'other-note', mimeType: 'image/png' }));
    const service = createNoteService({ ...noteStore, findImageAsset }, () => 'id-1');
    await expect(service.create({ ...base, contentJson: imageJson })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    const note = await service.create(base);
    await expect(service.update(note.id, { contentJson: imageJson })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    findImageAsset.mockResolvedValue({ noteId: note.id, mimeType: 'application/pdf' });
    await expect(service.update(note.id, { contentJson: imageJson })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    findImageAsset.mockResolvedValue({ noteId: note.id, mimeType: 'image/png' });
    expect((await service.update(note.id, { contentJson: imageJson }))?.contentText).toBe(
      'Diagram',
    );
    const version = await service.saveVersion(note.id);
    findImageAsset.mockResolvedValue({ noteId: 'other-note', mimeType: 'image/png' });
    await expect(service.publish(note.id)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.restoreVersion(note.id, { versionId: version!.id })).rejects.toMatchObject(
      { code: 'VALIDATION_ERROR' },
    );
  });

  it('creates, reads, partially updates, and archives a note', async () => {
    const service = createNoteService(
      store().noteStore,
      () => 'id-1',
      () => '2026-07-18T00:00:00.000Z',
    );
    const created = await service.create(base);
    expect((await service.get(created.id))?.title).toBe('First note');
    expect((await service.update(created.id, { title: 'Renamed' }))?.title).toBe('Renamed');
    expect((await service.archive(created.id))?.status).toBe('archived');
  });

  it('updates slug and rejects conflicting slug', async () => {
    const { noteStore } = store();
    let currentId = 1;
    const service = createNoteService(
      noteStore,
      () => `id-${currentId++}`,
      () => '2026-07-18T00:00:00.000Z',
    );
    const note1 = await service.create({ ...base, title: 'Note 1', slug: 'note-1' });
    const note2 = await service.create({ ...base, title: 'Note 2', slug: 'note-2' });

    // Successfully update slug
    const updated = await service.update(note1.id, { slug: 'new-custom-slug' });
    expect(updated?.slug).toBe('new-custom-slug');

    // Reject conflicting slug
    await expect(service.update(note2.id, { slug: 'new-custom-slug' })).rejects.toMatchObject({
      code: 'SLUG_CONFLICT',
    });
  });

  it('invokes the default UUID generator with the Workers crypto receiver', async () => {
    const workersCrypto = {
      randomUUID(this: unknown) {
        if (this !== workersCrypto) throw new TypeError('Illegal invocation');
        return 'workers-id';
      },
    };
    vi.stubGlobal('crypto', workersCrypto);
    try {
      const created = await createNoteService(store().noteStore).create(base);
      expect(created.id).toBe('workers-id');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects empty updates and returns null for absent notes', async () => {
    const service = createNoteService(
      store().noteStore,
      () => 'id-1',
      () => '2026-07-18T00:00:00.000Z',
    );
    await expect(service.update('missing', {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await service.get('missing')).toBeNull();
  });

  it('derives text and leaves versions to the explicit snapshot operation', async () => {
    const { noteStore, versions } = store();
    const service = createNoteService(
      noteStore,
      () => 'id-1',
      () => '2026-07-18T00:00:00.000Z',
    );
    const document = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Heading' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'First' },
            { type: 'hardBreak' },
            { type: 'text', text: 'line' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }],
            },
          ],
        },
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quote' }] }],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [{ type: 'text', text: 'const x = 1;' }],
        },
        { type: 'paragraph' },
      ],
    });
    const created = await service.create({ ...base, contentJson: document });
    expect(created.contentText).toBe('Heading\n\nFirst\nline\n\nItem\n\nQuote\n\nconst x = 1;');
    await service.update(created.id, {
      contentJson: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated' }] }],
      }),
    });
    expect(versions).toEqual([]);
    await service.saveVersion(created.id);
    expect(versions).toEqual([created.id]);
  });

  it('PUB-01 & PUB-02: isolates working draft edits from published snapshot until update-publish', async () => {
    const { noteStore } = store();
    let clock = 1000;
    const now = () => new Date(clock).toISOString();
    const service = createNoteService(noteStore, () => 'note-pub-1', now);

    const initialDoc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original content' }] }],
    });

    // 1. Create a draft
    const created = await service.create({
      ...base,
      title: 'Original Title',
      summary: 'Original Summary',
      contentJson: initialDoc,
      status: 'draft',
      slug: 'pub-isolation-test',
    });
    expect(created.status).toBe('draft');
    expect(created.publishedTitle).toBeNull();
    expect(created.publishedContentJson).toBeNull();

    // 2. Publish the note (首次发布)
    clock = 2000;
    const published = await service.publish(created.id);
    expect(published?.status).toBe('published');
    expect(published?.publishedTitle).toBe('Original Title');
    expect(published?.publishedSummary).toBe('Original Summary');
    expect(published?.publishedContentJson).toBe(initialDoc);
    expect(published?.publishedContentText).toBe('Original content');
    expect(published?.publishedAt).toBe(new Date(2000).toISOString());

    // 3. Reader query sees published note with snapshot
    const readerViewBefore = await service.list({
      status: 'published',
      slug: 'pub-isolation-test',
    });
    expect(readerViewBefore.items).toHaveLength(1);
    expect(readerViewBefore.items[0].title).toBe('Original Title');
    expect(readerViewBefore.items[0].contentJson).toBe(initialDoc);

    // 4. Author modifies working draft (模拟自动保存，仅更新草稿)
    clock = 3000;
    const updatedDoc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft in progress' }] }],
    });
    const autosaved = await service.update(created.id, {
      title: 'Draft Title',
      summary: 'Draft Summary',
      contentJson: updatedDoc,
    });
    expect(autosaved?.title).toBe('Draft Title');
    expect(autosaved?.contentJson).toBe(updatedDoc);
    expect(autosaved?.publishedTitle).toBe('Original Title');
    expect(autosaved?.publishedContentJson).toBe(initialDoc);

    // 5. PUB-01 Assertion: Reader STILL sees old published snapshot, NOT draft!
    const readerViewDuring = await service.list({
      status: 'published',
      slug: 'pub-isolation-test',
    });
    expect(readerViewDuring.items[0].title).toBe('Original Title');
    expect(readerViewDuring.items[0].contentJson).toBe(initialDoc);
    expect(readerViewDuring.items[0].contentText).toBe('Original content');

    // 6. PUB-02: Author explicitly triggers Update Published
    clock = 4000;
    const updatedPublish = await service.publish(created.id);
    expect(updatedPublish?.publishedTitle).toBe('Draft Title');
    expect(updatedPublish?.publishedSummary).toBe('Draft Summary');
    expect(updatedPublish?.publishedContentJson).toBe(updatedDoc);
    expect(updatedPublish?.publishedContentText).toBe('Draft in progress');
    expect(updatedPublish?.publishedAt).toBe(new Date(4000).toISOString());

    // 7. Reader now sees updated content
    const readerViewAfter = await service.list({ status: 'published', slug: 'pub-isolation-test' });
    expect(readerViewAfter.items[0].title).toBe('Draft Title');
    expect(readerViewAfter.items[0].contentJson).toBe(updatedDoc);
  });

  it('validates publish requirements: title, slug, contentJson, conflict, and revision check', async () => {
    const { noteStore } = store();
    let valCounter = 1;
    const service = createNoteService(
      noteStore,
      () => `id-val-${valCounter++}`,
      () => '2026-10-01T12:00:00.000Z',
    );

    const draft = await service.create({
      ...base,
      title: 'Valid Title',
      slug: 'valid-slug',
      contentJson:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello"}]}]}',
    });

    // Stale revision rejection (409)
    await expect(
      service.publish(draft.id, { expectedUpdatedAt: '2020-01-01T00:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'STALE_REVISION_REJECTED' });

    // Empty title rejection
    await service.update(draft.id, { title: '   ' }).catch(() => {});
    // Direct store manipulation to simulate missing title
    const rawNote = (await noteStore.find(draft.id))!;
    await noteStore.save({ ...rawNote, title: '   ' });
    await expect(service.publish(draft.id)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    // Slug conflict rejection
    await noteStore.save({ ...rawNote, title: 'Note A', slug: 'conflict-slug' });
    const draft2 = await service.create({
      ...base,
      title: 'Note B',
      slug: 'other-slug',
      contentJson: rawNote.contentJson,
    });
    await noteStore.save({ ...(await noteStore.find(draft2.id))!, slug: 'conflict-slug' });
    await expect(service.publish(draft2.id)).rejects.toMatchObject({ code: 'SLUG_CONFLICT' });
  });

  it('PUB-03 & PUB-04: unpublish, archive, and safe restore to draft only', async () => {
    const { noteStore } = store();
    const service = createNoteService(
      noteStore,
      () => 'id-lifecycle',
      () => '2026-10-01T12:00:00.000Z',
    );

    const note = await service.create({
      ...base,
      title: 'Lifecycle Post',
      slug: 'lifecycle-post',
      contentJson:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"test"}]}]}',
      status: 'published',
    });
    expect(note.status).toBe('published');

    // Unpublish
    const unpublished = await service.unpublish(note.id);
    expect(unpublished?.status).toBe('draft');
    // Reader query excludes it
    expect(
      (await service.list({ status: 'published', slug: 'lifecycle-post' })).items,
    ).toHaveLength(0);

    // Re-publish and archive
    await service.publish(note.id);
    const archived = await service.archive(note.id);
    expect(archived?.status).toBe('archived');
    expect(
      (await service.list({ status: 'published', slug: 'lifecycle-post' })).items,
    ).toHaveLength(0);

    // PUB-04: Restore MUST force status to draft, never published!
    const restored = await service.restore(note.id);
    expect(restored?.status).toBe('draft');
    expect(
      (await service.list({ status: 'published', slug: 'lifecycle-post' })).items,
    ).toHaveLength(0);
  });

  it('VER-01: fail-safe circuit breaker aborts restore and preserves draft when pre-restore backup fails', async () => {
    const { noteStore, setFailCreateVersion } = store();
    const service = createNoteService(
      noteStore,
      () => 'id-fail-safe',
      () => '2026-10-01T12:00:00.000Z',
    );

    const note = await service.create({
      ...base,
      title: 'Critical Article',
      slug: 'critical-article',
      contentJson:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Current-Critical-Content"}]}]}',
    });

    // Save a historical version V1
    const v1 = await service.saveVersion(note.id);

    // Author edits note to new content
    const currentDoc =
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Unsaved-Critical-Draft"}]}]}';

    // Inject database failure into version creation
    setFailCreateVersion(true);

    // Attempt to restore V1 with current draft passed
    await expect(
      service.restoreVersion(note.id, {
        versionId: v1!.id,
        currentDraft: { contentJson: currentDoc },
      }),
    ).rejects.toMatchObject({ code: 'PRE_RESTORE_BACKUP_FAILED' });

    // Assert: draft was NOT overwritten with V1 content!
    const currentNote = await service.get(note.id);
    expect(currentNote?.contentJson).not.toBe(v1!.contentJson);
  });

  it('VER-02: successful restore creates pre-restore backup, overwrites draft only, and leaves published snapshot intact', async () => {
    const { noteStore, versionRecords } = store();
    let versionCounter = 1;
    const service = createNoteService(
      noteStore,
      () => `ver-${versionCounter++}`,
      () => '2026-10-01T12:00:00.000Z',
    );

    const ancientDoc =
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ancient-Content"}]}]}';
    const publishedDoc =
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Published-Snapshot-Content"}]}]}';

    const note = await service.create({
      ...base,
      title: 'Versioned Article',
      slug: 'versioned-article',
      contentJson: ancientDoc,
    });

    // Save Ancient-Content as version
    const ancientVersion = await service.saveVersion(note.id);

    // Now publish the note with published snapshot
    await service.update(note.id, { contentJson: publishedDoc });
    await service.publish(note.id);

    // Now author modifies draft to intermediate content
    const intermediateDoc =
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Content-Before-Restore"}]}]}';
    await service.update(note.id, { contentJson: intermediateDoc });

    // Author restores Ancient-Content
    const restored = await service.restoreVersion(note.id, {
      versionId: ancientVersion!.id,
      currentDraft: { contentJson: intermediateDoc },
    });

    // 1. Working draft is restored to ancient content
    expect(restored?.contentJson).toBe(ancientDoc);
    expect(restored?.contentText).toBe('Ancient-Content');

    // 2. Published snapshot is UNTOUCHED
    expect(restored?.publishedContentJson).toBe(publishedDoc);
    expect(restored?.publishedContentText).toBe('Published-Snapshot-Content');

    // 3. Pre-restore backup version was automatically created in note_versions
    const backupVersion = versionRecords.find((v) => v.contentJson === intermediateDoc);
    expect(backupVersion).toBeDefined();

    // 4. Author can restore the backup version again to recover intermediate content
    const reRestored = await service.restoreVersion(note.id, { versionId: backupVersion!.id });
    expect(reRestored?.contentJson).toBe(intermediateDoc);
    expect(reRestored?.contentText).toBe('Content-Before-Restore');
  });

  it('supports sort query options and validates sort parameter in parseNoteListQuery', () => {
    expect(
      parseNoteListQuery(new Request('http://localhost/api/notes?sort=updated_desc')).sort,
    ).toBe('updated_desc');
    expect(
      parseNoteListQuery(new Request('http://localhost/api/notes?sort=published_desc')).sort,
    ).toBe('published_desc');
    expect(parseNoteListQuery(new Request('http://localhost/api/notes?sort=title_asc')).sort).toBe(
      'title_asc',
    );
    expect(() =>
      parseNoteListQuery(new Request('http://localhost/api/notes?sort=invalid_sort')),
    ).toThrow(NoteDomainError);
  });
});

describe('authoritative Tiptap document validation', () => {
  const doc = (content: unknown[]) => JSON.stringify({ type: 'doc', content });
  const paragraph = (text = 'ok') => ({ type: 'paragraph', content: [{ type: 'text', text }] });

  it('accepts the approved node subset and all semantic highlight kinds', () => {
    const input = doc([
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Heading', marks: [{ type: 'bold' }] }],
      },
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [
          {
            type: 'listItem',
            content: [
              paragraph('Item'),
              {
                type: 'bulletList',
                content: [{ type: 'listItem', content: [paragraph('Nested')] }],
              },
            ],
          },
        ],
      },
      { type: 'blockquote', content: [paragraph('Quote')] },
      {
        type: 'codeBlock',
        attrs: { language: 'ts' },
        content: [{ type: 'text', text: 'const a = 1;' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'line' },
          { type: 'hardBreak' },
          { type: 'text', text: 'break' },
        ],
      },
    ]);
    expect(projectTiptapDocumentText(parseTiptapDocument(input))).toContain('Heading');
    for (const kind of ['core', 'mistake', 'mastered', 'method', 'investigate']) {
      expect(() =>
        parseTiptapDocument(
          doc([
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: kind, marks: [{ type: 'highlight', attrs: { kind } }] },
              ],
            },
          ]),
        ),
      ).not.toThrow();
    }
  });

  it('accepts tables with headers, cells, and column alignment, plus horizontalRule and links', () => {
    const tableDoc = doc([
      { type: 'horizontalRule' },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', attrs: { align: 'left' }, content: [paragraph('天数')] },
              { type: 'tableHeader', attrs: { align: 'center' }, content: [paragraph('任务')] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: { align: 'left' },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '第 1 天', marks: [{ type: 'bold' }] }],
                  },
                ],
              },
              {
                type: 'tableCell',
                attrs: { align: 'center' },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: '计划链接',
                        marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const parsed = parseTiptapDocument(tableDoc);
    expect(parsed.content).toHaveLength(2);
    expect(projectTiptapDocumentText(parsed)).toContain('天数');
    expect(projectTiptapDocumentText(parsed)).toContain('第 1 天');
  });

  it('handles isFeatured and publishedAt in note service create and update', async () => {
    const { noteStore } = store();
    const service = createNoteService(
      noteStore,
      () => 'id-feat',
      () => '2026-10-01T00:00:00.000Z',
    );
    const created = await service.create({
      ...base,
      isFeatured: true,
      publishedAt: '2026-10-01T08:00:00.000Z',
      status: 'published',
    });
    expect(created.isFeatured).toBe(true);
    expect(created.publishedAt).toBe('2026-10-01T08:00:00.000Z');

    const updated = await service.update(created.id, { isFeatured: false });
    expect(updated?.isFeatured).toBe(false);
    expect(updated?.publishedAt).toBe('2026-10-01T08:00:00.000Z');
  });

  it.each([
    ['malformed root', '[]'],
    ['invalid root type', JSON.stringify({ type: 'paragraph', content: [] })],
    ['malformed child', doc([{ type: 'paragraph', content: 'not-an-array' }])],
    ['unsupported node', doc([{ type: 'image', attrs: { src: 'https://example.test/a.png' } }])],
    [
      'malformed mark',
      doc([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [{ type: 'bold', attrs: {} }] }],
        },
      ]),
    ],
    [
      'unknown highlight kind',
      doc([
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'x', marks: [{ type: 'highlight', attrs: { kind: 'rainbow' } }] },
          ],
        },
      ]),
    ],
    [
      'unsafe mark attributes',
      doc([
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'highlight', attrs: { kind: 'core', style: 'color:red' } }],
            },
          ],
        },
      ]),
    ],
    [
      'unsafe node attributes',
      doc([{ type: 'paragraph', attrs: { onload: 'alert(1)' }, content: [] }]),
    ],
    [
      'unsafe link javascript protocol',
      doc([
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ]),
    ],
    ['invalid table empty rows', doc([{ type: 'table', content: [] }])],
  ])('rejects %s', (_label, input) => {
    expect(() => parseTiptapDocument(input)).toThrow(NoteDomainError);
  });

  it('rejects pathological depth, node count, string length, and payload size', () => {
    let nested: Record<string, unknown> = paragraph('leaf');
    for (let index = 0; index < 33; index += 1) nested = { type: 'blockquote', content: [nested] };
    expect(() => parseTiptapDocument(doc([nested]))).toThrow(NoteDomainError);
    expect(() =>
      parseTiptapDocument(doc(Array.from({ length: 10_001 }, () => paragraph()))),
    ).toThrow(NoteDomainError);
    expect(() => parseTiptapDocument(doc([paragraph('x'.repeat(16_385))]))).toThrow(
      NoteDomainError,
    );
    expect(() => parseTiptapDocument(doc([paragraph('x'.repeat(256 * 1024))]))).toThrow(
      NoteDomainError,
    );
  });
});
