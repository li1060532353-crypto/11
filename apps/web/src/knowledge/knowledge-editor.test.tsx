import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeEditorRoute } from './KnowledgeEditorRoute';

const note = { id: 'n1', title: 'Note', slug: 'note-n1', summary: '', contentJson: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Start"}]}]}', contentText: 'Start', category: 'Learning', status: 'draft', isPinned: false, reviewCount: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastReviewedAt: null };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function renderEditor(path = '/knowledge/notes/n1', mode: 'create' | 'edit' = 'edit') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/knowledge/notes/new" element={<KnowledgeEditorRoute mode="create" />} /><Route path="/knowledge/notes/:id" element={<KnowledgeEditorRoute mode={mode} />} /></Routes></MemoryRouter>);
}

afterEach(() => vi.useRealTimers());

describe('knowledge editor mutation integration', () => {
  it('loads an existing note and presents a malformed response safely', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));

    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { id: 'n1' } }));
    renderEditor('/knowledge/notes/n2');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('response was invalid'));
  });

  it('creates once and never creates a version automatically', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { ...note, id: 'created' } }, 201));
    renderEditor('/knowledge/notes/new', 'create');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Created note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenLastCalledWith('/api/notes', expect.objectContaining({ method: 'POST' }));
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/versions'))).toBe(false);

  });

  it('keeps a failed create dirty and presents a save failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: false, error: { code: 'VALIDATION_ERROR', message: 'raw' } }, 400));
    renderEditor('/knowledge/notes/new', 'create');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Rejected note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getAllByRole('status').at(-1)).toHaveTextContent('Save failed'));
  });

  it('autosaves changed existing notes but leaves unchanged content alone', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await act(async () => { await Promise.resolve(); });
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed' } });
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { ...note, title: 'Changed' } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(vi.mocked(fetch)).toHaveBeenLastCalledWith('/api/notes/n1', expect.objectContaining({ method: 'PATCH' }));
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/versions'))).toBe(false);
  });

  it('keeps a newer edit dirty when a stale autosave succeeds or fails', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await act(async () => { await Promise.resolve(); });
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve; })).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveSecond = resolve; }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'First' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Second' } });
    await act(async () => { resolveFirst(response({ success: true, data: { ...note, title: 'First' } })); await Promise.resolve(); });
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    await act(async () => { resolveSecond(response({ success: true, data: { ...note, title: 'Second' } })); await Promise.resolve(); });
    expect(screen.getByRole('status')).toHaveTextContent('Saved');

    let resolveFailure!: (value: Response) => void;
    let resolveLatest!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFailure = resolve; })).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveLatest = resolve; }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Third' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fourth' } });
    await act(async () => { resolveFailure(response({ success: false, error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'raw' } }, 500)); await Promise.resolve(); });
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    await act(async () => { resolveLatest(response({ success: true, data: { ...note, title: 'Fourth' } })); await Promise.resolve(); });
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('keeps a failed autosave dirty without an automatic retry', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await act(async () => { await Promise.resolve(); });
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: false, error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'raw' } }, 500));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unpersisted' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByRole('status')).toHaveTextContent('Save failed');
    expect(screen.getByLabelText('Title')).toHaveValue('Unpersisted');
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('saves current content before an explicit version and suppresses duplicate version clicks', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Latest' } });
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { ...note, title: 'Latest' } }));
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { id: 'v1', contentJson: note.contentJson, contentText: note.contentText, createdAt: note.updatedAt } }, 201));
    fireEvent.click(screen.getByRole('button', { name: 'Save Version' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Version' }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/versions'))).toHaveLength(1));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url)).slice(-2)).toEqual(['/api/notes/n1', '/api/notes/n1/versions']);
  });

  it('blocks attachment uploads until a new note has been saved', async () => {
    renderEditor('/knowledge/notes/new', 'create');
    fireEvent.change(screen.getByLabelText('Upload attachment'), { target: { files: [new File(['x'], 'safe.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Save the note before uploading attachments.'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uploads an attachment with the persisted note id and retains it when deletion fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { asset: { id: 'asset-1', noteId: 'n1', originalName: 'safe.png', mimeType: 'image/png', sizeBytes: 3, createdAt: note.createdAt } } }, 201));
    fireEvent.change(screen.getByLabelText('Upload attachment'), { target: { files: [new File(['png'], 'safe.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByText('safe.png')).toBeInTheDocument());
    const [, options] = vi.mocked(fetch).mock.calls.at(-1)!;
    expect(options).toMatchObject({ method: 'POST' });
    expect((options as RequestInit).headers).toEqual({ Accept: 'application/json' });
    expect((options as RequestInit).body).toBeInstanceOf(FormData);
    expect(((options as RequestInit).body as FormData).get('noteId')).toBe('n1');

    vi.mocked(fetch).mockResolvedValueOnce(response({ success: false, error: { code: 'ASSET_STORAGE_DELETE_FAILED', message: 'raw' } }, 500));
    fireEvent.click(screen.getByRole('button', { name: 'Delete safe.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.getByText('safe.png')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('The attachment could not be deleted.');
  });

  it('suppresses duplicate uploads while an upload is pending', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));
    let resolveUpload!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveUpload = resolve; }));
    const file = new File(['png'], 'safe.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload attachment'), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Upload attachment'), { target: { files: [file] } });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { resolveUpload(response({ success: true, data: { asset: { id: 'asset-2', noteId: 'n1', originalName: 'safe.png', mimeType: 'image/png', sizeBytes: 3, createdAt: note.createdAt } } }, 201)); });
  });
});
