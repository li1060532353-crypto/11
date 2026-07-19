import { describe, expect, it } from 'vitest';

import { createNoteService, NoteDomainError, parseTiptapDocument, projectTiptapDocumentText, type NoteStore } from '../../../functions/lib/notes';

const base = { title: 'First note', summary: '', contentJson: '{"type":"doc","content":[]}', category: 'test', status: 'draft' as const, isPinned: false };

function store() {
  const notes = new Map<string, ReturnType<ReturnType<typeof createNoteService>['create']> extends Promise<infer T> ? T : never>();
  const versions: string[] = [];
  const noteStore: NoteStore = {
    async list() { return { items: [...notes.values()], page: 1, pageSize: 20, totalItems: notes.size, totalPages: 1 }; },
    async find(id) { return notes.get(id) ?? null; },
    async save(note) { notes.set(note.id, note); return note; },
    async saveWithTags(note) { notes.set(note.id, note); return note; },
    async createVersion(note, versionId) { versions.push(note.id); return { id: versionId, contentJson: note.contentJson, contentText: note.contentText, createdAt: note.updatedAt }; },
    async listVersions() { return []; },
  };
  return { noteStore, versions };
}

describe('note service', () => {
  it('creates, reads, partially updates, and archives a note', async () => {
    const service = createNoteService(store().noteStore, () => 'id-1', () => '2026-07-18T00:00:00.000Z');
    const created = await service.create(base);
    expect((await service.get(created.id))?.title).toBe('First note');
    expect((await service.update(created.id, { title: 'Renamed' }))?.title).toBe('Renamed');
    expect((await service.archive(created.id))?.status).toBe('archived');
  });

  it('rejects empty updates and returns null for absent notes', async () => {
    const service = createNoteService(store().noteStore, () => 'id-1', () => '2026-07-18T00:00:00.000Z');
    await expect(service.update('missing', {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await service.get('missing')).toBeNull();
  });

  it('derives text and leaves versions to the explicit snapshot operation', async () => {
    const { noteStore, versions } = store();
    const service = createNoteService(noteStore, () => 'id-1', () => '2026-07-18T00:00:00.000Z');
    const document = JSON.stringify({ type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Heading' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'First' }, { type: 'hardBreak' }, { type: 'text', text: 'line' }] }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }] }] }, { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quote' }] }] }, { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'const x = 1;' }] }, { type: 'paragraph' }] });
    const created = await service.create({ ...base, contentJson: document });
    expect(created.contentText).toBe('Heading\n\nFirst\nline\n\nItem\n\nQuote\n\nconst x = 1;');
    await service.update(created.id, { contentJson: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated' }] }] }) });
    expect(versions).toEqual([]);
    await service.saveVersion(created.id);
    expect(versions).toEqual([created.id]);
  });
});

describe('authoritative Tiptap document validation', () => {
  const doc = (content: unknown[]) => JSON.stringify({ type: 'doc', content });
  const paragraph = (text = 'ok') => ({ type: 'paragraph', content: [{ type: 'text', text }] });

  it('accepts the approved node subset and all semantic highlight kinds', () => {
    const input = doc([{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Heading', marks: [{ type: 'bold' }] }] }, { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [paragraph('Item'), { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('Nested')] }] }] }] }, { type: 'blockquote', content: [paragraph('Quote')] }, { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'const a = 1;' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'line' }, { type: 'hardBreak' }, { type: 'text', text: 'break' }] }]);
    expect(projectTiptapDocumentText(parseTiptapDocument(input))).toContain('Heading');
    for (const kind of ['core', 'mistake', 'mastered', 'method', 'investigate']) {
      expect(() => parseTiptapDocument(doc([{ type: 'paragraph', content: [{ type: 'text', text: kind, marks: [{ type: 'highlight', attrs: { kind } }] }] }]))).not.toThrow();
    }
  });

  it.each([
    ['malformed root', '[]'],
    ['invalid root type', JSON.stringify({ type: 'paragraph', content: [] })],
    ['malformed child', doc([{ type: 'paragraph', content: 'not-an-array' }])],
    ['unsupported node', doc([{ type: 'image', attrs: { src: 'https://example.test/a.png' } }])],
    ['malformed mark', doc([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'bold', attrs: {} }] }] }])],
    ['unknown highlight kind', doc([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'highlight', attrs: { kind: 'rainbow' } }] }] }])],
    ['unsafe mark attributes', doc([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'highlight', attrs: { kind: 'core', style: 'color:red' } }] }] }])],
    ['unsafe node attributes', doc([{ type: 'paragraph', attrs: { onload: 'alert(1)' }, content: [] }])],
  ])('rejects %s', (_label, input) => {
    expect(() => parseTiptapDocument(input)).toThrow(NoteDomainError);
  });

  it('rejects pathological depth, node count, string length, and payload size', () => {
    let nested: Record<string, unknown> = paragraph('leaf');
    for (let index = 0; index < 33; index += 1) nested = { type: 'blockquote', content: [nested] };
    expect(() => parseTiptapDocument(doc([nested]))).toThrow(NoteDomainError);
    expect(() => parseTiptapDocument(doc(Array.from({ length: 10_001 }, () => paragraph())))).toThrow(NoteDomainError);
    expect(() => parseTiptapDocument(doc([paragraph('x'.repeat(16_385))]))).toThrow(NoteDomainError);
    expect(() => parseTiptapDocument(doc([paragraph('x'.repeat(256 * 1024))]))).toThrow(NoteDomainError);
  });
});
