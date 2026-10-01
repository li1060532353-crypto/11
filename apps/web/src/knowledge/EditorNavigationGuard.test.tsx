import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { EditorNavigationGuard } from './EditorNavigationGuard';

function setup({
  busy = false,
  onSave = vi.fn().mockResolvedValue(true),
  allowedPath,
}: {
  busy?: boolean;
  onSave?: () => Promise<boolean>;
  allowedPath?: string;
} = {}) {
  const router = createMemoryRouter(
    [
      { path: '/list', element: <p>文章列表页</p> },
      {
        path: '/edit',
        element: (
          <>
            <Link to="/list">文章列表</Link>
            <EditorNavigationGuard dirty busy={busy} onSave={onSave} allowedPath={allowedPath} />
          </>
        ),
      },
      { path: '/persisted', element: <p>已创建文章编辑页</p> },
    ],
    { initialEntries: ['/list', '/edit'], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);
  return { router, onSave };
}

describe('editor navigation protection', () => {
  it('allows consuming handoff state without leaving the same URL', async () => {
    const { router } = setup();
    await act(async () => {
      await router.navigate('/edit', { replace: true, state: null });
    });
    expect(router.state.location.state).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks browser back and resumes the original history entry after discard', async () => {
    const { router } = setup();
    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/edit');
    fireEvent.click(screen.getByRole('button', { name: '放弃修改并离开' }));
    await screen.findByText('文章列表页');
    expect(router.state.location.pathname).toBe('/list');
  });

  it('blocks programmatic navigation and retains its location state after saving', async () => {
    const { router, onSave } = setup();
    await act(async () => {
      await router.navigate('/list', { state: { filter: 'draft' } });
    });
    fireEvent.click(screen.getByRole('button', { name: '保存并离开' }));
    await screen.findByText('文章列表页');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(router.state.location.state).toEqual({ filter: 'draft' });
  });

  it('keeps edits and the navigation blocked when saving fails', async () => {
    const { router } = setup({ onSave: vi.fn().mockResolvedValue(false) });
    fireEvent.click(screen.getByRole('link', { name: '文章列表' }));
    fireEvent.click(screen.getByRole('button', { name: '保存并离开' }));
    await screen.findByRole('alert');
    expect(router.state.location.pathname).toBe('/edit');
    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/edit');
  });

  it('prevents leaving during an operation', async () => {
    const { router } = setup({ busy: true });
    await act(async () => {
      await router.navigate('/list');
    });
    expect(screen.getByRole('button', { name: '保存并离开' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '放弃修改并离开' })).toBeDisabled();
    expect(screen.getByText('正在处理保存或发布，请等待完成后再离开。')).toBeInTheDocument();
  });

  it('permits only the matching persisted editor handoff', async () => {
    const { router } = setup({ allowedPath: '/persisted' });
    await act(async () => {
      await router.navigate('/list', { state: { editorHandoff: {} } });
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    await act(async () => {
      await router.navigate('/persisted', {
        state: { editorHandoff: { note: { id: 'created' } } },
      });
    });
    await screen.findByText('已创建文章编辑页');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
