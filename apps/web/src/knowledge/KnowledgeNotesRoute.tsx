import { useCallback, useEffect, useRef, useState } from 'react';
import { NotesPage } from '../knowledge-ui/NotesPage';
import type { NotesViewModel } from '../knowledge-ui/fixtures';
import { mapNoteToCard } from './knowledge-adapter';
import { archiveKnowledgeNote, loadKnowledgeNotes, restoreKnowledgeNote } from './knowledge-api';
const initial: NotesViewModel = { searchTerm: '', filterLabel: 'All notes', notes: [] };
export function KnowledgeNotesRoute() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [model, setModel] = useState(initial);
  const [mutatingNoteId, setMutatingNoteId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const generation = useRef(0);
  const mutationLock = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    setState('loading');
    loadKnowledgeNotes({ q: searchTerm, page, pageSize: 20 })
      .then((result) => {
        if (generation.current !== current) return;
        const notes = result.items.map(mapNoteToCard);
        setModel({ searchTerm, filterLabel: 'All notes', notes });
        setState(notes.length ? 'ready' : 'empty');
      })
      .catch(() => { if (generation.current === current) setState('error'); });
    return () => { generation.current += 1; };
  }, [searchTerm, page, refresh]);

  const mutate = useCallback(async (noteId: string, operation: (id: string) => Promise<unknown>) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setMutatingNoteId(noteId);
    setMutationError(null);
    try {
      await operation(noteId);
      setRefresh((current) => current + 1);
    } catch {
      setMutationError('The note could not be updated.');
    } finally {
      mutationLock.current = false;
      setMutatingNoteId(null);
    }
  }, []);

  return <NotesPage model={model} state={state} onSearchChange={(value) => { setSearchTerm(value); setPage(1); }} onClearSearch={() => { setSearchTerm(''); setPage(1); }} onArchive={(noteId) => { void mutate(noteId, archiveKnowledgeNote); }} onRestore={(noteId) => { void mutate(noteId, restoreKnowledgeNote); }} mutatingNoteId={mutatingNoteId} mutationError={mutationError} />;
}
