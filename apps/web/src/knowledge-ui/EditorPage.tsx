import { useState, type ReactNode } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';

import { AssetPanel } from './AssetPanel';
import type { EditorAsset, EditorViewModel, HighlightKind, NoteStatus } from './editor-fixtures';
import { highlightKinds } from './editor-fixtures';
import type { NoteVersionRecord } from '@namdw/shared';
import './knowledge.css';

export type EditorPresentationState = 'unchanged' | 'unsaved' | 'saving' | 'saved' | 'failed';
export type VersionPresentationState = 'idle' | 'saving' | 'saved' | 'failed';

type EditorPageProps = {
  model: EditorViewModel;
  state?: EditorPresentationState;
  versionState?: VersionPresentationState;
  selectedHighlight?: HighlightKind | null;
  documentSlot?: ReactNode;
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
  onSaveVersion?: () => void;
  onRestoreVersion?: (version: NoteVersionRecord) => void;
  onOpenVersions?: () => void;
  onUpload?: (file: File) => void;
  onDownload?: (assetId: string) => void;
  onDelete?: (assetId: string) => void;
  onInsertAsset?: (asset: EditorAsset) => void;
  attachmentUnavailableMessage?: string | undefined;
  isNew?: boolean;
};

const stateLabels: Record<EditorPresentationState, string> = {
  unchanged: 'No changes',
  unsaved: 'Unsaved changes',
  saving: 'Saving',
  saved: 'Saved',
  failed: 'Save failed',
};

const versionStateLabels: Record<Exclude<VersionPresentationState, 'idle'>, string> = {
  saving: 'Saving version',
  saved: 'Version saved',
  failed: 'Version could not be saved',
};

function labelForKind(kind: HighlightKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function EditorPage({
  model,
  state = 'unchanged',
  versionState = 'idle',
  selectedHighlight = null,
  documentSlot,
  versions,
  onTitleChange,
  onSummaryChange,
  onCategoryChange,
  onTagsChange,
  onStatusChange,
  onFeaturedChange,
  onPinnedChange,
  onSlugChange,
  onContentChange,
  onHighlight,
  onRemoveHighlight,
  onSave,
  onSaveVersion,
  onRestoreVersion,
  onOpenVersions,
  onUpload,
  onDownload,
  onDelete,
  onInsertAsset,
  attachmentUnavailableMessage,
  isNew = false,
}: EditorPageProps) {
  const [showVersions, setShowVersions] = useState(false);
  const inRouter = useInRouterContext();
  const navigation = inRouter ? (
    <nav className="knowledge-page-actions" aria-label="笔记导航">
      <Link className="knowledge-button knowledge-button--quiet" to="/knowledge">
        知识库概览
      </Link>
      <Link className="knowledge-button knowledge-button--quiet" to="/knowledge/notes">
        笔记列表
      </Link>
      {model.id && !isNew ? (
        <Link
          className="knowledge-button knowledge-button--quiet"
          to={`/knowledge/notes/${model.id}/read`}
        >
          阅读模式 ↗
        </Link>
      ) : null}
      {model.status === 'published' && model.slug ? (
        <Link className="knowledge-button knowledge-button--quiet" to={`/posts/${model.slug}`}>
          公开文章 ↗
        </Link>
      ) : null}
    </nav>
  ) : (
    <nav className="knowledge-page-actions" aria-label="笔记导航">
      <a className="knowledge-button knowledge-button--quiet" href="/knowledge">
        知识库概览
      </a>
      <a className="knowledge-button knowledge-button--quiet" href="/knowledge/notes">
        笔记列表
      </a>
      {model.id && !isNew ? (
        <a
          className="knowledge-button knowledge-button--quiet"
          href={`/knowledge/notes/${model.id}/read`}
        >
          阅读模式 ↗
        </a>
      ) : null}
    </nav>
  );
  return (
    <section className="knowledge-shell knowledge-editor" aria-labelledby="knowledge-editor-title">
      <header className="knowledge-editor__header">
        <div>
          <div className="knowledge-shell__meta" aria-hidden="true">
            <span>WORKSPACE // 0x03</span>
            <span className="knowledge-shell__sep">·</span>
            <span>{isNew ? '新建文章' : '编辑文章'}</span>
          </div>
          <p className="knowledge-shell__eyebrow">KNOWLEDGE WORKSPACE</p>
          <h1 id="knowledge-editor-title">{isNew ? 'New article' : 'Edit article'}</h1>
          {navigation}
        </div>
        <div className="knowledge-editor__actions">
          <span
            className={`knowledge-save-state knowledge-save-state--${state}`}
            role="status"
            aria-live="polite"
          >
            {stateLabels[state]}
          </span>
          <button type="button" onClick={onSave} disabled={!onSave || state === 'saving'} aria-label="Save">
            Save
          </button>
          {!isNew ? (
            <>
              <button
                type="button"
                className="knowledge-button--secondary"
                onClick={onSaveVersion}
                disabled={!onSaveVersion || state === 'saving' || versionState === 'saving'}
                aria-label="Save Version"
              >
                Save Version
              </button>
              <button
                type="button"
                className="knowledge-button--quiet"
                onClick={() => {
                  setShowVersions((prev) => !prev);
                  if (!showVersions) onOpenVersions?.();
                }}
              >
                {showVersions ? '收起历史' : '版本历史'}
              </button>
            </>
          ) : null}
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
      </header>

      <div className="knowledge-editor__layout">
        <section className="knowledge-editor__main" aria-label="文章正文与元数据编辑">
          <label className="knowledge-editor__field" htmlFor="knowledge-editor-title-input">
            <span>Title</span>
            <input
              id="knowledge-editor-title-input"
              value={model.title}
              placeholder="请输入技术文章标题…"
              onChange={(event) => onTitleChange?.(event.target.value)}
              readOnly={!onTitleChange}
            />
          </label>
          <label className="knowledge-editor__field" htmlFor="knowledge-editor-summary">
            <span>文章摘要</span>
            <textarea
              id="knowledge-editor-summary"
              value={model.summary}
              placeholder="简要概括本文核心要点与技术推导结论…"
              onChange={(event) => onSummaryChange?.(event.target.value)}
              readOnly={!onSummaryChange}
              rows={3}
            />
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <label className="knowledge-editor__field" htmlFor="knowledge-editor-category">
              <span>文章分类</span>
              <input
                id="knowledge-editor-category"
                value={model.category}
                placeholder="例如：Learning / Engineering"
                onChange={(event) => onCategoryChange?.(event.target.value)}
                readOnly={!onCategoryChange}
              />
            </label>
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
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              alignItems: 'end',
            }}
          >
            <label className="knowledge-editor__field" htmlFor="knowledge-editor-status">
              <span>发布状态</span>
              <select
                id="knowledge-editor-status"
                value={model.status ?? 'draft'}
                onChange={(event) => onStatusChange?.(event.target.value as NoteStatus)}
                disabled={!onStatusChange}
                style={{
                  border: '1px solid var(--color-border, #d2d2d7)',
                  borderRadius: '0.65rem',
                  padding: '0.7rem 0.8rem',
                  background: 'var(--color-surface, #fff)',
                  font: 'inherit',
                }}
              >
                <option value="draft">草稿 (Draft)</option>
                <option value="published">已发布 (Published)</option>
                <option value="archived">已归档 (Archived)</option>
              </select>
            </label>

            <label className="knowledge-editor__field" htmlFor="knowledge-editor-slug">
              <span>文章链接 Slug (URL 路径)</span>
              <input
                id="knowledge-editor-slug"
                value={model.slug ?? ''}
                placeholder="留空自动根据标题生成"
                onChange={(event) => onSlugChange?.(event.target.value)}
                readOnly={!onSlugChange}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', margin: '0.25rem 0' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(model.isFeatured)}
                onChange={(event) => onFeaturedChange?.(event.target.checked)}
                disabled={!onFeaturedChange}
              />
              <span>首页精选展示 (Featured on Homepage)</span>
            </label>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(model.isPinned)}
                onChange={(event) => onPinnedChange?.(event.target.checked)}
                disabled={!onPinnedChange}
              />
              <span>知识库置顶 (Pinned in Notes)</span>
            </label>
          </div>

          <section
            className="knowledge-editor__document"
            aria-labelledby="knowledge-document-heading"
          >
            <div className="knowledge-editor__section-heading">
              <h2 id="knowledge-document-heading">Document</h2>
              <div className="knowledge-highlight-toolbar" aria-label="Semantic highlights">
                {highlightKinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={selectedHighlight === kind}
                    onClick={() => onHighlight?.(kind)}
                  >
                    {labelForKind(kind)}
                  </button>
                ))}
                <button
                  type="button"
                  className="knowledge-button--quiet"
                  onClick={onRemoveHighlight}
                >
                  Remove highlight
                </button>
              </div>
            </div>
            {documentSlot ? (
              <div className="knowledge-editor__slot">{documentSlot}</div>
            ) : (
              <textarea
                aria-label="Document"
                value={model.contentJson}
                onChange={(event) => onContentChange?.(event.target.value)}
                readOnly={!onContentChange}
                rows={8}
              />
            )}
          </section>
        </section>
        <div className="knowledge-editor__sidebar-stack">
          {showVersions ? (
            <aside className="knowledge-version-panel" aria-labelledby="knowledge-versions-heading">
              <div className="knowledge-editor__section-heading">
                <div>
                  <p className="knowledge-shell__eyebrow">VERSIONS // 0x0B</p>
                  <h2 id="knowledge-versions-heading">版本历史</h2>
                </div>
                <button
                  type="button"
                  className="knowledge-button knowledge-button--quiet"
                  onClick={() => setShowVersions(false)}
                >
                  收起
                </button>
              </div>
              <p className="knowledge-asset-panel__boundary">
                查看历史版本快照。恢复前系统会自动保存当前内容为新版本。
              </p>
              {!versions || versions.length === 0 ? (
                <p className="knowledge-empty-state">暂无历史版本快照。点击“保存快照”创建。</p>
              ) : (
                <ul className="knowledge-version-list">
                  {versions.map((ver) => (
                    <li className="knowledge-version-row" key={ver.id}>
                      <div className="knowledge-version-row__info">
                        <strong>{new Date(ver.createdAt).toLocaleString('zh-CN')}</strong>
                        <span>
                          {ver.contentText
                            ? ver.contentText.slice(0, 50) + (ver.contentText.length > 50 ? '…' : '')
                            : '(正文内容)'}
                        </span>
                      </div>
                      <div className="knowledge-version-row__actions">
                        <button
                          type="button"
                          className="knowledge-button knowledge-button--quiet"
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
          <AssetPanel
            assets={model.assets}
            onUpload={onUpload}
            onDownload={onDownload}
            onDelete={onDelete}
            onInsert={onInsertAsset}
            unavailableMessage={attachmentUnavailableMessage}
          />
        </div>
      </div>
    </section>
  );
}
