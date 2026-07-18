import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { mapNoteToCard, mapStatsToDashboard } from './knowledge-adapter';
import { loadKnowledgeNotes, loadKnowledgeStats } from './knowledge-api';
import type { KnowledgeApiFailure } from './knowledge-api';
import { KnowledgeNotesRoute } from './KnowledgeNotesRoute';

const note = { id: 'n1', title: 'Note', slug: 'note-n1', summary: 'Summary', contentJson: '{}', contentText: '', category: 'Work', status: 'archived' as const, isPinned: true, reviewCount: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', lastReviewedAt: null };

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }

describe('knowledge read-only integration', () => {
  it('unwraps successful typed envelopes and constructs approved query URLs', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { items: [note], page: 2, pageSize: 10, totalItems: 1, totalPages: 1 } }));
    await expect(loadKnowledgeNotes({ page: 2, pageSize: 10, status: 'archived', pinned: true })).resolves.toMatchObject({ items: [note] });
    expect(fetchMock).toHaveBeenCalledWith('/api/notes?page=2&pageSize=10&status=archived&pinned=true', expect.any(Object));
  });

  it('uses the search endpoint only for a non-empty query', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));
    await loadKnowledgeNotes({ q: 'design', page: 1, pageSize: 20 });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/search?q=design&page=1&pageSize=20', expect.any(Object));
  });

  it('rejects malformed note/search items and pagination metadata without partial acceptance', async () => {
    const invalidPage = { items: [{ ...note, status: 'wrong' }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: invalidPage }));
    await expect(loadKnowledgeNotes({ page: 1, pageSize: 20 })).rejects.toMatchObject({ kind: 'malformed' });
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { items: [{ ...note, reviewCount: 'wrong', lastReviewedAt: 'bad' }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }));
    await expect(loadKnowledgeNotes({ page: 1, pageSize: 20 })).rejects.toMatchObject({ kind: 'malformed' });
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { items: [{ id: 's', title: 'x', slug: 's', summary: 2, category: 'x', updatedAt: 'bad', excerpt: '', tags: [] }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }));
    await expect(loadKnowledgeNotes({ q: 'x', page: 1, pageSize: 20 })).rejects.toMatchObject({ kind: 'malformed' });
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { items: [note], page: 1.5, pageSize: 20, totalItems: 1, totalPages: 1 } }));
    await expect(loadKnowledgeNotes({ page: 1, pageSize: 20 })).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('maps failed, malformed, and access responses to stable categories', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: false, error: { code: 'NOTE_NOT_FOUND', message: 'raw' } }));
    await expect(loadKnowledgeStats()).rejects.toMatchObject({ kind: 'request' } satisfies Partial<KnowledgeApiFailure>);
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json'));
    await expect(loadKnowledgeStats()).rejects.toMatchObject({ kind: 'malformed' } satisfies Partial<KnowledgeApiFailure>);
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: {} }));
    await expect(loadKnowledgeStats()).rejects.toMatchObject({ kind: 'malformed' } satisfies Partial<KnowledgeApiFailure>);
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(loadKnowledgeStats()).rejects.toMatchObject({ kind: 'access' } satisfies Partial<KnowledgeApiFailure>);
  });

  it('maps stats and notes without exposing backend contracts to presentation', () => {
    expect(mapStatsToDashboard({ total: 4, draft: 1, published: 2, archived: 1, pinned: 1, roadmapProgress: 50 }).statistics[0]).toMatchObject({ label: 'Total notes', value: '4' });
    expect(mapNoteToCard(note)).toMatchObject({ title: 'Note', pinned: true, archived: true });
  });

  it('renders loading, empty, error, and ready notes states without mutation calls', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));
    render(<MemoryRouter><KnowledgeNotesRoute /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading notes');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'No notes yet' })).toBeInTheDocument());
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).startsWith('/api/notes') || String(url).startsWith('/api/search'))).toBe(true);
  });

  it('does not allow an older deferred response to replace a newer search result', async () => {
    let resolveOld!: (value: Response) => void;
    let resolveNew!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOld = resolve; })).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveNew = resolve; }));
    render(<MemoryRouter><KnowledgeNotesRoute /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'new' } });
    resolveNew(response({ success: true, data: { items: [{ id: 'n1', title: 'New result', slug: 'n1', summary: 'x', category: 'x', updatedAt: '2026-01-02T00:00:00.000Z', excerpt: 'x', tags: [] }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }));
    await waitFor(() => expect(screen.getByText('New result')).toBeInTheDocument());
    resolveOld(response({ success: true, data: { items: [{ ...note, title: 'Old result' }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }));
    await waitFor(() => expect(screen.queryByText('Old result')).not.toBeInTheDocument());
  });
});
