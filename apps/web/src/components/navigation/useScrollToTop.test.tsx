import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSavedScrollPosition,
  saveScrollPosition,
  useScrollToTop,
} from '../../hooks/useScrollToTop';

function TestRouteComponent({ id = 'test-content' }: { id?: string }) {
  useScrollToTop();
  return (
    <div>
      <h1 id="article-content" tabIndex={-1}>
        文章标题
      </h1>
      <p id={id}>内容正文</p>
    </div>
  );
}

describe('useScrollToTop hook', () => {
  let scrollToSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists and retrieves scroll positions from sessionStorage correctly', () => {
    saveScrollPosition('/search', '?q=ts&page=2', 450);
    expect(getSavedScrollPosition('/search', '?q=ts&page=2')).toBe(450);

    saveScrollPosition('/posts', '', 0);
    expect(getSavedScrollPosition('/posts', '')).toBe(0);

    expect(getSavedScrollPosition('/nonexistent', '')).toBeNull();
  });

  it('scrolls to top and focuses article content on push navigation without restoreScroll', async () => {
    render(
      <MemoryRouter initialEntries={['/posts/initial']}>
        <TestRouteComponent />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(
        expect.objectContaining({ top: 0, behavior: 'auto' }),
      );
    });
  });

  it('restores historical scroll position when restoreScroll state is passed', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/posts/page-restored',
            state: { restoreScroll: true, scrollY: 520 },
          },
        ]}
      >
        <TestRouteComponent />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(
        expect.objectContaining({ top: 520, behavior: 'auto' }),
      );
    });
  });

  it('restores from sessionStorage cache when pop/restore state is triggered without explicit scrollY', async () => {
    saveScrollPosition('/posts/cached-view', '', 280);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/posts/cached-view',
            state: { restoreScroll: true },
          },
        ]}
      >
        <TestRouteComponent />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(
        expect.objectContaining({ top: 280, behavior: 'auto' }),
      );
    });
  });
});
