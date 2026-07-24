import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '../../router';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

function ArticleRouteNavigator() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/posts/missing')}>
        打开缺失文章
      </button>
      <button type="button" onClick={() => navigate('/posts/discrete-convolution')}>
        打开卷积文章
      </button>
    </>
  );
}

describe('PostDetailPage', () => {
  afterEach(() => {
    document.title = '';
    document.head.querySelector('meta[name="description"]')?.remove();
    vi.restoreAllMocks();
  });

  it('renders the repository article, metadata, reader region, and stable adjacent navigation', async () => {
    renderAt('/posts/discrete-convolution');

    expect(
      await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('离散信号的卷积曲线')).toHaveClass(
      'post-card__visual',
      'post-card__visual--blue',
    );
    expect(
      screen.getByText('从单位冲激分解出发，理解每一个输入样本如何共同构成当前输出。'),
    ).toBeInTheDocument();
    expect(document.querySelector('#article-content')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('progressbar', { name: '文章阅读进度' })).toBeInTheDocument();
    const tableOfContents = screen.getByRole('navigation', { name: '文章目录' });
    expect(within(tableOfContents).getByRole('link', { name: '从冲激响应出发' })).toHaveAttribute(
      'href',
      '#从冲激响应出发',
    );
    expect(within(tableOfContents).getByRole('link', { name: '用索引表检查求和' })).toHaveAttribute(
      'href',
      '#用索引表检查求和',
    );
    expect(document.querySelector('#从冲激响应出发')).toHaveTextContent('从冲激响应出发');
    expect(document.querySelector('#用索引表检查求和')).toHaveTextContent('用索引表检查求和');
    expect(screen.getByRole('link', { name: /上一篇.*从秩理解矩阵的结构/ })).toHaveAttribute(
      'href',
      '/posts/matrix-rank',
    );
    expect(screen.getByRole('link', { name: /下一篇.*周期信号分析的三个检查点/ })).toHaveAttribute(
      'href',
      '/posts/signal-period-analysis',
    );
    await waitFor(() => expect(document.title).toBe('离散卷积与系统响应 | Namdw 的技术笔记'));
  });

  it('routes missing posts to article recovery and preserves hook order across navigation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/posts/discrete-convolution']}>
        <ArticleRouteNavigator />
        <AppRoutes />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' });
    await user.click(screen.getByRole('button', { name: '打开缺失文章' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: '未找到文章' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '浏览全部文章' })).toHaveAttribute('href', '/posts');
    await waitFor(() => expect(document.title).toBe('未找到文章 | Namdw 的技术笔记'));

    await user.click(screen.getByRole('button', { name: '打开卷积文章' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('离散卷积与系统响应 | Namdw 的技术笔记'));
  });

  it('uses API related posts for article navigation when post detail provides them', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            slug: 'api-source',
            title: 'API Source Article',
            summary: 'Loaded from the API.',
            category: { slug: 'linear-algebra', label: 'Linear Algebra', postCount: 3 },
            tags: [{ slug: 'api', label: 'API', postCount: 3 }],
            publishedAt: '2026-02-01T00:00:00.000Z',
            readingMinutes: 5,
            seoTitle: null,
            seoDescription: null,
            body: '# API Source Article\n\n## API Body\n\nContent.',
            relatedPosts: [
              {
                slug: 'api-related-one',
                title: 'API Related One',
                summary: 'First API relation.',
                category: { slug: 'linear-algebra', label: 'Linear Algebra', postCount: 3 },
                tags: [{ slug: 'api', label: 'API', postCount: 3 }],
                publishedAt: '2026-01-20T00:00:00.000Z',
                readingMinutes: 4,
                seoTitle: null,
                seoDescription: null,
              },
              {
                slug: 'api-related-two',
                title: 'API Related Two',
                summary: 'Second API relation.',
                category: { slug: 'linear-algebra', label: 'Linear Algebra', postCount: 3 },
                tags: [{ slug: 'api', label: 'API', postCount: 3 }],
                publishedAt: '2026-01-18T00:00:00.000Z',
                readingMinutes: 3,
                seoTitle: null,
                seoDescription: null,
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderAt('/posts/api-source');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'API Source Article' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /上一篇.*API Related One/ })).toHaveAttribute(
      'href',
      '/posts/api-related-one',
    );
    expect(screen.getByRole('link', { name: /下一篇.*API Related Two/ })).toHaveAttribute(
      'href',
      '/posts/api-related-two',
    );
    expect(screen.queryByText(/内容服务暂时不可用/)).not.toBeInTheDocument();
  });

  it('defines responsive reader and reduced-motion progress styles', () => {
    const readingCss = readFileSync(resolve(process.cwd(), 'src/styles/reading.css'), 'utf8');
    const motionCss = readFileSync(resolve(process.cwd(), 'src/styles/motion.css'), 'utf8');

    expect(readingCss).toContain('var(--reading-max)');
    expect(readingCss).toContain('@media (max-width: 47.99rem)');
    expect(readingCss).toContain("@import 'highlight.js/styles/github-dark.css'");
    const highlightTheme = readFileSync(
      resolve(process.cwd(), 'node_modules/highlight.js/styles/github-dark.css'),
      'utf8',
    );
    expect(highlightTheme).toMatch(/\.hljs-keyword[\s\S]*?color:/);
    expect(readingCss).toMatch(
      /\.markdown-body \.katex-display\s*{[\s\S]*?max-width:\s*100%[\s\S]*?overflow-x:\s*auto/,
    );
    expect(readingCss).toMatch(
      /\.table-of-contents a\[aria-current='location'\]\s*{[\s\S]*?border-left:/,
    );
    expect(readingCss).toMatch(
      /\.markdown-body > table\s*{[\s\S]*?border-radius:[\s\S]*?box-shadow:/,
    );
    expect(motionCss).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*reading-progress/);
    expect(motionCss).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*scroll-behavior:\s*auto/);
  });
});
