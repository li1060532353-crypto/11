import type { NoteCardViewModel, NotesViewModel } from './fixtures';
import { Link } from 'react-router-dom';
import { KnowledgeShell } from './KnowledgeShell';
import './knowledge.css';

type NotesPresentationState = 'ready' | 'loading' | 'empty' | 'error';

type NotesPageProps = {
  model: NotesViewModel;
  state?: NotesPresentationState;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onSearchChange?: (value: string) => void;
  onClearSearch?: () => void;
  onArchive?: (noteId: string) => void;
  onRestore?: (noteId: string) => void;
  mutatingNoteId?: string | null;
  mutationError?: string | null;
};

function formatStatus(status: NonNullable<NoteCardViewModel['status']>) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function NoteCard({
  note,
  onArchive,
  onRestore,
  mutatingNoteId,
}: {
  note: NoteCardViewModel;
  onArchive?: (noteId: string) => void;
  onRestore?: (noteId: string) => void;
  mutatingNoteId?: string | null;
}) {
  const isMutating = mutatingNoteId === note.id;
  return (
    <article className="knowledge-note-card-wrap">
      <Link
        className={`knowledge-note-card${note.archived ? ' knowledge-note-card--archived' : ''}`}
        to={`/knowledge/notes/${note.id}`}
        aria-label={note.title}
      >
        <div className="knowledge-note-card__topline">
          <span className="knowledge-note-card__category">{note.category}</span>
          <div className="knowledge-note-card__states">
            {note.pinned ? (
              <span className="knowledge-badge knowledge-badge--pinned">Pinned</span>
            ) : null}
            {note.status ? (
              <span className={`knowledge-badge knowledge-badge--${note.status}`}>
                {formatStatus(note.status)}
              </span>
            ) : null}
          </div>
        </div>
        <h2>{note.title}</h2>
        <p>{note.summary}</p>
        <footer className="knowledge-note-card__footer">
          <span>{note.updatedLabel}</span>
        </footer>
      </Link>
      <div className="knowledge-note-card__actions">
        <Link className="knowledge-note-card__action" to={`/knowledge/notes/${note.id}/read`}>
          阅读
        </Link>
        <Link
          className="knowledge-note-card__action"
          to={`/knowledge/notes/${note.id}`}
          aria-label={`Edit ${note.title}`}
        >
          Edit {note.title}
        </Link>
        {note.archived && onRestore ? (
          <button
            type="button"
            className="knowledge-note-card__action"
            disabled={isMutating}
            onClick={() => onRestore(note.id)}
            aria-label={`Restore ${note.title}`}
          >
            Restore {note.title}
          </button>
        ) : null}
        {!note.archived && onArchive ? (
          <button
            type="button"
            className="knowledge-note-card__action"
            disabled={isMutating}
            onClick={() => onArchive(note.id)}
            aria-label={`Archive ${note.title}`}
          >
            Archive {note.title}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function NotesPage({
  model,
  state = 'ready',
  page = 1,
  totalPages = 1,
  totalItems = 0,
  onPageChange,
  onSearchChange,
  onClearSearch,
  onArchive,
  onRestore,
  mutatingNoteId,
  mutationError,
}: NotesPageProps) {
  return (
    <KnowledgeShell title="Knowledge workspace">
      <section className="knowledge-shell" aria-labelledby="knowledge-notes-title">
        <header className="knowledge-shell__heading">
          <div className="knowledge-shell__meta" aria-hidden="true">
            <span>WORKSPACE // 0x02</span>
            <span className="knowledge-shell__sep">·</span>
            <span>Articles</span>
          </div>
          <p className="knowledge-shell__eyebrow">Knowledge workspace</p>
          <h1 id="knowledge-notes-title">Articles</h1>
          <p className="knowledge-overview__intro">
            记录推导与实践，整理可复用的工程笔记。支持实时检索、分页浏览、归档与持续维护。
          </p>
          <nav className="knowledge-page-actions" aria-label="Article navigation">
            <Link className="knowledge-button knowledge-button--quiet" to="/knowledge">
              知识库概览
            </Link>
            <Link className="knowledge-button knowledge-button--quiet" to="/knowledge/import">
              导入 Markdown
            </Link>
            <Link
              className="knowledge-button knowledge-button--primary"
              to="/knowledge/notes/new"
              aria-label="Create article"
            >
              Create article
            </Link>
          </nav>
        </header>
        <div className="knowledge-notes-controls">
          <label className="knowledge-search-field" htmlFor="knowledge-note-search">
            <span>Search articles</span>
            <input
              id="knowledge-note-search"
              type="search"
              placeholder="Search your articles"
              value={model.searchTerm}
              readOnly={!onSearchChange}
              onChange={(event) => onSearchChange?.(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!onClearSearch || !model.searchTerm}
            aria-disabled={!onClearSearch || !model.searchTerm}
            onClick={onClearSearch}
            aria-label="Clear search"
          >
            Clear search
          </button>
          <p className="knowledge-filter-label" aria-label="Current filter">
            {model.filterLabel}
          </p>
        </div>
        {state === 'loading' ? (
          <p className="knowledge-message" role="status">
            Loading articles
          </p>
        ) : null}
        {state === 'error' ? (
          <p className="knowledge-message knowledge-message--error" role="alert">
            Articles could not be loaded
          </p>
        ) : null}
        {mutationError ? (
          <p className="knowledge-message knowledge-message--error" role="alert">
            {mutationError}
          </p>
        ) : null}
        {state === 'empty' ? (
          <section className="knowledge-empty-state" aria-labelledby="knowledge-empty-title">
            <h2 id="knowledge-empty-title">No articles yet</h2>
            <p>Your next article will appear here.</p>
            <Link className="knowledge-button knowledge-button--primary" to="/knowledge/notes/new">
              Create your first article
            </Link>
          </section>
        ) : null}
        {state === 'ready' ? (
          <>
            <div className="article-table__header" role="row" aria-hidden="true">
              <span className="article-table__th article-table__th--title">文章标题与摘要</span>
              <span className="article-table__th article-table__th--date">状态与操作</span>
            </div>
            <div className="knowledge-note-grid">
              {model.notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  {...(onArchive ? { onArchive } : {})}
                  {...(onRestore ? { onRestore } : {})}
                  {...(mutatingNoteId !== undefined ? { mutatingNoteId } : {})}
                />
              ))}
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
          </>
        ) : null}
      </section>
    </KnowledgeShell>
  );
}
