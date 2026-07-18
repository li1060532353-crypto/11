import { describe, expect, it } from 'vitest';

import { createNoteService, type NoteStore } from '../../../functions/lib/notes';

const base = { title: 'First note', summary: '', contentJson: '{"type":"doc","content":[]}', category: 'test', status: 'draft' as const, isPinned: false };

function store(): NoteStore {
  const notes = new Map<string, ReturnType<ReturnType<typeof createNoteService>['create']> extends Promise<infer T> ? T : never>();
  return {
    async list() { return { items: [...notes.values()], page: 1, pageSize: 20, totalItems: notes.size, totalPages: 1 }; },
    async find(id) { return notes.get(id) ?? null; },
    async save(note) { notes.set(note.id, note); return note; },
    async saveWithTags(note) { notes.set(note.id, note); return note; },
    async createVersion(note, versionId) { return { id: versionId, contentJson: note.contentJson, contentText: note.contentText, createdAt: note.updatedAt }; },
    async listVersions() { return []; },
  };
}

describe('note service', () => {
  it('creates, reads, partially updates, and archives a note', async () => {
    const service = createNoteService(store(), () => 'id-1', () => '2026-07-18T00:00:00.000Z');
    const created = await service.create(base);
    expect((await service.get(created.id))?.title).toBe('First note');
    expect((await service.update(created.id, { title: 'Renamed' }))?.title).toBe('Renamed');
    expect((await service.archive(created.id))?.status).toBe('archived');
  });

  it('rejects empty updates and returns null for absent notes', async () => {
    const service = createNoteService(store(), () => 'id-1', () => '2026-07-18T00:00:00.000Z');
    await expect(service.update('missing', {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await service.get('missing')).toBeNull();
  });
});
