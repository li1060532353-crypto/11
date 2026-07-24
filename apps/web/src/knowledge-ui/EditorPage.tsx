import type { ReactNode } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';

import { AssetPanel } from './AssetPanel';
import type { EditorViewModel, HighlightKind } from './editor-fixtures';
import { highlightKinds } from './editor-fixtures';
import './knowledge.css';

export type EditorPresentationState = 'unchanged' | 'unsaved' | 'saving' | 'saved' | 'failed';
export type VersionPresentationState = 'idle' | 'saving' | 'saved' | 'failed';

type EditorPageProps = {
  model: EditorViewModel;
  state?: EditorPresentationState;
  versionState?: VersionPresentationState;
  selectedHighlight?: HighlightKind | null;
  documentSlot?: ReactNode;
  onTitleChange?: (value: string) => void;
  onSummaryChange?: (value: string) => void;
  onContentChange?: (value: string) => void;
  onHighlight?: (kind: HighlightKind) => void;
  onRemoveHighlight?: () => void;
  onSave?: () => void;
  onSaveVersion?: () => void;
  onUpload?: (file: File) => void;
  onDownload?: (assetId: string) => void;
  onDelete?: (assetId: string) => void;
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
  onTitleChange,
  onSummaryChange,
  onContentChange,
  onHighlight,
  onRemoveHighlight,
  onSave,
  onSaveVersion,
  onUpload,
  onDownload,
  onDelete,
  attachmentUnavailableMessage,
  isNew = false,
}: EditorPageProps) {
  const inRouter = useInRouterContext();
  const navigation = inRouter ? (
    <nav className="knowledge-page-actions" aria-label="笔记导航"><Link className="knowledge-button knowledge-button--quiet" to="/knowledge">知识库概览</Link><Link className="knowledge-button knowledge-button--quiet" to="/knowledge/notes">笔记列表</Link></nav>
  ) : (
    <nav className="knowledge-page-actions" aria-label="笔记导航"><a className="knowledge-button knowledge-button--quiet" href="/knowledge">知识库概览</a><a className="knowledge-button knowledge-button--quiet" href="/knowledge/notes">笔记列表</a></nav>
  );
  return (
    <section className="knowledge-shell knowledge-editor" aria-labelledby="knowledge-editor-title">
      <header className="knowledge-editor__header">
        <div>
          <p className="knowledge-shell__eyebrow">Knowledge workspace</p>
          <h1 id="knowledge-editor-title">{isNew ? 'New article' : 'Edit article'}</h1>
          {navigation}
        </div>
        <div className="knowledge-editor__actions">
          <span className={`knowledge-save-state knowledge-save-state--${state}`} role="status" aria-live="polite">{stateLabels[state]}</span>
          <button type="button" onClick={onSave} disabled={!onSave || state === 'saving'}>Save</button>
          <button type="button" className="knowledge-button--secondary" onClick={onSaveVersion} disabled={!onSaveVersion || state === 'saving' || versionState === 'saving'}>Save Version</button>
          {versionState !== 'idle' ? <span className={`knowledge-version-state knowledge-version-state--${versionState}`} role={versionState === 'failed' ? 'alert' : 'status'} aria-live="polite">{versionStateLabels[versionState]}</span> : null}
        </div>
      </header>

      <div className="knowledge-editor__layout">
        <section className="knowledge-editor__main" aria-label="Note editor">
          <label className="knowledge-editor__field" htmlFor="knowledge-editor-title-input">
            <span>Title</span>
            <input id="knowledge-editor-title-input" value={model.title} onChange={(event) => onTitleChange?.(event.target.value)} readOnly={!onTitleChange} />
          </label>
          <label className="knowledge-editor__field" htmlFor="knowledge-editor-summary">
            <span>Summary</span>
            <textarea id="knowledge-editor-summary" value={model.summary} onChange={(event) => onSummaryChange?.(event.target.value)} readOnly={!onSummaryChange} rows={3} />
          </label>
          <div className="knowledge-editor__metadata" aria-label="Note metadata">
            <span>{model.category}</span>
            <ul className="knowledge-tag-list" aria-label="Tags">{model.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
          </div>
          <section className="knowledge-editor__document" aria-labelledby="knowledge-document-heading">
            <div className="knowledge-editor__section-heading">
              <h2 id="knowledge-document-heading">Document</h2>
              <div className="knowledge-highlight-toolbar" aria-label="Semantic highlights">
                {highlightKinds.map((kind) => <button key={kind} type="button" aria-pressed={selectedHighlight === kind} onClick={() => onHighlight?.(kind)}>{labelForKind(kind)}</button>)}
                <button type="button" className="knowledge-button--quiet" onClick={onRemoveHighlight}>Remove highlight</button>
              </div>
            </div>
            {documentSlot ? <div className="knowledge-editor__slot">{documentSlot}</div> : <textarea aria-label="Document" value={model.contentJson} onChange={(event) => onContentChange?.(event.target.value)} readOnly={!onContentChange} rows={8} />}
          </section>
        </section>
        <AssetPanel assets={model.assets} onUpload={onUpload} onDownload={onDownload} onDelete={onDelete} unavailableMessage={attachmentUnavailableMessage} />
      </div>
    </section>
  );
}
