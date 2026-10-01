import type { NoteRecord } from '@namdw/shared';
import { syncDynamicPosts } from './contentQueries';
import type { Post } from './types';

export function noteToPost(note: NoteRecord): Post {
  const publishedAt = note.publishedAt ?? note.createdAt;
  const readingTime = Math.max(1, Math.ceil((note.contentText || '').length / 400));
  let docObj: unknown;
  try {
    docObj = typeof note.contentJson === 'string' ? JSON.parse(note.contentJson) : note.contentJson;
  } catch {
    docObj = undefined;
  }

  return {
    slug: note.slug,
    title: note.title,
    summary: note.summary,
    body: note.contentText,
    contentJson: docObj,
    category: note.category,
    tags: note.tags ?? [],
    publishedAt,
    readingTime,
    selected: Boolean(note.isFeatured),
    cover: {
      alt: note.title,
      tone: 'blue',
    },
  };
}

let syncPromise: Promise<boolean> | null = null;
let lastSyncTimestamp = 0;
const SYNC_CACHE_MS = 5_000;

export async function syncPublishedNotes(force = false): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  if (process.env.NODE_ENV === 'test' && !force) return false;

  const now = Date.now();
  if (!force && syncPromise && now - lastSyncTimestamp < SYNC_CACHE_MS) {
    return syncPromise;
  }

  syncPromise = (async () => {
    try {
      const allItems: NoteRecord[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages && page <= 50) {
        const url =
          page === 1
            ? '/api/notes?status=published&pageSize=100'
            : `/api/notes?status=published&pageSize=100&page=${page}`;
        const response = await fetch(url);
        if (!response.ok) break;
        const json = await response.json();
        if (json && json.success && Array.isArray(json.data?.items)) {
          allItems.push(...(json.data.items as NoteRecord[]));
          totalPages = Number(json.data.totalPages) || 1;
          page++;
        } else {
          break;
        }
      }

      if (allItems.length > 0 || page > 1) {
        const posts = allItems.map(noteToPost);
        syncDynamicPosts(posts);
        lastSyncTimestamp = Date.now();
        return true;
      }
    } catch {
      // Graceful fallback to static posts
    }
    return false;
  })();

  return syncPromise;
}

export async function fetchPublishedNoteBySlug(slug: string): Promise<Post | undefined> {
  if (typeof fetch !== 'function') return undefined;
  try {
    const response = await fetch(`/api/notes?status=published&slug=${encodeURIComponent(slug)}`);
    if (!response.ok) return undefined;
    const json = await response.json();
    if (json && json.success && Array.isArray(json.data?.items) && json.data.items.length > 0) {
      const note = json.data.items[0] as NoteRecord;
      return noteToPost(note);
    }
  } catch {
    // fallback
  }
  return undefined;
}

export function invalidateDynamicContent(): void {
  syncPromise = null;
  lastSyncTimestamp = 0;
}
