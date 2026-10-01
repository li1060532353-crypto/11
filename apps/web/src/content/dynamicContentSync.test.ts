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
import { invalidateDynamicContent, noteToPost, syncPublishedNotes } from './dynamicContentSync';

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
  });

  afterEach(() => {
    clearDynamicPosts();
    invalidateDynamicContent();
    vi.restoreAllMocks();
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
    expect(fetchMock).toHaveBeenCalledWith('/api/notes?status=published&pageSize=100');

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
});
