import type { NoteCardViewModel, NotesViewModel } from './fixtures';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { NavigationSourceState } from '../components/navigation/navigationSource';
import { KnowledgeShell } from './KnowledgeShell';
import './knowledge.css';
import { DeleteNotesDialog } from './DeleteNotesDialog';

export type NotesPresentationState = 'ready' | 'loading' | 'empty' | 'error';

export type BatchItemFailure = {
  id: string;
  title: string;
  error: string;
};

export type BatchOperationResult = {
  total: number;
  succeeded: readonly string[];
  failed: readonly BatchItemFailure[];
  actionType: 'archive' | 'restore' | 'category';
  targetCategory?: string;
};

export type ToastState = {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type NotesPageProps = {
  model: NotesViewModel;
  state?: NotesPresentationState;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  showSearch?: boolean;
  // Search
  onSearchChange?: (value: string) => void;
  onClearSearch?: () => void;
  // Single note actions
  onArchive?: (noteId: string) => void | Promise<void>;
  onRestore?: (noteId: string) => void;
  mutatingNoteId?: string | null;
  mutationError?: string | null;
  // Tabs & Counts
  tab?: string;
  onTabChange?: (tab: string) => void;
  tabCounts?: {
    all?: number;
    draft?: number;
    published?: number;
    archived?: number;
  };
  // Filters & Sorting
  category?: string;
  onCategoryChange?: (category: string) => void;
  categories?: readonly string[];
  sort?: string;
  onSortChange?: (sort: string) => void;
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  featured?: boolean;
  onFeaturedChange?: (featured: boolean) => void;
  onResetFilters?: () => void;
  // Batch
  selectedIds?: readonly string[];
  onToggleSelect?: (noteId: string) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onBatchArchive?: (noteIds: string[]) => void | Promise<void>;
  onBatchRestore?: (noteIds: string[]) => void;
  onBatchCategoryChange?: (noteIds: string[], targetCategory: string) => void;
  batchResult?: BatchOperationResult | null;
  onClearBatchResult?: () => void;
  onRetryBatch?: () => void | Promise<void>;
  onRetrySingle?: (noteId: string) => void | Promise<void>;
  // Toast
  toast?: ToastState | null;
  onClearToast?: () => void;
};

function formatStatus(status: NonNullable<NoteCardViewModel['status']>): string {
  if (status === 'draft') return '草稿';
  if (status === 'published') return '已发布';
  if (status === 'archived') return '回收站';
  return String(status);
}

export function NotesPage({
  model,
  state = 'ready',
  page = 1,
  totalPages = 1,
  totalItems = 0,
  onPageChange,
  showSearch = false,
  onSearchChange,
  onClearSearch,
  onArchive,
  onRestore,
  mutatingNoteId,
  mutationError,
  tab: controlledTab,
  onTabChange,
  tabCounts,
  category: controlledCategory,
  onCategoryChange,
  categories,
  sort: controlledSort,
  onSortChange,
  pinned: controlledPinned,
  onPinnedChange,
  featured: controlledFeatured,
  onFeaturedChange,
  onResetFilters,
  selectedIds: controlledSelectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchArchive,
  onBatchRestore,
  onBatchCategoryChange,
  batchResult,
  onClearBatchResult,
  onRetryBatch,
  onRetrySingle,
  toast,
  onClearToast,
}: NotesPageProps) {
  const [deletion, setDeletion] = useState<{ ids: string[]; run: () => void | Promise<void> } | null>(null);
  const requestDelete = (ids: string[], run: () => void | Promise<void>) => setDeletion({ ids, run });
  const location = useLocation();
  const currentPathAndQuery = `${location.pathname}${location.search}`;
  const navSourceState: NavigationSourceState = {
    kind: 'admin_notes',
    fromPath: currentPathAndQuery,
    fromLabel: '← 返回文章列表',
    get scrollY() {
      return typeof window !== 'undefined' ? window.scrollY : 0;
    },
  };

  // Local fallbacks for uncontrolled usage
  const [localTab, setLocalTab] = useState('all');
  const [localCategory, setLocalCategory] = useState('');
  const [localSort, setLocalSort] = useState('updated_desc');
  const [localPinned, setLocalPinned] = useState(false);
  const [localFeatured, setLocalFeatured] = useState(false);
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([]);

  const activeTab = controlledTab ?? localTab;
  const handleTabChange = onTabChange ?? setLocalTab;

  const activeCategory = controlledCategory ?? localCategory;
  const handleCategoryChange = onCategoryChange ?? setLocalCategory;

  const activeSort = controlledSort ?? localSort;
  const handleSortChange = onSortChange ?? setLocalSort;

  const activePinned = controlledPinned ?? localPinned;
  const handlePinnedChange = onPinnedChange ?? setLocalPinned;

  const activeFeatured = controlledFeatured ?? localFeatured;
  const handleFeaturedChange = onFeaturedChange ?? setLocalFeatured;

  const selectedIds = controlledSelectedIds ?? localSelectedIds;
  const handleToggleSelect = (noteId: string) => {
    if (onToggleSelect) {
      onToggleSelect(noteId);
    } else {
      setLocalSelectedIds((prev) =>
        prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId],
      );
    }
  };

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll();
    } else {
      const allCurrentIds = model.notes.map((n) => n.id);
      const isAllSelected =
        allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedIds.includes(id));
      setLocalSelectedIds(isAllSelected ? [] : allCurrentIds);
    }
  };

  const handleClearSelection = () => {
    if (onClearSelection) {
      onClearSelection();
    } else {
      setLocalSelectedIds([]);
    }
  };

  const isAllSelected =
    model.notes.length > 0 && model.notes.every((n) => selectedIds.includes(n.id));

  const hasUnarchivedSelected = model.notes.some(
    (n) => selectedIds.includes(n.id) && !n.archived,
  );
  const hasArchivedSelected = model.notes.some(
    (n) => selectedIds.includes(n.id) && n.archived,
  );

  const derivedCategories = Array.from(
    new Set(
      model.notes
        .map((n) => n.category)
        .filter((c): c is string => Boolean(c && c.trim())),
    ),
  );
  const availableCategories = Array.from(
    new Set([...(categories ?? derivedCategories), activeCategory].filter(Boolean)),
  );

  const tabs = [
    { id: 'all', label: '全部', count: tabCounts?.all },
    { id: 'draft', label: '草稿', count: tabCounts?.draft },
    { id: 'published', label: '已发布', count: tabCounts?.published },
    { id: 'archived', label: '回收站', count: tabCounts?.archived },
  ];

  const hasActiveFilters = Boolean(
    (model.searchTerm && model.searchTerm.trim()) ||
      activeCategory ||
      activePinned ||
      activeFeatured ||
      (activeTab && activeTab !== 'all'),
  );

  const handleClearAllFilters = () => {
    if (onResetFilters) {
      onResetFilters();
    } else {
      onClearSearch?.();
      handleCategoryChange('');
      handleSortChange('updated_desc');
      handlePinnedChange(false);
      handleFeaturedChange(false);
      handleTabChange('all');
    }
  };

  return (
    <KnowledgeShell title="知识库工作区">
      <section className="knowledge-shell" aria-labelledby="knowledge-notes-title">
        <header className="knowledge-shell__heading knowledge-workbench-header">
          <div className="knowledge-workbench-header__top">
            <div className="knowledge-workbench-header__title-wrap">
              <h1 id="knowledge-notes-title" className="knowledge-workbench-title" aria-label="文章管理">
                内容
              </h1>
            </div>

            <div className="knowledge-workbench-header__actions">
              {showSearch ? <div className="knowledge-workbench-search">
                <label className="knowledge-search-field" htmlFor="knowledge-note-search">
                  <span className="sr-only">搜索文章</span>
                  <input
                    id="knowledge-note-search"
                    type="search"
                    placeholder="搜索文章标题、摘要或正文…"
                    value={model.searchTerm}
                    readOnly={!onSearchChange}
                    onChange={(event) => onSearchChange?.(event.target.value)}
                    aria-label="搜索文章"
                  />
                </label>
                <button
                  type="button"
                  className="knowledge-button knowledge-button--quiet knowledge-search-clear-btn"
                  disabled={!onClearSearch || !model.searchTerm}
                  aria-disabled={!onClearSearch || !model.searchTerm}
                  onClick={onClearSearch}
                  aria-label="清除搜索"
                >
                  清除搜索
                </button>
              </div> : null}

              <nav className="knowledge-page-actions" aria-label="文章管理操作">
                <Link
                  className="knowledge-button knowledge-button--primary"
                  to="/knowledge/create"
                  state={navSourceState}
                  aria-label="新建文章"
                >
                  新建文档
                </Link>
                <Link className="knowledge-button knowledge-button--quiet sr-only" to="/knowledge">
                  知识库概览
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* 状态流转 Tabs 与辅助筛选 */}
        <div className="knowledge-tabs-bar">
          <div className="knowledge-tabs" role="tablist" aria-label="文章状态分组">
            {tabs.map((t) => {
              const isSelected = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  data-tab={t.id}
                  data-status={t.id}
                  aria-selected={isSelected}
                  aria-controls="notes-panel"
                  className={`knowledge-tab${isSelected ? ' is-active' : ''}`}
                  onClick={() => handleTabChange(t.id)}
                >
                  <span>{t.label}</span>
                  {t.count !== undefined ? (
                    <span className="knowledge-tab__badge">{t.count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="knowledge-filter-selects">
            <label className="knowledge-select-wrap">
              <span className="sr-only">按分类筛选</span>
              <select
                value={activeCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                aria-label="按分类筛选"
                className="knowledge-select"
              >
                <option value="">全部分类</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="knowledge-select-wrap">
              <span className="sr-only">排序方式</span>
              <select
                value={activeSort}
                onChange={(e) => handleSortChange(e.target.value)}
                aria-label="排序方式"
                className="knowledge-select"
              >
                <option value="updated_desc">最近更新</option>
                <option value="published_desc">发布时间</option>
                <option value="title_asc">标题字典序</option>
              </select>
            </label>

            <label className="knowledge-toggle">
              <input
                type="checkbox"
                checked={activePinned}
                onChange={(e) => handlePinnedChange(e.target.checked)}
                aria-label="仅看置顶"
              />
              <span>仅看置顶</span>
            </label>

            <label className="knowledge-toggle">
              <input
                type="checkbox"
                checked={activeFeatured}
                onChange={(e) => handleFeaturedChange(e.target.checked)}
                aria-label="仅看精选"
              />
              <span>仅看精选</span>
            </label>
          </div>
        </div>

        {/* 悬浮批量操作栏 */}
        {selectedIds.length > 0 ? (
          <div className="knowledge-bulk-bar" role="toolbar" aria-label="批量管理操作栏">
            <div className="knowledge-bulk-bar__info">
              <span>
                已选中 <strong>{selectedIds.length}</strong> 篇文章
              </span>
              <button
                type="button"
                className="knowledge-button knowledge-button--quiet knowledge-button--small"
                onClick={handleSelectAll}
              >
                {isAllSelected ? '取消全选' : '全选当前页'}
              </button>
              <button
                type="button"
                className="knowledge-button knowledge-button--quiet knowledge-button--small"
                onClick={handleClearSelection}
              >
                取消选择
              </button>
            </div>
            <div className="knowledge-bulk-bar__actions">
              {hasUnarchivedSelected && onBatchArchive ? (
                <button
                  type="button"
                  className="knowledge-button knowledge-button--danger knowledge-button--small"
                  onClick={() => {
                    const ids = model.notes.filter((note) => selectedIds.includes(note.id) && !note.archived).map((note) => note.id);
                    requestDelete(ids, () => onBatchArchive(ids));
                  }}
                >
                  批量删除
                </button>
              ) : null}
              {hasArchivedSelected && onBatchRestore ? (
                <button
                  type="button"
                  className="knowledge-button knowledge-button--small"
                  onClick={() => onBatchRestore(model.notes.filter((note) => selectedIds.includes(note.id) && note.archived).map((note) => note.id))}
                >
                  批量恢复
                </button>
              ) : null}
              {onBatchCategoryChange ? (
                <select
                  className="knowledge-select knowledge-select--small"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onBatchCategoryChange(selectedIds.slice(), e.target.value);
                    }
                  }}
                  aria-label="批量调整分类"
                >
                  <option value="" disabled>
                    批量调整分类…
                  </option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* 批量操作逐项反馈横幅/弹窗 */}
        {batchResult ? (
          <div
            className={`knowledge-batch-result ${
              batchResult.failed.length > 0
                ? 'knowledge-batch-result--warning'
                : 'knowledge-batch-result--success'
            }`}
            role="region"
            aria-label="批量操作反馈"
          >
            <div className="knowledge-batch-result__header">
              <strong>
                {batchResult.actionType === 'archive'
                  ? `批量删除完成：${batchResult.succeeded.length} 篇成功，${batchResult.failed.length} 篇失败`
                  : batchResult.actionType === 'restore'
                    ? `批量恢复完成：${batchResult.succeeded.length} 篇成功，${batchResult.failed.length} 篇失败`
                    : `批量调整分类完成：${batchResult.succeeded.length} 篇成功，${batchResult.failed.length} 篇失败`}
              </strong>
              {onClearBatchResult ? (
                <button
                  type="button"
                  className="knowledge-button knowledge-button--quiet knowledge-button--small"
                  onClick={onClearBatchResult}
                  aria-label="关闭批量操作反馈"
                >
                  ✕
                </button>
              ) : null}
            </div>
            {batchResult.failed.length > 0 ? (
              <>
                <ul className="knowledge-batch-errors">
                  {batchResult.failed.map((f) => (
                    <li key={f.id}>
                      <span>
                        《{f.title}》— {f.error}
                      </span>
                      {onRetrySingle ? (
                        <button
                          type="button"
                          className="knowledge-button knowledge-button--small"
                          onClick={() => batchResult.actionType === 'archive'
                            ? requestDelete([f.id], () => onRetrySingle(f.id))
                            : onRetrySingle(f.id)}
                        >
                          重试
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {onRetryBatch ? (
                  <div className="knowledge-batch-result__footer">
                    <button
                      type="button"
                      className="knowledge-button knowledge-button--primary knowledge-button--small"
                      onClick={() => batchResult.actionType === 'archive'
                        ? requestDelete(batchResult.failed.map((item) => item.id), onRetryBatch)
                        : onRetryBatch()}
                    >
                      重试失败项
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {/* 全局加载/错误状态 */}
        {state === 'loading' ? (
          <p className="knowledge-message" role="status">
            正在加载文章列表…
          </p>
        ) : null}
        {state === 'error' ? (
          <p className="knowledge-message knowledge-message--error" role="alert">
            文章列表加载失败
          </p>
        ) : null}
        {mutationError ? (
          <p className="knowledge-message knowledge-message--error" role="alert">
            {mutationError}
          </p>
        ) : null}

        {/* 空状态细分 */}
        {state === 'empty' ? (
          hasActiveFilters ? (
            <section
              className="knowledge-empty-state"
              aria-labelledby="knowledge-search-empty-title"
            >
              <h2 id="knowledge-search-empty-title">未找到匹配的搜索结果</h2>
              <p>未找到与当前搜索词或筛选条件符合的文章。</p>
              <div className="knowledge-empty-state__actions">
                <button
                  type="button"
                  className="knowledge-button knowledge-button--primary"
                  onClick={handleClearAllFilters}
                >
                  清除筛选条件
                </button>
              </div>
      </section>
          ) : (
            <section className="knowledge-empty-state" aria-labelledby="knowledge-empty-title">
              <h2 id="knowledge-empty-title">{activeTab === 'archived' ? '回收站为空' : '知识库暂无文章'}</h2>
              <p>{activeTab === 'archived' ? '删除的文章会显示在这里，可恢复为草稿。' : '记录推导与实践，沉淀属于你的技术知识资产。'}</p>
              <div className="knowledge-empty-state__actions">
                <Link
                  className="knowledge-button knowledge-button--primary"
                  to="/knowledge/create"
                  state={navSourceState}
                >
                  新建第一篇文章
                </Link>
                <Link className="knowledge-button knowledge-button--quiet" to="/knowledge/import">
                  导入 Markdown 文档
                </Link>
              </div>
      </section>
          )
        ) : null}

        {/* 桌面端高密度表格视图与移动端卡片自适应 */}
        {state === 'ready' ? (
          <div id="notes-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            <div className="knowledge-table-container">
              <table className="knowledge-table" aria-label="文章列表">
                <thead>
                  <tr>
                    <th className="knowledge-table__th--select" scope="col">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        aria-label="全选当前页文章"
                      />
                    </th>
                    <th scope="col">文章标题与摘要</th>
                    <th scope="col">分类</th>
                    <th scope="col">状态与标记</th>
                    <th scope="col">最后更新时间</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.notes.map((note) => {
                    const isSelected = selectedIds.includes(note.id);
                    const isMutating = mutatingNoteId === note.id;
                    const extendedNote = note as NoteCardViewModel & {
                      tags?: readonly string[];
                      isFeatured?: boolean;
                    };
                    return (
                      <tr key={note.id} className={isSelected ? 'is-selected' : undefined}>
                        <td className="knowledge-table__td--select">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(note.id)}
                            aria-label={`选择文章 ${note.title}`}
                          />
                        </td>
                        <td>
                          <div className="knowledge-table__title-cell">
                            <Link
                              to={`/knowledge/notes/${note.id}`}
                              state={navSourceState}
                              className="knowledge-table__title-link"
                            >
                              <strong>{note.title}</strong>
                            </Link>
                            <p className="knowledge-table__summary">{note.summary}</p>
                            {extendedNote.tags && extendedNote.tags.length > 0 ? (
                              <div className="knowledge-table__tags">
                                {extendedNote.tags.map((t) => (
                                  <span key={t} className="knowledge-tag">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <span className="knowledge-table__category">{note.category}</span>
                        </td>
                        <td>
                          <div className="knowledge-table__status-group">
                            {note.status ? (
                              <div className={`knowledge-status-indicator knowledge-status-indicator--${note.status}`}>
                                <span
                                  className={`knowledge-status-dot knowledge-status-dot--${note.status}`}
                                  aria-hidden="true"
                                />
                                <span className={`knowledge-badge knowledge-badge--${note.status}`}>
                                  {note.status === 'published' && extendedNote.hasUnpublishedEdits
                                    ? '已发布 · 有未发布修改'
                                    : formatStatus(note.status)}
                                </span>
                              </div>
                            ) : null}
                            {note.pinned ? (
                              <span
                                className="knowledge-badge knowledge-badge--pinned"
                                title="已置顶"
                              >
                                📌 已置顶
                              </span>
                            ) : null}
                            {extendedNote.isFeatured ? (
                              <span
                                className="knowledge-badge knowledge-badge--featured"
                                title="首页精选"
                              >
                                ⭐ 首页精选
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <time className="knowledge-table__time">{note.updatedLabel}</time>
                        </td>
                        <td>
                          <div className="knowledge-table__actions">
                            <Link
                              to={`/knowledge/notes/${note.id}`}
                              state={navSourceState}
                              className="knowledge-action-btn"
                              aria-label={`编辑 ${note.title}`}
                            >
                              编辑
                            </Link>
                            <Link
                              to={`/knowledge/notes/${note.id}/read`}
                              state={navSourceState}
                              className="knowledge-action-btn"
                              aria-label={`阅读 ${note.title}`}
                            >
                              阅读
                            </Link>
                            {note.archived && onRestore ? (
                              <button
                                type="button"
                                className="knowledge-action-btn"
                                disabled={isMutating}
                                onClick={() => onRestore(note.id)}
                                aria-label={`恢复 ${note.title}`}
                              >
                                恢复
                              </button>
                            ) : null}
                            {!note.archived && onArchive ? (
                              <button
                                type="button"
                                className="knowledge-action-btn knowledge-action-btn--danger"
                                disabled={isMutating}
                                onClick={() => requestDelete([note.id], () => onArchive(note.id))}
                                aria-label={`删除 ${note.title}`}
                              >
                                删除
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="knowledge-action-btn knowledge-action-btn--more"
                              aria-label={`更多操作 ${note.title}`}
                              title="更多操作"
                            >
                              ⋮
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <nav className="knowledge-pagination" aria-label="文章列表分页">
                <button
                  type="button"
                  className="knowledge-button knowledge-button--quiet"
                  disabled={page <= 1}
                  onClick={() => onPageChange?.(page - 1)}
                >
                  ← 上一页
                </button>
                <span className="knowledge-pagination__info">
                  第 {page} / {totalPages} 页（共 {totalItems} 篇文章）
                </span>
                <button
                  type="button"
                  className="knowledge-button knowledge-button--quiet"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange?.(page + 1)}
                >
                  下一页 →
                </button>
              </nav>
            ) : null}
          </div>
        ) : null}

        {/* 操作后提示 Toast */}
        {toast ? (
          <aside className="knowledge-toast" role="status" aria-live="polite">
            <span>{toast.text}</span>
            {toast.actionLabel && toast.onAction ? (
              <button
                type="button"
                className="knowledge-toast__action"
                onClick={toast.onAction}
              >
                {toast.actionLabel}
              </button>
            ) : null}
            {onClearToast ? (
              <button
                type="button"
                className="knowledge-toast__close"
                onClick={onClearToast}
                aria-label="关闭通知"
              >
                ✕
              </button>
            ) : null}
          </aside>
        ) : null}
        {deletion ? (
          <DeleteNotesDialog
            titles={deletion.ids.map((id) => model.notes.find((note) => note.id === id)?.title ?? batchResult?.failed.find((item) => item.id === id)?.title ?? id)}
            onConfirm={deletion.run}
            onCancel={() => setDeletion(null)}
          />
        ) : null}
      </section>
    </KnowledgeShell>
  );
}
