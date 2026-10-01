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
  publishKnowledgeNote,
  unpublishKnowledgeNote,
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

const messageFor = (error: unknown) => {
  const kind = (error as KnowledgeApiFailure)?.kind;
  const messages: Record<string, string> = {
    access: '访问被拒绝 (Access was denied).',
    validation: '文章验证或保存失败 (The note could not be saved).',
    'not-found': '未找到目标文章 (The note was not found).',
    conflict: '文章在其他地方已被修改 (The note changed elsewhere).',
    repository: '知识库服务暂时不可用 (The note service is unavailable).',
    malformed: '文章数据响应格式错误 (The note response was invalid).',
    network: '网络连接失败 (The network request failed).',
    request: '文章请求处理失败 (The note request failed).',
  };
  return (
    messages[kind] ??
    (error instanceof Error ? error.message : '文章加载或操作失败。')
  );
};

export function KnowledgeEditorRoute({ mode }: Props) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [persistedKey, setPersistedKey] = useState(mode === 'create' ? keyOf(initialDraft) : '');
  const [loading, setLoading] = useState(mode === 'edit');
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [createState, setCreateState] = useState<EditorPresentationState>('unchanged');
  const [versionState, setVersionState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [assets, setAssets] = useState<EditorViewModel['assets']>([]);
  const [versions, setVersions] = useState<readonly NoteVersionRecord[]>([]);

  // Navigation intercept states for EDIT-01
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const uploads = useRef(new Set<string>());
  const downloads = useRef(new Set<string>());
  const deletions = useRef(new Set<string>());
  const createBusy = useRef(false);
  const saveBusy = useRef(false);
  const publishBusy = useRef(false);
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
      setError('文章文档格式错误，无法正常呈现。');
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

  // Draft auto-save callback: strictly updates draft fields only
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

  const isDirty = mode === 'edit' ? autosave.dirty : draftKey !== persistedKey;

  // EDIT-01: Native beforeunload listener
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // EDIT-01: SPA navigation guard via capturing window click listener
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      if (!isDirty) return;
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
  }, [isDirty]);

  // Manual save handler
  const manualSave = useCallback(async (): Promise<boolean> => {
    if (saveBusy.current) return false;
    saveBusy.current = true;
    setError(null);

    try {
      if (mode === 'edit') {
        const saved = await autosave.saveCurrent();
        if (!saved) {
          setError('文章保存失败。');
        } else {
          invalidateDynamicContent();
        }
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
    } finally {
      saveBusy.current = false;
    }
  }, [autosave, draft, mode, navigate]);

  // Load versions
  const loadVersions = useCallback(async () => {
    if (!noteId) return;
    try {
      const records = await listKnowledgeNoteVersions(noteId);
      setVersions(records);
    } catch {
      // Non-fatal
    }
  }, [noteId]);

  // Save version snapshot
  const saveVersion = useCallback(async () => {
    if (!noteId || versionBusy.current) return;
    versionBusy.current = true;
    setVersionState('saving');
    setError(null);
    try {
      if (!(await autosave.saveCurrent())) throw new Error('save failed');
      await createKnowledgeNoteVersion(noteId);
      setVersionState('saved');
      setToastMessage('版本快照已成功创建。');
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

  // Fail-Safe Version Restore (VER-01, VER-02)
  const restoreVersion = useCallback(
    async (version: NoteVersionRecord) => {
      if (!noteId || !editor) return;
      setError(null);

      // 步骤 1: 强制保存当前工作草稿
      let saved: boolean;
      try {
        saved = await autosave.saveCurrent();
      } catch {
        saved = false;
      }
      if (!saved) {
        setError(
          '安全保护失败：无法为当前正在编辑的内容创建安全备份快照。为防止您的工作丢失，系统已终止恢复。',
        );
        return;
      }

      // 步骤 2: 为当前工作区创建安全保护快照
      let versionCreated: boolean;
      try {
        await createKnowledgeNoteVersion(noteId);
        versionCreated = true;
      } catch {
        versionCreated = false;
      }
      if (!versionCreated) {
        setError(
          '安全保护失败：无法为当前正在编辑的内容创建安全备份快照。为防止您的工作丢失，系统已终止恢复。',
        );
        return;
      }

      // 强熔断校验：仅当前两步均成功确认后，才将历史版本的 contentJson 载入编辑器
      try {
        const doc = JSON.parse(version.contentJson);
        editor.commands.setContent(doc, { emitUpdate: true });
        setDraft((prev) => ({ ...prev, contentJson: version.contentJson }));
        await loadVersions();
        setToastMessage('已成功恢复旧版本，原编辑内容已备份至版本历史。');
      } catch {
        setError('恢复历史版本失败：文档格式不兼容。');
      }
    },
    [autosave, editor, loadVersions, noteId],
  );

  // Publish / Update Publish
  const publish = useCallback(async () => {
    if (publishBusy.current) return;
    if (!draft.title.trim()) {
      setError('发布失败：文章标题不能为空。');
      return;
    }

    publishBusy.current = true;
    setError(null);

    try {
      let currentId = noteId;
      if (mode === 'edit') {
        const saved = await autosave.saveCurrent();
        if (!saved) {
          setError('发布前保存草稿失败，请重试。');
          return;
        }
      } else {
        // Create note first
        setCreateState('saving');
        const payload: CreateNoteRequest = {
          title: draft.title,
          summary: draft.summary,
          contentJson: draft.contentJson,
          category: draft.category,
          status: 'draft',
          isPinned: draft.isPinned,
          isFeatured: draft.isFeatured,
          ...(draft.slug ? { slug: draft.slug } : {}),
          tags: draft.tags,
        };
        const created = await createKnowledgeNote(payload);
        currentId = created.id;
        const nextDraft = toDraft(created);
        setDraft(nextDraft);
        setPersistedKey(keyOf(nextDraft));
      }

      if (!currentId) return;

      const published = await publishKnowledgeNote(currentId);
      invalidateDynamicContent();
      const next = toDraft(published);
      setDraft(next);
      setPersistedKey(keyOf(next));
      setToastMessage(
        draft.status === 'published' ? '更新发布成功！' : '发布文章成功！文章已正式上线。',
      );

      if (mode === 'create') {
        navigate(`/knowledge/notes/${published.id}`, { replace: true });
      }
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      publishBusy.current = false;
    }
  }, [autosave, draft, mode, navigate, noteId]);

  // Unpublish / Retract to draft
  const unpublish = useCallback(async () => {
    if (!noteId || publishBusy.current) return;
    publishBusy.current = true;
    setError(null);
    try {
      const unpublished = await unpublishKnowledgeNote(noteId);
      invalidateDynamicContent();
      const next = toDraft(unpublished);
      setDraft(next);
      setPersistedKey(keyOf(next));
      setToastMessage('文章已成功撤回为草稿，前台已下架。');
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      publishBusy.current = false;
    }
  }, [noteId]);

  // Insert asset node / link into editor
  const insertAsset = useCallback(
    (asset: EditorViewModel['assets'][number]) => {
      if (!editor) return;
      const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(asset.name);
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
              ? {
                  ...item,
                  state: 'error',
                  errorMessage: 'The attachment could not be uploaded.',
                  file,
                }
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

      <EditorPage
        model={model}
        state={state}
        versionState={versionState}
        isNew={mode === 'create'}
        attachmentUnavailableMessage={noteId ? undefined : '附件上传会在笔记首次保存后可用。'}
        editor={editor}
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
        onPublish={() => {
          void publish();
        }}
        onUnpublish={() => {
          void unpublish();
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

      {/* EDIT-01: 未保存离开确认模态框 */}
      {showLeaveModal ? (
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
                onClick={async () => {
                  const ok = await manualSave();
                  if (ok && pendingNavigation) {
                    setShowLeaveModal(false);
                    navigate(pendingNavigation);
                  }
                }}
              >
                保存草稿并离开
              </button>
              <button
                type="button"
                className="knowledge-button knowledge-danger-button"
                onClick={() => {
                  setShowLeaveModal(false);
                  setPersistedKey(draftKey);
                  if (pendingNavigation) {
                    navigate(pendingNavigation);
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
