import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { listFeaturedContent } from './content/contentGateway';
import { AppRoutes } from './router';

type ContentQueriesModule = Record<string, unknown> & {
  listFeaturedContent: typeof listFeaturedContent;
};

vi.mock('./content/contentGateway', async (importOriginal) => {
  const actual = await importOriginal<ContentQueriesModule>();

  return { ...actual, listFeaturedContent: vi.fn(actual.listFeaturedContent) };
});

function RouteTransition() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/')}>
        返回首页
      </button>
      <AppRoutes />
    </>
  );
}

describe('App visual shell', () => {
  const routeLabels: Record<string, string> = {
    '/posts': '文章',
    '/categories': '分类',
    '/tags': '标签',
    '/archives': '归档',
    '/projects': '项目',
    '/about': '关于',
    '/search': '搜索',
  };

  it('renders the approved product-storytelling homepage structure', async () => {
    render(<App />);

    expect(screen.getByRole('link', { name: '跳到主要内容' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(
      screen.getByRole('heading', { level: 1, name: '让复杂知识，变得清晰。' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '浏览最新文章' })).toHaveAttribute('href', '/posts');
    expect(
      screen.getByRole('heading', { level: 2, name: '正在构建，也持续记录。' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 3, name: '智能冷链仓储系统' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '工程、学习与长期主义。' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('exposes every public route and a wildcard not-found page', () => {
    const paths = ['/posts', '/categories', '/tags', '/archives', '/projects', '/about', '/search'];
    for (const path of paths) {
      render(<App initialPath={path} />);
      expect(screen.getByRole('main')).toHaveTextContent(routeLabels[path]!);
      cleanup();
    }
    render(<App initialPath="/missing" />);
    expect(screen.getByRole('heading', { name: '页面不存在' })).toBeInTheDocument();
  });

  it('restores homepage metadata after navigating from a public page', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/posts']}>
        <RouteTransition />
      </MemoryRouter>,
    );

    expect(document.title).toBe('文章 | Namdw 的技术笔记');
    await user.click(screen.getByRole('button', { name: '返回首页' }));

    expect(document.title).toBe('Namdw 的技术笔记');
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    );
  });

  it('renders homepage cards from the shared content projection', async () => {
    vi.mocked(listFeaturedContent).mockResolvedValueOnce({
      data: [
        {
          kind: '项目',
          title: '来自共享查询的测试项目',
          summary: '此卡片只能由内容查询边界提供。',
          meta: 'Test · Query',
          href: '/projects/query-contract',
        },
      ],
      source: 'api',
    });

    render(<App initialPath="/" />);

    expect(await screen.findByRole('link', { name: /来自共享查询的测试项目/ })).toHaveAttribute(
      'href',
      '/projects/query-contract',
    );
  });

  it.each([
    [
      '/',
      '让复杂知识，变得清晰。',
      'Namdw 的技术笔记',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    ],
    [
      '/posts',
      '文章',
      '文章 | Namdw 的技术笔记',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    ],
    [
      '/posts/discrete-convolution',
      '从卷积公式理解离散系统的响应',
      '离散卷积与系统响应 | Namdw 的技术笔记',
      '从单位冲激分解出发，理解每一个输入样本如何共同构成当前输出。',
    ],
    [
      '/categories',
      '分类',
      '分类 | Namdw 的技术笔记',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    ],
    [
      '/categories/%E5%B5%8C%E5%85%A5%E5%BC%8F%E7%B3%BB%E7%BB%9F',
      '嵌入式系统',
      '分类 | Namdw 的技术笔记',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    ],
    [
      '/tags',
      '标签',
      '标签 | Namdw 的技术笔记',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    ],
    [
      '/tags/stm32',
      'STM32',
      '标签 | Namdw 的技术笔记',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    ],
    [
      '/archives',
      '归档',
      '归档 | Namdw 的技术笔记',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    ],
    ['/projects', '项目', '项目 | Namdw 的技术笔记', '记录从嵌入式系统到软件工程的实践项目。'],
    [
      '/projects/smart-cold-chain',
      '智能冷链仓储系统',
      '智能冷链仓储系统 | Namdw 的技术笔记',
      '从传感器、RFID 到云端物联网平台，把嵌入式系统连接成可观察的完整链路。',
    ],
    [
      '/projects/missing',
      '未找到项目',
      '未找到项目 | Namdw 的技术笔记',
      '这个项目不存在，或许已经被移除。',
    ],
    [
      '/about',
      '关于我',
      '关于我 | Namdw 的技术笔记',
      '一名持续学习电子信息、嵌入式系统与软件工程的实践者。',
    ],
    [
      '/search',
      '搜索',
      '搜索 | Namdw 的技术笔记',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    ],
    [
      '/missing',
      '页面不存在',
      '页面不存在 | Namdw 的技术笔记',
      '你访问的页面不存在，或许已经被移动。',
    ],
  ])(
    'keeps one main landmark, one page heading, and route metadata for %s',
    async (path, heading, title, description) => {
      render(<App initialPath={path} />);

      expect(screen.getAllByRole('main')).toHaveLength(1);
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      await waitFor(() => expect(document.title).toBe(title));
      expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
        'content',
        description,
      );
      cleanup();
    },
  );

  it.each([
    [
      '/POSTS',
      '文章',
      '文章 | Namdw 的技术笔记',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    ],
    [
      '/posts/',
      '文章',
      '文章 | Namdw 的技术笔记',
      '记录电子信息、嵌入式系统与工程实践中的学习和思考。',
    ],
    [
      '/POSTS/discrete-convolution/',
      '从卷积公式理解离散系统的响应',
      '离散卷积与系统响应 | Namdw 的技术笔记',
      '从单位冲激分解出发，理解每一个输入样本如何共同构成当前输出。',
    ],
    [
      '/POSTS/missing/',
      '未找到文章',
      '未找到文章 | Namdw 的技术笔记',
      '这篇文章不存在，或许已经被移动。',
    ],
    [
      '/posts/discrete-convolution/extra',
      '页面不存在',
      '页面不存在 | Namdw 的技术笔记',
      '你访问的页面不存在，或许已经被移动。',
    ],
  ])(
    'uses router-equivalent matching for metadata at %s',
    async (path, heading, title, description) => {
      render(<App initialPath={path} />);

      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      await waitFor(() => expect(document.title).toBe(title));
      expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
        'content',
        description,
      );
      cleanup();
    },
  );

  it('marks the current public navigation section for assistive technology', () => {
    render(<App initialPath="/projects/smart-cold-chain" />);

    for (const link of screen.getAllByRole('link', { name: '项目' })) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
  });
});
