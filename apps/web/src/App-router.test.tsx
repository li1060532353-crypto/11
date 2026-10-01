import { fireEvent, render, screen } from '@testing-library/react';
import { Link, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

import { App } from './App';
import { EditorNavigationGuard } from './knowledge/EditorNavigationGuard';

vi.mock('./router', () => ({
  AppRoutes: () => (
    <Routes>
      <Route
        path="/edit"
        element={
          <>
            <Link to="/list">文章列表</Link>
            <EditorNavigationGuard dirty busy={false} onSave={async () => true} />
          </>
        }
      />
      <Route path="/list" element={<p>文章列表页</p>} />
    </Routes>
  ),
}));

afterEach(() => window.history.replaceState(null, '', '/'));

it('supports editor blocking through the runtime browser router and nested application routes', async () => {
  window.history.replaceState(null, '', '/edit');
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: '文章列表' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/edit');
  fireEvent.click(screen.getByRole('button', { name: '放弃修改并离开' }));
  await screen.findByText('文章列表页');
  expect(window.location.pathname).toBe('/list');
});
