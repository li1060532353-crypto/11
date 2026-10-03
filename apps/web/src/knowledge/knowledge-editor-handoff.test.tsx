import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as KnowledgeApi from './knowledge-api';
import { KnowledgeEditorRoute } from './KnowledgeEditorRoute';

vi.mock('./knowledge-api', async (importOriginal) => ({
  ...(await importOriginal<typeof KnowledgeApi>()),
  listKnowledgeAssets: vi.fn().mockResolvedValue([]),
}));

const baseNote = {
  id: 'created-note-1',
  title: 'My Draft Note',
  slug: 'my-draft-note',
  summary: 'Draft summary',
  contentJson: JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Initial paragraph' }] }],
  }),
  contentText: 'Initial paragraph',
  category: 'Engineering',
  status: 'draft' as const,
  isPinned: false,
  isFeatured: false,
  tags: ['tech'],
  reviewCount: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  lastReviewedAt: null,
};

const imageAsset = {
  id: 'asset-img-123',
  noteId: 'created-note-1',
  originalName: 'diagram.png',
  mimeType: 'image/png',
  sizeBytes: 1024,
  createdAt: '2026-10-01T00:00:00.000Z',
};

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const errorResponse = (code: string, message: string, status = 500) =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function setupRouter(initialPath = '/knowledge/notes/new') {
  const routes = [
    {
      path: '/knowledge',
      element: (
        <div>
          <span data-testid="page-knowledge">知识库概览</span>
          <Link to="/knowledge/notes/new">新建文章</Link>
        </div>
      ),
    },
    {
      path: '/knowledge/notes',
      element: <div data-testid="page-notes-list">文章列表</div>,
    },
    {
      path: '/knowledge/notes/new',
      element: (
        <div>
          <nav>
            <Link to="/knowledge/notes" data-testid="nav-leave">
              离开去列表
            </Link>
          </nav>
          <KnowledgeEditorRoute mode="create" />
        </div>
      ),
    },
    {
      path: '/knowledge/notes/:id',
      element: (
        <div>
          <nav>
            <Link to="/knowledge/notes" data-testid="nav-leave">
              离开去列表
            </Link>
          </nav>
          <KnowledgeEditorRoute mode="edit" />
        </div>
      ),
    },
  ];

  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  return { router, ...render(<RouterProvider router={router} />) };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Editor Session Handoff (editorHandoff)', () => {
  it('Scenario 1: In create mode, pasting/uploading an image creates identity, uploads asset, inserts reference, flushes body save, and triggers navigate with replace and editorHandoff', async () => {
    let capturedCreateBody: Record<string, unknown> | null = null;
    let capturedPatchBody: Record<string, unknown> | null = null;
    let capturedAssetNoteId: string | null = null;

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/notes' && init?.method === 'POST') {
        capturedCreateBody = JSON.parse(String(init.body));
        return response({ ...baseNote, ...capturedCreateBody, id: 'created-note-1' }, 201);
      }
      if (url === '/api/assets' && init?.method === 'POST') {
        const formData = init.body as FormData;
        capturedAssetNoteId = String(formData.get('noteId'));
        return response({ asset: imageAsset }, 201);
      }
      if (url === '/api/notes/created-note-1' && init?.method === 'PATCH') {
        capturedPatchBody = JSON.parse(String(init.body));
        return response({ ...baseNote, ...capturedPatchBody, id: 'created-note-1' });
      }
      if (url.startsWith('/api/assets')) {
        return response([imageAsset]);
      }
      if (url === '/api/notes/created-note-1') {
        return response({ ...baseNote, id: 'created-note-1' });
      }
      return response({});
    });

    const { router } = setupRouter('/knowledge/notes/new');

    // Title input appears
    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'My Draft Note' } });

    // Capture the active editor DOM element to verify instance continuity
    const editorEl = document.querySelector('.tiptap')!;
    expect(editorEl).toBeInTheDocument();

    // Paste an image into the editor
    const imageFile = new File(['fake-png-data'], 'diagram.png', { type: 'image/png' });
    fireEvent.paste(editorEl, {
      clipboardData: {
        getData: () => '',
        files: [imageFile],
        items: [],
      },
    });

    // 1. Verify ensureIdentity created the draft in DB
    await waitFor(() => {
      expect(capturedCreateBody).not.toBeNull();
      expect(capturedCreateBody?.title).toBe('My Draft Note');
      expect(capturedCreateBody?.status).toBe('draft');
    });

    // 2. Verify asset was uploaded to R2 with created note identity
    await waitFor(() => {
      expect(capturedAssetNoteId).toBe('created-note-1');
    });

    // 3. Verify asset node was inserted into editor content
    await waitFor(() => {
      const img = document.querySelector('.tiptap img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('data-asset-id', 'asset-img-123');
      expect(img).toHaveAttribute('alt', 'diagram.png');
    });

    // 4. CRITICAL: Verify note body content was flushed / saved to DB with image reference
    await waitFor(() => {
      expect(capturedPatchBody).not.toBeNull();
      expect(capturedPatchBody?.contentJson).toContain('asset-img-123');
    });

    // 5. Verify seamless session handoff: URL replaced to /knowledge/notes/created-note-1
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/knowledge/notes/created-note-1');
    });

    // 6. Verify editor instance was NOT unmounted or blanked
    expect(document.querySelector('.tiptap')).toBe(editorEl);
    expect(screen.getByLabelText('Title')).toHaveValue('My Draft Note');
    // Save Version button is now available in edit mode
    expect(screen.getByRole('button', { name: 'Save Version' })).toBeInTheDocument();
  });

  it('Scenario 1 (Markdown mode): In create mode with format=markdown, pasting an image inserts markdown ref, flushes body, and handoff preserves markdown editing', async () => {
    let capturedPatchBody: Record<string, unknown> | null = null;

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/notes' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return response({ ...baseNote, ...body, id: 'created-note-md' }, 201);
      }
      if (url === '/api/assets' && init?.method === 'POST') {
        return response({ asset: { ...imageAsset, id: 'asset-md-1', noteId: 'created-note-md' } }, 201);
      }
      if (url === '/api/notes/created-note-md' && init?.method === 'PATCH') {
        capturedPatchBody = JSON.parse(String(init.body));
        return response({ ...baseNote, ...capturedPatchBody, id: 'created-note-md' });
      }
      if (url.startsWith('/api/assets')) return response([]);
      return response({});
    });

    const { router } = setupRouter('/knowledge/notes/new?format=markdown');

    const textarea = screen.getByLabelText('Markdown 正文');
    fireEvent.change(textarea, { target: { value: '# Hello World\n' } });
    (textarea as HTMLTextAreaElement).setSelectionRange(14, 14);

    const imageFile = new File(['fake-png-data'], 'diagram.png', { type: 'image/png' });
    fireEvent.paste(textarea, {
      clipboardData: {
        files: [imageFile],
        items: [],
      },
    });

    // Markdown reference inserted into textarea
    await waitFor(() => {
      expect(screen.getByLabelText('Markdown 正文')).toHaveValue(
        '# Hello World\n\n\n![diagram.png](/api/assets/asset-md-1?inline=1)\n\n',
      );
    });

    // Body flushed to DB
    await waitFor(() => {
      expect(capturedPatchBody).not.toBeNull();
      expect(capturedPatchBody?.contentJson).toContain('asset-md-1');
    });

    // URL transitioned with handoff
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/knowledge/notes/created-note-md');
      expect(router.state.location.search).toBe('?format=markdown');
    });
  });

  it('Scenario 2: Reloading / navigating to the persisted note ID renders the note with the image reference intact', async () => {
    const persistedNoteWithImage = {
      ...baseNote,
      id: 'persisted-note-42',
      title: 'Persisted Note Title',
      contentJson: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Text before image.' }],
          },
          {
            type: 'image',
            attrs: { assetId: 'asset-img-123', alt: 'diagram.png' },
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Text after image.' }],
          },
        ],
      }),
    };

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/notes/persisted-note-42') {
        return response(persistedNoteWithImage);
      }
      if (url.startsWith('/api/assets')) {
        return response([imageAsset]);
      }
      return response({});
    });

    // Load editor directly at /knowledge/notes/persisted-note-42 (simulates reload)
    setupRouter('/knowledge/notes/persisted-note-42');

    // Title recovered
    expect(await screen.findByLabelText('Title')).toHaveValue('Persisted Note Title');

    // Document loaded and rendered with image node
    await waitFor(() => {
      const img = document.querySelector('.tiptap img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('data-asset-id', 'asset-img-123');
      expect(img).toHaveAttribute('src', '/api/assets/asset-img-123?inline=1');
      expect(img).toHaveAttribute('alt', 'diagram.png');
    });

    // Text surrounding image is also intact
    expect(document.querySelector('.tiptap')).toHaveTextContent('Text before image.');
    expect(document.querySelector('.tiptap')).toHaveTextContent('Text after image.');
  });

  it('Scenario 3: Verify upload lock prevents leaving during upload, and failure allows retry', async () => {
    let resolveAssetUpload!: (res: Response) => void;
    let uploadAttempts = 0;

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/notes' && init?.method === 'POST') {
        return response({ ...baseNote, id: 'lock-test-note' }, 201);
      }
      if (url === '/api/assets' && init?.method === 'POST') {
        uploadAttempts++;
        if (uploadAttempts === 1) {
          // Keep first attempt pending until we trigger navigation guard test
          return new Promise<Response>((resolve) => {
            resolveAssetUpload = resolve;
          });
        }
        // Second attempt (retry) succeeds
        return response({ asset: { ...imageAsset, id: 'asset-retry-1', noteId: 'lock-test-note' } }, 201);
      }
      if (url.startsWith('/api/notes/lock-test-note') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body));
        return response({ ...baseNote, ...payload, id: 'lock-test-note' });
      }
      if (url.startsWith('/api/assets')) return response([]);
      return response({});
    });

    const { router } = setupRouter('/knowledge/notes/new');

    const editorEl = document.querySelector('.tiptap')!;
    const imageFile = new File(['upload-bytes'], 'diagram.png', { type: 'image/png' });

    // 1. Paste image to trigger upload
    fireEvent.paste(editorEl, {
      clipboardData: {
        getData: () => '',
        files: [imageFile],
        items: [],
      },
    });

    // Upload row shows uploading state
    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: '正在上传 diagram.png' })).toBeInTheDocument();
    });

    // 2. User attempts to leave during upload by clicking navigation link
    fireEvent.click(screen.getByTestId('nav-leave'));

    // Navigation guard blocks navigation and shows modal dialog
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '当前有未保存的修改' })).toBeInTheDocument();
    });
    expect(screen.getByText('正在处理保存或发布，请等待完成后再离开。')).toBeInTheDocument();

    // Verify leaving action buttons are disabled while upload is in progress
    const saveAndLeaveBtn = screen.getByRole('button', { name: '保存并离开' });
    const discardAndLeaveBtn = screen.getByRole('button', { name: '放弃修改并离开' });
    expect(saveAndLeaveBtn).toBeDisabled();
    expect(discardAndLeaveBtn).toBeDisabled();

    // Still on new page
    expect(router.state.location.pathname).toBe('/knowledge/notes/new');

    // Dismiss navigation dialog
    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // 3. Inject upload failure (e.g. 504 Gateway Timeout)
    await act(async () => {
      resolveAssetUpload(errorResponse('GATEWAY_TIMEOUT', 'Gateway Timeout', 504));
    });

    // Asset panel shows failure and retry button
    const retryBtn = await screen.findByRole('button', { name: '重试上传 diagram.png' });
    expect(retryBtn).toBeInTheDocument();

    // Editor is interactive and user can continue typing during error state
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Typing While Failed' } });
    expect(screen.getByLabelText('Title')).toHaveValue('Typing While Failed');

    // 4. Click retry button
    fireEvent.click(retryBtn);

    // Second upload attempt succeeds, image is inserted, body flushed, and session handoff completes
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/knowledge/notes/lock-test-note');
    });

    // Image is present in editor
    expect(document.querySelector('.tiptap img')).toHaveAttribute('data-asset-id', 'asset-retry-1');
    expect(screen.getByLabelText('Title')).toHaveValue('Typing While Failed');
  });
});
