import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { KnowledgeHighlight } from '../knowledge-editor/KnowledgeHighlight';
import { EditorPage, type EditorPresentationState } from '../knowledge-ui/EditorPage';
import type { EditorViewModel } from '../knowledge-ui/editor-fixtures';
import type { CreateNoteRequest, NoteRecord, UpdateNoteRequest } from '@namdw/shared';
import { createKnowledgeNote, createKnowledgeNoteVersion, deleteKnowledgeAsset, downloadKnowledgeAsset, getKnowledgeNote, type KnowledgeApiFailure, updateKnowledgeNote, uploadKnowledgeAsset } from './knowledge-api';
import { useNoteAutosave } from './useNoteAutosave';

type Props = { mode: 'create' | 'edit' };
type Draft = Pick<CreateNoteRequest, 'title' | 'summary' | 'contentJson' | 'category' | 'status' | 'isPinned'>;
const emptyDocument = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
const initialDraft: Draft = { title: '', summary: '', contentJson: emptyDocument, category: 'General', status: 'draft', isPinned: false };
const toDraft = (note: NoteRecord): Draft => ({ title: note.title, summary: note.summary, contentJson: note.contentJson, category: note.category, status: note.status, isPinned: note.isPinned });
const keyOf = (draft: Draft) => JSON.stringify(draft);
const messageFor = (error: unknown) => ({ access: 'Access was denied.', validation: 'The note could not be saved.', 'not-found': 'The note was not found.', conflict: 'The note changed elsewhere.', repository: 'The note service is unavailable.', malformed: 'The note response was invalid.', network: 'The network request failed.', request: 'The note request failed.' }[(error as KnowledgeApiFailure).kind] ?? 'The note could not be loaded.');

export function KnowledgeEditorRoute({ mode }: Props) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [persistedKey, setPersistedKey] = useState(mode === 'create' ? keyOf(initialDraft) : '');
  const [loading, setLoading] = useState(mode === 'edit');
  const [error, setError] = useState<string | null>(null);
  const [createState, setCreateState] = useState<EditorPresentationState>('unchanged');
  const [versionState, setVersionState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [assets, setAssets] = useState<EditorViewModel['assets']>([]);
  const uploads = useRef(new Set<string>()); const downloads = useRef(new Set<string>()); const deletions = useRef(new Set<string>());
  const createBusy = useRef(false);
  const versionBusy = useRef(false);
  const draftKey = useMemo(() => keyOf(draft), [draft]);
  const noteId = mode === 'edit' ? id ?? null : null;

  const editor = useEditor({ extensions: [StarterKit, KnowledgeHighlight], content: JSON.parse(emptyDocument), onUpdate: ({ editor: current }) => setDraft((previous) => ({ ...previous, contentJson: JSON.stringify(current.getJSON()) })) });
  useEffect(() => { if (!editor) return; try { if (JSON.stringify(editor.getJSON()) !== draft.contentJson) editor.commands.setContent(JSON.parse(draft.contentJson), { emitUpdate: false }); } catch { setError('The note document could not be displayed.'); } }, [draft.contentJson, editor]);
  useEffect(() => {
    if (mode !== 'edit' || !noteId) return;
    const controller = new AbortController(); let active = true;
    setLoading(true); setError(null);
    getKnowledgeNote(noteId, controller.signal).then((note) => { if (!active) return; const next = toDraft(note); setDraft(next); setPersistedKey(keyOf(next)); setLoading(false); }).catch((reason) => { if (active) { setError(messageFor(reason)); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [mode, noteId]);

  const persist = useCallback(async (snapshot: string, signal: AbortSignal) => { if (!noteId) return; await updateKnowledgeNote(noteId, JSON.parse(snapshot) as UpdateNoteRequest, signal); }, [noteId]);
  const autosave = useNoteAutosave({ enabled: mode === 'edit' && !loading && Boolean(noteId), value: draftKey, persistedValue: persistedKey, save: persist, onPersisted: setPersistedKey });
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (autosave.dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [autosave.dirty]);

  const manualSave = useCallback(async () => {
    setError(null);
    if (mode === 'edit') { const saved = await autosave.saveCurrent(); if (!saved) setError('The note could not be saved.'); return saved; }
    if (createBusy.current) return false;
    createBusy.current = true;
    try { setCreateState('saving'); const created = await createKnowledgeNote(draft); const next = toDraft(created); setDraft(next); setPersistedKey(keyOf(next)); setCreateState('saved'); navigate(`/knowledge/notes/${created.id}`, { replace: true }); return true; } catch (reason) { setCreateState('failed'); setError(messageFor(reason)); return false; } finally { createBusy.current = false; }
  }, [autosave, draft, mode, navigate]);
  const saveVersion = useCallback(async () => {
    if (!noteId || versionBusy.current) return;
    versionBusy.current = true; setVersionState('saving'); setError(null);
    try { if (!await autosave.saveCurrent()) throw new Error('save failed'); await createKnowledgeNoteVersion(noteId); setVersionState('saved'); } catch (reason) { setVersionState('failed'); setError(reason instanceof Error && reason.message === 'save failed' ? 'Save current changes before creating a version.' : messageFor(reason)); } finally { versionBusy.current = false; }
  }, [autosave, noteId]);

  const upload = useCallback(async (file: File) => {
    if (!noteId) { setError('Save the note before uploading attachments.'); return; }
    const key = `${file.name}:${file.size}:${file.lastModified}`; if (uploads.current.has(key)) return; uploads.current.add(key); setError(null);
    const tempId = `upload-${key}`; setAssets((current) => [...current, { id: tempId, name: file.name, sizeLabel: `${file.size} bytes`, state: 'uploading' }]);
    try { const { asset } = await uploadKnowledgeAsset(file, noteId); setAssets((current) => current.map((item) => item.id === tempId ? { id: asset.id, name: asset.originalName, sizeLabel: `${asset.sizeBytes} bytes`, state: 'ready' } : item)); }
    catch { setAssets((current) => current.map((item) => item.id === tempId ? { ...item, state: 'error', errorMessage: 'The attachment could not be uploaded.' } : item)); }
    finally { uploads.current.delete(key); }
  }, [noteId]);
  const download = useCallback(async (assetId: string) => { if (downloads.current.has(assetId)) return; const item = assets.find((asset) => asset.id === assetId); if (!item) return; downloads.current.add(assetId); setAssets((current) => current.map((asset) => asset.id === assetId ? { ...asset, busy: 'download', errorMessage: undefined } : asset)); try { await downloadKnowledgeAsset({ id: item.id, noteId, originalName: item.name, mimeType: '', sizeBytes: 0, createdAt: '' }); } catch { setAssets((current) => current.map((asset) => asset.id === assetId ? { ...asset, errorMessage: 'The attachment could not be downloaded.' } : asset)); } finally { downloads.current.delete(assetId); setAssets((current) => current.map((asset) => asset.id === assetId ? { ...asset, busy: undefined } : asset)); } }, [assets, noteId]);
  const removeAsset = useCallback(async (assetId: string) => { if (deletions.current.has(assetId)) return; deletions.current.add(assetId); setAssets((current) => current.map((asset) => asset.id === assetId ? { ...asset, busy: 'delete', errorMessage: undefined } : asset)); try { await deleteKnowledgeAsset(assetId); setAssets((current) => current.filter((asset) => asset.id !== assetId)); } catch { setAssets((current) => current.map((asset) => asset.id === assetId ? { ...asset, errorMessage: 'The attachment could not be deleted.' } : asset)); } finally { deletions.current.delete(assetId); setAssets((current) => current.map((asset) => asset.id === assetId ? { ...asset, busy: undefined } : asset)); } }, []);

  const model: EditorViewModel = { ...draft, tags: [], assets };
  const state: EditorPresentationState = mode === 'create' ? (createState === 'saving' || createState === 'failed' ? createState : draftKey === persistedKey ? 'unchanged' : 'unsaved') : autosave.state;
  if (loading) return <p className="knowledge-message" role="status">Loading note</p>;
  if (error && mode === 'edit' && !noteId) return <p className="knowledge-message knowledge-message--error" role="alert">{error}</p>;
  return <>
    {error ? <p className="knowledge-message knowledge-message--error" role="alert">{error}</p> : null}
    {versionState === 'saving' ? <p role="status">Saving version</p> : null}
    {versionState === 'saved' ? <p role="status">Version saved</p> : null}
    {versionState === 'failed' ? <p role="alert">Version could not be saved</p> : null}
    <EditorPage model={model} state={state} documentSlot={editor ? <EditorContent editor={editor} /> : <p>Loading document editor</p>} onTitleChange={(title) => { if (mode === 'create') setCreateState('unsaved'); setDraft((current) => ({ ...current, title })); }} onSummaryChange={(summary) => { if (mode === 'create') setCreateState('unsaved'); setDraft((current) => ({ ...current, summary })); }} onHighlight={(kind) => { if (mode === 'create') setCreateState('unsaved'); editor?.chain().focus().setMark('highlight', { kind }).run(); }} onRemoveHighlight={() => { if (mode === 'create') setCreateState('unsaved'); editor?.chain().focus().unsetHighlight().run(); }} onSave={() => { void manualSave(); }} onUpload={(file) => { void upload(file); }} onDownload={(assetId) => { void download(assetId); }} onDelete={(assetId) => { void removeAsset(assetId); }} {...(mode === 'edit' ? { onSaveVersion: () => { void saveVersion(); } } : {})} />
  </>;
}
