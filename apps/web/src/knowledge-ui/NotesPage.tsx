import type { NoteCardViewModel, NotesViewModel } from './fixtures';
import './knowledge.css';

type NotesPresentationState = 'ready' | 'loading' | 'empty' | 'error';

type NotesPageProps = {
  model: NotesViewModel;
  state?: NotesPresentationState;
  onSearchChange?: (value: string) => void;
  onClearSearch?: () => void;
};

function NoteCard({ note }: { note: NoteCardViewModel }) {
  return (
    <article className={`knowledge-note-card${note.archived ? ' knowledge-note-card--archived' : ''}`} aria-label={note.title}>
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
    </article>
  );
}

export function NotesPage({ model, state = 'ready', onSearchChange, onClearSearch }: NotesPageProps) {
  return (
    <section className="knowledge-shell" aria-labelledby="knowledge-notes-title">
      <header className="knowledge-shell__heading">
        <p className="knowledge-shell__eyebrow">Private workspace</p>
        <h1 id="knowledge-notes-title">Notes</h1>
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
      {state === 'empty' ? (
        <section className="knowledge-empty-state" aria-labelledby="knowledge-empty-title">
          <h2 id="knowledge-empty-title">No notes yet</h2>
          <p>Your next note will appear here.</p>
        </section>
      ) : null}
      {state === 'ready' ? <div className="knowledge-note-grid">{model.notes.map((note) => <NoteCard key={note.id} note={note} />)}</div> : null}
    </section>
  );
}
