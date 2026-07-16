import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContentSourceFailure, requestContent } from './apiClient';

describe('requestContent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns data from a successful API envelope', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { title: 'Hello API' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetch);

    await expect(
      requestContent<{ title: string }>('/posts', {
        search: new URLSearchParams({ page: '2' }),
      }),
    ).resolves.toEqual({ title: 'Hello API' });

    expect(fetch).toHaveBeenCalledWith('/api/v1/posts?page=2', expect.any(Object));
  });

  it('throws a typed http failure for non-2xx responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Nope' }), { status: 503 })),
    );

    await expect(requestContent('/posts')).rejects.toMatchObject({
      name: 'ContentSourceFailure',
      error: {
        kind: 'http',
        message: 'Content API responded with 503',
      },
    });
  });

  it('throws a typed invalid-envelope failure for malformed envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ item: { slug: 'wrong' } }), { status: 200 }),
        ),
    );

    await expect(requestContent('/posts')).rejects.toMatchObject({
      error: {
        kind: 'invalid-envelope',
        message: 'Content API response envelope is missing data',
      },
    });
  });

  it('throws a typed invalid-envelope failure for invalid JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(requestContent('/posts')).rejects.toMatchObject({
      error: {
        kind: 'invalid-envelope',
        message: 'Content API response envelope is malformed',
      },
    });
  });

  it('throws a typed invalid-envelope failure when envelope data is undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })),
    );

    await expect(requestContent('/posts')).rejects.toMatchObject({
      error: {
        kind: 'invalid-envelope',
        message: 'Content API response envelope is missing data',
      },
    });
  });

  it('throws a typed aborted failure when the request is aborted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')),
    );

    await expect(requestContent('/posts')).rejects.toBeInstanceOf(ContentSourceFailure);
    await expect(requestContent('/posts')).rejects.toMatchObject({
      error: {
        kind: 'aborted',
        message: 'Content API request was aborted',
      },
    });
  });
});
