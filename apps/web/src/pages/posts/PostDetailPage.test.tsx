import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as gateway from '../../content/contentGateway';
import { AppRoutes } from '../../router';
import { getAllPosts } from '../../content/contentQueries';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

function renderWithEntry(entry: string | { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry as never]}>
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
  it('shows the article before a slow adjacent navigation query completes', async () => {
    let finish!: (value: Awaited<ReturnType<typeof gateway.getPostNeighbors>>) => void;
    vi.spyOn(gateway, 'getPostNeighbors').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderAt('/posts/discrete-convolution');
    expect(await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' }, { timeout: 5000 })).toBeInTheDocument();
    finish({ source: 'api', data: { previous: { ...getAllPosts()[0]!, slug: 'previous', title: 'Previous article' }, next: undefined } });
    expect(await screen.findByRole('link', { name: /上一篇.*Previous article/ })).toHaveAttribute('href', '/posts/previous');
  });

  afterEach(() => {
    document.title = '';
    document.head.querySelector('meta[name="description"]')?.remove();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders the repository article, metadata, reader region, and stable adjacent navigation', async () => {
    renderAt('/posts/discrete-convolution');

    expect(
      await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('离散信号的卷积曲线')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回上一级' })).toHaveAttribute('href', '/posts');
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
    await waitFor(() => expect(document.querySelector('#从冲激响应出发')).toHaveTextContent('从冲激响应出发'), {
      timeout: 5000,
    });
    expect(document.querySelector('#用索引表检查求和')).toHaveTextContent('用索引表检查求和');
    expect(await screen.findByRole('link', { name: /上一篇.*从秩理解矩阵的结构/ })).toHaveAttribute(
      'href',
      '/posts/matrix-rank',
    );
    expect(await screen.findByRole('link', { name: /下一篇.*周期信号分析的三个检查点/ })).toHaveAttribute(
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

    await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' }, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: '打开缺失文章' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: '未找到文章' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '浏览全部文章' })).toHaveAttribute('href', '/posts');
    await waitFor(() => expect(document.title).toBe('未找到文章 | Namdw 的技术笔记'));

    await user.click(screen.getByRole('button', { name: '打开卷积文章' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('离散卷积与系统响应 | Namdw 的技术笔记'));
  });

  it('uses ordered API articles instead of related posts for navigation', async () => {
    const apiSummary = (slug: string, title: string) => ({
      slug, title, summary: title,
      category: { slug: 'notes', label: 'Notes', postCount: 3 }, tags: [],
      publishedAt: '2026-02-01T00:00:00Z', readingMinutes: 5,
      seoTitle: null, seoDescription: null,
    });
    const current = apiSummary('api-source', 'API Source Article');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/content/posts/api-source')) {
        return Response.json({ data: {
          ...current, body: '## API Body',
          relatedPosts: [apiSummary('unrelated', 'Unrelated Article')],
        } });
      }
      if (String(input).includes('/content/posts')) {
        return Response.json({ data: {
          items: [apiSummary('newer', 'Newer Article'), current, apiSummary('older', 'Older Article')],
          page: 1, pageSize: 24, totalItems: 3, totalPages: 1,
        } });
      }
      return Response.json({ success: true, data: [] });
    });
    renderAt('/posts/api-source');
    await screen.findByRole('heading', { level: 1, name: 'API Source Article' });
    expect(await screen.findByRole('link', { name: /上一篇.*Newer Article/ })).toHaveAttribute('href', '/posts/newer');
    expect(await screen.findByRole('link', { name: /下一篇.*Older Article/ })).toHaveAttribute('href', '/posts/older');
    expect(screen.queryByRole('link', { name: /Unrelated Article/ })).not.toBeInTheDocument();
  });

  it.each(['first', 'last'])('hides the missing direction for the %s production article', async (boundary) => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_BASE_URL', '');
    const posts = getAllPosts();
    const post = boundary === 'first' ? posts[0]! : posts.at(-1)!;
    renderAt('/posts/' + post.slug);
    await screen.findByRole('heading', { level: 1, name: post.title });
    const nav = await screen.findByRole('navigation', { name: '相邻文章' });
    expect(within(nav).getAllByRole('link')).toHaveLength(1);
    expect(within(nav).queryByRole('link', { name: boundary === 'first' ? /上一篇/ : /下一篇/ })).not.toBeInTheDocument();
  });

  it('follows the next article and retains the filtered list return path', async () => {
    const user = userEvent.setup();
    renderWithEntry({ pathname: '/posts/discrete-convolution', state: {
      kind: 'post_list', fromPath: '/posts?year=2025&page=2', fromLabel: '← 返回文章列表',
    } });
    await user.click(await screen.findByRole('link', { name: /下一篇.*周期信号分析/ }));
    await screen.findByRole('heading', { level: 1, name: '周期信号分析的三个检查点' });
    expect(screen.getByTestId('top-return-link')).toHaveAttribute('href', '/posts?year=2025&page=2');
  });

  it('defines responsive reader and reduced-motion progress styles', () => {
    const readingCss = readFileSync(resolve(process.cwd(), 'src/styles/reading.css'), 'utf8');
    const motionCss = readFileSync(resolve(process.cwd(), 'src/styles/motion.css'), 'utf8');

    expect(readingCss).toContain('var(--reader-body-width)');
    expect(readingCss).toMatch(/--reader-body-width:\s*46rem/);
    expect(readingCss).toMatch(
      /\.post-detail__layout\s*{[\s\S]*?grid-template-columns:[\s\S]*?var\(--reader-body-width\)/,
    );
    expect(readingCss).toMatch(
      /\.markdown-body\s*{[\s\S]*?max-width:\s*var\(--reader-body-width\)/,
    );
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

  describe('NAV-01: Return to search result with query, page, and scroll restoration', () => {
    it('renders return link reflecting search source and retains state for scroll restoration', async () => {
      const searchState = {
        kind: 'search',
        fromPath: '/search?q=%E7%B3%BB%E7%BB%9F&page=2',
        fromLabel: '← 返回搜索结果 "系统"',
        scrollY: 400,
      };

      renderWithEntry({
        pathname: '/posts/discrete-convolution',
        state: searchState,
      });

      expect(
        await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' }, { timeout: 5000 }),
      ).toBeInTheDocument();

      const topReturnLink = screen.getByTestId('top-return-link');
      expect(topReturnLink).toHaveTextContent('← 返回搜索结果 "系统"');
      expect(topReturnLink).toHaveAttribute('href', '/search?q=%E7%B3%BB%E7%BB%9F&page=2');

      const bottomReturnLink = screen.getByTestId('bottom-return-link');
      expect(bottomReturnLink).toHaveAttribute('href', '/search?q=%E7%B3%BB%E7%BB%9F&page=2');
    });
  });

  describe('NAV-02: Adjacent post continuous pagination with rootSource and hopCount', () => {
    it('propagates rootSource across adjacent navigation and renders continuous reading return bar', async () => {
      const taxonomySource = {
        kind: 'taxonomy',
        fromPath: '/categories/engineering',
        fromLabel: '← 返回分类 [工程实践]',
        scrollY: 180,
      };

      // 1. Initial entry from taxonomy list (hopCount = 0)
      const { unmount } = renderWithEntry({
        pathname: '/posts/discrete-convolution',
        state: taxonomySource,
      });

      expect(
        await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' }, { timeout: 5000 }),
      ).toBeInTheDocument();

      const nextPostLink = await screen.findByRole('link', { name: /下一篇.*周期信号分析的三个检查点/ });
      expect(nextPostLink).toBeInTheDocument();

      unmount();

      // 2. Next post with hopCount: 1 and propagated rootSource
      renderWithEntry({
        pathname: '/posts/signal-period-analysis',
        state: {
          kind: 'taxonomy',
          fromPath: '/posts/discrete-convolution',
          fromLabel: '上一篇文章',
          scrollY: 100,
          hopCount: 1,
          rootSource: taxonomySource,
        },
      });

      expect(
        await screen.findByRole('heading', { level: 1, name: '周期信号分析的三个检查点' }),
      ).toBeInTheDocument();

      // Top return still points to root taxonomy source
      const topLink = screen.getByTestId('top-return-link');
      expect(topLink).toHaveTextContent('← 返回分类 [工程实践]');
      expect(topLink).toHaveAttribute('href', '/categories/engineering');

      // Bottom return bar displays continuous reading notice with direct root return
      const rootReturnLink = screen.getByTestId('bottom-root-return-link');
      expect(screen.getByText(/已在文章间连续阅读 1 篇/)).toBeInTheDocument();
      expect(rootReturnLink).toHaveTextContent('直接返回最初来源: 返回分类 [工程实践]');
      expect(rootReturnLink).toHaveAttribute('href', '/categories/engineering');
    });
  });

  describe('NAV-03: Direct access or external referrer fallback', () => {
    it('falls back safely to /posts with default label when state is empty or absent', async () => {
      renderWithEntry('/posts/discrete-convolution');

      expect(
        await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' }, { timeout: 5000 }),
      ).toBeInTheDocument();

      const topReturnLink = screen.getByTestId('top-return-link');
      expect(topReturnLink).toHaveTextContent('← 返回文章列表');
      expect(topReturnLink).toHaveAttribute('href', '/posts');

      const bottomReturnLink = screen.getByTestId('bottom-return-link');
      expect(bottomReturnLink).toHaveTextContent('← 返回文章列表');
      expect(bottomReturnLink).toHaveAttribute('href', '/posts');
    });

    it('sanitizes malicious or external URLs and reverts to safe fallback /posts', async () => {
      renderWithEntry({
        pathname: '/posts/discrete-convolution',
        state: {
          kind: 'search',
          fromPath: 'https://malicious-site.com/steal',
          fromLabel: '恶意来源',
        },
      });

      expect(
        await screen.findByRole('heading', { level: 1, name: '从卷积公式理解离散系统的响应' }, { timeout: 5000 }),
      ).toBeInTheDocument();

      const topReturnLink = screen.getByTestId('top-return-link');
      expect(topReturnLink).toHaveTextContent('← 返回文章列表');
      expect(topReturnLink).toHaveAttribute('href', '/posts');
    });
  });

  describe('NAV-04: Knowledge note read view source identification and preview return', () => {
    it('returns to editor workbench when opened from editor preview', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/auth/session')) return Response.json({success:true,data:{authenticated:true}});
        if (urlStr.includes('/api/notes/draft-nav-test')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                id: 'draft-nav-test',
                title: '草稿预览文章',
                summary: '未发布草稿摘要',
                category: '系统架构',
                status: 'draft',
                slug: 'draft-nav-test',
                contentJson: JSON.stringify({ type: 'doc', content: [] }),
                contentText: '未发布草稿正文',
                reviewCount: 0,
                createdAt: '2026-10-01T12:00:00.000Z',
                updatedAt: '2026-10-01T12:00:00.000Z',
                lastReviewedAt: null,
                isFeatured: false,
                isPinned: false,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (urlStr.includes('/api/assets')) {
          return new Response(
            JSON.stringify({ success: true, data: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 200 });
      });

      renderWithEntry({
        pathname: '/knowledge/notes/draft-nav-test/read',
        state: {
          kind: 'editor_preview',
          fromPath: '/knowledge/notes/draft-nav-test',
          fromLabel: '← 返回正在编辑的文章',
        },
      });

      expect(await screen.findByRole('heading', { level: 1, name: '草稿预览文章' })).toBeInTheDocument();

      const returnLink = screen.getByTestId('knowledge-read-return-link');
      expect(returnLink).toHaveTextContent('← 返回正在编辑的文章');
      expect(returnLink).toHaveAttribute('href', '/knowledge/notes/draft-nav-test');
    });

    it('returns to notes list and displays sanitized action when opened from list or directly', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/auth/session')) return Response.json({success:true,data:{authenticated:true}});
        if (urlStr.includes('/api/notes/published-nav-test')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                id: 'published-nav-test',
                title: '已发布知识库文章',
                summary: '已发布内容摘要',
                category: '工程实践',
                status: 'published',
                slug: 'published-nav-test',
                contentJson: JSON.stringify({ type: 'doc', content: [] }),
                contentText: '已发布正文',
                reviewCount: 0,
                createdAt: '2026-10-01T12:00:00.000Z',
                updatedAt: '2026-10-01T12:00:00.000Z',
                lastReviewedAt: null,
                isFeatured: true,
                isPinned: false,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (urlStr.includes('/api/assets')) {
          return new Response(
            JSON.stringify({ success: true, data: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 200 });
      });

      renderWithEntry('/knowledge/notes/published-nav-test/read');

      expect(await screen.findByRole('heading', { level: 1, name: '已发布知识库文章' })).toBeInTheDocument();

      const returnLink = screen.getByTestId('knowledge-read-return-link');
      expect(returnLink).toHaveTextContent('← 返回文章列表');
      expect(returnLink).toHaveAttribute('href', '/knowledge/notes');

      // Verify sanitized "查看文章 ↗" action (replacing legacy "查看公开文章 ↗")
      expect(screen.getByRole('link', { name: '查看文章 ↗' })).toHaveAttribute(
        'href',
        '/posts/published-nav-test',
      );
      expect(screen.queryByText(/查看公开文章/)).not.toBeInTheDocument();
    });
  });

  describe('Phase 3 Optimizations: Lazy loading and Cover Image attributes', () => {
    it('renders post cover image with eager loading and async decoding', async () => {
      const mockPost = {
        ...getAllPosts()[0]!,
        slug: 'cover-test-post',
        cover: {
          image: '/content-media/cover-test.png',
          alt: 'Cover test image',
          tone: 'blue' as const,
        },
      };

      vi.spyOn(gateway, 'getPostBySlug').mockResolvedValue({
        source: 'api',
        data: mockPost,
      });

      renderAt('/posts/cover-test-post');

      const coverImg = await screen.findByRole('img', { name: 'Cover test image' });
      expect(coverImg).toHaveAttribute('src', '/content-media/cover-test.png');
      expect(coverImg).toHaveAttribute('loading', 'eager');
      expect(coverImg).toHaveAttribute('decoding', 'async');
    });
  });
});
