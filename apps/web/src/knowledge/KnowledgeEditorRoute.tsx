import { parseMarkdownToTiptap } from '@namdw/shared';
import { MarkdownDraft, type MarkdownDraftHandle } from './MarkdownDraft';
import { clipboardImages, type ImageUpload, type ImageInsertion } from './clipboard-images';
import { isMarkdownPaste } from './markdown-paste';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Link } from '@tiptap/extension-link';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UNSAFE_DataRouterContext, useLocation, useNavigate, useParams } from 'react-router-dom';

import { KnowledgeHighlight } from '../knowledge-editor/KnowledgeHighlight';
import { KnowledgeImage } from '../knowledge-editor/KnowledgeImage';
import { TiptapRenderer } from '../components/reading/TiptapRenderer';
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
  publishKnowledgeNote,
  unpublishKnowledgeNote,
  updateKnowledgeNote,
  uploadKnowledgeAsset,
} from './knowledge-api';
import { useNoteAutosave } from './useNoteAutosave';
import { EditorNavigationGuard } from './EditorNavigationGuard';
import { invalidateDynamicContent } from '../content/dynamicContentSync';
import { getSafeReturnTarget } from '../components/navigation/navigationSource';

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

const messageFor = (error: unknown) => {
  const kind = (error as KnowledgeApiFailure)?.kind;
  const messages: Record<string, string> = {
    access: '登录已失效，请重新登录后重试。',
    validation: '文章验证或保存失败 (The note could not be saved).',
    'not-found': '未找到目标文章 (The note was not found).',
    conflict: '文章在其他地方已被修改 (The note changed elsewhere).',
    repository: '知识库服务暂时不可用 (The note service is unavailable).',
    malformed: '文章数据响应格式错误 (The note response was invalid).',
    network: '网络连接失败 (The network request failed).',
    request: '文章请求处理失败 (The note request failed).',
  };
  return messages[kind] ?? (error instanceof Error ? error.message : '文章加载或操作失败。');
};

export function KnowledgeEditorRoute({ mode }: Props) {
  const { id } = useParams();
  const location = useLocation();
  const handoff = location.state?.editorHandoff as
    | { note: { id: string } }
    | undefined;

  const sessionRef = useRef<{ key: string; noteId: string | null }>({
    key: mode === 'create' ? 'new' : id ?? 'unknown',
    noteId: mode === 'create' ? null : id ?? null,
  });

  if (mode === 'create') {
    if (sessionRef.current.noteId !== null) {
      sessionRef.current = { key: 'new', noteId: null };
    }
  } else if (mode === 'edit' && id) {
    if (handoff?.note?.id === id && sessionRef.current.key === 'new') {
      sessionRef.current.noteId = id;
    } else if (sessionRef.current.noteId !== id) {
      sessionRef.current = { key: id, noteId: id };
    }
  }

  return <KnowledgeEditorSession key={sessionRef.current.key} mode={mode} />;
}

function KnowledgeEditorSession({ mode }: Props) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  const returnTarget = getSafeReturnTarget(location.state, '/knowledge/notes', '← 返回文章列表');
  const returnState = useMemo(
    () => ({
      restoreScroll: true,
      scrollY: returnTarget.scrollY,
      rootSource: returnTarget.rootSource,
    }),
    [returnTarget.scrollY, returnTarget.rootSource],
  );
  const handoff = useRef(
    location.state?.editorHandoff as
      { note: NoteRecord; draft: Draft; error: string | null } | undefined,
  );
  if (location.state?.editorHandoff && !handoff.current) {
    handoff.current = location.state.editorHandoff;
  }
  const initial = handoff.current?.note.id === id ? handoff.current : undefined;
  useEffect(() => {
    const handoffState = location.state?.editorHandoff as
      | { note: NoteRecord; draft: Draft; error: string | null }
      | undefined;
    if (!handoffState || handoffState.note?.id !== id) return;
    const rest = { ...location.state };
    delete rest.editorHandoff;
    navigate(location.pathname + location.search + location.hash, { replace: true, state: rest });
  }, [id, location.state, location.pathname, location.search, location.hash, navigate]);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const identity = useRef<string | null>(mode === 'edit' ? (id ?? null) : null);
  if (mode === 'edit' && id && !identity.current) {
    identity.current = id;
  }
  const [loaded, setLoaded] = useState(mode === 'create' || Boolean(initial));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [operation, setOperation] = useState<string | null>(null);
  const operationLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [draft, setDraft] = useState<Draft>(initial?.draft ?? initialDraft);
  const [persistedKey, setPersistedKey] = useState(
    initial ? keyOf(toDraft(initial.note)) : mode === 'create' ? keyOf(initialDraft) : '',
  );
  const [loading, setLoading] = useState(mode === 'edit' && !initial);
  const [error, setError] = useState<string | null>(initial?.error ?? null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [createState, setCreateState] = useState<EditorPresentationState>('unchanged');
  const [versionState, setVersionState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [assets, setAssets] = useState<EditorViewModel['assets']>([]);
  const [versions, setVersions] = useState<readonly NoteVersionRecord[]>([]);
  const [authExpired, setAuthExpired] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<File | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetAttempt, setAssetAttempt] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Navigation intercept states for EDIT-01
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const uploads = useRef(new Set<string>());
  const uploadInsertions = useRef(new Map<string, ImageInsertion>());
  const uploadHandler = useRef<ImageUpload>(() => {});
  const markdownDraft = useRef<MarkdownDraftHandle>(null);
  const markdownMode =
    new URLSearchParams(location.search).get('format') === 'markdown';
  const creation = useRef<Promise<NoteRecord> | null>(null);
  useEffect(
    () => () => {
      for (const insert of uploadInsertions.current.values()) insert.cancel?.();
      uploadInsertions.current.clear();
    },
    [],
  );
  const downloads = useRef(new Set<string>());
  const deletions = useRef(new Set<string>());

  const draftKey = useMemo(() => keyOf(draft), [draft]);
  const noteId = mode === 'edit' ? (id ?? null) : createdId;
  const isNew = !noteId;
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const knownRecord = useRef<NoteRecord | null>(initial?.note ?? null);

  const editorInstance = useRef<ReturnType<typeof useEditor>>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      KnowledgeHighlight,
      KnowledgeImage,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
    ],
    editorProps: {
      handlePaste: (view, event) => {
        const files = clipboardImages(event.clipboardData);
        if (files.length) {
          event.preventDefault();
          for (const file of files) {
            const current = editorInstance.current;
            if (!current) continue;
            let bookmark = view.state.selection.getBookmark();
            const mapBookmark = ({
              transaction,
            }: {
              transaction: { mapping: Parameters<typeof bookmark.map>[0] };
            }) => {
              bookmark = bookmark.map(transaction.mapping);
            };
            current.on('transaction', mapBookmark);
            uploadHandler.current(
              file,
              Object.assign(
                (asset: { id: string; originalName: string }) => {
                  current.off('transaction', mapBookmark);
                  if (current.isDestroyed) return;
                  const selection = bookmark.resolve(current.state.doc);
                  current
                    .chain()
                    .setTextSelection({ from: selection.from, to: selection.to })
                    .insertContent({
                      type: 'image',
                      attrs: { assetId: asset.id, alt: asset.originalName },
                    })
                    .run();
                },
                {
                  cancel: () => {
                    current.off('transaction', mapBookmark);
                  },
                },
              ),
            );
          }
          return true;
        }
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (!isMarkdownPaste(text) || view.state.selection.$from.parent.type.name === 'codeBlock')
          return false;
        const parsed = parseMarkdownToTiptap(text, 'paste.md', { preserveFirstHeading: true });
        if (
          !editorInstance.current?.commands.insertContent(JSON.parse(parsed.documentJson).content)
        )
          return false;
        event.preventDefault();
        return true;
      },
    },
    content: JSON.parse(emptyDocument),
    onUpdate: ({ editor: current }) => {
      const contentJson = JSON.stringify(current.getJSON());
      latestDraft.current = { ...latestDraft.current, contentJson };
      setDraft((previous) => ({ ...previous, contentJson }));
    },
  });

  editorInstance.current = editor;
  useEffect(() => {
    if (!editor) return;
    try {
      if (JSON.stringify(editor.getJSON()) !== draft.contentJson) {
        editor.commands.setContent(JSON.parse(draft.contentJson), { emitUpdate: false });
      }
    } catch {
      setError('文章文档格式错误，无法正常呈现。');
    }
  }, [draft.contentJson, editor]);

  useEffect(() => {
    if (!noteId) return;
    const controller = new AbortController();
    let active = true;
    if (knownRecord.current?.id === noteId && loadAttempt === 0) return;
    setLoading(true);
    setLoaded(false);
    setError(null);
    getKnowledgeNote(noteId, controller.signal)
      .then((note) => {
        if (!active) return;
        knownRecord.current = note;
        setLoaded(true);
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

    return () => {
      active = false;
      controller.abort();
    };
  }, [noteId, loadAttempt]);

  useEffect(() => {
    if (!noteId || !loaded) return;
    const controller = new AbortController();
    setAssetError(null);
    listKnowledgeAssets(noteId, controller.signal)
      .then((records) => {
        if (controller.signal.aborted) return;
        setAssets((current) => [
          ...records
            .filter((asset) => !current.some((row) => row.id === asset.id))
            .map((asset) => ({
              id: asset.id,
              name: asset.originalName,
              mimeType: asset.mimeType,
              sizeLabel: `${(asset.sizeBytes / 1024).toFixed(1)} KB`,
              state: 'ready' as const,
            })),
          ...current,
        ]);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAssetError('附件列表加载失败，请重试。');
      });
    return () => controller.abort();
  }, [noteId, loaded, assetAttempt]);

  // Draft auto-save callback: strictly updates draft fields only
  const persist = useCallback(
    async (snapshot: string, signal: AbortSignal) => {
      if (!noteId) return;
      const currentDraft = JSON.parse(snapshot) as Draft;
      if (!currentDraft.slug.trim()) {
        setError('文章路径不能为空，请填写后再保存。');
        throw new Error('文章路径不能为空。');
      }
      const payload: UpdateNoteRequest = {
        title: currentDraft.title,
        summary: currentDraft.summary,
        contentJson: currentDraft.contentJson,
        category: currentDraft.category,
        isPinned: currentDraft.isPinned,
        isFeatured: currentDraft.isFeatured,
        ...(currentDraft.slug ? { slug: currentDraft.slug } : {}),
        tags: currentDraft.tags,
      };
      const saved = await updateKnowledgeNote(noteId, payload, signal);
      knownRecord.current = saved;
      const acknowledged = toDraft(saved);
      const next = { ...latestDraft.current };
      for (const key of Object.keys(acknowledged) as Array<keyof Draft>) {
        if (JSON.stringify(next[key]) === JSON.stringify(currentDraft[key]))
          Object.assign(next, { [key]: acknowledged[key] });
      }
      latestDraft.current = next;
      setDraft(next);
      invalidateDynamicContent();
      return { persistedValue: keyOf(acknowledged), value: keyOf(next) };
    },
    [noteId],
  );

  const autosave = useNoteAutosave({
    enabled: loaded && !loading && Boolean(noteId),
    paused: Boolean(operation),
    value: draftKey,
    persistedValue: persistedKey,
    save: persist,
    onPersisted: setPersistedKey,
  });

  const isDirty =
    (noteId ? autosave.dirty : draftKey !== persistedKey) ||
    assets.some((asset) => asset.state === 'uploading' || asset.state === 'error');

  // EDIT-01: Native beforeunload listener
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty || operation || autosave.state === 'saving') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, operation, autosave.state]);

  // EDIT-01: SPA navigation guard via capturing window click listener
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      if (dataRouter || (!isDirty && !operation && autosave.state !== 'saving')) return;
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('blob:') ||
        href.startsWith('javascript:') ||
        target.getAttribute('target') === '_blank'
      ) {
        return;
      }

      // Check if clicking within current editor route (like anchor jumps)
      if (href === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      setPendingNavigation(href);
      setShowLeaveModal(true);
    };

    window.addEventListener('click', handleLinkClick, true);
    return () => window.removeEventListener('click', handleLinkClick, true);
  }, [dataRouter, isDirty, operation, autosave.state]);

  // Preview Escape listener to seamlessly return to edit state
  useEffect(() => {
    if (!previewOpen) return;
    const handlePreviewEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewOpen(false);
        editor?.commands.focus();
      }
    };
    window.addEventListener('keydown', handlePreviewEscape);
    return () => window.removeEventListener('keydown', handlePreviewEscape);
  }, [previewOpen, editor]);

  const beginOperation = (name: string) => {
    if (uploads.current.size) {
      setError('附件正在上传，请等待完成后再保存或发布。');
      return false;
    }
    if (operationLock.current || !loaded) return false;
    operationLock.current = true;
    setOperation(name);
    setError(null);
    return true;
  };
  const endOperation = () => {
    operationLock.current = false;
    if (mounted.current) setOperation(null);
  };

  const ensureIdentity = async (): Promise<NoteRecord> => {
    if (identity.current && knownRecord.current) return knownRecord.current;
    if (creation.current) return creation.current;
    const pending = createIdentity();
    creation.current = pending;
    try {
      return await pending;
    } finally {
      creation.current = null;
    }
  };

  const createIdentity = async (): Promise<NoteRecord> => {
    const snapshot = latestDraft.current;
    setCreateState('saving');
    try {
      const created = await createKnowledgeNote({
        ...snapshot,
        title: snapshot.title.trim() ? snapshot.title : '未命名草稿',
        status: 'draft',
        ...(snapshot.slug ? { slug: snapshot.slug } : { slug: undefined }),
      } as CreateNoteRequest);
      identity.current = created.id;
      knownRecord.current = created;
      const acknowledged = toDraft(created);
      const next = { ...latestDraft.current };
      for (const key of Object.keys(acknowledged) as Array<keyof Draft>) {
        if (JSON.stringify(next[key]) === JSON.stringify(snapshot[key])) {
          Object.assign(next, { [key]: acknowledged[key] });
        }
      }
      latestDraft.current = next;
      setDraft(next);
      setPersistedKey(keyOf(acknowledged));
      setCreatedId(created.id);
      setCreateState('saved');
      invalidateDynamicContent();
      return created;
    } catch (reason) {
      setCreateState('failed');
      throw reason;
    }
  };

  // Creation can finish while typing continues. Flush directly using its new identity,
  // since the autosave hook in this render may still belong to the /new session.
  const flushCreated = async (): Promise<NoteRecord> => {
    let record = knownRecord.current!;
    while (keyOf(latestDraft.current) !== keyOf(toDraft(record))) {
      const snapshot = latestDraft.current;
      const { slug, ...fields } = snapshot;
      const { status, ...editableFields } = fields;
      void status;
      record = await updateKnowledgeNote(identity.current!, {
        ...editableFields,
        ...(slug ? { slug } : {}),
      });
      knownRecord.current = record;
      const acknowledged = toDraft(record);
      const next = { ...latestDraft.current };
      for (const key of Object.keys(acknowledged) as Array<keyof Draft>) {
        if (JSON.stringify(next[key]) === JSON.stringify(snapshot[key]))
          Object.assign(next, { [key]: acknowledged[key] });
      }
      latestDraft.current = next;
      setDraft(next);
      setPersistedKey(keyOf(acknowledged));
      invalidateDynamicContent();
    }
    return record;
  };

  const openPersistedEditor = (
    record: NoteRecord,
    failure: string | null = null,
    preserveSearch = false,
  ) => {
    const search = preserveSearch ? location.search : '';
    navigate('/knowledge/notes/' + record.id + search, {
      replace: true,
      state: {
        ...(location.state && typeof location.state === 'object' ? location.state : {}),
        editorHandoff: { note: record, draft: latestDraft.current, error: failure },
      },
    });
  };

  const manualSave = async (stayOnPage = false): Promise<boolean> => {
    if (!beginOperation('save')) return false;
    try {
      if (!identity.current) {
        let created = await ensureIdentity();
        if (stayOnPage) created = await flushCreated();
        if (!stayOnPage) openPersistedEditor(created);
        return true;
      }
      const saved = await autosave.saveCurrent();
      if (!saved) setError('文章保存失败。');
      if (saved && (mode === 'create' || markdownMode) && !stayOnPage && knownRecord.current)
        openPersistedEditor(knownRecord.current);
      return saved;
    } catch (reason) {
      setError(messageFor(reason));
      return false;
    } finally {
      endOperation();
    }
  };

  const loadVersions = useCallback(async () => {
    if (!noteId) return;
    try {
      setVersions(await listKnowledgeNoteVersions(noteId));
    } catch (reason) {
      setError(messageFor(reason));
    }
  }, [noteId]);

  const saveVersion = async () => {
    if (!noteId || !beginOperation('version')) return;
    setVersionState('saving');
    try {
      if (!(await autosave.saveCurrent()))
        throw new Error('Save current changes before creating a version.');
      await createKnowledgeNoteVersion(noteId);
      setVersionState('saved');
      await loadVersions();
      setToastMessage('版本快照已成功创建。');
    } catch (reason) {
      setVersionState('failed');
      setError(messageFor(reason));
    } finally {
      endOperation();
    }
  };

  const restoreVersion = async (version: NoteVersionRecord) => {
    if (!noteId || !editor || !beginOperation('restore')) return;
    // Keep the protected revision stable until the backup operation finishes.
    editor.setEditable(false);
    try {
      if (!(await autosave.saveCurrent())) throw new Error('backup failed');
      await createKnowledgeNoteVersion(noteId);
      editor.commands.setContent(JSON.parse(version.contentJson), { emitUpdate: true });
      setDraft((current) => ({ ...current, contentJson: version.contentJson }));
      await loadVersions();
      setToastMessage('已成功恢复旧版本，原编辑内容已备份至版本历史。');
    } catch {
      setError(
        '安全保护失败：无法为当前正在编辑的内容创建安全备份快照。为防止您的工作丢失，系统已终止恢复。',
      );
    } finally {
      editor.setEditable(true);
      endOperation();
    }
  };

  const publish = async (): Promise<boolean> => {
    if (!latestDraft.current.title.trim()) {
      setError('发布失败：文章标题不能为空。');
      return false;
    }
    if (!beginOperation('publish')) return false;
    const wasNew = !identity.current;
    try {
      if (wasNew) {
        await ensureIdentity();
        await flushCreated();
      } else if (!(await autosave.saveCurrent())) {
        throw new Error('发布前保存草稿失败，请重试。');
      }
      const currentId = identity.current!;
      // On first publication, creation already acknowledged its exact snapshot.
      const record = knownRecord.current!;
      const published = await publishKnowledgeNote(currentId, {
        expectedUpdatedAt: record.updatedAt,
      });
      knownRecord.current = published;
      invalidateDynamicContent();
      latestDraft.current = { ...latestDraft.current, status: published.status };
      setDraft(latestDraft.current);
      setPersistedKey(keyOf(toDraft(published)));
      setToastMessage('发布文章成功！');
      if (wasNew && knownRecord.current) {
        openPersistedEditor(knownRecord.current);
      }
      return true;
    } catch (reason) {
      const failure = messageFor(reason);
      setError(failure);
      if (wasNew && knownRecord.current) {
        // Retain persisted identity and keep state saved so user can retry publishing
        setCreateState('saved');
        setCreatedId(knownRecord.current.id);
      }
      return false;
    } finally {
      endOperation();
    }
  };

  const unpublish = async () => {
    if (!noteId || !beginOperation('unpublish')) return;
    try {
      if (!(await autosave.saveCurrent())) throw new Error('撤回前保存草稿失败，请重试。');
      const unpublished = await unpublishKnowledgeNote(noteId);
      knownRecord.current = unpublished;
      invalidateDynamicContent();
      latestDraft.current = { ...latestDraft.current, status: 'draft' };
      setDraft(latestDraft.current);
      setPersistedKey(keyOf(toDraft(unpublished)));
      setToastMessage('文章已成功撤回为草稿，前台已下架。');
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      endOperation();
    }
  };

  // Insert asset node / link into editor
  const insertAsset = useCallback(
    (asset: EditorViewModel['assets'][number]) => {
      if (!editor) return;
      const isImage = asset.mimeType
        ? /^image\/(png|jpeg|webp|gif)$/.test(asset.mimeType)
        : /\.(png|jpe?g|webp|gif)$/i.test(asset.name);
      if (isImage) {
        editor
          .chain()
          .focus()
          .insertContent({ type: 'image', attrs: { assetId: asset.id, alt: asset.name } })
          .run();
        return;
      }
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

  // Upload asset with file preservation for retry (ASSET-01)
  const upload = useCallback(
    async (file: File, insert?: ImageInsertion) => {
      if (operationLock.current) {
        insert?.cancel?.();
        setError('正在保存或发布文章，请完成后再上传附件。');
        return;
      }
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (uploads.current.has(key)) {
        insert?.cancel?.();
        return;
      }
      if (insert) uploadInsertions.current.get(key)?.cancel?.();
      if (insert) uploadInsertions.current.set(key, insert);
      const allowed = /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(file.type);
      if (!allowed || file.size > 15 * 1024 * 1024 || file.size === 0) {
        setError(
          !allowed ? '仅支持 PNG、JPG、WebP、GIF 图片和 PDF。' : '附件不能为空，且不能超过 15 MB。',
        );
        uploadInsertions.current.get(key)?.cancel?.();
        uploadInsertions.current.delete(key);
        return;
      }
      uploads.current.add(key);
      setPendingUpload(file);
      setError(null);
      const tempId = `upload-${key}`;
      setAssets((current) => [
        ...current.filter((item) => item.id !== tempId),
        {
          id: tempId,
          name: file.name,
          sizeLabel: `${(file.size / 1024).toFixed(1)} KB`,
          state: 'uploading',
          file,
        },
      ]);
      try {
        let targetNoteId = identity.current;
        const wasCreateMode = mode === 'create' || !targetNoteId;
        if (!targetNoteId) {
          const created = await ensureIdentity();
          await flushCreated();
          targetNoteId = created.id;
        }
        const { asset } = await uploadKnowledgeAsset(file, targetNoteId);
        if (!mounted.current) return;
        setPendingUpload(null);
        setAuthExpired(false);
        const insertFn = uploadInsertions.current.get(key);
        if (insertFn) {
          insertFn(asset);
          uploadInsertions.current.delete(key);
          if (editorInstance.current && !markdownMode) {
            const newJson = JSON.stringify(editorInstance.current.getJSON());
            latestDraft.current = { ...latestDraft.current, contentJson: newJson };
            setDraft((prev) => ({ ...prev, contentJson: newJson }));
          }
        }
        setAssets((current) =>
          current.map((item) =>
            item.id === tempId
              ? {
                  id: asset.id,
                  name: asset.originalName,
                  mimeType: asset.mimeType,
                  sizeLabel: `${(asset.sizeBytes / 1024).toFixed(1)} KB`,
                  state: 'ready',
                }
              : item,
          ),
        );
        if (wasCreateMode && insertFn) {
          const persisted = await flushCreated();
          openPersistedEditor(persisted, null, markdownMode);
        }
      } catch (reason) {
        if ((reason as KnowledgeApiFailure)?.kind === 'access') setAuthExpired(true);
        setAssets((current) =>
          current.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  state: 'error',
                  errorMessage:
                    (reason as KnowledgeApiFailure)?.kind === 'access'
                      ? '登录已失效，请重新登录后重试。'
                      : `附件上传失败，请重试。${messageFor(reason)}`,
                  file,
                }
              : item,
          ),
        );
      } finally {
        uploads.current.delete(key);
      }
    },
    [markdownMode, mode, noteId, openPersistedEditor],
  );
  uploadHandler.current = (file, insert) => {
    void upload(file, insert);
  };

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

  const removeAsset = useCallback(
    async (assetId: string) => {
      if (assetId.startsWith('upload-')) {
        const key = assetId.slice('upload-'.length);
        if (uploads.current.has(key)) return;
        uploadInsertions.current.get(key)?.cancel?.();
        uploadInsertions.current.delete(key);
        setAssets((current) => current.filter((asset) => asset.id !== assetId));
        setPendingUpload(null);
        return;
      }
      if (deletions.current.has(assetId)) return;
      if (operation || autosave.state === 'saving') {
        setError('正在保存文章，请等待完成后再删除附件。');
        return;
      }
      const referenced = (node: {
        type?: string;
        attrs?: { assetId?: string };
        marks?: Array<{ attrs?: { href?: string } }>;
        content?: unknown[];
      }): boolean =>
        (node.type === 'image' && node.attrs?.assetId === assetId) ||
        Boolean(node.marks?.some((mark) => mark.attrs?.href === '/api/assets/' + assetId)) ||
        Boolean(
          node.content?.some((child) => referenced(child as Parameters<typeof referenced>[0])),
        );
      try {
        if (referenced(JSON.parse(latestDraft.current.contentJson))) {
          setAssets((current) =>
            current.map((asset) =>
              asset.id === assetId
                ? { ...asset, errorMessage: '附件仍被当前正文引用，请先移除引用并保存。' }
                : asset,
            ),
          );
          return;
        }
      } catch {
        setError('无法检查正文引用，已取消删除附件。');
        return;
      }
      deletions.current.add(assetId);
      setAssets((current) =>
        current.map((asset) =>
          asset.id === assetId ? { ...asset, busy: 'delete', errorMessage: undefined } : asset,
        ),
      );
      try {
        await deleteKnowledgeAsset(assetId);
        setAssets((current) => current.filter((asset) => asset.id !== assetId));
      } catch (reason) {
        setAssets((current) =>
          current.map((asset) =>
            asset.id === assetId
              ? {
                  ...asset,
                  errorMessage:
                    (reason as KnowledgeApiFailure)?.code === 'ASSET_IN_USE'
                      ? '附件仍被草稿、已发布文章或历史快照引用，无法删除。'
                      : 'The attachment could not be deleted.',
                }
              : asset,
          ),
        );
      } finally {
        deletions.current.delete(assetId);
        setAssets((current) =>
          current.map((asset) => (asset.id === assetId ? { ...asset, busy: undefined } : asset)),
        );
      }
    },
    [operation, autosave.state],
  );

  const model: EditorViewModel = {
    id: noteId ?? undefined,
    ...draft,
    assets,
  };

  const state: EditorPresentationState = isNew
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

  if (!loaded && !loading)
    return (
      <p className="knowledge-message knowledge-message--error" role="alert">
        {error}
        <button type="button" onClick={() => setLoadAttempt((n) => n + 1)}>
          重试加载
        </button>
      </p>
    );

  return (
    <>
      {dataRouter ? (
        <EditorNavigationGuard
          dirty={isDirty}
          busy={Boolean(operation) || autosave.state === 'saving' || uploads.current.size > 0}
          onSave={() => manualSave(true)}
          allowedPath={() =>
            identity.current ? '/knowledge/notes/' + identity.current : undefined
          }
        />
      ) : null}
      {error ? (
        <p className="knowledge-message knowledge-message--error" role="alert">
          {error}
        </p>
      ) : null}

      {toastMessage ? (
        <div className="knowledge-toast" role="status">
          <span>{toastMessage}</span>
          <button
            type="button"
            className="knowledge-toast__close"
            onClick={() => setToastMessage(null)}
            aria-label="关闭通知"
          >
            ✕
          </button>
        </div>
      ) : null}

      {(authExpired || error?.includes('登录已失效')) && (
        <p role="alert">
          登录已失效，编辑内容和待上传文件已保留。
          <a
            href={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            重新登录
          </a>
          后返回此页重试。
          {pendingUpload && (
            <button
              type="button"
              onClick={() => {
                void upload(pendingUpload);
              }}
            >
              重试待上传文件
            </button>
          )}
        </p>
      )}
      <EditorPage
        model={model}
        state={state}
        versionState={versionState}
        isNew={isNew}
        returnTarget={{
          path: returnTarget.path,
          label: returnTarget.label,
          state: returnState,
        }}
        errorMessage={error}
        saveBusy={Boolean(operation) || uploads.current.size > 0}
        publishBusy={Boolean(operation) || uploads.current.size > 0}
        onPreview={() => setPreviewOpen(true)}
        markdownMode={markdownMode}
        editor={editor}
        documentSlot={
          markdownMode ? (
            <MarkdownDraft
              ref={markdownDraft}
              onUpload={uploadHandler.current}
              onChange={(contentJson) => {
                setCreateState('unsaved');
                latestDraft.current = { ...latestDraft.current, contentJson };
                setDraft((previous) => ({ ...previous, contentJson }));
              }}
            />
          ) : editor ? (
            <EditorContent editor={editor} />
          ) : (
            <p>Loading document editor</p>
          )
        }
        onTitleChange={(title) => {
          if (mode === 'create') setCreateState('unsaved');
          latestDraft.current = { ...latestDraft.current, title };
          setDraft((current) => ({ ...current, title }));
        }}
        onSummaryChange={(summary) => {
          if (mode === 'create') setCreateState('unsaved');
          latestDraft.current = { ...latestDraft.current, summary };
          setDraft((current) => ({ ...current, summary }));
        }}
        onCategoryChange={(category) => {
          if (mode === 'create') setCreateState('unsaved');
          latestDraft.current = { ...latestDraft.current, category };
          setDraft((current) => ({ ...current, category }));
        }}
        onTagsChange={(tags) => {
          if (mode === 'create') setCreateState('unsaved');
          latestDraft.current = { ...latestDraft.current, tags };
          setDraft((current) => ({ ...current, tags }));
        }}
        onStatusChange={(status) => {
          if (mode === 'create') setCreateState('unsaved');
          latestDraft.current = { ...latestDraft.current, status };
          setDraft((current) => ({ ...current, status }));
        }}
        onFeaturedChange={(isFeatured) => {
          if (mode === 'create') setCreateState('unsaved');
          latestDraft.current = { ...latestDraft.current, isFeatured };
          setDraft((current) => ({ ...current, isFeatured }));
        }}
        onPinnedChange={(isPinned) => {
          if (mode === 'create') setCreateState('unsaved');
          latestDraft.current = { ...latestDraft.current, isPinned };
          setDraft((current) => ({ ...current, isPinned }));
        }}
        onSlugChange={(slug) => {
          if (mode === 'create') setCreateState('unsaved');
          latestDraft.current = { ...latestDraft.current, slug };
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
        onPublish={publish}
        onUnpublish={() => {
          void unpublish();
        }}
        onUpload={(file) => {
          void upload(file);
        }}
        onDownload={(assetId) => {
          void download(assetId);
        }}
        onDelete={(assetId) => {
          void removeAsset(assetId);
        }}
        onInsertAsset={(asset) => {
          if (markdownMode)
            markdownDraft.current?.insertAsset({
              id: asset.id,
              originalName: asset.name,
              mimeType: asset.mimeType,
            });
          else insertAsset(asset);
        }}
        versions={versions}
        lastSavedAt={autosave.lastSavedAt}
        lastPublishedAt={knownRecord.current?.publishedAt}
        hasUnpublishedEdits={
          knownRecord.current?.status === 'published' &&
          (knownRecord.current.publishedContentJson !== draft.contentJson ||
            knownRecord.current.publishedTitle !== draft.title)
        }
        {...(noteId && !markdownMode
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

      {assetError ? (
        <p role="alert">
          {assetError}{' '}
          <button type="button" onClick={() => setAssetAttempt((n) => n + 1)}>
            重试附件加载
          </button>
        </p>
      ) : null}
      {previewOpen ? (
        <div
          className="knowledge-dialog-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewOpen(false);
              editor?.commands.focus();
            }
          }}
        >
          <section
            className="knowledge-dialog knowledge-draft-preview"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setPreviewOpen(false);
                editor?.commands.focus();
              }
              if (event.key === 'Tab') {
                event.preventDefault();
                event.currentTarget.querySelector('button')?.focus();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-label="当前草稿预览"
          >
            <button
              type="button"
              autoFocus
              onClick={() => {
                setPreviewOpen(false);
                editor?.commands.focus();
              }}
            >
              返回编辑
            </button>
            <h1>{draft.title || '未命名草稿'}</h1>
            <div className="markdown-body">
              <TiptapRenderer content={draft.contentJson} />
            </div>
          </section>
        </div>
      ) : null}

      {/* EDIT-01: 未保存离开确认模态框 */}
      {!dataRouter && showLeaveModal ? (
        <div className="knowledge-dialog-backdrop">
          <section
            className="knowledge-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="knowledge-leave-modal-title"
          >
            <h2 id="knowledge-leave-modal-title">当前有未保存的修改</h2>
            <p>
              您在文章《{draft.title || (mode === 'create' ? '新建文章' : '未命名草稿')}
              》中的编辑尚未保存。现在离开，最新修改将会丢失。
            </p>
            <div className="knowledge-dialog__actions">
              <button
                type="button"
                className="knowledge-button knowledge-button--quiet"
                onClick={() => {
                  setShowLeaveModal(false);
                  setPendingNavigation(null);
                }}
              >
                留在当前页面
              </button>
              <button
                type="button"
                className="knowledge-button knowledge-button--secondary"
                disabled={Boolean(operation) || autosave.state === 'saving' || uploads.current.size > 0}
                onClick={async () => {
                  const ok = await manualSave(true);
                  if (ok && pendingNavigation) {
                    setShowLeaveModal(false);
                    navigate(pendingNavigation, {
                      state: pendingNavigation === returnTarget.path ? returnState : undefined,
                    });
                  }
                }}
              >
                保存草稿并离开
              </button>
              <button
                type="button"
                className="knowledge-button knowledge-danger-button"
                disabled={Boolean(operation) || autosave.state === 'saving' || uploads.current.size > 0}
                onClick={() => {
                  setShowLeaveModal(false);
                  setPersistedKey(draftKey);
                  if (pendingNavigation) {
                    navigate(pendingNavigation, {
                      state: pendingNavigation === returnTarget.path ? returnState : undefined,
                    });
                  }
                }}
              >
                放弃修改并离开
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
