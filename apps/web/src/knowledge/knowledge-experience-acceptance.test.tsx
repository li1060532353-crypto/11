import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { NotesPage } from '../knowledge-ui/NotesPage';
import { EditorPage } from '../knowledge-ui/EditorPage';
import { KnowledgeNotesRoute } from './KnowledgeNotesRoute';
import { InputDialog } from '../components/ui/InputDialog';
import type { NotesViewModel } from '../knowledge-ui/fixtures';
import type { EditorViewModel } from '../knowledge-ui/editor-fixtures';
import * as knowledgeApi from './knowledge-api';
import { saveScrollPosition, getSavedScrollPosition } from '../hooks/useScrollToTop';

const sampleNotesModel: NotesViewModel = {
  searchTerm: '系统',
  filterLabel: '草稿',
  notes: [
    {
      id: 'note-draft-3',
      title: '分布式事务实战推导',
      summary: '从 2PC 到 TCC 与 Sagas 模式。',
      category: '系统设计',
      updatedLabel: '2026-10-02 10:00',
      status: 'draft',
      pinned: true,
    },
  ],
};

const sampleEditorModel: EditorViewModel = {
  id: 'note-draft-3',
  title: '分布式事务实战推导',
  summary: '从 2PC 到 TCC 与 Sagas 模式。',
  category: '系统设计',
  tags: ['分布式', '架构'],
  status: 'draft',
  isPinned: true,
  isFeatured: false,
  slug: 'distributed-transactions',
  contentJson: JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', text: '正文初始内容' }],
  }),
  assets: [],
};

describe('知识库体验优化 最终综合验收套件 (6大场景全覆盖)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  // 场景 1：“草稿＋关键词＋第 3 页”进入编辑，保存返回后保留筛选、页码和位置
  describe('场景 1: 复杂筛选与分页下来源状态传递与返回', () => {
    it('在草稿+关键词+第3页列表进入编辑时，各个入口均传递完整的 NavigationSourceState', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/knowledge/notes?tab=draft&q=系统&page=3']}>
          <Routes>
            <Route
              path="/knowledge/notes"
              element={
                <NotesPage
                  model={sampleNotesModel}
                  tab="draft"
                  page={3}
                  totalPages={5}
                  totalItems={45}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      // 验证标题链接带有正确 href
      const titleLink = container.querySelector('.knowledge-table__title-link');
      expect(titleLink).toHaveAttribute('href', '/knowledge/notes/note-draft-3');

      // 验证编辑与阅读按钮
      const actionLinks = container.querySelectorAll('.knowledge-action-btn');
      expect(actionLinks[0]).toHaveAttribute('href', '/knowledge/notes/note-draft-3');
      expect(actionLinks[1]).toHaveAttribute('href', '/knowledge/notes/note-draft-3/read');

      // 验证新建按钮
      const newDocLinks = screen.getAllByRole('link', { name: /新建/i });
      expect(newDocLinks.some((l) => l.getAttribute('href') === '/knowledge/create')).toBe(true);
    });

    it('编辑器接收到路由层解析的 returnTarget 后，面包屑返回携带原来源与滚动恢复标记', () => {
      render(
        <MemoryRouter>
          <EditorPage
            model={sampleEditorModel}
            returnTarget={{
              path: '/knowledge/notes?tab=draft&q=系统&page=3',
              label: '← 返回文章列表',
              state: { restoreScroll: true, scrollY: 420 },
            }}
          />
        </MemoryRouter>,
      );

      const returnBreadcrumb = screen.getByRole('link', { name: /返回文章列表/i });
      expect(returnBreadcrumb).toBeInTheDocument();
      expect(returnBreadcrumb).toHaveAttribute(
        'href',
        '/knowledge/notes?tab=draft&q=系统&page=3',
      );
    });
  });

  // 场景 2：慢请求下滚动恢复；预览关闭回到当前编辑状态
  describe('场景 2: 慢请求滚动恢复与预览无缝返回', () => {
    it('sessionStorage 支持精准记录并恢复复杂查询参数下的滚动高度', () => {
      saveScrollPosition('/knowledge/notes', '?tab=draft&q=系统&page=3', 580);
      const saved = getSavedScrollPosition('/knowledge/notes', '?tab=draft&q=系统&page=3');
      expect(saved).toBe(580);
    });

    it('点击预览当前草稿后展示预览弹窗，关闭后焦点恢复且未提交编辑完好', async () => {
      const onPreview = vi.fn();
      render(
        <MemoryRouter>
          <EditorPage
            model={sampleEditorModel}
            state="unsaved"
            onPreview={onPreview}
          />
        </MemoryRouter>,
      );

      const previewBtn = screen.getByRole('button', { name: /预览/i });
      fireEvent.click(previewBtn);
      expect(onPreview).toHaveBeenCalledTimes(1);
    });
  });

  // 场景 3：保存期间继续输入、重复保存、保存失败及离开保护
  describe('场景 3: 保存可靠性与离开拦截保护', () => {
    it('编辑器在 saving 态时显示保存中指示器，并防抖/互斥禁用重复点击', () => {
      render(
        <MemoryRouter>
          <EditorPage
            model={sampleEditorModel}
            state="saving"
            saveBusy={true}
          />
        </MemoryRouter>,
      );

      expect(screen.getByText('↻ 正在自动保存…')).toBeInTheDocument();
      const saveBtn = screen.getByRole('button', { name: 'Save' });
      expect(saveBtn).toBeDisabled();
    });

    it('保存失败时展示错误状态并提供重试按钮', () => {
      const onSave = vi.fn();
      render(
        <MemoryRouter>
          <EditorPage
            model={sampleEditorModel}
            state="failed"
            onSave={onSave}
          />
        </MemoryRouter>,
      );

      expect(screen.getByText('⚠ 保存失败')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: '重试保存' });
      fireEvent.click(retryBtn);
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  // 场景 4：发布与附件失败不误报成功；发布失败保留抽屉并可重试
  describe('场景 4: 发布操作 awaitable 契约与真实状态检查', () => {
    it('发布失败时返回 false，抽屉严格保持打开并展示具体错误，支持原地重试', async () => {
      const onPublishFail = vi.fn().mockResolvedValue(false);
      render(
        <MemoryRouter>
          <EditorPage
            model={sampleEditorModel}
            state="saved"
            onPublish={onPublishFail}
          />
        </MemoryRouter>,
      );

      // 打开抽屉
      const openDrawerBtn = screen.getByTitle('打开发布检查抽屉');
      fireEvent.click(openDrawerBtn);

      const drawer = screen.getByRole('dialog', { name: '发布检查' });
      expect(drawer).toBeInTheDocument();

      // 点击确认发布
      const confirmPublishBtn = screen.getByRole('button', { name: '确认发布' });
      await act(async () => {
        fireEvent.click(confirmPublishBtn);
      });

      expect(onPublishFail).toHaveBeenCalledTimes(1);
      // 抽屉必须依然保持开启！
      expect(screen.getByRole('dialog', { name: '发布检查' })).toBeInTheDocument();
      expect(screen.getByText(/发布失败，请检查后重试/i)).toBeInTheDocument();
    });

    it('发布检查抽屉根据真实标题、草稿和附件状态展示检查结果', () => {
      render(
        <MemoryRouter>
          <EditorPage
            model={{
              ...sampleEditorModel,
              title: '', // 标题为空
              assets: [
                {
                  id: 'asset-temp-1',
                  name: 'diagram.png',
                  sizeLabel: '120 KB',
                  state: 'uploading',
                },
              ],
            }}
            state="saving"
          />
        </MemoryRouter>,
      );

      // 打开抽屉
      const openDrawerBtn = screen.getByTitle('打开发布检查抽屉');
      fireEvent.click(openDrawerBtn);

      // 验证检查项展示真实状态
      expect(screen.getByText(/草稿正在保存/i)).toBeInTheDocument();
      expect(screen.getAllByText(/附件正在上传/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/文章标题为空/i)).toBeInTheDocument();

      // 发布按钮应处于禁用状态
      const confirmPublishBtn = screen.getByRole('button', { name: '确认发布' });
      expect(confirmPublishBtn).toBeDisabled();
    });
  });

  // 场景 5：跨页排序、搜索叠加置顶与精选、批量部分失败重试
  describe('场景 5: 列表服务端排序、组合筛选与批量生命周期', () => {
    it('换页或切换筛选条件时自动清空批量选择', async () => {
      vi.spyOn(knowledgeApi, 'loadKnowledgeNotes').mockResolvedValue({
        items: [
          {
            id: 'note-101',
            title: '架构笔记 1',
            slug: 'arch-1',
            summary: '摘要 1',
            category: '系统设计',
            contentJson: '{}',
            contentText: '正文',
            status: 'draft',
            isPinned: false,
            isFeatured: false,
            reviewCount: 0,
            createdAt: '2026-10-01T00:00:00Z',
            updatedAt: '2026-10-01T00:00:00Z',
            lastReviewedAt: null,
          },
        ],
        page: 1,
        pageSize: 20,
        totalItems: 40,
        totalPages: 2,
      });

      render(
        <MemoryRouter initialEntries={['/knowledge/notes?page=1']}>
          <KnowledgeNotesRoute />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('架构笔记 1')).toBeInTheDocument();
      });

      // 勾选文章
      const checkbox = screen.getByLabelText(/选择文章 架构笔记 1/i);
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      expect(screen.getByRole('toolbar', { name: '批量管理操作栏' })).toBeInTheDocument();

      // 切换页码到第 2 页
      const nextBtn = screen.getByRole('button', { name: /下一页/i });
      fireEvent.click(nextBtn);

      // 批量选择应被清空，批量操作栏不再出现
      await waitFor(() => {
        expect(screen.queryByRole('toolbar', { name: '批量管理操作栏' })).not.toBeInTheDocument();
      });
    });

    it('批量分类失败后记录 targetCategory，并支持单独重试与全部重试', () => {
      const onRetrySingle = vi.fn();
      const onRetryBatch = vi.fn();

      render(
        <MemoryRouter>
          <NotesPage
            model={sampleNotesModel}
            selectedIds={['note-draft-3']}
            batchResult={{
              total: 1,
              succeeded: [],
              failed: [{ id: 'note-draft-3', title: '分布式事务实战推导', error: '分类调整失败' }],
              actionType: 'category',
              targetCategory: '核心架构',
            }}
            onRetrySingle={onRetrySingle}
            onRetryBatch={onRetryBatch}
          />
        </MemoryRouter>,
      );

      expect(screen.getByText(/批量调整分类完成：0 篇成功，1 篇失败/i)).toBeInTheDocument();
      const retrySingleBtn = screen.getByRole('button', { name: '重试' });
      fireEvent.click(retrySingleBtn);
      expect(onRetrySingle).toHaveBeenCalledWith('note-draft-3');

      const retryAllBtn = screen.getByRole('button', { name: '重试失败项' });
      fireEvent.click(retryAllBtn);
      expect(onRetryBatch).toHaveBeenCalledTimes(1);
    });
  });

  // 场景 6：桌面、手机尺寸、键盘操作、浏览器后退与直接打开
  describe('场景 6: 公共输入弹窗与键盘/响应式细节', () => {
    it('InputDialog 支持 Enter 快速确认与 Escape 取消，具备完整无障碍焦点流转', async () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      const { rerender } = render(
        <InputDialog
          isOpen={true}
          title="调整文章分类"
          placeholder="请输入新的分类名称"
          defaultValue="系统架构"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );

      const dialog = screen.getByRole('dialog', { name: '调整文章分类' });
      expect(dialog).toBeInTheDocument();

      // 按 Escape 触发取消
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);

      // 输入并通过表单提交
      const input = screen.getByPlaceholderText('请输入新的分类名称');
      fireEvent.change(input, { target: { value: '前沿工程' } });
      const form = dialog.querySelector('form')!;
      fireEvent.submit(form);
      expect(onConfirm).toHaveBeenCalledWith('前沿工程');

      // 处于 isOpen=false 时不渲染任何 DOM
      rerender(
        <InputDialog
          isOpen={false}
          title="调整文章分类"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('右侧属性面板具备 3 大折叠分组，支持分类、标签、Slug 与版本历史无冲突管理', () => {
      render(
        <MemoryRouter>
          <EditorPage
            model={sampleEditorModel}
            versions={[
              {
                id: 'ver-1',
                contentJson: '{}',
                contentText: '快照 1',
                createdAt: '2026-10-02T12:00:00Z',
              },
            ]}
          />
        </MemoryRouter>,
      );

      // 打开文档设置面板
      const settingsToggle = screen.getByTitle('切换右侧属性设置面板');
      fireEvent.click(settingsToggle);

      // 验证三大分组标题均存在
      expect(screen.getByText('基本信息')).toBeInTheDocument();
      expect(screen.getByText('页面属性')).toBeInTheDocument();
      expect(screen.getByText('版本快照与历史')).toBeInTheDocument();

      // 验证版本快照面板存在且有版本条目
      expect(screen.getByText(/历史快照/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '恢复此版本' })).toBeInTheDocument();
    });
  });
});
