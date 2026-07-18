import { useEffect, useRef, useState } from 'react';
import { NotesPage } from '../knowledge-ui/NotesPage';
import type { NotesViewModel } from '../knowledge-ui/fixtures';
import { mapNoteToCard } from './knowledge-adapter';
import { loadKnowledgeNotes } from './knowledge-api';
const initial: NotesViewModel = { searchTerm: '', filterLabel: 'All notes', notes: [] };
export function KnowledgeNotesRoute() { const [searchTerm, setSearchTerm] = useState(''); const [page, setPage] = useState(1); const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading'); const [model, setModel] = useState(initial); const generation = useRef(0); useEffect(() => { const current = ++generation.current; setState('loading'); loadKnowledgeNotes({ q: searchTerm, page, pageSize: 20 }).then((result) => { if (generation.current !== current) return; const notes = result.items.map(mapNoteToCard); setModel({ searchTerm, filterLabel: 'All notes', notes }); setState(notes.length ? 'ready' : 'empty'); }).catch(() => { if (generation.current === current) setState('error'); }); return () => { generation.current += 1; }; }, [searchTerm, page]); return <NotesPage model={model} state={state} onSearchChange={(value) => { setSearchTerm(value); setPage(1); }} onClearSearch={() => { setSearchTerm(''); setPage(1); }} />; }
