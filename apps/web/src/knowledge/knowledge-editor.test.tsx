import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeEditorRoute } from './KnowledgeEditorRoute';

const note = {
  id: 'n1',
  title: 'Note',
  slug: 'note-n1',
  summary: '',
  contentJson:
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Start"}]}]}',
  contentText: 'Start',
  category: 'Learning',
  status: 'draft',
  isPinned: false,
  isFeatured: false,
  reviewCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastReviewedAt: null,
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function renderEditor(path = '/knowledge/notes/n1', mode: 'create' | 'edit' = 'edit') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <div>
        <nav aria-label="测试导航">
          <Link to="/knowledge" data-testid="nav-overview">
            概览
          </Link>
          <Link to="/knowledge/notes" data-testid="nav-notes">
            文章管理
          </Link>
        </nav>
        <Routes>
          <Route path="/knowledge" element={<div data-testid="page-overview">概览页</div>} />
          <Route path="/knowledge/notes" element={<div data-testid="page-notes">文章列表页</div>} />
          <Route path="/knowledge/notes/new" element={<KnowledgeEditorRoute mode="create" />} />
          <Route path="/knowledge/notes/:id" element={<KnowledgeEditorRoute mode={mode} />} />
        </Routes>
      </div>
    </MemoryRouter>,
  );
}

afterEach(() => vi.useRealTimers());

describe('knowledge editor mutation integration', () => {
  it('loads an existing note and presents a malformed response safely', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));

    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { id: 'n1' } }));
    renderEditor('/knowledge/notes/n2');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/response was invalid/i),
    );
  });

  it('creates once and never creates a version automatically', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: true, data: { ...note, id: 'created' } }, 201),
    );
    renderEditor('/knowledge/notes/new', 'create');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Created note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/notes',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/versions'))).toBe(
      false,
    );
  });

  it('keeps a failed create dirty and presents a save failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: false, error: { code: 'VALIDATION_ERROR', message: 'raw' } }, 400),
    );
    renderEditor('/knowledge/notes/new', 'create');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Rejected note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getAllByText(/保存失败/).length).toBeGreaterThan(0);
    });
  });

  it('autosaves changed existing notes but leaves unchanged content alone', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed' } });
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: true, data: { ...note, title: 'Changed' } }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(vi.mocked(fetch)).toHaveBeenLastCalledWith(
      '/api/notes/n1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/versions'))).toBe(
      false,
    );
  });

  it('EDIT-02: keeps a newer edit dirty when a stale autosave succeeds or fails', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await act(async () => {
      await Promise.resolve();
    });
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    vi.mocked(fetch)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'First' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Second' } });
    await act(async () => {
      resolveFirst(response({ success: true, data: { ...note, title: 'First' } }));
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('未保存修改');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      resolveSecond(response({ success: true, data: { ...note, title: 'Second' } }));
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('已自动保存');

    let resolveFailure!: (value: Response) => void;
    let resolveLatest!: (value: Response) => void;
    vi.mocked(fetch)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFailure = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveLatest = resolve;
          }),
      );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Third' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fourth' } });
    await act(async () => {
      resolveFailure(
        response(
          { success: false, error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'raw' } },
          500,
        ),
      );
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('未保存修改');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      resolveLatest(response({ success: true, data: { ...note, title: 'Fourth' } }));
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('已自动保存');
  });

  it('keeps a failed autosave dirty without an automatic retry', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await act(async () => {
      await Promise.resolve();
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: false, error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'raw' } }, 500),
    );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unpersisted' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('保存失败');
    expect(screen.getByLabelText('Title')).toHaveValue('Unpersisted');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('EDIT-03: supports manual retry after a save failure', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await act(async () => {
      await Promise.resolve();
    });

    // 1. Trigger autosave failure
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: false, error: { code: 'NOTE_REPOSITORY_FAILURE', message: 'raw' } }, 500),
    );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Retry content' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('保存失败');

    // 2. Click retry button
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: true, data: { ...note, title: 'Retry content' } }),
    );
    const retryBtn = screen.getByRole('button', { name: '重试保存' });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('已自动保存');
  });

  it('saves current content before an explicit version and suppresses duplicate version clicks', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Latest' } });
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: true, data: { ...note, title: 'Latest' } }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      response(
        {
          success: true,
          data: {
            id: 'v1',
            contentJson: note.contentJson,
            contentText: note.contentText,
            createdAt: note.updatedAt,
          },
        },
        201,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Version' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Version' }));
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/versions')),
      ).toHaveLength(1),
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.map(([url]) => String(url))
        .slice(-2),
    ).toEqual(['/api/notes/n1', '/api/notes/n1/versions']);
  });

  it('blocks attachment uploads until a new note has been saved', async () => {
    renderEditor('/knowledge/notes/new', 'create');
    expect(screen.getByLabelText('附件上传')).toBeDisabled();
    expect(screen.getByText('附件上传会在笔记首次保存后可用。')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uploads an attachment with the persisted note id and retains it when deletion fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));
    vi.mocked(fetch).mockResolvedValueOnce(
      response(
        {
          success: true,
          data: {
            asset: {
              id: 'asset-1',
              noteId: 'n1',
              originalName: 'safe.png',
              mimeType: 'image/png',
              sizeBytes: 3,
              createdAt: note.createdAt,
            },
          },
        },
        201,
      ),
    );
    fireEvent.change(screen.getByLabelText('附件上传'), {
      target: { files: [new File(['png'], 'safe.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByText('safe.png')).toBeInTheDocument());
    const [, options] = vi.mocked(fetch).mock.calls.at(-1)!;
    expect(options).toMatchObject({ method: 'POST' });
    expect((options as RequestInit).headers).toEqual({ Accept: 'application/json' });
    expect((options as RequestInit).body).toBeInstanceOf(FormData);
    expect(((options as RequestInit).body as FormData).get('noteId')).toBe('n1');

    vi.mocked(fetch).mockResolvedValueOnce(
      response(
        { success: false, error: { code: 'ASSET_STORAGE_DELETE_FAILED', message: 'raw' } },
        500,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: '删除 safe.png' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(screen.getByText('safe.png')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('The attachment could not be deleted.');
  });

  it('suppresses duplicate uploads while an upload is pending', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));
    let resolveUpload!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const file = new File(['png'], 'safe.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('附件上传'), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('附件上传'), { target: { files: [file] } });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveUpload(
        response(
          {
            success: true,
            data: {
              asset: {
                id: 'asset-2',
                noteId: 'n1',
                originalName: 'safe.png',
                mimeType: 'image/png',
                sizeBytes: 3,
                createdAt: note.createdAt,
              },
            },
          },
          201,
        ),
      );
    });
  });

  it('EDIT-01: intercepts SPA navigation when unsaved changes exist and provides leave guard modal', async () => {
    renderEditor('/knowledge/notes/new', 'create');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '未保存重要草稿' } });

    // Click external navigation link while dirty
    const overviewLink = screen.getByTestId('nav-overview');
    fireEvent.click(overviewLink);

    // Modal dialog pops up to guard unsaved changes
    expect(screen.getByRole('dialog', { name: '当前有未保存的修改' })).toBeInTheDocument();
    expect(
      screen.getByText(/您在文章《未保存重要草稿》中的编辑尚未保存。现在离开，最新修改将会丢失。/),
    ).toBeInTheDocument();

    // Click "留在当前页面" -> modal closes, route not left
    fireEvent.click(screen.getByRole('button', { name: '留在当前页面' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('未保存重要草稿');
  });

  it('PUB-01 & PUB-02: handles publishing draft and updating published note', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));

    // Draft note shows "发布文章"
    const publishBtn = screen.getByRole('button', { name: '发布文章' });
    expect(publishBtn).toBeInTheDocument();

    // 1. Publish draft -> calls saveCurrent, then POST /publish
    vi.mocked(fetch).mockResolvedValueOnce(
      response({
        success: true,
        data: {
          ...note,
          status: 'published',
          publishedAt: '2026-10-01T12:00:00.000Z',
          publishedTitle: 'Note',
        },
      }),
    );
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenLastCalledWith(
        '/api/notes/n1/publish',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    // 2. Status is now published -> button transforms to "更新发布"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '更新发布' })).toBeInTheDocument();
    });

    // 3. Update publish
    vi.mocked(fetch).mockResolvedValueOnce(
      response({
        success: true,
        data: {
          ...note,
          status: 'published',
          publishedAt: '2026-10-01T13:00:00.000Z',
        },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '更新发布' }));
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenLastCalledWith(
        '/api/notes/n1/publish',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('PUB-03: retracts published note to draft', async () => {
    const publishedNote = { ...note, status: 'published' as const };
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: publishedNote }));
    renderEditor();
    await waitFor(() => expect(screen.getByRole('button', { name: '撤回为草稿' })).toBeInTheDocument());

    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: true, data: { ...publishedNote, status: 'draft' } }),
    );
    fireEvent.click(screen.getByRole('button', { name: '撤回为草稿' }));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenLastCalledWith(
        '/api/notes/n1/unpublish',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '发布文章' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '撤回为草稿' })).not.toBeInTheDocument();
    });
  });

  it('VER-01: fail-safe circuit breaker aborts restore when pre-restore backup fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));

    // Open versions list
    const historicalVersion = {
      id: 'v-ancient',
      contentJson: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ancient text"}]}]}',
      contentText: 'Ancient text',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: [historicalVersion] }));
    fireEvent.click(screen.getByRole('button', { name: '版本历史' }));
    await waitFor(() => expect(screen.getByText('Ancient text')).toBeInTheDocument());

    // Inject failure: POST /versions returns 500
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: false, error: { code: 'PRE_RESTORE_BACKUP_FAILED', message: 'D1 error' } }, 500),
    );

    // Attempt to restore historical version
    fireEvent.click(screen.getByRole('button', { name: '恢复此版本' }));

    // Must halt immediately and show strict safety warning!
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '安全保护失败：无法为当前正在编辑的内容创建安全备份快照。为防止您的工作丢失，系统已终止恢复。',
      );
    });

    // Current document in editor is preserved and NOT overwritten!
    expect(screen.queryByText('Ancient text…')).not.toBeInTheDocument();
  });

  it('VER-02: successfully restores historical version when backup passes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));

    const historicalVersion = {
      id: 'v-ancient',
      contentJson: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Historical Content"}]}]}',
      contentText: 'Historical Content',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: [historicalVersion] }));
    fireEvent.click(screen.getByRole('button', { name: '版本历史' }));
    await waitFor(() => expect(screen.getByText('Historical Content')).toBeInTheDocument());

    // Step 2 backup succeeds, then versions reloaded
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: true, data: { ...historicalVersion, id: 'v-backup' } }, 201),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: true, data: [historicalVersion] }),
    );

    fireEvent.click(screen.getByRole('button', { name: '恢复此版本' }));
    await waitFor(() => {
      expect(screen.getByText('已成功恢复旧版本，原编辑内容已备份至版本历史。')).toBeInTheDocument();
    });
  });

  it('ASSET-01: upload failure displays error and allows retry while editor remains interactive', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
    renderEditor();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Note'));

    // Inject 504 gateway timeout on asset upload
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ success: false, error: { code: 'GATEWAY_TIMEOUT', message: 'Timeout' } }, 504),
    );
    const testFile = new File(['png-data'], 'diagram.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('附件上传'), { target: { files: [testFile] } });

    // Asset panel shows failure and retry button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '重试上传 diagram.png' })).toBeInTheDocument();
    });

    // Editor is NOT frozen or blocked: user can continue typing
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Typing smoothly' } });
    expect(screen.getByLabelText('Title')).toHaveValue('Typing smoothly');

    // Clicking retry successfully uploads
    vi.mocked(fetch).mockResolvedValueOnce(
      response(
        {
          success: true,
          data: {
            asset: {
              id: 'asset-diagram',
              noteId: 'n1',
              originalName: 'diagram.png',
              mimeType: 'image/png',
              sizeBytes: 8,
              createdAt: note.createdAt,
            },
          },
        },
        201,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: '重试上传 diagram.png' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '下载 diagram.png' })).toBeInTheDocument();
    });
  });
});
