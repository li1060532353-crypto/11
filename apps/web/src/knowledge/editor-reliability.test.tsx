import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryRouter,
  Link,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeEditorRoute } from './KnowledgeEditorRoute';

const note = {
  id: 'reliable-note',
  title: 'Saved snapshot',
  slug: 'reliable-note',
  summary: '',
  contentJson: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
  contentText: '',
  category: 'General',
  status: 'draft',
  isPinned: false,
  isFeatured: false,
  tags: [],
  reviewCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastReviewedAt: null,
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
function openEditor(path = '/knowledge/notes/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/knowledge/notes/new" element={<KnowledgeEditorRoute mode="create" />} />
        <Route path="/knowledge/notes/:id" element={<KnowledgeEditorRoute mode="edit" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('editor lifecycle reliability', () => {
  it('preserves typing during the first save after transitioning to the persisted note', async () => {
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation((input, options) => {
      if (String(input).startsWith('/api/assets')) return Promise.resolve(response([]));
      if (String(input) === '/api/notes' && options?.method === 'POST')
        return new Promise((resolve) => {
          finish = resolve;
        });
      return Promise.resolve(response(note));
    });
    openEditor();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: note.title } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Latest edit' } });
    await act(async () => {
      finish(response(note, 201));
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Version' })).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Latest edit');
  });

  it('saves dirty content before retracting a published article', async () => {
    let stored = { ...note, status: 'published' };
    vi.mocked(fetch).mockImplementation((input, options) => {
      if (String(input).startsWith('/api/assets')) return Promise.resolve(response([]));
      if (options?.method === 'PATCH') stored = { ...stored, ...JSON.parse(String(options.body)) };
      if (String(input).endsWith('/unpublish')) stored = { ...stored, status: 'draft' };
      return Promise.resolve(response(stored));
    });
    openEditor('/knowledge/notes/reliable-note');
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue(note.title));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Unsaved before retract' },
    });
    fireEvent.click(screen.getByRole('button', { name: '撤回为草稿' }));
    await waitFor(() => expect(screen.getByText(/成功撤回/)).toBeInTheDocument());
    expect(screen.getByLabelText('Title')).toHaveValue('Unsaved before retract');
    expect(stored.title).toBe('Unsaved before retract');
    expect(stored.status).toBe('draft');
  });

  it('retains a created identity when publication fails and retries without another create', async () => {
    let created = 0;
    let publishes = 0;
    vi.mocked(fetch).mockImplementation((input, options) => {
      if (String(input).startsWith('/api/assets')) return Promise.resolve(response([]));
      if (String(input) === '/api/notes' && options?.method === 'POST') created++;
      if (String(input).endsWith('/publish')) {
        publishes++;
        if (publishes === 1)
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: false,
                error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'unavailable' },
              }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        return Promise.resolve(response({ ...note, status: 'published' }));
      }
      return Promise.resolve(response(note));
    });
    openEditor();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: note.title } });
    fireEvent.click(screen.getByRole('button', { name: '发布文章' }));
    await waitFor(() => expect(screen.getByText(/服务暂时不可用/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '发布文章' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '更新发布' })).toBeInTheDocument(),
    );
    expect(created).toBe(1);
  });

  it('does not allow editing an existing note until a successful load', async () => {
    vi.mocked(fetch).mockImplementation((input) =>
      String(input).startsWith('/api/assets')
        ? Promise.resolve(response([]))
        : Promise.reject(new Error('offline')),
    );
    openEditor('/knowledge/notes/reliable-note');
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重试/ })).toBeInTheDocument();
  });

  it('reloads saved attachments and inserts a real private image in the saved document', async () => {
    let stored = { ...note };
    const asset = {
      id: 'image-1',
      noteId: note.id,
      originalName: 'diagram.png',
      mimeType: 'image/png',
      sizeBytes: 68,
      createdAt: note.createdAt,
    };
    vi.mocked(fetch).mockImplementation((input, options) => {
      if (String(input).startsWith('/api/assets')) return Promise.resolve(response([asset]));
      if (options?.method === 'PATCH') stored = { ...stored, ...JSON.parse(String(options.body)) };
      return Promise.resolve(response(stored));
    });
    openEditor('/knowledge/notes/reliable-note');
    await screen.findByLabelText('Title');
    fireEvent.click(screen.getByRole('button', { name: '文章设置' }));
    fireEvent.click(await screen.findByRole('button', { name: '插入图片' }));
    expect(screen.getByRole('img', { name: 'diagram.png' })).toHaveAttribute(
      'src',
      '/api/assets/image-1?inline=1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(JSON.parse(stored.contentJson).content).toContainEqual({
        type: 'image',
        attrs: { assetId: 'image-1', alt: 'diagram.png' },
      }),
    );
  });
});

describe('draft protection across navigation and publication', () => {
  it('flushes typing during creation before save-and-leave proceeds', async () => {
    let finish!: (value: Response) => void;
    let stored = { ...note };
    vi.mocked(fetch).mockImplementation((input, options) => {
      if (String(input).startsWith('/api/assets')) return Promise.resolve(response([]));
      if (String(input) === '/api/notes')
        return new Promise((resolve) => {
          finish = resolve;
        });
      if (options?.method === 'PATCH') stored = { ...stored, ...JSON.parse(String(options.body)) };
      return Promise.resolve(response(stored));
    });
    const router = createMemoryRouter(
      [
        {
          path: '/knowledge/notes/new',
          element: (
            <>
              <Link to="/list">List</Link>
              <KnowledgeEditorRoute mode="create" />
            </>
          ),
        },
        { path: '/list', element: <p>Left editor</p> },
      ],
      { initialEntries: ['/knowledge/notes/new'] },
    );
    render(<RouterProvider router={router} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: note.title } });
    fireEvent.click(screen.getByRole('link', { name: 'List' }));
    fireEvent.click(screen.getByRole('button', { name: '保存并离开' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Typed while creating' } });
    await act(async () => {
      finish(response(note, 201));
    });
    await screen.findByText('Left editor');
    expect(stored.title).toBe('Typed while creating');
  });

  it('publishes the latest content typed during first creation', async () => {
    let finish!: (value: Response) => void;
    let stored = { ...note };
    let publishedTitle = '';
    vi.mocked(fetch).mockImplementation((input, options) => {
      if (String(input).startsWith('/api/assets')) return Promise.resolve(response([]));
      if (String(input) === '/api/notes')
        return new Promise((resolve) => {
          finish = resolve;
        });
      if (options?.method === 'PATCH') stored = { ...stored, ...JSON.parse(String(options.body)) };
      if (String(input).endsWith('/publish')) {
        publishedTitle = stored.title;
        stored = { ...stored, status: 'published' };
      }
      return Promise.resolve(response(stored));
    });
    openEditor();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: note.title } });
    fireEvent.click(screen.getByRole('button', { name: '发布文章' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Latest publication' } });
    await act(async () => {
      finish(response(note, 201));
    });
    await screen.findByRole('button', { name: '更新发布' });
    expect(publishedTitle).toBe('Latest publication');
  });
});

describe('live preview and server normalization', () => {
  it('previews unsaved text without making a save request or leaving the editor', async () => {
    openEditor();
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Unsaved preview title' },
    });
    fireEvent.click(screen.getByRole('button', { name: '预览当前草稿' }));
    expect(screen.getByRole('dialog', { name: '当前草稿预览' })).toHaveTextContent(
      'Unsaved preview title',
    );
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '返回编辑' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Unsaved preview title');
  });
  it('acknowledges the normalized server slug without another redundant save', async () => {
    let stored = { ...note };
    vi.mocked(fetch).mockImplementation((input, options) => {
      if (String(input).startsWith('/api/assets')) return Promise.resolve(response([]));
      if (options?.method === 'PATCH')
        stored = { ...stored, ...JSON.parse(String(options.body)), slug: 'my-slug' };
      return Promise.resolve(response(stored));
    });
    openEditor('/knowledge/notes/reliable-note');
    await screen.findByLabelText('Title');
    fireEvent.click(screen.getByRole('button', { name: '文章设置' }));
    fireEvent.change(screen.getByRole('textbox', { name: /URL Slug/ }), {
      target: { value: 'My Slug' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /URL Slug/ })).toHaveValue('my-slug'),
    );
    expect(screen.getByRole('status')).toHaveTextContent('已自动保存');
    expect(vi.mocked(fetch).mock.calls.filter(([, opts]) => opts?.method === 'PATCH')).toHaveLength(
      1,
    );
  });
});
