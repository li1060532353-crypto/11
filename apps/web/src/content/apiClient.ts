import type { ApiEnvelope } from './apiTypes';
import type { ContentSourceError } from './types';

export class ContentSourceFailure extends Error {
  readonly error: ContentSourceError;
  readonly status?: number | undefined;

  constructor(error: ContentSourceError) {
    super(error.message);
    this.name = 'ContentSourceFailure';
    this.error = error;
    this.status = error.status;
  }
}

export function isNotFoundError(error: unknown): boolean {
  if (error instanceof ContentSourceFailure) {
    return error.status === 404 || error.error.status === 404;
  }
  return false;
}

export type RequestContentOptions = {
  signal?: AbortSignal | undefined;
  search?: URLSearchParams | undefined;
  timeoutMs?: number | undefined;
};

const defaultApiBaseUrl = '/api/v1';

export async function requestContent<T>(
  path: string,
  options: RequestContentOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  let isTimedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
    timeoutId = setTimeout(() => {
      isTimedOut = true;
      controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'));
    }, timeoutMs);
  }

  const callerSignal = options.signal;
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
    const response = await fetch(buildContentUrl(path, options.search), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ContentSourceFailure({
        kind: 'http',
        message: `Content API responded with ${response.status}`,
        status: response.status,
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

    if (isTimedOut || (error instanceof DOMException && error.name === 'TimeoutError')) {
      throw new ContentSourceFailure({
        kind: 'network',
        message: `Content API request timed out after ${timeoutMs}ms`,
      });
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
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    if (callerSignal) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
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
