import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { DashboardPage } from './DashboardPage';
import { KnowledgeShell } from './KnowledgeShell';
import { NotesPage } from './NotesPage';
import { dashboardFixture, emptyNotesFixture, notesFixture } from './fixtures';

describe('knowledge presentation shell', () => {
  it('provides overview, articles, import, and new article navigation without Settings placeholder or nested main', () => {
    render(
      <MemoryRouter>
        <KnowledgeShell title="知识库工作区">
          <p>Runtime content</p>
        </KnowledgeShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: '知识库工作区' })).toHaveTextContent(
      'Runtime content',
    );
    expect(screen.getByRole('link', { name: '知识库概览' })).toHaveAttribute('href', '/knowledge');
    expect(screen.getByRole('link', { name: '文章管理' })).toHaveAttribute(
      'href',
      '/knowledge/notes',
    );
    expect(screen.getByRole('link', { name: '导入 Markdown' })).toHaveAttribute(
      'href',
      '/knowledge/import',
    );
    expect(screen.getByRole('link', { name: '新建文章' })).toHaveAttribute(
      'href',
      '/knowledge/notes/new',
    );
    // Settings placeholder is completely removed
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('设置')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('main')).toHaveLength(0);
  });

  it('opens and closes the mobile knowledge navigation with Chinese labels', () => {
    render(
      <MemoryRouter>
        <KnowledgeShell title="知识库工作区">
          <p>Runtime content</p>
        </KnowledgeShell>
      </MemoryRouter>,
    );

    const toggle = screen.getByRole('button', { name: '打开知识库导航' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: '知识库导航' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '关闭知识库导航' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders dashboard statistics with accessible heading and clickable links', () => {
    render(
      <MemoryRouter>
        <DashboardPage model={dashboardFixture} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    expect(screen.getByText('Total notes')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    // Statistics are clickable links
    const statLinks = screen.getAllByRole('link', { name: /Total notes|In progress|Pinned|Roadmap/i });
    expect(statLinks.length).toBeGreaterThan(0);
  });

  it('exposes discoverable actions for creating, importing, and browsing notes', () => {
    render(
      <MemoryRouter>
        <DashboardPage model={dashboardFixture} />
      </MemoryRouter>,
    );

    const actions = screen.getByRole('navigation', { name: '知识库快捷操作' });
    expect(within(actions).getByRole('link', { name: '新建笔记' })).toHaveAttribute(
      'href',
      '/knowledge/notes/new',
    );
    expect(within(actions).getByRole('link', { name: '导入 Markdown' })).toHaveAttribute(
      'href',
      '/knowledge/import',
    );
    expect(within(actions).getByRole('link', { name: '查看全部笔记' })).toHaveAttribute(
      'href',
      '/knowledge/notes',
    );
  });

  it('renders static loading, empty, and error variants', () => {
    const { rerender } = render(
      <MemoryRouter>
        <NotesPage model={notesFixture} state="loading" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('正在加载文章列表…');

    rerender(
      <MemoryRouter>
        <NotesPage model={emptyNotesFixture} state="empty" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '知识库暂无文章' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '新建第一篇文章' })).toHaveAttribute(
      'href',
      '/knowledge/notes/new',
    );

    rerender(
      <MemoryRouter>
        <NotesPage model={notesFixture} state="error" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('文章列表加载失败');
  });

  it('presents pinned and archived notes in table with labelled search controls and clean actions', () => {
    render(
      <MemoryRouter>
        <NotesPage model={notesFixture} />
      </MemoryRouter>,
    );

    const pageActions = screen.getByRole('navigation', { name: '文章管理操作' });
    expect(within(pageActions).getByRole('link', { name: '新建文章' })).toHaveAttribute(
      'href',
      '/knowledge/notes/new',
    );
    expect(screen.getByLabelText('搜索文章')).toHaveAttribute(
      'placeholder',
      '搜索文章标题、摘要或正文…',
    );
    expect(screen.getByRole('button', { name: '清除搜索' })).toBeDisabled();
    expect(screen.getByText('📌 已置顶')).toBeInTheDocument();
    expect(screen.getAllByText('已归档').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Project retrospective')).toBeInTheDocument();
    expect(screen.getByText('Research archive')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Project retrospective' })).toHaveAttribute(
      'href',
      '/knowledge/notes/project-retrospective',
    );
    // Actions are clean independent buttons without long title concatenation
    expect(screen.getByRole('link', { name: '编辑 Project retrospective' })).toHaveTextContent('编辑');
  });

  it('exposes archive and restore actions without changing note links', () => {
    const onArchive = vi.fn();
    const onRestore = vi.fn();
    render(
      <MemoryRouter>
        <NotesPage model={notesFixture} onArchive={onArchive} onRestore={onRestore} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '归档 Project retrospective' }));
    fireEvent.click(screen.getByRole('button', { name: '恢复 Research archive' }));

    expect(onArchive).toHaveBeenCalledWith('project-retrospective');
    expect(onRestore).toHaveBeenCalledWith('research-archive');
    expect(screen.getByRole('link', { name: 'Project retrospective' })).toHaveAttribute(
      'href',
      '/knowledge/notes/project-retrospective',
    );
  });
});
