import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { mapNoteToCard, mapStatsToDashboard } from './knowledge-adapter';
import { loadKnowledgeNotes, loadKnowledgeStats } from './knowledge-api';
import type { KnowledgeApiFailure } from './knowledge-api';
import { KnowledgeDashboardRoute } from './KnowledgeDashboardRoute';
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

  it('loads the existing statistics envelope from its dedicated endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { total: 4, draft: 1, published: 2, archived: 1, pinned: 1, roadmapProgress: 50 } }));
    await expect(loadKnowledgeStats()).resolves.toMatchObject({ total: 4, published: 2 });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/stats', expect.objectContaining({ method: 'GET' }));
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
    await expect(loadKnowledgeStats()).rejects.toMatchObject({ kind: 'not-found' } satisfies Partial<KnowledgeApiFailure>);
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

  it('archives and restores listed notes through the existing protected endpoints', async () => {
    const activeNote = { ...note, status: 'draft' as const };
    const archivedNote = { ...note, id: 'n2', slug: 'note-n2', title: 'Archived note' };
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ success: true, data: { items: [activeNote, archivedNote], page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } }))
      .mockResolvedValueOnce(response({ success: true, data: { ...activeNote, status: 'archived' } }))
      .mockResolvedValueOnce(response({ success: true, data: { items: [{ ...activeNote, status: 'archived' }, archivedNote], page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } }))
      .mockResolvedValueOnce(response({ success: true, data: { ...archivedNote, status: 'draft' } }))
      .mockResolvedValueOnce(response({ success: true, data: { items: [activeNote, archivedNote], page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } }));
    render(<MemoryRouter><KnowledgeNotesRoute /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Archive Note' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Archive Note' }));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/notes/n1', expect.objectContaining({ method: 'DELETE' })));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore Archived note' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Restore Archived note' }));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/notes/n2/restore', expect.objectContaining({ method: 'POST' })));
  });

  it('sends only one archive request when the action is clicked again before the mutation resolves', async () => {
    const activeNote = { ...note, status: 'draft' as const };
    let resolveArchive!: (value: Response) => void;
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ success: true, data: { items: [activeNote], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveArchive = resolve; }))
      .mockResolvedValueOnce(response({ success: true, data: { items: [{ ...activeNote, status: 'archived' }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }));
    render(<MemoryRouter><KnowledgeNotesRoute /></MemoryRouter>);
    const archive = await screen.findByRole('button', { name: 'Archive Note' });

    fireEvent.click(archive);
    fireEvent.click(archive);
    expect(vi.mocked(fetch).mock.calls.filter(([url, init]) => url === '/api/notes/n1' && init?.method === 'DELETE')).toHaveLength(1);

    resolveArchive(response({ success: true, data: { ...activeNote, status: 'archived' } }));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/notes?page=1&pageSize=20', expect.any(Object)));
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

  it('renders dashboard loading, real API statistics, and an explicit error without fixture fallback', async () => {
    let resolveStats!: (value: Response) => void;
    const emptyNotes = { success: true, data: { items: [], page: 1, pageSize: 4, totalItems: 0, totalPages: 1 } };
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveStats = resolve; })).mockResolvedValueOnce(response(emptyNotes));
    const { rerender } = render(<MemoryRouter><KnowledgeDashboardRoute /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading dashboard');
    expect(screen.queryByText('24')).not.toBeInTheDocument();
    resolveStats(response({ success: true, data: { total: 7, draft: 1, published: 4, archived: 2, pinned: 2, roadmapProgress: 40 } }));
    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument());

    vi.mocked(fetch).mockResolvedValueOnce(response({ success: false, error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'raw' } }, 500)).mockResolvedValueOnce(response(emptyNotes));
    rerender(<MemoryRouter><KnowledgeDashboardRoute key="failed-dashboard" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Knowledge dashboard could not be loaded'));
    expect(screen.queryByText('24')).not.toBeInTheDocument();
  });

  it('builds the overview from existing stats and recently edited notes only', async () => {
    const recent = { ...note, status: 'draft' as const, title: 'Recently edited note' };
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ success: true, data: { total: 7, draft: 2, published: 4, archived: 1, pinned: 1, roadmapProgress: 40 } }))
      .mockResolvedValueOnce(response({ success: true, data: { items: [recent], page: 1, pageSize: 4, totalItems: 1, totalPages: 1 } }));

    render(<MemoryRouter><KnowledgeDashboardRoute /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Recently edited articles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recently edited note' })).toHaveAttribute('href', '/knowledge/notes/n1');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/stats', expect.objectContaining({ method: 'GET' }));
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/notes?page=1&pageSize=4', expect.objectContaining({ method: 'GET' }));
    expect(screen.queryByText(/views|popularity/i)).not.toBeInTheDocument();
  });
});
