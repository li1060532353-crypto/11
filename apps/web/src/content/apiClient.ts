import type { ApiEnvelope } from './apiTypes';
import type { ContentSourceError } from './types';

export class ContentSourceFailure extends Error {
  readonly error: ContentSourceError;

  constructor(error: ContentSourceError) {
    super(error.message);
    this.name = 'ContentSourceFailure';
    this.error = error;
  }
}

type RequestContentOptions = {
  signal?: AbortSignal;
  search?: URLSearchParams;
};

const defaultApiBaseUrl = '/api/v1';

export async function requestContent<T>(
  path: string,
  options: RequestContentOptions = {},
): Promise<T> {
  try {
    const response = await fetch(buildContentUrl(path, options.search), {
      headers: { Accept: 'application/json' },
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      throw new ContentSourceFailure({
        kind: 'http',
        message: `Content API responded with ${response.status}`,
      });
    }

    const envelope = await parseApiEnvelope<T>(response);

    if (!isApiEnvelope<T>(envelope)) {
      throw new ContentSourceFailure({
        kind: 'invalid-envelope',
        message: 'Content API response envelope is missing data',
      });
    }

    return envelope.data;
  } catch (error) {
    if (error instanceof ContentSourceFailure) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new ContentSourceFailure({
        kind: 'aborted',
        message: 'Content API request was aborted',
      });
    }

    throw new ContentSourceFailure({
      kind: 'network',
      message: error instanceof Error ? error.message : 'Content API request failed',
    });
  }
}

function buildContentUrl(path: string, search?: URLSearchParams): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;
  const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const query = search?.toString();

  return query ? `${url}?${query}` : url;
}

async function parseApiEnvelope<T>(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as Partial<ApiEnvelope<T>>;
  } catch {
    throw new ContentSourceFailure({
      kind: 'invalid-envelope',
      message: 'Content API response envelope is malformed',
    });
  }
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return typeof value === 'object' && value !== null && 'data' in value && value.data !== undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
