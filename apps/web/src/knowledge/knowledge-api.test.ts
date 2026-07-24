import { describe, expect, it, vi } from 'vitest';

import { archiveKnowledgeNote, createKnowledgeNote, createKnowledgeNoteVersion, getKnowledgeNote, listKnowledgeNoteVersions, restoreKnowledgeNote, updateKnowledgeNote } from './knowledge-api';

const note = { id: 'n1', title: 'Note', slug: 'note-n1', summary: '', contentJson: '{"type":"doc","content":[]}', contentText: '', category: 'Learning', status: 'draft', isPinned: false, reviewCount: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastReviewedAt: null };
const create = { title: note.title, summary: note.summary, contentJson: note.contentJson, category: note.category, status: 'draft' as const, isPinned: note.isPinned };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('knowledge mutation API client', () => {
  it('uses explicit methods and unwraps only valid note envelopes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    await expect(getKnowledgeNote('n1')).resolves.toEqual(note);
    expect(fetch).toHaveBeenLastCalledWith('/api/notes/n1', expect.objectContaining({ method: 'GET' }));

    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }, 201));
    await createKnowledgeNote(create);
    expect(fetch).toHaveBeenLastCalledWith('/api/notes', expect.objectContaining({ method: 'POST', body: JSON.stringify(create) }));

    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    await updateKnowledgeNote('n1', { title: 'Renamed' });
    expect(fetch).toHaveBeenLastCalledWith('/api/notes/n1', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ title: 'Renamed' }) }));

    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { id: 'v1', contentJson: note.contentJson, contentText: '', createdAt: note.updatedAt } }, 201));
    await expect(createKnowledgeNoteVersion('n1')).resolves.toMatchObject({ id: 'v1' });
    expect(fetch).toHaveBeenLastCalledWith('/api/notes/n1/versions', expect.objectContaining({ method: 'POST' }));
  });

  it('maps stable failure categories and rejects malformed success data', async () => {
    for (const [status, kind] of [[400, 'validation'], [401, 'access'], [404, 'not-found'], [409, 'conflict'], [500, 'repository']] as const) {
      vi.mocked(fetch).mockResolvedValueOnce(response({ success: false, error: { code: 'INTERNAL', message: 'raw backend detail' } }, status));
      await expect(getKnowledgeNote('n1')).rejects.toMatchObject({ kind });
    }
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { ...note, contentJson: 7 } }));
    await expect(getKnowledgeNote('n1')).rejects.toMatchObject({ kind: 'malformed' });
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json'));
    await expect(getKnowledgeNote('n1')).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('uses existing archive, restore, and version-list contracts without changing note semantics', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { ...note, status: 'archived' } }));
    await expect(archiveKnowledgeNote('n1')).resolves.toMatchObject({ status: 'archived' });
    expect(fetch).toHaveBeenLastCalledWith('/api/notes/n1', expect.objectContaining({ method: 'DELETE' }));

    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    await expect(restoreKnowledgeNote('n1')).resolves.toEqual(note);
    expect(fetch).toHaveBeenLastCalledWith('/api/notes/n1/restore', expect.objectContaining({ method: 'POST' }));

    const version = { id: 'v1', contentJson: note.contentJson, contentText: note.contentText, createdAt: note.updatedAt };
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: [version] }));
    await expect(listKnowledgeNoteVersions('n1')).resolves.toEqual([version]);
    expect(fetch).toHaveBeenLastCalledWith('/api/notes/n1/versions', expect.objectContaining({ method: 'GET' }));
  });
});
