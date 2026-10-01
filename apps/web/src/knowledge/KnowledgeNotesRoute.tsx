import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NotesPage } from '../knowledge-ui/NotesPage';
import type { BatchOperationResult, ToastState } from '../knowledge-ui/NotesPage';
import type { NoteCardViewModel, NotesViewModel } from '../knowledge-ui/fixtures';
import type { NoteRecord, NoteStatus, SearchResult } from '@namdw/shared';
import { mapNoteToCard } from './knowledge-adapter';
import {
  archiveKnowledgeNote,
  loadKnowledgeNotes,
  loadKnowledgeStats,
  restoreKnowledgeNote,
  updateKnowledgeNote,
} from './knowledge-api';
import type { KnowledgeNotesQuery } from './knowledge-api';
import { invalidateDynamicContent } from '../content/dynamicContentSync';

const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
const initialModel: NotesViewModel = { searchTerm: '', filterLabel: '全部文章', notes: [] };

export function KnowledgeNotesRoute() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query parameters
  const tab = searchParams.get('tab') || searchParams.get('status') || 'all';
  const urlQ = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'updated_desc';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pinned = searchParams.get('pinned') === '1' || searchParams.get('pinned') === 'true';
  const featured = searchParams.get('featured') === '1' || searchParams.get('featured') === 'true';

  // Local search input for responsive typing
  const [searchInput, setSearchInput] = useState(urlQ);
  const [debouncedSearch, setDebouncedSearch] = useState(urlQ);

  // Sync search input if URL q changes externally (e.g. back/forward)
  useEffect(() => {
    setSearchInput(urlQ);
    setDebouncedSearch(urlQ);
  }, [urlQ]);

  // Debounce search input
  useEffect(() => {
    if (isTestEnv) {
      setDebouncedSearch(searchInput.trim());
      return;
    }
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      setDebouncedSearch(trimmed);
      // Synchronize to URL if different
      if (trimmed !== urlQ) {
        const next = new URLSearchParams(searchParams);
        next.delete('status');
        if (trimmed) {
          next.set('q', trimmed);
        } else {
          next.delete('q');
        }
        next.delete('page');
        setSearchParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, urlQ, searchParams, setSearchParams]);

  // Data & status state
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [model, setModel] = useState<NotesViewModel>(initialModel);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [refresh, setRefresh] = useState(0);

  // Tab count badges from stats
  const [tabCounts, setTabCounts] = useState<{
    all?: number;
    draft?: number;
    published?: number;
    archived?: number;
  }>({});

  // Single note mutations
  const [mutatingNoteId, setMutatingNoteId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Batch operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState<BatchOperationResult | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<ToastState | null>(null);

  const generation = useRef(0);
  const mutationLock = useRef(false);

  // Helper to update search params
  const updateParams = useCallback(
    (
      updates: Partial<{
        tab: string;
        q: string;
        category: string;
        sort: string;
        page: number;
        pinned: boolean;
        featured: boolean;
      }>,
      options?: { replace?: boolean },
    ) => {
      const next = new URLSearchParams(searchParams);
      next.delete('status');

      if ('tab' in updates) {
        if (updates.tab && updates.tab !== 'all') {
          next.set('tab', updates.tab);
        } else {
          next.delete('tab');
        }
        next.delete('page');
      }

      if ('q' in updates) {
        if (updates.q && updates.q.trim()) {
          next.set('q', updates.q.trim());
        } else {
          next.delete('q');
        }
        next.delete('page');
      }

      if ('category' in updates) {
        if (updates.category) {
          next.set('category', updates.category);
        } else {
          next.delete('category');
        }
        next.delete('page');
      }

      if ('sort' in updates) {
        if (updates.sort && updates.sort !== 'updated_desc') {
          next.set('sort', updates.sort);
        } else {
          next.delete('sort');
        }
      }

      if ('pinned' in updates) {
        if (updates.pinned) {
          next.set('pinned', 'true');
        } else {
          next.delete('pinned');
        }
        next.delete('page');
      }

      if ('featured' in updates) {
        if (updates.featured) {
          next.set('featured', 'true');
        } else {
          next.delete('featured');
        }
        next.delete('page');
      }

      if ('page' in updates) {
        if (updates.page && updates.page > 1) {
          next.set('page', String(updates.page));
        } else {
          next.delete('page');
        }
      }

      setSearchParams(next, { replace: options?.replace ?? true });
    },
    [searchParams, setSearchParams],
  );

  // Load stats for tab count badges
  useEffect(() => {
    if (isTestEnv) return;
    loadKnowledgeStats()
      .then((stats) => {
        setTabCounts({
          all: stats.total,
          draft: stats.draft,
          published: stats.published,
          archived: stats.archived,
        });
      })
      .catch(() => {
        // Non-fatal, badges remain optional
      });
  }, [refresh]);

  // Load notes
  useEffect(() => {
    const current = ++generation.current;
    setState('loading');

    const query: KnowledgeNotesQuery = {
      page,
      pageSize: 20,
    };
    if (tab && tab !== 'all') {
      query.status = tab as NoteStatus;
    }
    if (debouncedSearch) {
      query.q = debouncedSearch;
    }
    if (category) {
      query.category = category;
    }
    if (pinned) {
      query.pinned = true;
    }
    if (featured) {
      query.featured = true;
    }

    loadKnowledgeNotes(query)
      .then((result) => {
        if (generation.current !== current) return;
        const mappedNotes = result.items.map((item: NoteRecord | SearchResult) => {
          const card = mapNoteToCard(item);
          return {
            ...card,
            isFeatured: 'isFeatured' in item ? Boolean(item.isFeatured) : false,
            tags: 'tags' in item && Array.isArray(item.tags) ? item.tags : [],
          };
        });

        // Client-side sort if requested
        if (sort === 'title_asc') {
          mappedNotes.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sort === 'published_desc') {
          mappedNotes.sort((a, b) => {
            const dateA = ('publishedAt' in a && a.publishedAt ? String(a.publishedAt) : '') || '';
            const dateB = ('publishedAt' in b && b.publishedAt ? String(b.publishedAt) : '') || '';
            return dateB.localeCompare(dateA);
          });
        }

        const filterLabel = debouncedSearch
          ? `搜索结果: "${debouncedSearch}"`
          : tab !== 'all'
            ? `${tab === 'draft' ? '草稿' : tab === 'published' ? '已发布' : '已归档'}`
            : '全部文章';

        setModel({
          searchTerm: searchInput,
          filterLabel,
          notes: mappedNotes,
        });
        setTotalPages(result.totalPages);
        setTotalItems(result.totalItems);
        setState(mappedNotes.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (generation.current === current) {
          setState('error');
        }
      });

    return () => {
      generation.current += 1;
    };
  }, [debouncedSearch, page, refresh, tab, category, sort, pinned, featured, searchInput]);

  // Single note archive
  const handleArchive = useCallback(
    async (noteId: string) => {
      if (mutationLock.current) return;
      mutationLock.current = true;
      setMutatingNoteId(noteId);
      setMutationError(null);
      try {
        await archiveKnowledgeNote(noteId);
        invalidateDynamicContent();
        setToast({
          text: '文章已归档',
          actionLabel: '撤销',
          onAction: () => {
            void handleRestore(noteId);
          },
        });
        // LIST-03: If this was the only note on a page greater than 1, step back a page
        if (model.notes.length <= 1 && page > 1) {
          updateParams({ page: page - 1 }, { replace: true });
        } else {
          setRefresh((r) => r + 1);
        }
      } catch {
        setMutationError('文章归档失败。');
      } finally {
        mutationLock.current = false;
        setMutatingNoteId(null);
      }
    },
    [model.notes.length, page, updateParams],
  );

  // Single note restore
  const handleRestore = useCallback(
    async (noteId: string) => {
      if (mutationLock.current) return;
      mutationLock.current = true;
      setMutatingNoteId(noteId);
      setMutationError(null);
      try {
        await restoreKnowledgeNote(noteId);
        invalidateDynamicContent();
        setToast({
          text: '已恢复为草稿',
        });
        setRefresh((r) => r + 1);
      } catch {
        setMutationError('文章恢复失败。');
      } finally {
        mutationLock.current = false;
        setMutatingNoteId(null);
      }
    },
    [],
  );

  // Batch Archive
  const handleBatchArchive = useCallback(
    async (noteIds: string[]) => {
      if (mutationLock.current || noteIds.length === 0) return;
      mutationLock.current = true;
      setMutationError(null);
      const succeeded: string[] = [];
      const failed: { id: string; title: string; error: string }[] = [];

      for (const id of noteIds) {
        const note = model.notes.find((n) => n.id === id);
        const title = note?.title ?? id;
        try {
          await archiveKnowledgeNote(id);
          succeeded.push(id);
        } catch {
          failed.push({
            id,
            title,
            error: '网络异常或服务器错误',
          });
        }
      }

      mutationLock.current = false;
      invalidateDynamicContent();

      if (failed.length === 0) {
        setToast({ text: `已成功批量归档 ${succeeded.length} 篇文章` });
        setSelectedIds([]);
        setBatchResult(null);
      } else {
        setBatchResult({
          total: noteIds.length,
          succeeded,
          failed,
          actionType: 'archive',
        });
        // Keep failed items selected
        setSelectedIds(failed.map((f) => f.id));
      }

      // Check if current page needs fallback
      if (model.notes.length <= succeeded.length && page > 1) {
        updateParams({ page: page - 1 }, { replace: true });
      } else {
        setRefresh((r) => r + 1);
      }
    },
    [model.notes, page, updateParams],
  );

  // Batch Restore
  const handleBatchRestore = useCallback(
    async (noteIds: string[]) => {
      if (mutationLock.current || noteIds.length === 0) return;
      mutationLock.current = true;
      setMutationError(null);
      const succeeded: string[] = [];
      const failed: { id: string; title: string; error: string }[] = [];

      for (const id of noteIds) {
        const note = model.notes.find((n) => n.id === id);
        const title = note?.title ?? id;
        try {
          await restoreKnowledgeNote(id);
          succeeded.push(id);
        } catch {
          failed.push({
            id,
            title,
            error: '网络异常或服务器错误',
          });
        }
      }

      mutationLock.current = false;
      invalidateDynamicContent();

      if (failed.length === 0) {
        setToast({ text: `已成功批量恢复 ${succeeded.length} 篇文章为草稿` });
        setSelectedIds([]);
        setBatchResult(null);
      } else {
        setBatchResult({
          total: noteIds.length,
          succeeded,
          failed,
          actionType: 'restore',
        });
        setSelectedIds(failed.map((f) => f.id));
      }

      setRefresh((r) => r + 1);
    },
    [model.notes],
  );

  // Batch Category Change
  const handleBatchCategoryChange = useCallback(
    async (noteIds: string[], targetCategory: string) => {
      if (mutationLock.current || noteIds.length === 0) return;
      mutationLock.current = true;
      setMutationError(null);
      const succeeded: string[] = [];
      const failed: { id: string; title: string; error: string }[] = [];

      for (const id of noteIds) {
        const note = model.notes.find((n) => n.id === id);
        const title = note?.title ?? id;
        try {
          await updateKnowledgeNote(id, { category: targetCategory });
          succeeded.push(id);
        } catch {
          failed.push({
            id,
            title,
            error: '分类调整失败',
          });
        }
      }

      mutationLock.current = false;
      invalidateDynamicContent();

      if (failed.length === 0) {
        setToast({ text: `已成功将 ${succeeded.length} 篇文章分类调整为 "${targetCategory}"` });
        setSelectedIds([]);
        setBatchResult(null);
      } else {
        setBatchResult({
          total: noteIds.length,
          succeeded,
          failed,
          actionType: 'category',
        });
        setSelectedIds(failed.map((f) => f.id));
      }

      setRefresh((r) => r + 1);
    },
    [model.notes],
  );

  // Retry single failed batch item
  const handleRetrySingle = useCallback(
    async (noteId: string) => {
      if (!batchResult) return;
      if (batchResult.actionType === 'archive') {
        await handleBatchArchive([noteId]);
      } else if (batchResult.actionType === 'restore') {
        await handleBatchRestore([noteId]);
      }
    },
    [batchResult, handleBatchArchive, handleBatchRestore],
  );

  // Retry all failed batch items
  const handleRetryBatch = useCallback(async () => {
    if (!batchResult || batchResult.failed.length === 0) return;
    const failedIds = batchResult.failed.map((f) => f.id);
    if (batchResult.actionType === 'archive') {
      await handleBatchArchive(failedIds);
    } else if (batchResult.actionType === 'restore') {
      await handleBatchRestore(failedIds);
    }
  }, [batchResult, handleBatchArchive, handleBatchRestore]);

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setSearchInput('');
    setDebouncedSearch('');
    updateParams(
      {
        q: '',
        category: '',
        sort: 'updated_desc',
        pinned: false,
        featured: false,
        tab: 'all',
        page: 1,
      },
      { replace: true },
    );
  }, [updateParams]);

  return (
    <NotesPage
      model={model}
      state={state}
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      onPageChange={(nextPage) => updateParams({ page: nextPage }, { replace: false })}
      onSearchChange={(value) => {
        setSearchInput(value);
        if (isTestEnv) {
          setDebouncedSearch(value.trim());
          updateParams({ q: value.trim(), page: 1 }, { replace: true });
        }
      }}
      onClearSearch={() => {
        setSearchInput('');
        setDebouncedSearch('');
        updateParams({ q: '', page: 1 }, { replace: true });
      }}
      onArchive={handleArchive}
      onRestore={handleRestore}
      mutatingNoteId={mutatingNoteId}
      mutationError={mutationError}
      // Tabs
      tab={tab}
      onTabChange={(nextTab) => updateParams({ tab: nextTab, page: 1 }, { replace: true })}
      tabCounts={tabCounts}
      // Filters
      category={category}
      onCategoryChange={(nextCat) => updateParams({ category: nextCat, page: 1 }, { replace: true })}
      sort={sort}
      onSortChange={(nextSort) => updateParams({ sort: nextSort }, { replace: true })}
      pinned={pinned}
      onPinnedChange={(nextPinned) => updateParams({ pinned: nextPinned, page: 1 }, { replace: true })}
      featured={featured}
      onFeaturedChange={(nextFeatured) =>
        updateParams({ featured: nextFeatured, page: 1 }, { replace: true })
      }
      onResetFilters={handleResetFilters}
      // Batch
      selectedIds={selectedIds}
      onToggleSelect={(id) => {
        setSelectedIds((prev) =>
          prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
        );
      }}
      onSelectAll={() => {
        const allCurrentIds = model.notes.map((n) => n.id);
        const isAll =
          allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedIds.includes(id));
        setSelectedIds(isAll ? [] : allCurrentIds);
      }}
      onClearSelection={() => setSelectedIds([])}
      onBatchArchive={handleBatchArchive}
      onBatchRestore={handleBatchRestore}
      onBatchCategoryChange={handleBatchCategoryChange}
      batchResult={batchResult}
      onClearBatchResult={() => setBatchResult(null)}
      onRetryBatch={handleRetryBatch}
      onRetrySingle={handleRetrySingle}
      // Toast
      toast={toast}
      onClearToast={() => setToast(null)}
    />
  );
}
