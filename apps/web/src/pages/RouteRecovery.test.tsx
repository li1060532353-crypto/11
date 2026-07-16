import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { AppRoutes } from '../router';

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('resource-aware route recovery', () => {
  afterEach(() => {
    cleanup();
    document.title = '';
    document.head.querySelector('meta[name="description"]')?.remove();
  });

  it.each([
    [
      '/posts/missing',
      '未找到文章',
      '未找到文章 | Namdw 的技术笔记',
      '这篇文章不存在，或许已经被移动。',
      '浏览全部文章',
      '/posts',
    ],
    [
      '/categories/missing',
      '未找到分类',
      '未找到分类 | Namdw 的技术笔记',
      '这个分类不存在，或许已经被移除。',
      '浏览全部分类',
      '/categories',
    ],
    [
      '/tags/missing',
      '未找到标签',
      '未找到标签 | Namdw 的技术笔记',
      '这个标签不存在，或许已经被移除。',
      '浏览全部标签',
      '/tags',
    ],
    [
      '/projects/missing',
      '未找到项目',
      '未找到项目 | Namdw 的技术笔记',
      '这个项目不存在，或许已经被移除。',
      '浏览全部项目',
      '/projects',
    ],
    [
      '/missing',
      '页面不存在',
      '页面不存在 | Namdw 的技术笔记',
      '你访问的页面不存在，或许已经被移动。',
      '浏览文章',
      '/posts',
    ],
  ])(
    'recovers %s with its contextual page',
    async (path, heading, title, description, linkName, href) => {
      renderAt(path);

      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: linkName })).toHaveAttribute('href', href);
      await waitFor(() => expect(document.title).toBe(title));
      expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
        'content',
        description,
      );
    },
  );
});
