import type { NoteRecord } from '@namdw/shared';
import { getDynamicPosts, syncDynamicPosts } from './contentQueries';
import type { Cover, Post, PostSummary } from './types';

export type PublicPostSummary = {
  slug: string;
  title?: string;
  publishedTitle?: string;
  summary?: string;
  publishedSummary?: string;
  body?: string;
  contentText?: string;
  publishedContentText?: string;
  contentJson?: unknown;
  publishedContentJson?: unknown;
  category?: string | { slug?: string; label?: string; name?: string };
  tags?: readonly (string | { slug?: string; label?: string; name?: string })[];
  publishedAt?: string;
  createdAt?: string;
  readingTime?: number;
  readingMinutes?: number;
  selected?: boolean;
  featured?: boolean;
  isFeatured?: boolean;
  cover?: Cover;
  seoTitle?: string | null;
  seoDescription?: string | null;
  [key: string]: unknown;
};

export type PublicPostDetail = PublicPostSummary & {
  body?: string;
  contentJson?: unknown;
};

export function toSummary(post: Post): PostSummary {
  const { body, ...summary } = post;
  void body;
  return summary;
}

export function noteToPost(
  note: NoteRecord | PublicPostSummary | PublicPostDetail | Record<string, unknown>,
): Post {
  const item = note as Partial<NoteRecord> & PublicPostSummary;
  const title = String(item.title ?? item.publishedTitle ?? '');
  const summary = String(item.summary ?? item.publishedSummary ?? '');
  const slug = String(item.slug ?? '');
  const publishedAt = String(item.publishedAt ?? item.createdAt ?? new Date().toISOString());

  const bodyText =
    (typeof item.body === 'string' ? item.body : undefined) ??
    (typeof item.publishedContentText === 'string' ? item.publishedContentText : undefined) ??
    (typeof item.contentText === 'string' ? item.contentText : undefined) ??
    '';

  const rawJson = item.contentJson ?? item.publishedContentJson;
  let docObj: unknown = undefined;
  if (rawJson !== undefined && rawJson !== null) {
    try {
      docObj = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    } catch {
      docObj = undefined;
    }
  }

  let category = '';
  if (typeof item.category === 'string') {
    category = item.category;
  } else if (item.category && typeof item.category === 'object') {
    const cat = item.category as Record<string, unknown>;
    category = String(cat.label ?? cat.name ?? cat.slug ?? '');
  }

  let tags: string[] = [];
  if (Array.isArray(item.tags)) {
    tags = item.tags.map((t) => {
      if (typeof t === 'string') return t;
      if (t && typeof t === 'object') {
        const tagObj = t as Record<string, unknown>;
        return String(tagObj.label ?? tagObj.name ?? tagObj.slug ?? '');
      }
      return String(t);
    });
  }

  let readingTime = 1;
  if (typeof item.readingTime === 'number' && item.readingTime > 0) {
    readingTime = item.readingTime;
  } else if (typeof item.readingMinutes === 'number' && item.readingMinutes > 0) {
    readingTime = item.readingMinutes;
  } else if (bodyText.length > 0) {
    readingTime = Math.max(1, Math.ceil(bodyText.length / 400));
  }

  const selected = Boolean(item.selected ?? item.isFeatured ?? item.featured ?? false);

  const cover: Cover =
    item.cover && typeof item.cover === 'object'
      ? (item.cover as Cover)
      : {
          alt: title,
          tone: 'blue',
        };

  return {
    slug,
    title,
    summary,
    body: bodyText,
    contentJson: docObj,
    category,
    tags,
    publishedAt,
    readingTime,
    selected,
    cover,
    ...(typeof item.seoTitle === 'string' ? { seoTitle: item.seoTitle } : {}),
    ...(typeof item.seoDescription === 'string' ? { seoDescription: item.seoDescription } : {}),
  };
}

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = 8_000,
): Promise<Response> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
    timeoutId = setTimeout(() => {
      controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'));
    }, timeoutMs);
  }

  const callerSignal = init?.signal;
  const onCallerAbort = () => {
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    if (callerSignal) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  }
}

let syncPromise: Promise<boolean> | null = null;
let lastSyncTimestamp = 0;
const SYNC_CACHE_MS = 5_000;

export async function syncPublishedNotes(force = false): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  if (process.env.NODE_ENV === 'test' && !force) return false;

  const now = Date.now();
  if (syncPromise) {
    return syncPromise;
  }

  if (!force && lastSyncTimestamp > 0 && now - lastSyncTimestamp < SYNC_CACHE_MS) return true;

  const pending = (async () => {
    try {
      const allItems: (NoteRecord | PublicPostSummary)[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages && page <= 50) {
        const url =
          page === 1
            ? '/api/public/posts?status=published&pageSize=100'
            : `/api/public/posts?status=published&pageSize=100&page=${page}`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) return false;
        const json = await response.json();
        if (json && json.success && Array.isArray(json.data?.items)) {
          allItems.push(...(json.data.items as (NoteRecord | PublicPostSummary)[]));
          totalPages = Number(json.data.totalPages) || 1;
          page++;
        } else {
          return false;
        }
      }

      if (page > totalPages) {
        const existingPosts = getDynamicPosts();
        const existingMap = new Map(existingPosts.map((p) => [p.slug, p]));
        const posts = allItems.map((item) => {
          const post = noteToPost(item);
          const existing = existingMap.get(post.slug);
          if (existing) {
            if (!post.body && existing.body) {
              post.body = existing.body;
            }
            if (post.contentJson === undefined && existing.contentJson !== undefined) {
              post.contentJson = existing.contentJson;
            }
          }
          return post;
        });
        syncDynamicPosts(posts);
        lastSyncTimestamp = Date.now();
        return true;
      }
    } catch {
      // Graceful fallback to static posts
    }
    return false;
  })();

  syncPromise = pending;
  try {
    return await pending;
  } finally {
    if (syncPromise === pending) syncPromise = null;
  }
}

export async function fetchPublishedNoteBySlug(slug: string): Promise<Post | null | undefined> {
  if (typeof fetch !== 'function') return undefined;
  try {
    const response = await fetchWithTimeout(
      `/api/public/posts?status=published&slug=${encodeURIComponent(slug)}`,
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      return undefined;
    }
    const json = await response.json();
    if (json && json.success && Array.isArray(json.data?.items)) {
      if (json.data.items.length === 0) return null;
      const raw = json.data.items[0] as NoteRecord | PublicPostDetail;
      const post = noteToPost(raw);

      const currentDynamic = getDynamicPosts();
      const existingIndex = currentDynamic.findIndex((p) => p.slug === post.slug);
      if (existingIndex >= 0) {
        const updated = [...currentDynamic];
        updated[existingIndex] = post;
        syncDynamicPosts(updated);
      } else {
        syncDynamicPosts([...currentDynamic, post]);
      }

      return post;
    }
  } catch {
    // Network failure, timeout, or parsing error
    return undefined;
  }
  return undefined;
}

export function invalidateDynamicContent(): void {
  syncPromise = null;
  lastSyncTimestamp = 0;
}
