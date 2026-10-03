import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteRecord } from '@namdw/shared';
import {
  clearDynamicPosts,
  getAllPosts,
  getPostBySlug,
  listCategories,
  listFeaturedContent,
  listPosts,
  listTags,
} from './contentQueries';
import {
  fetchPublishedNoteBySlug,
  fetchWithTimeout,
  invalidateDynamicContent,
  noteToPost,
  type PublicPostSummary,
  syncPublishedNotes,
} from './dynamicContentSync';

const sampleNote: NoteRecord = {
  id: 'test-note-1',
  title: '考研英语阅读四周强化训练计划',
  slug: 'english-reading-training-plan',
  summary: '围绕词汇、长难句与真题复盘展开的四周英语阅读训练方案。',
  category: '英语学习',
  status: 'published',
  isPinned: false,
  isFeatured: true,
  publishedAt: '2026-03-01T12:00:00.000Z',
  contentJson: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '四周强化训练第一周：基础长难句与词汇。' }],
      },
    ],
  }),
  contentText: '四周强化训练第一周：基础长难句与词汇。',
  reviewCount: 0,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T12:00:00.000Z',
  lastReviewedAt: null,
  tags: ['英语', '考研', '复习计划'],
};

describe('dynamicContentSync', () => {
  beforeEach(() => {
    clearDynamicPosts();
    invalidateDynamicContent();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    clearDynamicPosts();
    invalidateDynamicContent();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('converts NoteRecord to Post correctly', () => {
    const post = noteToPost(sampleNote);

    expect(post.slug).toBe('english-reading-training-plan');
    expect(post.title).toBe(sampleNote.title);
    expect(post.summary).toBe(sampleNote.summary);
    expect(post.category).toBe('英语学习');
    expect(post.tags).toEqual(['英语', '考研', '复习计划']);
    expect(post.selected).toBe(true);
    expect(post.publishedAt).toBe('2026-03-01T12:00:00.000Z');
    expect(post.readingTime).toBeGreaterThanOrEqual(1);
    expect(post.contentJson).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '四周强化训练第一周：基础长难句与词汇。' }],
        },
      ],
    });
  });

  it('converts lightweight PublicPostSummary to Post with default empty body and undefined contentJson', () => {
    const summary: PublicPostSummary = {
      slug: 'summary-article',
      title: 'Summary Article',
      summary: 'Short summary',
      category: 'Science',
      tags: ['physics'],
      publishedAt: '2026-03-01T12:00:00.000Z',
      readingTime: 4,
      selected: false,
    };
    const post = noteToPost(summary);
    expect(post.slug).toBe('summary-article');
    expect(post.title).toBe('Summary Article');
    expect(post.summary).toBe('Short summary');
    expect(post.body).toBe('');
    expect(post.contentJson).toBeUndefined();
    expect(post.readingTime).toBe(4);
    expect(post.selected).toBe(false);
    expect(post.cover).toEqual({ alt: 'Summary Article', tone: 'blue' });
  });

  it('synchronizes published notes from API into content layer and handles slug precedence', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [sampleNote],
          page: 1,
          pageSize: 100,
          totalItems: 1,
          totalPages: 1,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const synced = await syncPublishedNotes(true);
    expect(synced).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/posts?status=published&pageSize=100',
      expect.any(Object),
    );

    // Verification in contentQueries:
    const post = getPostBySlug('english-reading-training-plan');
    expect(post).toBeDefined();
    expect(post?.title).toBe(sampleNote.title);
    expect(post?.contentJson).toBeDefined();

    // Appears in featured content because isFeatured: true
    const featured = listFeaturedContent();
    const featuredArticle = featured.find(
      (item) => item.href === '/posts/english-reading-training-plan',
    );
    expect(featuredArticle).toBeDefined();
    expect(featuredArticle?.title).toBe(sampleNote.title);

    // Appears in categories and tags
    const categories = listCategories();
    expect(categories.some((c) => c.name === '英语学习')).toBe(true);

    const tags = listTags();
    expect(tags.some((t) => t.name === '考研')).toBe(true);
  });

  it('synchronizes lightweight summary items from /api/public/posts into dynamicPosts', async () => {
    const lightweightItem: PublicPostSummary = {
      slug: 'lightweight-article',
      title: 'Lightweight Article',
      summary: 'Lightweight summary',
      category: 'Design',
      tags: ['ui'],
      publishedAt: '2026-03-01T12:00:00.000Z',
      readingTime: 2,
      selected: true,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [lightweightItem],
          page: 1,
          pageSize: 100,
          totalItems: 1,
          totalPages: 1,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const synced = await syncPublishedNotes(true);
    expect(synced).toBe(true);
    const post = getPostBySlug('lightweight-article');
    expect(post).toBeDefined();
    expect(post?.body).toBe('');
    expect(post?.contentJson).toBeUndefined();
    expect(post?.selected).toBe(true);
  });

  it('removes note from featured content when isFeatured is false', async () => {
    const unfeaturedNote: NoteRecord = {
      ...sampleNote,
      id: 'unfeatured-1',
      slug: 'unfeatured-article',
      title: '普通非精选笔记',
      isFeatured: false,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [unfeaturedNote],
          page: 1,
          pageSize: 100,
          totalItems: 1,
          totalPages: 1,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await syncPublishedNotes(true);

    // Should be listed in all posts
    const post = getPostBySlug('unfeatured-article');
    expect(post).toBeDefined();
    expect(post?.selected).toBe(false);

    // Should NOT be in featured content on homepage
    const featured = listFeaturedContent();
    expect(featured.some((item) => item.href === '/posts/unfeatured-article')).toBe(false);
  });

  it('fails gracefully when API network error occurs without crashing static content', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);

    const synced = await syncPublishedNotes(true);
    expect(synced).toBe(false);

    // Static posts are still accessible
    const allPosts = getAllPosts();
    expect(allPosts.length).toBeGreaterThan(0);
    expect(listPosts().items.length).toBeGreaterThan(0);
  });

  it('shares an in-flight synchronization even before the first success', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    let finish!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const first = syncPublishedNotes();
    const second = syncPublishedNotes();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(Response.json({ success: true, data: { items: [sampleNote], totalPages: 1 } }));
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(getPostBySlug(sampleNote.slug)?.title).toBe(sampleNote.title);
  });

  it('keeps the last complete collection when a later page fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      success: true, data: { items: [sampleNote], totalPages: 1 },
    })));
    await syncPublishedNotes(true);
    const replacement = { ...sampleNote, slug: 'replacement' };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, data: { items: [replacement], totalPages: 2 } }))
      .mockResolvedValueOnce(new Response('', { status: 503 })));
    expect(await syncPublishedNotes(true)).toBe(false);
    expect(getPostBySlug(sampleNote.slug)?.title).toBe(sampleNote.title);
    expect(getPostBySlug('replacement')).toBeUndefined();
  });

  it('fetches published note by slug with full body and contentJson, updating dynamicPosts', async () => {
    const detailItem = {
      slug: 'full-detail-article',
      title: 'Full Detail Article',
      summary: 'Full detail summary',
      body: '# Full Article Body',
      contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Full text' }] }] },
      category: 'Programming',
      tags: ['typescript'],
      publishedAt: '2026-03-02T12:00:00.000Z',
      readingTime: 5,
      selected: false,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [detailItem],
          page: 1,
          pageSize: 100,
          totalItems: 1,
          totalPages: 1,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPublishedNoteBySlug('full-detail-article');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/posts?status=published&slug=full-detail-article',
      expect.any(Object),
    );
    expect(result).toBeDefined();
    expect(result?.body).toBe('# Full Article Body');
    expect(result?.contentJson).toEqual(detailItem.contentJson);

    // Verify dynamicPosts was augmented with the full detail
    const inMemory = getPostBySlug('full-detail-article');
    expect(inMemory).toBeDefined();
    expect(inMemory?.body).toBe('# Full Article Body');
    expect(inMemory?.contentJson).toEqual(detailItem.contentJson);
  });

  it('augments existing in-memory summary with full detail when fetched by slug', async () => {
    const summaryItem: PublicPostSummary = {
      slug: 'augment-slug',
      title: 'Augment Title',
      summary: 'Initial summary',
      category: 'Engineering',
      tags: ['rust'],
      publishedAt: '2026-03-01T00:00:00.000Z',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [summaryItem], page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
      }),
    }));
    await syncPublishedNotes(true);
    expect(getPostBySlug('augment-slug')?.body).toBe('');

    const detailItem = {
      ...summaryItem,
      body: 'Detailed rust explanation',
      contentJson: { type: 'doc', content: [] },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [detailItem], totalItems: 1, totalPages: 1 },
      }),
    }));
    const fullPost = await fetchPublishedNoteBySlug('augment-slug');
    expect(fullPost?.body).toBe('Detailed rust explanation');
    expect(getPostBySlug('augment-slug')?.body).toBe('Detailed rust explanation');
    expect(getPostBySlug('augment-slug')?.contentJson).toBeDefined();
  });

  it('handles fetchPublishedNoteBySlug fallbacks and 404 cleanly', async () => {
    // 404 response status -> returns null
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));
    expect(await fetchPublishedNoteBySlug('not-found-status')).toBeNull();

    // 200 OK with empty items -> returns null
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [] },
      }),
    }));
    expect(await fetchPublishedNoteBySlug('nonexistent')).toBeNull();

    // HTTP 500 error -> returns undefined
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));
    expect(await fetchPublishedNoteBySlug('error-post')).toBeUndefined();

    // Network exception -> returns undefined
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Fetch failed')));
    expect(await fetchPublishedNoteBySlug('network-fail')).toBeUndefined();

    // Timeout (AbortError) -> returns undefined
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')));
    expect(await fetchPublishedNoteBySlug('timeout-post')).toBeUndefined();
  });

  it('fetchWithTimeout enforces timeout and abort signals', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const promise = fetchWithTimeout('/api/slow', undefined, 100);
      vi.advanceTimersByTime(150);

      await expect(promise).rejects.toMatchObject({
        name: 'AbortError',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('fetchWithTimeout forwards caller abort signal', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithTimeout('/api/cancel', { signal: controller.signal }, 5000);
    controller.abort();

    await expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('syncPublishedNotes returns false when timeout occurs', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const syncPromise = syncPublishedNotes(true);
      vi.advanceTimersByTime(10_000);
      const result = await syncPromise;
      expect(result).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
