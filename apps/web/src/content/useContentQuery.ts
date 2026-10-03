import { useCallback, useEffect, useState } from 'react';

import type { ContentResult } from './types';
import { syncPublishedNotes } from './dynamicContentSync';

export type ContentQueryState<T> =
  | { state: 'loading'; result?: undefined; retry: () => void }
  | { state: 'ready'; result: ContentResult<T>; retry: () => void };

export function useContentQuery<T>(
  load: () => Promise<ContentResult<T>>,
  deps: readonly unknown[],
  synchronize = true,
): ContentQueryState<T> {
  const [reloadCount, setReloadCount] = useState(0);
  const retry = useCallback(() => {
    setReloadCount((current) => current + 1);
  }, []);

  const [query, setQuery] = useState<ContentQueryState<T>>(() => ({
    state: 'loading',
    retry,
  }));

  useEffect(() => {
    let cancelled = false;
    setQuery({ state: 'loading', retry });

    void (async () => {
      if (synchronize) await syncPublishedNotes();
      if (cancelled) return;
      const result = await load();
      if (!cancelled) {
        setQuery({ state: 'ready', result, retry });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [...deps, reloadCount, retry]);

  return query;
}
