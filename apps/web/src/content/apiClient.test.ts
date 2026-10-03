import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContentSourceFailure, isNotFoundError, requestContent } from './apiClient';

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

  it('throws a typed network failure when the request times out', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn((_url: string, options?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const promise = requestContent('/posts', { timeoutMs: 200 });
      vi.advanceTimersByTime(250);

      await expect(promise).rejects.toMatchObject({
        name: 'ContentSourceFailure',
        error: {
          kind: 'network',
          message: expect.stringMatching(/timed out/i),
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts using caller signal even when timeout is set', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_url: string, options?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = requestContent('/posts', { signal: controller.signal, timeoutMs: 5000 });
    controller.abort();

    await expect(promise).rejects.toMatchObject({
      name: 'ContentSourceFailure',
      error: {
        kind: 'aborted',
        message: 'Content API request was aborted',
      },
    });
  });

  it('cleanly distinguishes 404 responses from other HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })),
    );

    await expect(requestContent('/posts/nonexistent')).rejects.toMatchObject({
      name: 'ContentSourceFailure',
      status: 404,
      error: {
        kind: 'http',
        status: 404,
        message: 'Content API responded with 404',
      },
    });
  });

  it('correctly identifies 404 errors using isNotFoundError', () => {
    const notFound = new ContentSourceFailure({
      kind: 'http',
      status: 404,
      message: 'Not found',
    });
    const serverError = new ContentSourceFailure({
      kind: 'http',
      status: 500,
      message: 'Server error',
    });
    const networkError = new ContentSourceFailure({
      kind: 'network',
      message: 'Network error',
    });

    expect(isNotFoundError(notFound)).toBe(true);
    expect(isNotFoundError(serverError)).toBe(false);
    expect(isNotFoundError(networkError)).toBe(false);
    expect(isNotFoundError(new Error('general error'))).toBe(false);
  });
});
