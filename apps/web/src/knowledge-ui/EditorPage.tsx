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
  markdownMode?: boolean;
  editor?: Editor | null;
  versions?: readonly NoteVersionRecord[] | undefined;
  returnTarget?: {
    path: string;
    label: string;
    state?: unknown;
  } | undefined;
  errorMessage?: string | null | undefined;
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
  onPublish?: () => Promise<boolean> | boolean | void;
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
  lastSavedAt?: Date | null | undefined;
  lastPublishedAt?: string | null | undefined;
  hasUnpublishedEdits?: boolean | undefined;
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
  markdownMode = false,
  editor: suppliedEditor,
  versions,
  returnTarget,
  errorMessage,
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
  lastSavedAt = null,
  lastPublishedAt = null,
  hasUnpublishedEdits = false,
}: EditorPageProps) {
  const editor = suppliedEditor && !suppliedEditor.isDestroyed ? suppliedEditor : null;
  const [showVersions, setShowVersions] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const inRouter = useInRouterContext();
  const settingsToggleRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const resizeTitle = () => {
      const field = titleInputRef.current;
      if (!field) return;
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight}px`;
    };
    resizeTitle();
    window.addEventListener('resize', resizeTitle);
    return () => window.removeEventListener('resize', resizeTitle);
  }, [model.title, isSettingsOpen]);

  useEffect(() => {
    if (isNew) titleInputRef.current?.focus();
  }, [isNew]);

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

  const [isPublishDrawerOpen, setIsPublishDrawerOpen] = useState(false);

  // Dynamic publish check calculations
  const hasValidTitle = model.title.trim().length > 0;
  const uploadingAssets = model.assets.filter((a) => a.state === 'uploading');
  const failedAssets = model.assets.filter((a) => a.state === 'error');
  const hasUploadingAssets = uploadingAssets.length > 0;
  const hasFailedAssets = failedAssets.length > 0;
  const isDraftSaved = state === 'saved' || state === 'unchanged';
  const isDraftSaving = state === 'saving';
  const isDraftFailed = state === 'failed';
  const isPublishDisabled =
    !hasValidTitle ||
    hasUploadingAssets ||
    hasFailedAssets ||
    isDraftFailed ||
    isDraftSaving ||
    publishBusy;

  const handlePublishConfirm = async () => {
    setPublishError(null);
    try {
      const result = await onPublish?.();
      if (result === true) {
        setIsPublishDrawerOpen(false);
      } else if (result === false) {
        setIsPublishDrawerOpen(true);
        setPublishError(errorMessage || '发布失败，请检查后重试。');
      }
    } catch (err) {
      setIsPublishDrawerOpen(true);
      setPublishError(err instanceof Error ? err.message : '发布失败，请重试。');
    }
  };

  const handlePublishTopClick = async () => {
    setPublishError(null);
    setIsPublishDrawerOpen(true);
    try {
      const result = await onPublish?.();
      if (result === true) {
        setIsPublishDrawerOpen(false);
      } else if (result === false) {
        setIsPublishDrawerOpen(true);
        setPublishError(errorMessage || '发布失败，请检查后重试。');
      }
    } catch (err) {
      setIsPublishDrawerOpen(true);
      setPublishError(err instanceof Error ? err.message : '发布失败，请重试。');
    }
  };

  // Handle drawer Escape key & focus trapping (UI-02)
  useEffect(() => {
    if (!isSettingsOpen && !isPublishDrawerOpen) return;
    const handleDrawerKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPublishDrawerOpen) {
          setIsPublishDrawerOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
          settingsToggleRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleDrawerKeyDown);
    return () => window.removeEventListener('keydown', handleDrawerKeyDown);
  }, [isSettingsOpen, isPublishDrawerOpen]);

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
    const slug = raw.replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-').replace(/^-+|-+$/g, '');
    if (slug) {
      onSlugChange(slug);
    }
  };

  const previewState = {
    kind: 'editor_preview',
    fromPath: model.id ? `/knowledge/notes/${model.id}` : '/knowledge/notes/new',
    fromLabel: '← 返回正在编辑的文章',
  };

  const articleTitle = model.title.trim() ? model.title : isNew ? '新建文章' : '未命名草稿';
  const statusLabel = model.status === 'published' ? '已发布' : '草稿';

  return (
    <div className="knowledge-shell knowledge-editor" aria-labelledby="knowledge-editor-title">
      {/* 1. 吸顶固定操作栏 (Sticky Topbar) */}
      <header className="knowledge-editor__topbar" aria-label="编辑器顶部操作栏">
        <div className="knowledge-editor__topbar-left">
          <nav className="knowledge-breadcrumbs" aria-label="面包屑导航">
            {inRouter ? (
              <Link
                className="knowledge-breadcrumbs__link"
                to={returnTarget?.path ?? '/knowledge/notes'}
                state={returnTarget?.state}
                aria-label={returnTarget?.label ? returnTarget.label.replace(/^←\s*/, '') : '文章管理'}
              >
                {returnTarget?.label ?? '← 内容'}
              </Link>
            ) : (
              <a
                className="knowledge-breadcrumbs__link"
                href={returnTarget?.path ?? '/knowledge/notes'}
                aria-label={returnTarget?.label ? returnTarget.label.replace(/^←\s*/, '') : '文章管理'}
              >
                {returnTarget?.label ?? '← 内容'}
              </a>
            )}
            <span className="knowledge-breadcrumbs__sep">/</span>
            <span className="knowledge-breadcrumbs__current" title={articleTitle}>
              {statusLabel}
            </span>
          </nav>

          {/* 保存状态实时指示器 */}
          <div className="knowledge-save-indicator-wrap">
            <span
              className={`knowledge-save-state knowledge-save-state--${state}`}
              role={state === 'failed' ? 'alert' : 'status'}
              aria-live="polite"
            >
              <span>
                {state === 'saved' && lastSavedAt
                  ? `已保存于 ${lastSavedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
                  : isNew && state === 'unchanged' ? '尚未创建草稿' : stateLabels[state]}
              </span>
              {state === 'saved' && lastSavedAt ? (
                <span className="sr-only">{stateLabels[state]}</span>
              ) : null}
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
            {saveBusy || state === 'saving' ? '正在保存…' : '保存草稿'}
          </button>

          {/* 保存快照 */}
          {!isNew ? (
            <button
              type="button"
              className="knowledge-button knowledge-button--quiet knowledge-button--small"
              onClick={onSaveVersion}
              disabled={
                !onSaveVersion || state === 'saving' || versionState === 'saving' || saveBusy
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

          {/* 发布检查抽屉切换 */}
          <button
            type="button"
            className={`knowledge-button knowledge-button--quiet knowledge-button--small ${isPublishDrawerOpen ? 'is-active' : ''}`}
            onClick={() => setIsPublishDrawerOpen((prev) => !prev)}
            title="打开发布检查抽屉"
          >
            发布检查
          </button>

          {/* 发布文章 / 更新发布 */}
          {onPublish ? (
            <button
              type="button"
              className="knowledge-button knowledge-button--primary knowledge-button--small"
              onClick={handlePublishTopClick}
              disabled={isPublishDisabled}
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
            文档设置 ⚙
          </button>
        </div>
      </header>

      {/* 隐藏的辅助标题，供屏幕阅读器语义 */}
      <h1 id="knowledge-editor-title" className="sr-only">
        {isNew ? '新建文章' : '编辑文章'}
      </h1>

      {/* 2. 主体工作区布局 (双栏 / 抽屉) */}
      <div className={`knowledge-editor__layout ${isSettingsOpen ? 'has-settings' : ''}`}>
        {/* 左侧正文优先画布 */}
        <section className="knowledge-editor__canvas-wrap" aria-label="文章正文编辑区">
          {/* 大标题直接输入 */}
          <div className="knowledge-editor__title-container">
            <textarea
              ref={titleInputRef}
              rows={1}
              id="knowledge-editor-title-input"
              className="knowledge-editor__title-input"
              value={model.title}
              placeholder="在此输入文章标题…"
              aria-label="Title"
              onChange={(event) => onTitleChange?.(event.target.value.replace(/[\r\n]+/g, ' '))}
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
          {!markdownMode ? <div className="knowledge-toolbar" role="toolbar" aria-label="富文本编辑器工具栏">
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
          </div> : null}

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
            <h3>文档设置</h3>
            <button
              type="button"
              className="knowledge-button knowledge-button--quiet knowledge-button--small"
              onClick={() => setIsSettingsOpen(false)}
              aria-label="关闭设置抽屉"
            >
              关闭 ✕
            </button>
          </div>

          {/* 分组 1: 基本信息（标题、摘要、分类、标签） */}
          <details open className="knowledge-prop-card" aria-labelledby="heading-basics">
            <summary id="heading-basics" className="knowledge-settings-title" style={{ cursor: 'pointer', listStyle: 'none' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>基本信息</span>
                <span className="knowledge-version-link-arrow" aria-hidden="true">▾</span>
              </span>
            </summary>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem' }}>
              {/* 标题 */}
              <label className="knowledge-editor__field" htmlFor="knowledge-setting-title">
                <span>文章标题</span>
                <input
                  id="knowledge-setting-title"
                  value={model.title}
                  placeholder="在此输入文章标题…"
                  onChange={(event) => onTitleChange?.(event.target.value)}
                  readOnly={!onTitleChange}
                />
              </label>

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

              {/* 分类下拉选择 */}
              <div className="knowledge-setting-item">
                <label className="knowledge-setting-label" htmlFor="knowledge-editor-category-select">
                  分类
                </label>
                <select
                  id="knowledge-editor-category-select"
                  value={model.category}
                  onChange={(e) => onCategoryChange?.(e.target.value)}
                  className="knowledge-select knowledge-select--full"
                >
                  <option value="使用教程">使用教程</option>
                  <option value="系统设计">系统设计</option>
                  <option value="网络协议">网络协议</option>
                  <option value="前端架构">前端架构</option>
                  <option value="General">General</option>
                  <option value="Learning">Learning</option>
                  {model.category &&
                  !['使用教程', '系统设计', '网络协议', '前端架构', 'General', 'Learning'].includes(
                    model.category,
                  ) ? (
                    <option value={model.category}>{model.category}</option>
                  ) : null}
                </select>
              </div>

              {/* 标签胶囊管理 */}
              <div className="knowledge-setting-item">
                <label className="knowledge-setting-label">标签</label>
                <div className="knowledge-tag-chips-wrap">
                  {model.tags.map((t) => (
                    <span key={t} className="knowledge-tag-chip">
                      <span>{t}</span>
                      <button
                        type="button"
                        className="knowledge-tag-chip__remove"
                        onClick={() => onTagsChange?.(model.tags.filter((item) => item !== t))}
                        aria-label={`移除标签 ${t}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="knowledge-tag-add-btn"
                    onClick={() => {
                      const newTag = window.prompt('请输入新标签:');
                      if (newTag && newTag.trim() && !model.tags.includes(newTag.trim())) {
                        onTagsChange?.([...model.tags, newTag.trim()]);
                      }
                    }}
                  >
                    + 添加标签
                  </button>
                </div>
              </div>

              {/* 封面缩略与更换 */}
              <div className="knowledge-setting-item">
                <label className="knowledge-setting-label">封面</label>
                <div className="knowledge-cover-row">
                  <div className="knowledge-cover-thumbnail">
                    <img
                      src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=240&auto=format&fit=crop&q=80"
                      alt="文档封面"
                      className="knowledge-cover-img"
                    />
                  </div>
                  <button
                    type="button"
                    className="knowledge-button knowledge-button--quiet knowledge-button--small knowledge-cover-change-btn"
                    onClick={() => window.alert('更换封面：支持从知识库资源或本地图片设置。')}
                  >
                    更换封面
                  </button>
                </div>
              </div>

              {/* 当前状态展示 */}
              <div className="knowledge-setting-item">
                <label className="knowledge-setting-label">当前状态</label>
                <div className="knowledge-current-status-card">
                  <div className="knowledge-current-status-title">
                    <span
                      className={`knowledge-status-dot knowledge-status-dot--${model.status ?? 'draft'}`}
                      aria-hidden="true"
                    />
                    <strong>
                      {model.status === 'published'
                        ? hasUnpublishedEdits
                          ? '已发布 · 有未发布修改'
                          : '已发布'
                        : '草稿'}
                    </strong>
                  </div>
                  <p className="knowledge-current-status-subtitle">
                    {lastPublishedAt ? `上次发布于 ${lastPublishedAt}` : '尚未发布'}
                  </p>
                </div>
              </div>
            </div>
          </details>

          {/* 分组 2: 页面属性（置顶、精选、自定义路径 slug） */}
          <details open className="knowledge-prop-card" aria-labelledby="heading-page-props">
            <summary id="heading-page-props" className="knowledge-settings-title" style={{ cursor: 'pointer', listStyle: 'none' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>页面属性</span>
                <span className="knowledge-version-link-arrow" aria-hidden="true">▾</span>
              </span>
            </summary>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem' }}>
              {/* URL Slug (自定义路径) */}
              <label className="knowledge-editor__field" htmlFor="knowledge-editor-slug">
                <span className="knowledge-field-label-row">
                  <span>URL Slug (自定义路径)</span>
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

              {/* 置顶与精选勾选框 */}
              <div className="knowledge-checkbox-stack">
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
              </div>
            </div>
          </details>

          {/* 分组 3: 版本快照与历史 */}
          <details open className="knowledge-prop-card" aria-labelledby="heading-versions">
            <summary id="heading-versions" className="knowledge-settings-title" style={{ cursor: 'pointer', listStyle: 'none' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>版本快照与历史</span>
                <span className="knowledge-version-link-arrow" aria-hidden="true">▾</span>
              </span>
            </summary>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem' }}>
              <div className="knowledge-editor__section-heading">
                <div>
                  <p className="knowledge-shell__eyebrow" style={{ margin: 0 }}>VERSIONS // 0x0B</p>
                  <h4 id="knowledge-versions-heading" style={{ margin: 0, fontSize: '0.92rem' }}>
                    历史快照 ({versions?.length ?? 0})
                  </h4>
                </div>
                {!isNew && onSaveVersion ? (
                  <button
                    type="button"
                    className="knowledge-button knowledge-button--quiet knowledge-button--small"
                    onClick={onSaveVersion}
                    disabled={
                      !onSaveVersion || state === 'saving' || versionState === 'saving' || saveBusy
                    }
                    title="创建只读历史快照"
                  >
                    创建快照
                  </button>
                ) : null}
              </div>

              <p className="knowledge-asset-panel__boundary" style={{ fontSize: '0.8rem', color: '#6e6e73', margin: 0 }}>
                恢复版本前，系统会自动为您当前的编辑内容创建安全备份。
              </p>

              {!versions || versions.length === 0 ? (
                <p className="knowledge-empty-state">暂无历史快照。点击顶栏“保存快照”或“创建快照”创建。</p>
              ) : (
                <ul className="knowledge-version-list">
                  {versions.map((ver) => (
                    <li className="knowledge-version-row" key={ver.id}>
                      <div className="knowledge-version-row__info">
                        <strong>{new Date(ver.createdAt).toLocaleString('zh-CN')}</strong>
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
            </div>
          </details>

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

      {/* 4. 发布检查抽屉 (Publish Inspection Drawer) */}
      {isPublishDrawerOpen ? (
        <>
          <div
            className="knowledge-drawer-backdrop"
            onClick={() => setIsPublishDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="knowledge-publish-drawer is-open"
            aria-label="发布检查"
            role="dialog"
            aria-modal="true"
          >
            <div className="knowledge-publish-drawer__header">
              <h3>发布检查</h3>
              <button
                type="button"
                className="knowledge-publish-drawer__close"
                onClick={() => setIsPublishDrawerOpen(false)}
                aria-label="关闭发布检查"
              >
                ✕
              </button>
            </div>

            <div className="knowledge-publish-drawer__body">
              {/* 左侧检查项 */}
              <div className="knowledge-publish-checks">
                {/* 1. 草稿保存状态 */}
                <div className="knowledge-publish-check-item">
                  <div
                    className={`knowledge-publish-check-icon ${
                      isDraftSaved
                        ? 'knowledge-publish-check-icon--success'
                        : isDraftFailed
                          ? 'knowledge-publish-check-icon--error'
                          : 'knowledge-publish-check-icon--warning'
                    }`}
                    style={{
                      backgroundColor: isDraftSaved
                        ? '#10b981'
                        : isDraftFailed
                          ? '#ef4444'
                          : '#f59e0b',
                      color: '#ffffff',
                    }}
                  >
                    {isDraftSaved ? '✓' : isDraftFailed ? '⚠' : '↻'}
                  </div>
                  <div className="knowledge-publish-check-content">
                    <strong>
                      {isDraftSaved
                        ? '✓ 草稿已保存'
                        : isDraftFailed
                          ? '⚠ 草稿保存失败'
                          : state === 'saving'
                            ? '草稿正在保存…'
                            : '草稿待保存'}
                    </strong>
                    <p>
                      {isDraftSaved
                        ? '当前文档已保存到草稿'
                        : isDraftFailed
                          ? '草稿保存失败，请检查网络后重试'
                          : state === 'saving'
                            ? '正在自动保存草稿到服务器'
                            : '存在未保存的修改，发布时将自动同步'}
                    </p>
                  </div>
                </div>

                {/* 2. 附件状态 */}
                <div className="knowledge-publish-check-item">
                  <div
                    className={`knowledge-publish-check-icon ${
                      !hasUploadingAssets && !hasFailedAssets
                        ? 'knowledge-publish-check-icon--success'
                        : hasFailedAssets
                          ? 'knowledge-publish-check-icon--error'
                          : 'knowledge-publish-check-icon--warning'
                    }`}
                    style={{
                      backgroundColor:
                        !hasUploadingAssets && !hasFailedAssets
                          ? '#10b981'
                          : hasFailedAssets
                            ? '#ef4444'
                            : '#f59e0b',
                      color: '#ffffff',
                    }}
                  >
                    {!hasUploadingAssets && !hasFailedAssets ? '✓' : hasFailedAssets ? '⚠' : '↻'}
                  </div>
                  <div className="knowledge-publish-check-content">
                    <strong>
                      {!hasUploadingAssets && !hasFailedAssets
                        ? '图片上传完成'
                        : hasFailedAssets
                          ? '附件上传失败'
                          : '附件正在上传…'}
                    </strong>
                    <p>
                      {!hasUploadingAssets && !hasFailedAssets
                        ? model.assets.length > 0
                          ? `文档中的 ${model.assets.length} 个附件均已上传完成`
                          : '文档中的图片均已上传完成'
                        : hasFailedAssets
                          ? `${failedAssets.length} 个附件上传失败，请重新上传或移除`
                          : `${uploadingAssets.length} 个附件正在上传中，请稍候`}
                    </p>
                  </div>
                </div>

                {/* 3. 内容校验 */}
                <div className="knowledge-publish-check-item">
                  <div
                    className={`knowledge-publish-check-icon ${
                      hasValidTitle
                        ? 'knowledge-publish-check-icon--success'
                        : 'knowledge-publish-check-icon--error'
                    }`}
                    style={{
                      backgroundColor: hasValidTitle ? '#10b981' : '#ef4444',
                      color: '#ffffff',
                    }}
                  >
                    {hasValidTitle ? '✓' : '⚠'}
                  </div>
                  <div className="knowledge-publish-check-content">
                    <strong>{hasValidTitle ? '内容检查通过' : '文章标题为空'}</strong>
                    <p>
                      {hasValidTitle
                        ? '未发现需要修改的问题'
                        : '文章标题不能为空，请先填写标题'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 右侧发布确认信息卡片 */}
              <div className="knowledge-publish-meta">
                <div className="knowledge-publish-card">
                  <div className="knowledge-publish-card__thumb">
                    <img
                      src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=120&auto=format&fit=crop&q=80"
                      alt="封面缩略图"
                    />
                  </div>
                  <div className="knowledge-publish-card__info">
                    <span className="knowledge-publish-card__label">摘要</span>
                    <p className="knowledge-publish-card__text">
                      {model.summary ||
                        '在内容工作台中上传图片并完成内容发布的完整流程，帮助你更高效地完成创作与发布。'}
                    </p>
                  </div>
                </div>

                <div className="knowledge-publish-field">
                  <label>分类</label>
                  <select
                    value={model.category}
                    onChange={(e) => onCategoryChange?.(e.target.value)}
                    className="knowledge-select"
                  >
                    <option value="使用教程">使用教程</option>
                    <option value="系统设计">系统设计</option>
                    <option value="网络协议">网络协议</option>
                    <option value="前端架构">前端架构</option>
                    <option value="General">General</option>
                    <option value="Learning">Learning</option>
                    {model.category &&
                    !['使用教程', '系统设计', '网络协议', '前端架构', 'General', 'Learning'].includes(
                      model.category,
                    ) ? (
                      <option value={model.category}>{model.category}</option>
                    ) : null}
                  </select>
                </div>

                <div className="knowledge-publish-field">
                  <label>封面</label>
                  <div className="knowledge-publish-cover-row">
                    <img
                      src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=160&auto=format&fit=crop&q=80"
                      alt="封面预览"
                      className="knowledge-publish-cover-preview"
                    />
                    <button
                      type="button"
                      className="knowledge-button knowledge-button--quiet knowledge-button--small"
                    >
                      更换封面
                    </button>
                  </div>
                </div>

                <div className="knowledge-publish-action-wrap">
                  {(publishError || errorMessage) ? (
                    <div
                      className="knowledge-publish-error"
                      role="alert"
                      style={{
                        marginBottom: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '0.375rem',
                        fontSize: '0.82rem',
                        lineHeight: '1.4',
                        textAlign: 'left',
                      }}
                    >
                      <span>⚠ {publishError || errorMessage}</span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="knowledge-button knowledge-button--primary knowledge-publish-submit-btn"
                    onClick={handlePublishConfirm}
                    disabled={isPublishDisabled}
                  >
                    {publishBusy
                      ? '正在发布…'
                      : model.status === 'published'
                        ? '确认发布更新'
                        : '确认发布'}
                  </button>
                  <p className="knowledge-publish-helper-text">发布后更新阅读版本</p>
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
