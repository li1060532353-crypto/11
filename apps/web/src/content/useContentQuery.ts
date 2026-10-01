import { useEffect, useState } from 'react';

import type { ContentResult } from './types';
import { syncPublishedNotes } from './dynamicContentSync';

export type ContentQueryState<T> =
  { state: 'loading'; result?: undefined } | { state: 'ready'; result: ContentResult<T> };

export function useContentQuery<T>(
  load: () => Promise<ContentResult<T>>,
  deps: readonly unknown[],
): ContentQueryState<T> {
  const [query, setQuery] = useState<ContentQueryState<T>>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setQuery({ state: 'loading' });

    void (async () => {
      await syncPublishedNotes();
      if (cancelled) return;
      const result = await load();
      if (!cancelled) {
        setQuery({ state: 'ready', result });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, deps);

  return query;
}
