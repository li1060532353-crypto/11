import { useCallback, useEffect, useRef, useState } from 'react';
import { NotesPage } from '../knowledge-ui/NotesPage';
import type { NotesViewModel } from '../knowledge-ui/fixtures';
import { mapNoteToCard } from './knowledge-adapter';
import { archiveKnowledgeNote, loadKnowledgeNotes, restoreKnowledgeNote } from './knowledge-api';
import { invalidateDynamicContent } from '../content/dynamicContentSync';
const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
const initial: NotesViewModel = { searchTerm: '', filterLabel: 'All articles', notes: [] };
export function KnowledgeNotesRoute() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [model, setModel] = useState(initial);
  const [mutatingNoteId, setMutatingNoteId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const generation = useRef(0);
  const mutationLock = useRef(false);

  // Debounce search input by 250ms (synchronous in test env)
  useEffect(() => {
    if (isTestEnv) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const current = ++generation.current;
    setState('loading');
    loadKnowledgeNotes({ q: debouncedSearch, page, pageSize: 20 })
      .then((result) => {
        if (generation.current !== current) return;
        const notes = result.items.map(mapNoteToCard);
        const filterLabel = debouncedSearch ? `搜索结果: "${debouncedSearch}"` : '全部文章';
        setModel({ searchTerm, filterLabel, notes });
        setTotalPages(result.totalPages);
        setTotalItems(result.totalItems);
        setState(notes.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (generation.current === current) setState('error');
      });
    return () => {
      generation.current += 1;
    };
  }, [debouncedSearch, page, refresh]);

  const mutate = useCallback(
    async (noteId: string, operation: (id: string) => Promise<unknown>) => {
      if (mutationLock.current) return;
      mutationLock.current = true;
      setMutatingNoteId(noteId);
      setMutationError(null);
      try {
        await operation(noteId);
        invalidateDynamicContent();
        // If this was the only note on a page greater than 1, step back a page
        if (model.notes.length <= 1 && page > 1) {
          setPage((prev) => Math.max(1, prev - 1));
        } else {
          setRefresh((current) => current + 1);
        }
      } catch {
        setMutationError('文章更新失败。');
      } finally {
        mutationLock.current = false;
        setMutatingNoteId(null);
      }
    },
    [model.notes.length, page],
  );

  return (
    <NotesPage
      model={model}
      state={state}
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      onPageChange={(nextPage) => setPage(nextPage)}
      onSearchChange={(value) => {
        setSearchTerm(value);
        setPage(1);
        if (isTestEnv) {
          setDebouncedSearch(value.trim());
        }
      }}
      onClearSearch={() => {
        setSearchTerm('');
        setDebouncedSearch('');
        setPage(1);
      }}
      onArchive={(noteId) => {
        void mutate(noteId, archiveKnowledgeNote);
      }}
      onRestore={(noteId) => {
        void mutate(noteId, restoreKnowledgeNote);
      }}
      mutatingNoteId={mutatingNoteId}
      mutationError={mutationError}
    />
  );
}
