import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', async (original) => ({
  ...(await original() as object),
  requestContent: vi.fn(),
}));

import { requestContent } from './apiClient';
import { getPostNeighbors } from './contentGateway';
import { clearDynamicPosts, getAllPosts, syncDynamicPosts } from './contentQueries';

const summary = (slug: string) => ({
  slug, title: slug, summary: slug,
  category: { slug: 'notes', label: 'Notes', postCount: 3 },
  tags: [], publishedAt: '2026-01-01T00:00:00Z', readingMinutes: 3,
  seoTitle: null, seoDescription: null,
});
const page = (slugs: string[], number = 1, totalPages = 1) => ({
  items: slugs.map(summary), page: number, pageSize: 2,
  totalItems: totalPages * 2, totalPages,
});

describe('ordered article neighbors', () => {
  afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); clearDynamicPosts(); });

  it('uses list order and hides missing directions at either boundary', async () => {
    vi.mocked(requestContent).mockResolvedValue(page(['newest', 'middle', 'oldest']));
    expect((await getPostNeighbors('newest')).data).toMatchObject({ previous: undefined, next: { slug: 'middle' } });
    expect((await getPostNeighbors('middle')).data).toMatchObject({ previous: { slug: 'newest' }, next: { slug: 'oldest' } });
    expect((await getPostNeighbors('oldest')).data).toMatchObject({ previous: { slug: 'middle' }, next: undefined });
  });

  it('finds the next article across a page boundary', async () => {
    vi.mocked(requestContent).mockResolvedValueOnce(page(['first', 'current'], 1, 2))
      .mockResolvedValueOnce(page(['next', 'last'], 2, 2));
    expect((await getPostNeighbors('current')).data).toMatchObject({ previous: { slug: 'first' }, next: { slug: 'next' } });
  });

  it('finds the previous article across a page boundary', async () => {
    vi.mocked(requestContent).mockResolvedValueOnce(page(['first', 'previous'], 1, 2))
      .mockResolvedValueOnce(page(['current', 'last'], 2, 2));
    expect((await getPostNeighbors('current')).data).toMatchObject({ previous: { slug: 'previous' }, next: { slug: 'last' } });
  });

  it('returns no directions for a single or missing article', async () => {
    vi.mocked(requestContent).mockResolvedValue(page(['only']));
    expect((await getPostNeighbors('only')).data).toEqual({ previous: undefined, next: undefined });
    expect((await getPostNeighbors('missing')).data).toEqual({ previous: undefined, next: undefined });
  });

  it('queries /api/public/neighbors on production gateway when available', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          previous: undefined,
          next: { slug: 'next-article', title: 'Next Article' },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getPostNeighbors('current-article');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/neighbors?slug=current-article',
      expect.any(Object),
    );
    expect(result).toEqual({
      source: 'api',
      data: {
        previous: undefined,
        next: { slug: 'next-article', title: 'Next Article' },
      },
    });
    expect(requestContent).not.toHaveBeenCalled();
  });

  it('falls back to static neighbors on production gateway when API is unavailable or fails', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);

    const latest = getAllPosts()[0]!;
    syncDynamicPosts([{ ...latest, slug: 'new-publication', publishedAt: '2030-01-01T00:00:00Z' }]);
    expect(await getPostNeighbors('new-publication')).toMatchObject({
      source: 'fallback',
      data: { previous: undefined, next: { slug: latest.slug } },
    });
    expect(requestContent).not.toHaveBeenCalled();
  });

  it('falls back to static neighbors on production gateway when API returns error response', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'Server error' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const latest = getAllPosts()[0]!;
    syncDynamicPosts([{ ...latest, slug: 'new-publication', publishedAt: '2030-01-01T00:00:00Z' }]);
    expect(await getPostNeighbors('new-publication')).toMatchObject({
      source: 'fallback',
      data: { previous: undefined, next: { slug: latest.slug } },
    });
    expect(requestContent).not.toHaveBeenCalled();
  });

  it('uses synchronized fallback articles when the API is unavailable', async () => {
    vi.mocked(requestContent).mockRejectedValue(new Error('offline'));
    const latest = getAllPosts()[0]!;
    expect(await getPostNeighbors(latest.slug)).toMatchObject({ source: 'fallback', data: { previous: undefined, next: { slug: getAllPosts()[1]!.slug } } });
  });
});
