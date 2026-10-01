import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Link } from '@tiptap/extension-link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { KnowledgeHighlight } from '../knowledge-editor/KnowledgeHighlight';
import { EditorPage, type EditorPresentationState } from '../knowledge-ui/EditorPage';
import type { EditorViewModel } from '../knowledge-ui/editor-fixtures';
import type {
  CreateNoteRequest,
  NoteRecord,
  NoteStatus,
  NoteVersionRecord,
  UpdateNoteRequest,
} from '@namdw/shared';
import {
  createKnowledgeNote,
  createKnowledgeNoteVersion,
  deleteKnowledgeAsset,
  downloadKnowledgeAsset,
  getKnowledgeNote,
  type KnowledgeApiFailure,
  listKnowledgeAssets,
  listKnowledgeNoteVersions,
  updateKnowledgeNote,
  uploadKnowledgeAsset,
} from './knowledge-api';
import { useNoteAutosave } from './useNoteAutosave';
import { invalidateDynamicContent } from '../content/dynamicContentSync';

type Props = { mode: 'create' | 'edit' };
type Draft = {
  title: string;
  summary: string;
  contentJson: string;
  category: string;
  status: NoteStatus;
  isPinned: boolean;
  isFeatured: boolean;
  slug: string;
  tags: readonly string[];
};

const emptyDocument = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
const initialDraft: Draft = {
  title: '',
  summary: '',
  contentJson: emptyDocument,
  category: 'General',
  status: 'draft',
  isPinned: false,
  isFeatured: false,
  slug: '',
  tags: [],
};

const toDraft = (note: NoteRecord): Draft => ({
  title: note.title,
  summary: note.summary,
  contentJson: note.contentJson,
  category: note.category,
  status: note.status,
  isPinned: note.isPinned,
  isFeatured: Boolean(note.isFeatured),
  slug: note.slug ?? '',
  tags: note.tags ?? [],
});
const keyOf = (draft: Draft) => JSON.stringify(draft);
const messageFor = (error: unknown) =>
  ({
    access: 'Access was denied.',
    validation: 'The note could not be saved.',
    'not-found': 'The note was not found.',
    conflict: 'The note changed elsewhere.',
    repository: 'The note service is unavailable.',
    malformed: 'The note response was invalid.',
    network: 'The network request failed.',
    request: 'The note request failed.',
  })[(error as KnowledgeApiFailure).kind] ?? 'The note could not be loaded.';

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
  const [versions, setVersions] = useState<readonly NoteVersionRecord[]>([]);
  const uploads = useRef(new Set<string>());
  const downloads = useRef(new Set<string>());
  const deletions = useRef(new Set<string>());
  const createBusy = useRef(false);
  const versionBusy = useRef(false);
  const draftKey = useMemo(() => keyOf(draft), [draft]);
  const noteId = mode === 'edit' ? (id ?? null) : null;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      KnowledgeHighlight,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
    ],
    content: JSON.parse(emptyDocument),
    onUpdate: ({ editor: current }) =>
      setDraft((previous) => ({ ...previous, contentJson: JSON.stringify(current.getJSON()) })),
  });

  useEffect(() => {
    if (!editor) return;
    try {
      if (JSON.stringify(editor.getJSON()) !== draft.contentJson) {
        editor.commands.setContent(JSON.parse(draft.contentJson), { emitUpdate: false });
      }
    } catch {
      setError('The note document could not be displayed.');
    }
  }, [draft.contentJson, editor]);

  useEffect(() => {
    if (mode !== 'edit' || !noteId) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    getKnowledgeNote(noteId, controller.signal)
      .then((note) => {
        if (!active) return;
        const next = toDraft(note);
        setDraft(next);
        setPersistedKey(keyOf(next));
        setLoading(false);
      })
      .catch((reason) => {
        if (active) {
          setError(messageFor(reason));
          setLoading(false);
        }
      });
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      listKnowledgeAssets(noteId, controller.signal)
        .then((records) => {
          if (!active) return;
          setAssets(
            records.map((r) => ({
              id: r.id,
              name: r.originalName,
              sizeLabel: `${(r.sizeBytes / 1024).toFixed(1)} KB`,
              state: 'ready',
            })),
          );
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, [mode, noteId]);

  const persist = useCallback(
    async (snapshot: string, signal: AbortSignal) => {
      if (!noteId) return;
      const currentDraft = JSON.parse(snapshot) as Draft;
      const payload: UpdateNoteRequest = {
        title: currentDraft.title,
        summary: currentDraft.summary,
        contentJson: currentDraft.contentJson,
        category: currentDraft.category,
        status: currentDraft.status,
        isPinned: currentDraft.isPinned,
        isFeatured: currentDraft.isFeatured,
        ...(currentDraft.slug ? { slug: currentDraft.slug } : {}),
        tags: currentDraft.tags,
      };
      await updateKnowledgeNote(noteId, payload, signal);
      invalidateDynamicContent();
    },
    [noteId],
  );

  const autosave = useNoteAutosave({
    enabled: mode === 'edit' && !loading && Boolean(noteId),
    value: draftKey,
    persistedValue: persistedKey,
    save: persist,
    onPersisted: setPersistedKey,
  });

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (autosave.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [autosave.dirty]);

  const manualSave = useCallback(async () => {
    setError(null);
    if (mode === 'edit') {
      const saved = await autosave.saveCurrent();
      if (!saved) setError('The note could not be saved.');
      else invalidateDynamicContent();
      return saved;
    }
    if (createBusy.current) return false;
    createBusy.current = true;
    try {
      setCreateState('saving');
      const payload: CreateNoteRequest = {
        title: draft.title,
        summary: draft.summary,
        contentJson: draft.contentJson,
        category: draft.category,
        status: draft.status,
        isPinned: draft.isPinned,
        isFeatured: draft.isFeatured,
        ...(draft.slug ? { slug: draft.slug } : {}),
        tags: draft.tags,
      };
      const created = await createKnowledgeNote(payload);
      invalidateDynamicContent();
      const next = toDraft(created);
      setDraft(next);
      setPersistedKey(keyOf(next));
      setCreateState('saved');
      navigate(`/knowledge/notes/${created.id}`, { replace: true });
      return true;
    } catch (reason) {
      setCreateState('failed');
      setError(messageFor(reason));
      return false;
    } finally {
      createBusy.current = false;
    }
  }, [autosave, draft, mode, navigate]);

  const loadVersions = useCallback(async () => {
    if (!noteId) return;
    try {
      const records = await listKnowledgeNoteVersions(noteId);
      setVersions(records);
    } catch {
      // Non-fatal
    }
  }, [noteId]);

  const saveVersion = useCallback(async () => {
    if (!noteId || versionBusy.current) return;
    versionBusy.current = true;
    setVersionState('saving');
    setError(null);
    try {
      if (!(await autosave.saveCurrent())) throw new Error('save failed');
      await createKnowledgeNoteVersion(noteId);
      setVersionState('saved');
    } catch (reason) {
      setVersionState('failed');
      setError(
        reason instanceof Error && reason.message === 'save failed'
          ? 'Save current changes before creating a version.'
          : messageFor(reason),
      );
    } finally {
      versionBusy.current = false;
    }
  }, [autosave, loadVersions, noteId]);

  const restoreVersion = useCallback(
    async (version: NoteVersionRecord) => {
      if (!noteId || !editor) return;
      setError(null);
      try {
        await autosave.saveCurrent();
        await createKnowledgeNoteVersion(noteId);
      } catch {
        // continue
      }
      try {
        const doc = JSON.parse(version.contentJson);
        editor.commands.setContent(doc, { emitUpdate: true });
        setDraft((prev) => ({ ...prev, contentJson: version.contentJson }));
        await loadVersions();
      } catch {
        setError('恢复历史版本失败：文档格式不兼容。');
      }
    },
    [autosave, editor, loadVersions, noteId],
  );

  const insertAsset = useCallback(
    (asset: EditorViewModel['assets'][number]) => {
      if (!editor) return;
      const isImage = /\.(png|jpe?g|webp|gif)$/i.test(asset.name);
      const href = `/api/assets/${encodeURIComponent(asset.id)}`;
      const text = isImage ? `🖼️ ${asset.name}` : `📎 ${asset.name}`;
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    },
    [editor],
  );

  const upload = useCallback(
    async (file: File) => {
      if (!noteId) {
        setError('Save the note before uploading attachments.');
        return;
      }
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (uploads.current.has(key)) return;
      uploads.current.add(key);
      setError(null);
      const tempId = `upload-${key}`;
      setAssets((current) => [
        ...current,
        { id: tempId, name: file.name, sizeLabel: `${(file.size / 1024).toFixed(1)} KB`, state: 'uploading' },
      ]);
      try {
        const { asset } = await uploadKnowledgeAsset(file, noteId);
        setAssets((current) =>
          current.map((item) =>
            item.id === tempId
              ? {
                  id: asset.id,
                  name: asset.originalName,
                  sizeLabel: `${(asset.sizeBytes / 1024).toFixed(1)} KB`,
                  state: 'ready',
                }
              : item,
          ),
        );
      } catch {
        setAssets((current) =>
          current.map((item) =>
            item.id === tempId
              ? { ...item, state: 'error', errorMessage: 'The attachment could not be uploaded.' }
              : item,
          ),
        );
      } finally {
        uploads.current.delete(key);
      }
    },
    [noteId],
  );

  const download = useCallback(
    async (assetId: string) => {
      if (downloads.current.has(assetId)) return;
      const item = assets.find((asset) => asset.id === assetId);
      if (!item) return;
      downloads.current.add(assetId);
      setAssets((current) =>
        current.map((asset) =>
          asset.id === assetId ? { ...asset, busy: 'download', errorMessage: undefined } : asset,
        ),
      );
      try {
        await downloadKnowledgeAsset({
          id: item.id,
          noteId,
          originalName: item.name,
          mimeType: '',
          sizeBytes: 0,
          createdAt: '',
        });
      } catch {
        setAssets((current) =>
          current.map((asset) =>
            asset.id === assetId
              ? { ...asset, errorMessage: 'The attachment could not be downloaded.' }
              : asset,
          ),
        );
      } finally {
        downloads.current.delete(assetId);
        setAssets((current) =>
          current.map((asset) => (asset.id === assetId ? { ...asset, busy: undefined } : asset)),
        );
      }
    },
    [assets, noteId],
  );
  const removeAsset = useCallback(async (assetId: string) => {
    if (deletions.current.has(assetId)) return;
    deletions.current.add(assetId);
    setAssets((current) =>
      current.map((asset) =>
        asset.id === assetId ? { ...asset, busy: 'delete', errorMessage: undefined } : asset,
      ),
    );
    try {
      await deleteKnowledgeAsset(assetId);
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
    } catch {
      setAssets((current) =>
        current.map((asset) =>
          asset.id === assetId
            ? { ...asset, errorMessage: 'The attachment could not be deleted.' }
            : asset,
        ),
      );
    } finally {
      deletions.current.delete(assetId);
      setAssets((current) =>
        current.map((asset) => (asset.id === assetId ? { ...asset, busy: undefined } : asset)),
      );
    }
  }, []);

  const model: EditorViewModel = {
    id: noteId ?? undefined,
    ...draft,
    assets,
  };
  const state: EditorPresentationState =
    mode === 'create'
      ? createState === 'saving' || createState === 'failed'
        ? createState
        : draftKey === persistedKey
          ? 'unchanged'
          : 'unsaved'
      : autosave.state;

  if (loading)
    return (
      <p className="knowledge-message" role="status">
        Loading note
      </p>
    );
  if (error && mode === 'edit' && !noteId)
    return (
      <p className="knowledge-message knowledge-message--error" role="alert">
        {error}
      </p>
    );

  return (
    <>
      {error ? (
        <p className="knowledge-message knowledge-message--error" role="alert">
          {error}
        </p>
      ) : null}
      <EditorPage
        model={model}
        state={state}
        versionState={versionState}
        isNew={mode === 'create'}
        attachmentUnavailableMessage={noteId ? undefined : '附件上传会在笔记首次保存后可用。'}
        documentSlot={editor ? <EditorContent editor={editor} /> : <p>Loading document editor</p>}
        onTitleChange={(title) => {
          if (mode === 'create') setCreateState('unsaved');
          setDraft((current) => ({ ...current, title }));
        }}
        onSummaryChange={(summary) => {
          if (mode === 'create') setCreateState('unsaved');
          setDraft((current) => ({ ...current, summary }));
        }}
        onCategoryChange={(category) => {
          if (mode === 'create') setCreateState('unsaved');
          setDraft((current) => ({ ...current, category }));
        }}
        onTagsChange={(tags) => {
          if (mode === 'create') setCreateState('unsaved');
          setDraft((current) => ({ ...current, tags }));
        }}
        onStatusChange={(status) => {
          if (mode === 'create') setCreateState('unsaved');
          setDraft((current) => ({ ...current, status }));
        }}
        onFeaturedChange={(isFeatured) => {
          if (mode === 'create') setCreateState('unsaved');
          setDraft((current) => ({ ...current, isFeatured }));
        }}
        onPinnedChange={(isPinned) => {
          if (mode === 'create') setCreateState('unsaved');
          setDraft((current) => ({ ...current, isPinned }));
        }}
        onSlugChange={(slug) => {
          if (mode === 'create') setCreateState('unsaved');
          setDraft((current) => ({ ...current, slug }));
        }}
        onHighlight={(kind) => {
          if (mode === 'create') setCreateState('unsaved');
          editor?.chain().focus().setMark('highlight', { kind }).run();
        }}
        onRemoveHighlight={() => {
          if (mode === 'create') setCreateState('unsaved');
          editor?.chain().focus().unsetHighlight().run();
        }}
        onSave={() => {
          void manualSave();
        }}
        {...(noteId
          ? {
              onUpload: (file: File) => {
                void upload(file);
              },
            }
          : {})}
        onDownload={(assetId) => {
          void download(assetId);
        }}
        onDelete={(assetId) => {
          void removeAsset(assetId);
        }}
        onInsertAsset={insertAsset}
        versions={versions}
        {...(mode === 'edit'
          ? {
              onSaveVersion: () => {
                void saveVersion();
              },
              onRestoreVersion: (version) => {
                void restoreVersion(version);
              },
              onOpenVersions: () => {
                void loadVersions();
              },
            }
          : {})}
      />
    </>
  );
}
