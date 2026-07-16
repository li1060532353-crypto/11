import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  afterEach(() => {
    document.title = '';
    document.head.querySelector('meta[name="description"]')?.remove();
  });

  it('renders a page introduction with not-found metadata', async () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: '页面不存在' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('页面不存在 | Namdw 的技术笔记'));
  });

  it('adapts recovery links and metadata for a missing article', async () => {
    render(
      <MemoryRouter>
        <NotFoundPage resource="article" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: '未找到文章' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '浏览全部文章' })).toHaveAttribute('href', '/posts');
    await waitFor(() => expect(document.title).toBe('未找到文章 | Namdw 的技术笔记'));
  });
});
