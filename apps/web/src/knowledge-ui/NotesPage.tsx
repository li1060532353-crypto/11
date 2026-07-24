import type { NoteCardViewModel, NotesViewModel } from './fixtures';
import { Link } from 'react-router-dom';
import './knowledge.css';

type NotesPresentationState = 'ready' | 'loading' | 'empty' | 'error';

type NotesPageProps = {
  model: NotesViewModel;
  state?: NotesPresentationState;
  onSearchChange?: (value: string) => void;
  onClearSearch?: () => void;
  onArchive?: (noteId: string) => void;
  onRestore?: (noteId: string) => void;
  mutatingNoteId?: string | null;
  mutationError?: string | null;
};

function NoteCard({ note, onArchive, onRestore, mutatingNoteId }: { note: NoteCardViewModel; onArchive?: (noteId: string) => void; onRestore?: (noteId: string) => void; mutatingNoteId?: string | null }) {
  const isMutating = mutatingNoteId === note.id;
  return (
    <article className="knowledge-note-card-wrap">
      <Link className={`knowledge-note-card${note.archived ? ' knowledge-note-card--archived' : ''}`} to={`/knowledge/notes/${note.id}`} aria-label={note.title}>
        <div className="knowledge-note-card__topline">
          <span>{note.category}</span>
          <div className="knowledge-note-card__states">
            {note.pinned ? <span className="knowledge-badge knowledge-badge--pinned">Pinned</span> : null}
            {note.archived ? <span className="knowledge-badge knowledge-badge--archived">Archived</span> : null}
          </div>
        </div>
        <h2>{note.title}</h2>
        <p>{note.summary}</p>
        <footer className="knowledge-note-card__footer"><span>{note.updatedLabel}</span></footer>
      </Link>
      {note.archived && onRestore ? <button type="button" className="knowledge-note-card__action" disabled={isMutating} onClick={() => onRestore(note.id)}>Restore {note.title}</button> : null}
      {!note.archived && onArchive ? <button type="button" className="knowledge-note-card__action" disabled={isMutating} onClick={() => onArchive(note.id)}>Archive {note.title}</button> : null}
    </article>
  );
}

export function NotesPage({ model, state = 'ready', onSearchChange, onClearSearch, onArchive, onRestore, mutatingNoteId, mutationError }: NotesPageProps) {
  return (
    <section className="knowledge-shell" aria-labelledby="knowledge-notes-title">
      <header className="knowledge-shell__heading">
        <p className="knowledge-shell__eyebrow">Private workspace</p>
        <h1 id="knowledge-notes-title">Notes</h1>
        <nav className="knowledge-page-actions" aria-label="笔记导航">
          <Link className="knowledge-button knowledge-button--quiet" to="/knowledge">知识库概览</Link>
          <Link className="knowledge-button knowledge-button--primary" to="/knowledge/notes/new">新建笔记</Link>
        </nav>
      </header>
      <div className="knowledge-notes-controls">
        <label className="knowledge-search-field" htmlFor="knowledge-note-search">
          <span>Search notes</span>
          <input id="knowledge-note-search" type="search" placeholder="Search your notes" value={model.searchTerm} readOnly={!onSearchChange} onChange={(event) => onSearchChange?.(event.target.value)} />
        </label>
        <button type="button" disabled={!onClearSearch || !model.searchTerm} aria-disabled={!onClearSearch || !model.searchTerm} onClick={onClearSearch}>Clear search</button>
        <p className="knowledge-filter-label" aria-label="Current filter">{model.filterLabel}</p>
      </div>
      {state === 'loading' ? <p className="knowledge-message" role="status">Loading notes</p> : null}
      {state === 'error' ? <p className="knowledge-message knowledge-message--error" role="alert">Notes could not be loaded</p> : null}
      {mutationError ? <p className="knowledge-message knowledge-message--error" role="alert">{mutationError}</p> : null}
      {state === 'empty' ? (
        <section className="knowledge-empty-state" aria-labelledby="knowledge-empty-title">
          <h2 id="knowledge-empty-title">No notes yet</h2>
          <p>Your next note will appear here.</p>
          <Link className="knowledge-button knowledge-button--primary" to="/knowledge/notes/new">创建第一篇笔记</Link>
        </section>
      ) : null}
      {state === 'ready' ? <div className="knowledge-note-grid">{model.notes.map((note) => <NoteCard key={note.id} note={note} {...(onArchive ? { onArchive } : {})} {...(onRestore ? { onRestore } : {})} {...(mutatingNoteId !== undefined ? { mutatingNoteId } : {})} />)}</div> : null}
    </section>
  );
}
