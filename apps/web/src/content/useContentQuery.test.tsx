import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useContentQuery } from './useContentQuery';
import type { ContentResult } from './types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function QueryHarness({
  load,
  label = 'value',
}: {
  load: () => Promise<ContentResult<string>>;
  label?: string;
}) {
  const result = useContentQuery(load, [load]);

  return (
    <output aria-label={label}>
      {result.state === 'loading' ? 'loading' : `${result.result?.source}:${result.result?.data}`}
    </output>
  );
}

describe('useContentQuery', () => {
  it('starts in loading state and publishes the ready content result', async () => {
    const load = vi
      .fn()
      .mockResolvedValue({ data: 'hello', source: 'api' } satisfies ContentResult<string>);

    render(<QueryHarness load={load} />);

    expect(screen.getByLabelText('value')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByLabelText('value')).toHaveTextContent('api:hello'));
  });

  it('reloads when dependencies change', async () => {
    const user = userEvent.setup();
    const second = deferred<ContentResult<string>>();
    const load = vi
      .fn<() => Promise<ContentResult<string>>>()
      .mockResolvedValueOnce({ data: 'first', source: 'api' })
      .mockReturnValueOnce(second.promise);

    function ReloadHarness() {
      const [version, setVersion] = useState(1);
      const stableLoad = useMemo(() => () => load(), [version]);
      const result = useContentQuery(stableLoad, [stableLoad]);

      return (
        <>
          <button type="button" onClick={() => setVersion((current) => current + 1)}>
            reload
          </button>
          <output aria-label="value">
            {result.state === 'loading' ? 'loading' : result.result?.data}
          </output>
        </>
      );
    }

    render(<ReloadHarness />);

    await waitFor(() => expect(screen.getByLabelText('value')).toHaveTextContent('first'));
    await user.click(screen.getByRole('button', { name: 'reload' }));

    expect(screen.getByLabelText('value')).toHaveTextContent('loading');
    second.resolve({ data: 'second', source: 'api' });
    await waitFor(() => expect(screen.getByLabelText('value')).toHaveTextContent('second'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('ignores stale promise results after dependencies change', async () => {
    const user = userEvent.setup();
    const first = deferred<ContentResult<string>>();
    const second = deferred<ContentResult<string>>();

    function StaleHarness() {
      const [slug, setSlug] = useState('first');
      const load = useMemo(() => () => (slug === 'first' ? first.promise : second.promise), [slug]);
      const result = useContentQuery(load, [load]);

      return (
        <>
          <button type="button" onClick={() => setSlug('second')}>
            second
          </button>
          <output aria-label="value">
            {result.state === 'loading' ? 'loading' : result.result?.data}
          </output>
        </>
      );
    }

    render(<StaleHarness />);

    await user.click(screen.getByRole('button', { name: 'second' }));
    second.resolve({ data: 'fresh', source: 'api' });
    await waitFor(() => expect(screen.getByLabelText('value')).toHaveTextContent('fresh'));

    first.resolve({ data: 'stale', source: 'api' });
    await waitFor(() => expect(screen.getByLabelText('value')).toHaveTextContent('fresh'));
  });
});
