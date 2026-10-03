import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentSourceFailure } from './apiClient';
import type { ApiPostDetail, ApiPostSummary, ApiProject, ApiTaxonomy } from './apiTypes';
import type { Paginated, Post, PostSummary, Project } from './types';

vi.mock('./apiClient', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  requestContent: vi.fn(),
}));

vi.mock('./contentQueries', () => ({
  getPostBySlug: vi.fn(),
  getProjectBySlug: vi.fn(),
  groupPostsByArchive: vi.fn(),
  listCategories: vi.fn(),
  listFeaturedContent: vi.fn(),
  listPosts: vi.fn(),
  listProjects: vi.fn(),
  listTags: vi.fn(),
  searchPosts: vi.fn(),
}));

import { requestContent } from './apiClient';
import {
  getPostBySlug as getStaticPostBySlug,
  groupPostsByArchive as groupStaticPostsByArchive,
  listCategories as listStaticCategories,
  listFeaturedContent as listStaticFeaturedContent,
  listPosts as listStaticPosts,
  searchPosts as searchStaticPosts,
} from './contentQueries';
import {
  getPostBySlug,
  groupPostsByArchive,
  listCategories,
  listFeaturedContent,
  listPosts,
  listProjects,
  searchPosts,
} from './contentGateway';

const requestContentMock = vi.mocked(requestContent);
const listStaticPostsMock = vi.mocked(listStaticPosts);
const getStaticPostBySlugMock = vi.mocked(getStaticPostBySlug);
const groupStaticPostsByArchiveMock = vi.mocked(groupStaticPostsByArchive);
const listStaticCategoriesMock = vi.mocked(listStaticCategories);
const listStaticFeaturedContentMock = vi.mocked(listStaticFeaturedContent);
const searchStaticPostsMock = vi.mocked(searchStaticPosts);

describe('content gateway', () => {
  const apiPost = {
    slug: 'matrix-rank',
    title: 'From Rank to Structure',
    summary: 'A compact linear algebra note.',
    category: { slug: 'linear-algebra', label: 'Linear Algebra', postCount: 4 },
    tags: [
      { slug: 'matrix', label: 'Matrix', postCount: 2 },
      { slug: 'rank', label: 'Rank', postCount: 1 },
    ],
    publishedAt: '2026-01-10T00:00:00.000Z',
    readingMinutes: 6,
    seoTitle: null,
    seoDescription: null,
  } satisfies ApiPostSummary;

  const staticPost = {
    slug: 'static-post',
    title: 'Static post',
    summary: 'Static summary',
    body: 'Static body',
    category: 'Static',
    tags: ['fallback'],
    publishedAt: '2026-01-01T00:00:00.000Z',
    readingTime: 3,
    selected: false,
    cover: { alt: 'Static cover', tone: 'blue' },
  } satisfies Post;

  const staticPage = {
    items: [toSummary(staticPost)],
    page: 1,
    pageSize: 6,
    totalItems: 1,
    totalPages: 1,
  } satisfies Paginated<PostSummary>;

  beforeEach(() => {
    vi.clearAllMocks();
    listStaticPostsMock.mockReturnValue(staticPage);
    getStaticPostBySlugMock.mockReturnValue(staticPost);
    groupStaticPostsByArchiveMock.mockReturnValue([
      { year: 2026, month: 1, posts: [toSummary(staticPost)] },
    ]);
    listStaticCategoriesMock.mockReturnValue([{ slug: 'static', name: 'Static', count: 1 }]);
    listStaticFeaturedContentMock.mockReturnValue([
      {
        kind: '文章',
        title: 'Static post',
        summary: 'Static summary',
        meta: 'Static · 3 分钟',
        href: '/posts/static-post',
      },
    ]);
    searchStaticPostsMock.mockReturnValue(staticPage);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns API data with api source when list posts succeeds', async () => {
    requestContentMock.mockResolvedValue({
      items: [apiPost],
      page: 1,
      pageSize: 6,
      totalItems: 1,
      totalPages: 1,
    });

    await expect(listPosts()).resolves.toEqual({
      data: {
        items: [expect.objectContaining({ slug: 'matrix-rank', readingTime: 6 })],
        page: 1,
        pageSize: 6,
        totalItems: 1,
        totalPages: 1,
      },
      source: 'api',
    });
  });

  it('returns fallback data with the API failure when the network request fails', async () => {
    const failure = new ContentSourceFailure({ kind: 'network', message: 'offline' });
    requestContentMock.mockRejectedValue(failure);

    await expect(listPosts({ page: 999, pageSize: 2 })).resolves.toEqual({
      data: staticPage,
      source: 'fallback',
      error: failure.error,
    });
    expect(listStaticPostsMock).toHaveBeenCalledWith({ page: 999, pageSize: 2 });
  });

  it('falls back when API post data is malformed', async () => {
    requestContentMock.mockResolvedValue({
      items: [{ slug: 'missing-fields' }],
      page: 1,
      pageSize: 6,
      totalItems: 1,
      totalPages: 1,
    });

    await expect(listPosts()).resolves.toEqual({
      data: staticPage,
      source: 'fallback',
      error: {
        kind: 'invalid-data',
        message: 'Content API returned invalid post summary data',
      },
    });
  });

  it('maps API related posts on post detail responses', async () => {
    const detail = {
      ...apiPost,
      body: '# API detail',
      relatedPosts: [
        {
          ...apiPost,
          slug: 'related-rank',
          title: 'Related Rank',
        },
      ],
    } satisfies ApiPostDetail;
    requestContentMock.mockResolvedValue(detail);

    await expect(getPostBySlug('matrix-rank')).resolves.toEqual({
      data: expect.objectContaining({
        slug: 'matrix-rank',
        relatedPosts: [
          expect.objectContaining({
            slug: 'related-rank',
            title: 'Related Rank',
            readingTime: 6,
          }),
        ],
      }),
      source: 'api',
    });
  });

  it('sends q to /content/posts when list posts receives a query', async () => {
    requestContentMock.mockResolvedValue({
      items: [apiPost],
      page: 1,
      pageSize: 6,
      totalItems: 1,
      totalPages: 1,
    });

    await listPosts({ q: 'rank' });

    expect(requestContentMock).toHaveBeenCalledWith('/content/posts', {
      search: expect.objectContaining({
        get: expect.any(Function),
      }),
    });
    expect(getSearchParams().get('q')).toBe('rank');
  });

  it('uses /content/search for explicit searches', async () => {
    requestContentMock.mockResolvedValue({
      items: [apiPost],
      page: 1,
      pageSize: 6,
      totalItems: 1,
      totalPages: 1,
    });

    await searchPosts('rank', { page: 2, pageSize: 3 });

    expect(requestContentMock).toHaveBeenCalledWith('/content/search', {
      search: expect.objectContaining({
        get: expect.any(Function),
      }),
    });
    expect(getSearchParams().get('q')).toBe('rank');
    expect(getSearchParams().get('page')).toBe('2');
    expect(getSearchParams().get('pageSize')).toBe('3');
  });

  it('uses category and tag post routes when those filters are present', async () => {
    requestContentMock.mockResolvedValue({
      items: [apiPost],
      page: 1,
      pageSize: 6,
      totalItems: 1,
      totalPages: 1,
    });

    await listPosts({ category: 'linear-algebra' });
    await listPosts({ tag: 'typescript' });

    expect(requestContentMock).toHaveBeenNthCalledWith(
      1,
      '/content/categories/linear-algebra/posts',
      expect.any(Object),
    );
    expect(requestContentMock).toHaveBeenNthCalledWith(
      2,
      '/content/tags/typescript/posts',
      expect.any(Object),
    );
  });

  it('preserves the static search-start behavior for empty searches', async () => {
    await searchPosts('', { page: 2, pageSize: 1 });

    expect(requestContentMock).not.toHaveBeenCalled();
    expect(searchStaticPostsMock).toHaveBeenCalledWith('', { page: 2, pageSize: 1 });
    await expect(searchPosts('', { page: 2, pageSize: 1 })).resolves.toEqual({
      data: staticPage,
      source: 'fallback',
    });
  });

  it('queries /api/public/search on the production gateway when available', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [
            {
              slug: 'prod-search-result',
              title: 'Production Search Result',
              summary: 'Found via public search',
              category: 'Search',
              tags: ['prod'],
              publishedAt: '2026-03-01T00:00:00.000Z',
              readingTime: 3,
              selected: false,
            },
          ],
          page: 2,
          pageSize: 5,
          totalItems: 11,
          totalPages: 3,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchPosts('search-query', { page: 2, pageSize: 5 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/search?q=search-query&page=2&pageSize=5',
      expect.any(Object),
    );
    expect(result).toEqual({
      source: 'api',
      data: {
        items: [
          expect.objectContaining({
            slug: 'prod-search-result',
            title: 'Production Search Result',
            readingTime: 3,
          }),
        ],
        page: 2,
        pageSize: 5,
        totalItems: 11,
        totalPages: 3,
      },
    });
    expect(searchStaticPostsMock).not.toHaveBeenCalled();
    expect(requestContentMock).not.toHaveBeenCalled();
  });

  it('uses default page 1 and pageSize 12 for production search when unspecified', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [],
          page: 1,
          pageSize: 12,
          totalItems: 0,
          totalPages: 1,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await searchPosts('test');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/search?q=test&page=1&pageSize=12',
      expect.any(Object),
    );
  });

  it('falls back to static search on production gateway when public search fails or returns non-ok response', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, error: 'Service unavailable' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchPosts('failing-query', { page: 1, pageSize: 6 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/search?q=failing-query&page=1&pageSize=6',
      expect.any(Object),
    );
    expect(searchStaticPostsMock).toHaveBeenCalledWith('failing-query', { page: 1, pageSize: 6 });
    expect(result).toEqual({
      data: staticPage,
      source: 'fallback',
    });
  });

  it('falls back to static search on production gateway when public search encounters network error', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network failure'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchPosts('offline-query', { page: 1, pageSize: 12 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/search?q=offline-query&page=1&pageSize=12',
      expect.any(Object),
    );
    expect(searchStaticPostsMock).toHaveBeenCalledWith('offline-query', { page: 1, pageSize: 12 });
    expect(result).toEqual({
      data: staticPage,
      source: 'fallback',
    });
  });

  it('maps taxonomy and projects from API responses', async () => {
    const taxonomy = {
      slug: 'linear-algebra',
      label: 'Linear Algebra',
      postCount: 4,
    } satisfies ApiTaxonomy;
    const project = {
      slug: 'content-api',
      title: 'Content API',
      summary: 'Typed API boundary.',
      description: '# Content API',
      technologies: ['TypeScript'],
      links: {
        source: 'https://github.com/example/repo',
      },
    } satisfies ApiProject;
    requestContentMock.mockResolvedValueOnce([taxonomy]).mockResolvedValueOnce([project]);

    await expect(listCategories()).resolves.toEqual({
      data: [{ slug: 'linear-algebra', name: 'Linear Algebra', count: 4 }],
      source: 'api',
    });
    await expect(listProjects()).resolves.toEqual({
      data: [
        {
          slug: 'content-api',
          name: 'Content API',
          summary: 'Typed API boundary.',
          body: '# Content API',
          technologies: ['TypeScript'],
          selected: false,
          sourceUrl: 'https://github.com/example/repo',
        } satisfies Project,
      ],
      source: 'api',
    });
  });

  it('derives featured content from API projects and posts without requesting a featured route', async () => {
    const project = {
      slug: 'content-api',
      title: 'Content API',
      summary: 'Typed API boundary.',
      description: '# Content API',
      technologies: ['TypeScript', 'Vite'],
      featured: true,
    } satisfies ApiProject;
    requestContentMock.mockResolvedValueOnce([project]).mockResolvedValueOnce({
      items: [
        {
          ...apiPost,
          featured: true,
        },
      ],
      page: 1,
      pageSize: 3,
      totalItems: 1,
      totalPages: 1,
    });

    await expect(listFeaturedContent()).resolves.toEqual({
      data: [
        {
          kind: '项目',
          title: 'Content API',
          summary: 'Typed API boundary.',
          meta: 'TypeScript · Vite',
          href: '/projects/content-api',
        },
        {
          kind: '文章',
          title: 'From Rank to Structure',
          summary: 'A compact linear algebra note.',
          meta: 'Linear Algebra · 6 分钟',
          href: '/posts/matrix-rank',
        },
      ],
      source: 'api',
    });
    expect(requestContentMock).toHaveBeenNthCalledWith(1, '/content/projects');
    expect(requestContentMock).toHaveBeenNthCalledWith(2, '/content/posts', {
      search: expect.objectContaining({
        get: expect.any(Function),
      }),
    });
    expect(getSearchParamsForCall(2).get('pageSize')).toBe('12');
    expect(requestContentMock).not.toHaveBeenCalledWith('/content/featured');
  });

  it('falls back to static featured content when featured API derivation fails', async () => {
    const failure = new ContentSourceFailure({ kind: 'http', message: 'boom' });
    requestContentMock.mockResolvedValueOnce([]).mockRejectedValueOnce(failure);

    await expect(listFeaturedContent()).resolves.toEqual({
      data: [
        {
          kind: '文章',
          title: 'Static post',
          summary: 'Static summary',
          meta: 'Static · 3 分钟',
          href: '/posts/static-post',
        },
      ],
      source: 'fallback',
      error: failure.error,
    });
  });

  it('derives archive groups from archive month metadata and monthly post fetches', async () => {
    requestContentMock
      .mockResolvedValueOnce([
        { month: '2026-01', count: 1 },
        { month: '2025-12', count: 1 },
      ])
      .mockResolvedValueOnce({
        items: [apiPost],
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
      })
      .mockResolvedValueOnce({
        items: [
          {
            ...apiPost,
            slug: 'december-rank',
            title: 'December Rank',
            publishedAt: '2025-12-20T00:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
      });

    await expect(groupPostsByArchive()).resolves.toEqual({
      data: [
        {
          year: 2026,
          month: 1,
          posts: [expect.objectContaining({ slug: 'matrix-rank', category: 'Linear Algebra' })],
        },
        {
          year: 2025,
          month: 12,
          posts: [expect.objectContaining({ slug: 'december-rank' })],
        },
      ],
      source: 'api',
    });
    expect(requestContentMock).toHaveBeenNthCalledWith(1, '/content/archives');
    expect(requestContentMock).toHaveBeenNthCalledWith(2, '/content/posts', {
      search: expect.objectContaining({
        get: expect.any(Function),
      }),
    });
    expect(requestContentMock).toHaveBeenNthCalledWith(3, '/content/posts', {
      search: expect.objectContaining({
        get: expect.any(Function),
      }),
    });
    expect(getSearchParamsForCall(2).get('archive')).toBe('2026-01');
    expect(getSearchParamsForCall(2).get('pageSize')).toBe('1');
    expect(getSearchParamsForCall(3).get('archive')).toBe('2025-12');
    expect(getSearchParamsForCall(3).get('pageSize')).toBe('1');
  });
});

function toSummary(post: Post): PostSummary {
  const { body, ...summary } = post;
  void body;
  return summary;
}

function getSearchParams(): URLSearchParams {
  return getSearchParamsForCall(requestContentMock.mock.calls.length);
}

function getSearchParamsForCall(callNumber: number): URLSearchParams {
  const options = requestContentMock.mock.calls.at(callNumber - 1)?.[1];
  expect(options?.search).toBeInstanceOf(URLSearchParams);
  return options!.search!;
}
