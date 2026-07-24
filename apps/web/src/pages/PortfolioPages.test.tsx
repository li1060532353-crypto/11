import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from '../router';
import { siteContent } from '../content/site';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

function ProjectRouteNavigator() {
  const navigate = useNavigate();

  return (
    <nav aria-label="测试项目导航">
      <button type="button" onClick={() => navigate('/projects/missing')}>
        打开缺失项目
      </button>
      <button type="button" onClick={() => navigate('/projects/embedded-observability')}>
        打开可观测性项目
      </button>
    </nav>
  );
}

describe('portfolio pages', () => {
  it('renders every project with its technologies and safe optional external links', async () => {
    renderAt('/projects');

    expect(screen.getByRole('heading', { level: 1, name: '项目' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '智能冷链仓储系统' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '嵌入式可观测性工具箱' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '个人技术博客' })).toBeInTheDocument();
    expect(screen.getAllByText('STM32').length).toBeGreaterThan(0);
    expect(screen.getByText('FreeRTOS')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '智能冷链仓储系统' })).toHaveAttribute(
      'href',
      '/projects/smart-cold-chain',
    );
    expect(screen.getByRole('link', { name: '嵌入式可观测性工具箱' })).toHaveAttribute(
      'href',
      '/projects/embedded-observability',
    );
    expect(screen.getByRole('link', { name: '个人技术博客' })).toHaveAttribute(
      'href',
      '/projects/personal-blog',
    );

    const observability = screen.getByRole('article', { name: /嵌入式可观测性工具箱/ });
    expect(
      within(observability).getByRole('link', { name: '查看嵌入式可观测性工具箱源代码' }),
    ).toHaveAttribute('href', 'https://github.com/');
    expect(
      within(observability).getByRole('link', { name: '查看嵌入式可观测性工具箱源代码' }),
    ).toHaveAttribute('target', '_blank');
    expect(
      within(observability).getByRole('link', { name: '查看嵌入式可观测性工具箱源代码' }),
    ).toHaveAttribute('rel', 'noreferrer');
  });

  it('renders semantic about sections and contact links', () => {
    renderAt('/about');

    expect(screen.getByRole('heading', { level: 1, name: '关于我' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '关注方向' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '联系我' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '发送邮件给 Namdw' })).toHaveAttribute(
      'href',
      siteContent.about.contact.email,
    );
    expect(screen.getByRole('link', { name: '访问 Namdw 的 GitHub' })).toHaveAttribute(
      'href',
      siteContent.about.contact.github,
    );
    expect(screen.getByRole('link', { name: '访问 Namdw 的 GitHub' })).toHaveAttribute(
      'rel',
      'noreferrer',
    );
    expect(screen.getByRole('heading', { name: '自我介绍' }).closest('section')).toHaveClass(
      'about-page__statement',
    );
    expect(screen.getByRole('heading', { name: '关注方向' }).closest('section')).toHaveClass(
      'about-page__detail',
    );
  });

  it('renders a project detail from the content repository with metadata', async () => {
    renderAt('/projects/embedded-observability');

    expect(
      await screen.findByRole('heading', { level: 1, name: '嵌入式可观测性工具箱' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('为资源受限设备统一采样日志、指标和串口诊断，让现场问题可复现。'),
    ).toBeInTheDocument();
    expect(screen.getByText(/emit_metric/)).toBeInTheDocument();
    expect(screen.getByText('FreeRTOS')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看嵌入式可观测性工具箱源代码' })).toHaveAttribute(
      'rel',
      'noreferrer',
    );
    await waitFor(() => expect(document.title).toBe('嵌入式可观测性工具箱 | Namdw 的技术笔记'));
  });

  it('transitions between valid and missing project slugs without changing hook order', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/projects/embedded-observability']}>
        <ProjectRouteNavigator />
        <AppRoutes />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { level: 1, name: '嵌入式可观测性工具箱' });
    await user.click(screen.getByRole('button', { name: '打开缺失项目' }));
    expect(await screen.findByRole('heading', { name: '未找到项目' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('未找到项目 | Namdw 的技术笔记'));
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      '这个项目不存在，或许已经被移除。',
    );

    await user.click(screen.getByRole('button', { name: '打开可观测性项目' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: '嵌入式可观测性工具箱' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('嵌入式可观测性工具箱 | Namdw 的技术笔记'));
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      '为资源受限设备统一采样日志、指标和串口诊断，让现场问题可复现。',
    );
  });

  it('offers posts recovery from an unknown route', () => {
    renderAt('/missing');

    expect(screen.getByRole('heading', { level: 1, name: '页面不存在' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '浏览文章' })).toHaveAttribute('href', '/posts');
  });
});
