import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { NotesPage } from './NotesPage';
import { KnowledgeNotesRoute } from '../knowledge/KnowledgeNotesRoute';
import { emptyNotesFixture, notesFixture } from './fixtures';
import type { NotesViewModel, NoteCardViewModel } from './fixtures';
import * as knowledgeApi from '../knowledge/knowledge-api';

const richNotesFixture: NotesViewModel = {
  searchTerm: '',
  filterLabel: '全部文章',
  notes: [
    {
      id: 'note-1',
      title: '分布式共识推导',
      summary: '从 Paxos 到 Raft 的工程实践与推导。',
      category: '系统设计',
      updatedLabel: '2026-10-01 14:20',
      pinned: true,
      status: 'draft',
    },
    {
      id: 'note-2',
      title: '网络协议底层探秘',
      summary: 'TCP 拥塞控制与 QUIC 协议优化。',
      category: '网络协议',
      updatedLabel: '2026-09-28 10:15',
      status: 'published',
    },
    {
      id: 'note-3',
      title: '前端架构演进史',
      summary: '从 MVC 到微前端与 Islands 架构。',
      category: '前端架构',
      updatedLabel: '2026-09-20 09:00',
      archived: true,
      status: 'archived',
    },
  ],
};

describe('NotesPage Component', () => {
  it('renders status tabs with counts and marks the active tab', () => {
    const onTabChange = vi.fn();
    render(
      <MemoryRouter>
        <NotesPage
          model={richNotesFixture}
          tab="draft"
          onTabChange={onTabChange}
          tabCounts={{ all: 24, draft: 3, published: 18, archived: 3 }}
        />
      </MemoryRouter>,
    );

    const tablist = screen.getByRole('tablist', { name: '文章状态分组' });
    expect(tablist).toBeInTheDocument();

    const allTab = screen.getByRole('tab', { name: /全部/ });
    const draftTab = screen.getByRole('tab', { name: /草稿/ });
    const publishedTab = screen.getByRole('tab', { name: /已发布/ });
    const archivedTab = screen.getByRole('tab', { name: /已归档/ });

    expect(allTab).toHaveAttribute('aria-selected', 'false');
    expect(draftTab).toHaveAttribute('aria-selected', 'true');
    expect(draftTab).toHaveTextContent('3');
    expect(allTab).toHaveTextContent('24');
    expect(publishedTab).toHaveTextContent('18');
    expect(archivedTab).toHaveTextContent('3');

    fireEvent.click(publishedTab);
    expect(onTabChange).toHaveBeenCalledWith('published');
  });

  it('renders filter controls and handles change events', () => {
    const onSearchChange = vi.fn();
    const onClearSearch = vi.fn();
    const onCategoryChange = vi.fn();
    const onSortChange = vi.fn();
    const onPinnedChange = vi.fn();
    const onFeaturedChange = vi.fn();

    render(
      <MemoryRouter>
        <NotesPage
          model={{ ...richNotesFixture, searchTerm: '分布式' }}
          category="系统设计"
          sort="updated_desc"
          pinned={false}
          featured={false}
          onSearchChange={onSearchChange}
          onClearSearch={onClearSearch}
          onCategoryChange={onCategoryChange}
          onSortChange={onSortChange}
          onPinnedChange={onPinnedChange}
          onFeaturedChange={onFeaturedChange}
        />
      </MemoryRouter>,
    );

    const searchInput = screen.getByLabelText('搜索文章');
    expect(searchInput).toHaveValue('分布式');
    fireEvent.change(searchInput, { target: { value: '网络' } });
    expect(onSearchChange).toHaveBeenCalledWith('网络');

    const clearButton = screen.getByRole('button', { name: '清除搜索' });
    expect(clearButton).not.toBeDisabled();
    fireEvent.click(clearButton);
    expect(onClearSearch).toHaveBeenCalled();

    const categorySelect = screen.getByLabelText('按分类筛选');
    fireEvent.change(categorySelect, { target: { value: '网络协议' } });
    expect(onCategoryChange).toHaveBeenCalledWith('网络协议');

    const sortSelect = screen.getByLabelText('排序方式');
    fireEvent.change(sortSelect, { target: { value: 'title_asc' } });
    expect(onSortChange).toHaveBeenCalledWith('title_asc');

    const pinnedToggle = screen.getByLabelText('仅看置顶');
    fireEvent.click(pinnedToggle);
    expect(onPinnedChange).toHaveBeenCalledWith(true);

    const featuredToggle = screen.getByLabelText('仅看精选');
    fireEvent.click(featuredToggle);
    expect(onFeaturedChange).toHaveBeenCalledWith(true);
  });

  it('renders high-density data table with clean independent action buttons', () => {
    const onArchive = vi.fn();
    const onRestore = vi.fn();

    render(
      <MemoryRouter>
        <NotesPage model={richNotesFixture} onArchive={onArchive} onRestore={onRestore} />
      </MemoryRouter>,
    );

    // Table headers
    expect(screen.getByRole('table', { name: '文章列表' })).toBeInTheDocument();
    expect(screen.getByText('文章标题与摘要')).toBeInTheDocument();
    expect(screen.getByText('分类')).toBeInTheDocument();
    expect(screen.getByText('状态与标记')).toBeInTheDocument();
    expect(screen.getByText('最后更新时间')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();

    // Clicking title links to edit page
    const titleLink = screen.getByRole('link', { name: '分布式共识推导' });
    expect(titleLink).toHaveAttribute('href', '/knowledge/notes/note-1');

    // Clean independent action buttons
    const editButtons = screen.getAllByRole('link', { name: /^编辑 / });
    expect(editButtons[0]).toHaveTextContent('编辑');
    expect(editButtons[0]).toHaveAttribute('href', '/knowledge/notes/note-1');

    const readButtons = screen.getAllByRole('link', { name: /^阅读 / });
    expect(readButtons[0]).toHaveTextContent('阅读');
    expect(readButtons[0]).toHaveAttribute('href', '/knowledge/notes/note-1/read');

    const archiveButton = screen.getByRole('button', { name: '归档 分布式共识推导' });
    expect(archiveButton).toHaveTextContent('归档');
    fireEvent.click(archiveButton);
    expect(onArchive).toHaveBeenCalledWith('note-1');

    const restoreButton = screen.getByRole('button', { name: '恢复 前端架构演进史' });
    expect(restoreButton).toHaveTextContent('恢复');
    fireEvent.click(restoreButton);
    expect(onRestore).toHaveBeenCalledWith('note-3');
  });

  it('manages row selection and displays floating batch action bar', () => {
    const onBatchArchive = vi.fn();
    const onBatchRestore = vi.fn();
    const onBatchCategoryChange = vi.fn();

    render(
      <MemoryRouter>
        <NotesPage
          model={richNotesFixture}
          onBatchArchive={onBatchArchive}
          onBatchRestore={onBatchRestore}
          onBatchCategoryChange={onBatchCategoryChange}
        />
      </MemoryRouter>,
    );

    // Check row 1
    const note1Checkbox = screen.getByLabelText('选择文章 分布式共识推导');
    expect(note1Checkbox).not.toBeChecked();

    fireEvent.click(note1Checkbox);
    expect(note1Checkbox).toBeChecked();

    // Floating bar appears
    expect(screen.getByRole('toolbar', { name: '批量管理操作栏' })).toBeInTheDocument();
    expect(screen.getByText(/已选中/)).toHaveTextContent('已选中 1 篇文章');

    // Batch actions available
    const batchArchiveBtn = screen.getByRole('button', { name: '批量归档' });
    fireEvent.click(batchArchiveBtn);
    expect(onBatchArchive).toHaveBeenCalledWith(['note-1']);

    // Check row 3 (archived)
    const note3Checkbox = screen.getByLabelText('选择文章 前端架构演进史');
    fireEvent.click(note3Checkbox);
    expect(screen.getByText(/已选中/)).toHaveTextContent('已选中 2 篇文章');

    const batchRestoreBtn = screen.getByRole('button', { name: '批量恢复' });
    fireEvent.click(batchRestoreBtn);
    expect(onBatchRestore).toHaveBeenCalledWith(['note-1', 'note-3']);

    // Batch category change
    const categorySelect = screen.getByLabelText('批量调整分类');
    fireEvent.change(categorySelect, { target: { value: '系统设计' } });
    expect(onBatchCategoryChange).toHaveBeenCalledWith(['note-1', 'note-3'], '系统设计');

    // Cancel selection
    const cancelBtn = screen.getByRole('button', { name: '取消选择' });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole('toolbar', { name: '批量管理操作栏' })).not.toBeInTheDocument();
  });

  it('displays item-by-item batch feedback and allows retrying failed items (LIST-04)', () => {
    const onRetryBatch = vi.fn();
    const onRetrySingle = vi.fn();
    const onClearBatchResult = vi.fn();

    render(
      <MemoryRouter>
        <NotesPage
          model={richNotesFixture}
          selectedIds={['note-2']}
          batchResult={{
            total: 3,
            succeeded: ['note-1', 'note-3'],
            failed: [
              {
                id: 'note-2',
                title: '网络协议底层探秘',
                error: '发生并发冲突，文档正在被另一进程编辑',
              },
            ],
            actionType: 'archive',
          }}
          onRetryBatch={onRetryBatch}
          onRetrySingle={onRetrySingle}
          onClearBatchResult={onClearBatchResult}
        />
      </MemoryRouter>,
    );

    // Feedback banner shows explicit success and failure count
    const feedback = screen.getByRole('region', { name: '批量操作反馈' });
    expect(feedback).toBeInTheDocument();
    expect(within(feedback).getByText(/批量归档完成：2 篇成功，1 篇失败/)).toBeInTheDocument();
    expect(within(feedback).getByText(/网络协议底层探秘/)).toBeInTheDocument();
    expect(within(feedback).getByText(/发生并发冲突/)).toBeInTheDocument();

    // Failed item remains checked
    const note2Checkbox = screen.getByLabelText('选择文章 网络协议底层探秘');
    expect(note2Checkbox).toBeChecked();

    // Retrying failed items
    const retryBatchBtn = screen.getByRole('button', { name: '重试失败项' });
    fireEvent.click(retryBatchBtn);
    expect(onRetryBatch).toHaveBeenCalled();

    const retrySingleBtn = screen.getByRole('button', { name: '重试' });
    fireEvent.click(retrySingleBtn);
    expect(onRetrySingle).toHaveBeenCalledWith('note-2');

    const closeBtn = screen.getByRole('button', { name: '关闭批量操作反馈' });
    fireEvent.click(closeBtn);
    expect(onClearBatchResult).toHaveBeenCalled();
  });

  it('distinguishes between global empty state and filter/search empty state (LIST-02)', () => {
    const onResetFilters = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <NotesPage model={emptyNotesFixture} state="empty" />
      </MemoryRouter>,
    );

    // Global empty state
    expect(screen.getByRole('heading', { name: '知识库暂无文章' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '新建第一篇文章' })).toHaveAttribute(
      'href',
      '/knowledge/notes/new',
    );
    expect(screen.getByRole('link', { name: '导入 Markdown 文档' })).toHaveAttribute(
      'href',
      '/knowledge/import',
    );

    // Filter/search empty state
    rerender(
      <MemoryRouter>
        <NotesPage
          model={{ searchTerm: '不存在的词', filterLabel: '', notes: [] }}
          state="empty"
          onResetFilters={onResetFilters}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '未找到匹配的搜索结果' })).toBeInTheDocument();
    expect(screen.queryByText('知识库暂无文章')).not.toBeInTheDocument();

    const clearFiltersBtn = screen.getByRole('button', { name: '清除筛选条件' });
    fireEvent.click(clearFiltersBtn);
    expect(onResetFilters).toHaveBeenCalled();
  });

  it('renders undoable Toast on archive and restore messages', () => {
    const onUndo = vi.fn();
    const onClearToast = vi.fn();

    const { rerender } = render(
      <MemoryRouter>
        <NotesPage
          model={richNotesFixture}
          toast={{ text: '文章已归档', actionLabel: '撤销', onAction: onUndo }}
          onClearToast={onClearToast}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('文章已归档');
    const undoBtn = screen.getByRole('button', { name: '撤销' });
    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalled();

    rerender(
      <MemoryRouter>
        <NotesPage
          model={richNotesFixture}
          toast={{ text: '已恢复为草稿' }}
          onClearToast={onClearToast}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('已恢复为草稿');
  });

  it('renders pagination controls and handles page changes', () => {
    const onPageChange = vi.fn();
    render(
      <MemoryRouter>
        <NotesPage
          model={richNotesFixture}
          page={2}
          totalPages={5}
          totalItems={95}
          onPageChange={onPageChange}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/第 2 \/ 5 页（共 95 篇文章）/)).toBeInTheDocument();
    const prevBtn = screen.getByRole('button', { name: '← 上一页' });
    const nextBtn = screen.getByRole('button', { name: '下一页 →' });

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});

describe('KnowledgeNotesRoute URL Two-Way Binding & Integration (LIST-01, LIST-03)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(knowledgeApi, 'loadKnowledgeStats').mockResolvedValue({
      total: 24,
      draft: 3,
      published: 18,
      archived: 3,
      pinned: 2,
      roadmapProgress: 50,
    });
    vi.spyOn(knowledgeApi, 'loadKnowledgeNotes').mockResolvedValue({
      items: [
        {
          id: 'note-a',
          title: '架构设计笔记',
          slug: 'arch-note',
          summary: '微服务架构考量',
          category: '系统设计',
          contentJson: '{}',
          contentText: '微服务架构考量',
          status: 'draft',
          isPinned: true,
          reviewCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastReviewedAt: null,
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('initializes tab, category, and search state from URL query parameters (LIST-01)', async () => {
    render(
      <MemoryRouter initialEntries={['/knowledge/notes?tab=draft&category=系统设计&q=架构']}>
        <Routes>
          <Route path="/knowledge/notes" element={<KnowledgeNotesRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    // Assert loadKnowledgeNotes was called with URL parameters
    expect(knowledgeApi.loadKnowledgeNotes).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'draft',
        category: '系统设计',
        q: '架构',
      }),
    );
  });

  it('automatically falls back to previous page when the last item on page > 1 is archived (LIST-03)', async () => {
    vi.spyOn(knowledgeApi, 'loadKnowledgeNotes').mockResolvedValue({
      items: [
        {
          id: 'note-last',
          title: '末项文章',
          slug: 'last-note',
          summary: '第2页唯一的文章',
          category: '系统设计',
          contentJson: '{}',
          contentText: '第2页唯一的文章',
          status: 'draft',
          isPinned: false,
          reviewCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastReviewedAt: null,
        },
      ],
      page: 2,
      pageSize: 10,
      totalItems: 11,
      totalPages: 2,
    });
    const archiveMock = vi.spyOn(knowledgeApi, 'archiveKnowledgeNote').mockResolvedValue({} as never);

    render(
      <MemoryRouter initialEntries={['/knowledge/notes?tab=draft&page=2']}>
        <Routes>
          <Route path="/knowledge/notes" element={<KnowledgeNotesRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for the note to render
    const archiveBtn = await screen.findByRole('button', { name: '归档 末项文章' });
    expect(archiveBtn).toBeInTheDocument();

    fireEvent.click(archiveBtn);
    expect(archiveMock).toHaveBeenCalledWith('note-last');
  });
});
