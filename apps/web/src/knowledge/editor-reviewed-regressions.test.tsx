import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeEditorRoute } from './KnowledgeEditorRoute';

const note = {
  id: 'review-note',
  title: 'Original title',
  slug: 'review-note',
  summary: '',
  contentJson: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
  contentText: '',
  category: 'General',
  status: 'draft' as const,
  isPinned: false,
  isFeatured: false,
  tags: [],
  reviewCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastReviewedAt: null,
};
const asset = {
  id: 'review-image',
  noteId: note.id,
  originalName: 'review.png',
  mimeType: 'image/png',
  sizeBytes: 68,
  createdAt: note.createdAt,
};
const response = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    headers: { 'Content-Type': 'application/json' },
  });
const routes = [{ path: '/knowledge/notes/:id', element: <KnowledgeEditorRoute mode="edit" /> }];
function openEditor() {
  const router = createMemoryRouter(routes, { initialEntries: ['/knowledge/notes/' + note.id] });
  return { router, ...render(<RouterProvider router={router} />) };
}

describe('independent review regressions', () => {
  it('allows the first-save handoff through the production data-router guard', async () => {
    let finishCreate!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation((input, options) => {
      if (String(input) === '/api/notes' && options?.method === 'POST')
        return new Promise((resolve) => {
          finishCreate = resolve;
        });
      return Promise.resolve(response(String(input).startsWith('/api/assets') ? [] : note));
    });
    const router = createMemoryRouter(
      [
        { path: '/knowledge/notes/new', element: <KnowledgeEditorRoute mode="create" /> },
        ...routes,
      ],
      { initialEntries: ['/knowledge/notes/new'] },
    );
    render(<RouterProvider router={router} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: note.title } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Typing during creation' },
    });
    await act(async () => {
      finishCreate(response(note));
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/knowledge/notes/' + note.id));
    expect(screen.getByLabelText('Title')).toHaveValue('Typing during creation');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('consumes creation handoff so a later reload reads the current server draft', async () => {
    const draft = {
      title: note.title,
      summary: note.summary,
      contentJson: note.contentJson,
      category: note.category,
      status: note.status,
      isPinned: note.isPinned,
      isFeatured: note.isFeatured,
      slug: note.slug,
      tags: note.tags,
    };
    const router = createMemoryRouter(routes, {
      initialEntries: [
        {
          pathname: '/knowledge/notes/' + note.id,
          state: { editorHandoff: { note, draft, error: null }, returnTo: '/knowledge' },
        },
      ],
    });
    vi.mocked(fetch).mockImplementation((input) =>
      Promise.resolve(
        response(
          String(input).startsWith('/api/assets') ? [] : { ...note, title: 'Latest server draft' },
        ),
      ),
    );
    const first = render(<RouterProvider router={router} />);
    await waitFor(() => expect(router.state.location.state).toEqual({ returnTo: '/knowledge' }));
    expect(screen.getByLabelText('Title')).toHaveValue(note.title);
    const reloadedEntry = router.state.location;
    first.unmount();
    const reloaded = createMemoryRouter(routes, { initialEntries: [reloadedEntry] });
    render(<RouterProvider router={reloaded} />);
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Latest server draft'));
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(
          ([url, options]) =>
            String(url) === '/api/notes/' + note.id &&
            (!options?.method || options.method === 'GET'),
        ),
    ).toHaveLength(1);
  });

  it('preserves an upload row when an older attachment list finishes late', async () => {
    let finishList!: (value: Response) => void;
    let finishUpload!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation((input, options) => {
      if (String(input).startsWith('/api/assets?'))
        return new Promise((resolve) => {
          finishList = resolve;
        });
      if (String(input) === '/api/assets' && options?.method === 'POST')
        return new Promise((resolve) => {
          finishUpload = resolve;
        });
      return Promise.resolve(response(note));
    });
    openEditor();
    await screen.findByLabelText('Title');
    fireEvent.click(screen.getByRole('button', { name: '文章设置' }));
    fireEvent.change(screen.getByLabelText('附件上传'), {
      target: { files: [new File(['png'], asset.originalName, { type: asset.mimeType })] },
    });
    expect(
      screen.getByRole('progressbar', { name: '正在上传 ' + asset.originalName }),
    ).toBeInTheDocument();
    await act(async () => {
      finishList(response([]));
    });
    expect(
      screen.getByRole('progressbar', { name: '正在上传 ' + asset.originalName }),
    ).toBeInTheDocument();
    await act(async () => {
      finishUpload(response({ asset }));
    });
    expect(screen.getByRole('button', { name: '插入图片' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('refuses to delete a newly inserted image before its draft is persisted', async () => {
    vi.mocked(fetch).mockImplementation((input) =>
      Promise.resolve(response(String(input).startsWith('/api/assets') ? [asset] : note)),
    );
    openEditor();
    await screen.findByLabelText('Title');
    fireEvent.click(screen.getByRole('button', { name: '文章设置' }));
    fireEvent.click(await screen.findByRole('button', { name: '插入图片' }));
    expect(screen.getByRole('img', { name: asset.originalName })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '删除 ' + asset.originalName }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    expect(
      await screen.findByText('附件仍被当前正文引用，请先移除引用并保存。'),
    ).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(
      false,
    );
    expect(screen.getByRole('img', { name: asset.originalName })).toBeInTheDocument();
  });
});
