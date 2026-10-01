import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';

import { AssetPanel } from './AssetPanel';
import type { EditorAsset, EditorViewModel, HighlightKind, NoteStatus } from './editor-fixtures';
import { highlightKinds } from './editor-fixtures';
import type { NoteVersionRecord } from '@namdw/shared';
import type { Editor } from '@tiptap/react';
import './knowledge.css';

export type EditorPresentationState = 'unchanged' | 'unsaved' | 'saving' | 'saved' | 'failed';
export type VersionPresentationState = 'idle' | 'saving' | 'saved' | 'failed';

export type EditorPageProps = {
  model: EditorViewModel;
  state?: EditorPresentationState;
  versionState?: VersionPresentationState;
  selectedHighlight?: HighlightKind | null;
  documentSlot?: ReactNode;
  editor?: Editor | null;
  versions?: readonly NoteVersionRecord[] | undefined;
  onTitleChange?: (value: string) => void;
  onSummaryChange?: (value: string) => void;
  onCategoryChange?: (value: string) => void;
  onTagsChange?: (value: readonly string[]) => void;
  onStatusChange?: (value: NoteStatus) => void;
  onFeaturedChange?: (value: boolean) => void;
  onPinnedChange?: (value: boolean) => void;
  onSlugChange?: (value: string) => void;
  onContentChange?: (value: string) => void;
  onHighlight?: (kind: HighlightKind) => void;
  onRemoveHighlight?: () => void;
  onSave?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onPreview?: () => void;
  onSaveVersion?: () => void;
  onRestoreVersion?: (version: NoteVersionRecord) => void;
  onOpenVersions?: () => void;
  onUpload?: (file: File) => void;
  onDownload?: (assetId: string) => void;
  onDelete?: (assetId: string) => void;
  onInsertAsset?: (asset: EditorAsset) => void;
  attachmentUnavailableMessage?: string | undefined;
  isNew?: boolean;
  saveBusy?: boolean;
  publishBusy?: boolean;
};

export const stateLabels: Record<EditorPresentationState, string> = {
  unchanged: '已保存',
  unsaved: '● 未保存修改',
  saving: '↻ 正在自动保存…',
  saved: '✓ 已自动保存',
  failed: '⚠ 保存失败',
};

export const versionStateLabels: Record<Exclude<VersionPresentationState, 'idle'>, string> = {
  saving: '正在保存快照…',
  saved: '快照已保存',
  failed: '快照保存失败',
};

const highlightMeta: Record<HighlightKind, { label: string; icon: string; name: string }> = {
  core: { label: '核心推导', icon: '💛', name: 'Core' },
  mistake: { label: '踩坑记录', icon: '🔴', name: 'Mistake' },
  mastered: { label: '掌握要点', icon: '🟢', name: 'Mastered' },
  method: { label: '技术方法', icon: '🔵', name: 'Method' },
  investigate: { label: '深入探索', icon: '🟣', name: 'Investigate' },
};

function labelForKind(kind: HighlightKind) {
  return highlightMeta[kind]?.name ?? kind;
}

export function EditorPage({
  model,
  state = 'unchanged',
  versionState = 'idle',
  selectedHighlight = null,
  documentSlot,
  editor,
  versions,
  onTitleChange,
  onSummaryChange,
  onCategoryChange,
  onTagsChange,
  onFeaturedChange,
  onPinnedChange,
  onSlugChange,
  onContentChange,
  onHighlight,
  onRemoveHighlight,
  onSave,
  onPublish,
  onUnpublish,
  onPreview,
  onSaveVersion,
  onRestoreVersion,
  onOpenVersions,
  onUpload,
  onDownload,
  onDelete,
  onInsertAsset,
  attachmentUnavailableMessage,
  isNew = false,
  saveBusy = false,
  publishBusy = false,
}: EditorPageProps) {
  const [showVersions, setShowVersions] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const inRouter = useInRouterContext();
  const settingsToggleRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcut: Ctrl/Cmd + S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  // Handle drawer Escape key & focus trapping (UI-02)
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleDrawerKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
        settingsToggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleDrawerKeyDown);
    return () => window.removeEventListener('keydown', handleDrawerKeyDown);
  }, [isSettingsOpen]);

  const handleExtractSummary = () => {
    if (!onSummaryChange) return;
    let text = '';
    if (editor && typeof editor.getText === 'function') {
      text = editor.getText();
    } else if (model.contentJson) {
      try {
        const parsed = JSON.parse(model.contentJson);
        const extractText = (node: { text?: string; content?: unknown[] }): string => {
          if (node.text) return node.text;
          if (Array.isArray(node.content)) {
            return (node.content as Array<{ text?: string; content?: unknown[] }>)
              .map(extractText)
              .join(' ');
          }
          return '';
        };
        text = extractText(parsed);
      } catch {
        text = '';
      }
    }
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean) {
      onSummaryChange(clean.slice(0, 150) + (clean.length > 150 ? '…' : ''));
    }
  };

  const handleGenerateSlug = () => {
    if (!onSlugChange) return;
    const raw = model.title.trim().toLowerCase();
    const slug = raw
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    if (slug) {
      onSlugChange(slug);
    }
  };

  const previewState = {
    kind: 'editor_preview',
    fromPath: model.id ? `/knowledge/notes/${model.id}` : '/knowledge/notes/new',
    fromLabel: '← 返回正在编辑的文章',
  };

  const articleTitle = model.title.trim()
    ? model.title
    : isNew
      ? '新建文章'
      : '未命名草稿';

  return (
    <div className="knowledge-shell knowledge-editor" aria-labelledby="knowledge-editor-title">
      {/* 1. 吸顶固定操作栏 (Sticky Topbar) */}
      <header className="knowledge-editor__topbar" aria-label="编辑器顶部操作栏">
        <div className="knowledge-editor__topbar-left">
          <nav className="knowledge-breadcrumbs" aria-label="面包屑导航">
            {inRouter ? (
              <Link className="knowledge-breadcrumbs__link" to="/knowledge/notes">
                文章管理
              </Link>
            ) : (
              <a className="knowledge-breadcrumbs__link" href="/knowledge/notes">
                文章管理
              </a>
            )}
            <span className="knowledge-breadcrumbs__sep">/</span>
            <span className="knowledge-breadcrumbs__current" title={articleTitle}>
              {articleTitle}
            </span>
          </nav>

          {/* 保存状态实时指示器 */}
          <div className="knowledge-save-indicator-wrap">
            <span
              className={`knowledge-save-state knowledge-save-state--${state}`}
              role={state === 'failed' ? 'alert' : 'status'}
              aria-live="polite"
            >
              <span>{stateLabels[state]}</span>
              {state === 'failed' && onSave ? (
                <button
                  type="button"
                  className="knowledge-save-retry-button"
                  onClick={onSave}
                  aria-label="重试保存"
                >
                  重试
                </button>
              ) : null}
            </span>

            {versionState !== 'idle' ? (
              <span
                className={`knowledge-version-state knowledge-version-state--${versionState}`}
                role={versionState === 'failed' ? 'alert' : 'status'}
                aria-live="polite"
              >
                {versionStateLabels[versionState]}
              </span>
            ) : null}
          </div>
        </div>

        {/* 顶部行动按钮组 */}
        <div className="knowledge-editor__topbar-actions">
          {/* 预览当前草稿 */}
          {onPreview ? (
            <button
              type="button"
              className="knowledge-button knowledge-button--quiet knowledge-button--small"
              onClick={onPreview}
              title="预览当前草稿"
            >
              预览当前草稿
            </button>
          ) : model.id && !isNew ? (
            inRouter ? (
              <Link
                className="knowledge-button knowledge-button--quiet knowledge-button--small"
                to={`/knowledge/notes/${model.id}/read`}
                state={previewState}
                title="预览当前草稿"
              >
                预览当前草稿
              </Link>
            ) : (
              <a
                className="knowledge-button knowledge-button--quiet knowledge-button--small"
                href={`/knowledge/notes/${model.id}/read`}
                title="预览当前草稿"
              >
                预览当前草稿
              </a>
            )
          ) : null}

          {/* 保存草稿 */}
          <button
            type="button"
            className="knowledge-button knowledge-button--quiet knowledge-button--small"
            onClick={onSave}
            disabled={!onSave || state === 'saving' || saveBusy}
            aria-label="Save"
            title="保存当前工作草稿 (Ctrl+S)"
          >
            保存草稿
          </button>

          {/* 保存快照 */}
          {!isNew ? (
            <button
              type="button"
              className="knowledge-button knowledge-button--quiet knowledge-button--small"
              onClick={onSaveVersion}
              disabled={
                !onSaveVersion ||
                state === 'saving' ||
                versionState === 'saving' ||
                saveBusy
              }
              aria-label="Save Version"
              title="显式创建只读历史快照"
            >
              保存快照
            </button>
          ) : null}

          {/* 版本历史切换 */}
          {!isNew ? (
            <button
              type="button"
              className={`knowledge-button knowledge-button--quiet knowledge-button--small ${showVersions ? 'is-active' : ''}`}
              onClick={() => {
                setShowVersions((prev) => !prev);
                if (!showVersions) onOpenVersions?.();
              }}
              title="切换版本历史快照面板"
            >
              {showVersions ? '收起历史' : '版本历史'}
            </button>
          ) : null}

          {/* 撤回为草稿 (仅在已发布状态显示) */}
          {model.status === 'published' && onUnpublish ? (
            <button
              type="button"
              className="knowledge-button knowledge-button--quiet knowledge-button--small knowledge-button--danger"
              onClick={onUnpublish}
              disabled={publishBusy}
              title="将已发布文章撤回为草稿并下架"
            >
              撤回为草稿
            </button>
          ) : null}

          {/* 发布文章 / 更新发布 */}
          {onPublish ? (
            <button
              type="button"
              className="knowledge-button knowledge-button--primary knowledge-button--small"
              onClick={onPublish}
              disabled={publishBusy || state === 'saving'}
            >
              {model.status === 'published' ? '更新发布' : '发布文章'}
            </button>
          ) : null}

          {/* 文章设置 ⚙ 开关按钮 */}
          <button
            ref={settingsToggleRef}
            type="button"
            className={`knowledge-button knowledge-button--quiet knowledge-button--small ${isSettingsOpen ? 'is-active' : ''}`}
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            aria-expanded={isSettingsOpen}
            aria-label="文章设置"
            title="切换右侧属性设置面板"
          >
            文章设置 ⚙
          </button>
        </div>
      </header>

      {/* 隐藏的辅助标题，供屏幕阅读器语义 */}
      <h1 id="knowledge-editor-title" className="sr-only">
        {isNew ? '新建文章' : '编辑文章'}
      </h1>

      {/* 2. 主体工作区布局 (双栏 / 抽屉) */}
      <div className="knowledge-editor__layout">
        {/* 左侧正文优先画布 */}
        <section className="knowledge-editor__canvas-wrap" aria-label="文章正文编辑区">
          {/* 大标题直接输入 */}
          <div className="knowledge-editor__title-container">
            <input
              ref={titleInputRef}
              id="knowledge-editor-title-input"
              className="knowledge-editor__title-input"
              value={model.title}
              placeholder="在此输入文章标题…"
              aria-label="Title"
              onChange={(event) => onTitleChange?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (editor) {
                    editor.commands.focus('start');
                  } else {
                    const docEl = document.querySelector<HTMLElement>(
                      '[aria-label="Document"], .tiptap',
                    );
                    docEl?.focus();
                  }
                }
              }}
              readOnly={!onTitleChange}
            />
          </div>

          {/* 吸顶富文本工具栏 (Tiptap Sticky Toolbar) */}
          <div
            className="knowledge-toolbar"
            role="toolbar"
            aria-label="富文本编辑器工具栏"
          >
            {/* 分组 1: 结构级别 */}
            <div className="knowledge-toolbar__group" aria-label="结构级别">
              <button
                type="button"
                className={editor?.isActive('paragraph') ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().setParagraph().run()}
                aria-label="正文"
                title="正文 (P)"
              >
                P
              </button>
              <button
                type="button"
                className={editor?.isActive('heading', { level: 1 }) ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                aria-label="一级标题"
                title="一级标题 (H1)"
              >
                H1
              </button>
              <button
                type="button"
                className={editor?.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                aria-label="二级标题"
                title="二级标题 (H2)"
              >
                H2
              </button>
              <button
                type="button"
                className={editor?.isActive('heading', { level: 3 }) ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                aria-label="三级标题"
                title="三级标题 (H3)"
              >
                H3
              </button>
            </div>

            <span className="knowledge-toolbar__divider" aria-hidden="true" />

            {/* 分组 2: 行内样式 */}
            <div className="knowledge-toolbar__group" aria-label="行内样式">
              <button
                type="button"
                className={editor?.isActive('bold') ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                aria-label="加粗"
                title="加粗 (Ctrl+B)"
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className={editor?.isActive('italic') ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                aria-label="斜体"
                title="斜体 (Ctrl+I)"
              >
                <em>I</em>
              </button>
              <button
                type="button"
                className={editor?.isActive('strike') ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleStrike().run()}
                aria-label="删除线"
                title="删除线"
              >
                <s>S</s>
              </button>
              <button
                type="button"
                className={editor?.isActive('code') ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleCode().run()}
                aria-label="行内代码"
                title="行内代码"
              >
                <code>&lt;/&gt;</code>
              </button>
            </div>

            <span className="knowledge-toolbar__divider" aria-hidden="true" />

            {/* 分组 3: 列表样式 */}
            <div className="knowledge-toolbar__group" aria-label="列表样式">
              <button
                type="button"
                className={editor?.isActive('bulletList') ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                aria-label="无序列表"
                title="无序列表"
              >
                • 列表
              </button>
              <button
                type="button"
                className={editor?.isActive('orderedList') ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                aria-label="有序列表"
                title="有序列表"
              >
                1. 列表
              </button>
            </div>

            <span className="knowledge-toolbar__divider" aria-hidden="true" />

            {/* 分组 4: 引用与代码块 */}
            <div className="knowledge-toolbar__group" aria-label="块级样式">
              <button
                type="button"
                className={editor?.isActive('blockquote') ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                aria-label="引用"
                title="引用块"
              >
                “”
              </button>
              <button
                type="button"
                className={editor?.isActive('codeBlock') ? 'is-active' : ''}
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                aria-label="代码块"
                title="代码块"
              >
                代码块
              </button>
            </div>

            <span className="knowledge-toolbar__divider" aria-hidden="true" />

            {/* 分组 5: 链接 */}
            <div className="knowledge-toolbar__group" aria-label="超链接">
              <button
                type="button"
                className={editor?.isActive('link') ? 'is-active' : ''}
                onClick={() => {
                  if (!editor) return;
                  const previousUrl = editor.getAttributes('link').href || '';
                  const url = window.prompt('输入超链接 URL:', previousUrl);
                  if (url === null) return;
                  if (url === '') {
                    editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  } else {
                    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                  }
                }}
                aria-label="链接"
                title="插入/编辑超链接"
              >
                🔗 链接
              </button>
            </div>

            <span className="knowledge-toolbar__divider" aria-hidden="true" />

            {/* 分组 6: 表格工具包 */}
            <div className="knowledge-toolbar__group" aria-label="表格工具">
              <button
                type="button"
                onClick={() =>
                  editor
                    ?.chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
                aria-label="插入表格"
                title="插入 3x3 表格"
              >
                表格
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().addRowAfter().run()}
                aria-label="增加行"
                title="在下方增加行"
              >
                +行
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().deleteRow().run()}
                aria-label="删除行"
                title="删除当前行"
              >
                -行
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().addColumnAfter().run()}
                aria-label="增加列"
                title="在右侧增加列"
              >
                +列
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().deleteColumn().run()}
                aria-label="删除列"
                title="删除当前列"
              >
                -列
              </button>
            </div>

            <span className="knowledge-toolbar__divider" aria-hidden="true" />

            {/* 分组 7: 五色工程语义高亮组 */}
            <div className="knowledge-highlight-toolbar" aria-label="Semantic highlights">
              {highlightKinds.map((kind) => {
                const meta = highlightMeta[kind];
                const isSelected = selectedHighlight === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-label={labelForKind(kind)}
                    aria-pressed={isSelected}
                    className={`knowledge-highlight-btn knowledge-highlight-btn--${kind}`}
                    title={`${meta.name} (${meta.label})`}
                    onClick={() => {
                      onHighlight?.(kind);
                      editor?.chain().focus().setMark('highlight', { kind }).run();
                    }}
                  >
                    <span aria-hidden="true">{meta.icon}</span> {meta.label}
                  </button>
                );
              })}
              <button
                type="button"
                className="knowledge-button--quiet"
                onClick={() => {
                  onRemoveHighlight?.();
                  editor?.chain().focus().unsetHighlight().run();
                }}
                aria-label="Remove highlight"
                title="清除选中文本的高亮"
              >
                清除高亮
              </button>
            </div>

            <span className="knowledge-toolbar__divider" aria-hidden="true" />

            {/* 分组 8: 历史控制 */}
            <div className="knowledge-toolbar__group" aria-label="撤销重做">
              <button
                type="button"
                onClick={() => editor?.chain().focus().undo().run()}
                disabled={editor ? !editor.can().undo() : false}
                aria-label="撤销"
                title="撤销 (Ctrl+Z)"
              >
                ↶
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().redo().run()}
                disabled={editor ? !editor.can().redo() : false}
                aria-label="重做"
                title="重做 (Ctrl+Y)"
              >
                ↷
              </button>
            </div>
          </div>

          {/* 正文编辑画布 */}
          <div className="knowledge-editor__canvas">
            {documentSlot ? (
              <div className="knowledge-editor__slot">{documentSlot}</div>
            ) : (
              <textarea
                aria-label="Document"
                value={model.contentJson}
                onChange={(event) => onContentChange?.(event.target.value)}
                readOnly={!onContentChange}
                rows={12}
              />
            )}
          </div>
        </section>

        {/* 3. 右侧设置属性面板 (移动端为抽屉 Drawer) */}
        {isSettingsOpen ? (
          <div
            className="knowledge-drawer-backdrop"
            onClick={() => setIsSettingsOpen(false)}
            aria-hidden="true"
          />
        ) : null}

        <aside
          ref={drawerRef}
          className={`knowledge-editor__sidebar-stack ${isSettingsOpen ? 'is-open' : ''}`}
          aria-label="文章属性与辅助设置"
          role="complementary"
        >
          {/* 移动端抽屉顶标 */}
          <div className="knowledge-drawer__header">
            <h3>文章设置</h3>
            <button
              type="button"
              className="knowledge-button knowledge-button--quiet knowledge-button--small"
              onClick={() => setIsSettingsOpen(false)}
              aria-label="关闭设置抽屉"
            >
              关闭 ✕
            </button>
          </div>

          {/* 基础设置卡片 */}
          <section className="knowledge-prop-card" aria-labelledby="heading-basics">
            <h3 id="heading-basics">基础设置</h3>

            {/* 摘要 */}
            <label className="knowledge-editor__field" htmlFor="knowledge-editor-summary">
              <span className="knowledge-field-label-row">
                <span>文章摘要</span>
                <button
                  type="button"
                  className="knowledge-btn-link"
                  onClick={handleExtractSummary}
                  title="提取正文前 150 字作为摘要"
                >
                  从正文提取
                </button>
              </span>
              <textarea
                id="knowledge-editor-summary"
                value={model.summary}
                placeholder="简要概括本文核心要点与技术推导结论…"
                onChange={(event) => onSummaryChange?.(event.target.value)}
                readOnly={!onSummaryChange}
                rows={3}
              />
            </label>

            {/* URL Slug */}
            <label className="knowledge-editor__field" htmlFor="knowledge-editor-slug">
              <span className="knowledge-field-label-row">
                <span>URL Slug (访问路径)</span>
                <button
                  type="button"
                  className="knowledge-btn-link"
                  onClick={handleGenerateSlug}
                  title="根据标题生成格式化 Slug"
                >
                  从标题生成
                </button>
              </span>
              <input
                id="knowledge-editor-slug"
                value={model.slug ?? ''}
                placeholder="仅限小写英文、数字与中划线"
                onChange={(event) => onSlugChange?.(event.target.value)}
                readOnly={!onSlugChange}
              />
            </label>

            {/* 分类 */}
            <label className="knowledge-editor__field" htmlFor="knowledge-editor-category">
              <span>文章分类</span>
              <input
                id="knowledge-editor-category"
                value={model.category}
                placeholder="例如：系统设计 / 学习笔记"
                onChange={(event) => onCategoryChange?.(event.target.value)}
                readOnly={!onCategoryChange}
              />
            </label>

            {/* 标签 */}
            <label className="knowledge-editor__field" htmlFor="knowledge-editor-tags">
              <span>文章标签 (英文逗号分隔)</span>
              <input
                id="knowledge-editor-tags"
                value={model.tags.join(', ')}
                placeholder="例如：typescript, react, rust"
                onChange={(event) =>
                  onTagsChange?.(
                    event.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  )
                }
                readOnly={!onTagsChange}
              />
            </label>
          </section>

          {/* 展示与推荐设置卡片 */}
          <section className="knowledge-prop-card" aria-labelledby="heading-display">
            <h3 id="heading-display">展示设置</h3>
            <div className="knowledge-checkbox-stack">
              <label className="knowledge-checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(model.isFeatured)}
                  onChange={(event) => onFeaturedChange?.(event.target.checked)}
                  disabled={!onFeaturedChange}
                />
                <div>
                  <strong>首页精选展示 (Featured)</strong>
                  <p>开启后文章将在博客首页精选瀑布流中置顶展示。</p>
                </div>
              </label>

              <label className="knowledge-checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(model.isPinned)}
                  onChange={(event) => onPinnedChange?.(event.target.checked)}
                  disabled={!onPinnedChange}
                />
                <div>
                  <strong>知识库置顶 (Pinned)</strong>
                  <p>开启后文章将在文章管理列表中置顶排序。</p>
                </div>
              </label>
            </div>
          </section>

          {/* 版本历史面板 */}
          {showVersions ? (
            <aside
              className="knowledge-version-panel"
              aria-labelledby="knowledge-versions-heading"
            >
              <div className="knowledge-editor__section-heading">
                <div>
                  <p className="knowledge-shell__eyebrow">VERSIONS // 0x0B</p>
                  <h3 id="knowledge-versions-heading">版本历史快照</h3>
                </div>
                <button
                  type="button"
                  className="knowledge-button knowledge-button--quiet knowledge-button--small"
                  onClick={() => setShowVersions(false)}
                >
                  收起
                </button>
              </div>
              <p className="knowledge-asset-panel__boundary">
                查看历史版本快照。恢复版本前，系统会自动为您当前的编辑内容创建安全备份。
              </p>
              {!versions || versions.length === 0 ? (
                <p className="knowledge-empty-state">
                  暂无历史快照。点击顶栏“保存快照”创建。
                </p>
              ) : (
                <ul className="knowledge-version-list">
                  {versions.map((ver) => (
                    <li className="knowledge-version-row" key={ver.id}>
                      <div className="knowledge-version-row__info">
                        <strong>
                          {new Date(ver.createdAt).toLocaleString('zh-CN')}
                        </strong>
                        <span>
                          {ver.contentText
                            ? ver.contentText.slice(0, 60) +
                              (ver.contentText.length > 60 ? '…' : '')
                            : '(正文内容)'}
                        </span>
                      </div>
                      <div className="knowledge-version-row__actions">
                        <button
                          type="button"
                          className="knowledge-button knowledge-button--quiet knowledge-button--small"
                          onClick={() => onRestoreVersion?.(ver)}
                        >
                          恢复此版本
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          ) : null}

          {/* 附件资源面板 */}
          <AssetPanel
            assets={model.assets}
            onUpload={onUpload}
            onDownload={onDownload}
            onDelete={onDelete}
            onInsert={onInsertAsset}
            unavailableMessage={attachmentUnavailableMessage}
          />
        </aside>
      </div>
    </div>
  );
}
