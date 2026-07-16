import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReadingProgress } from './ReadingProgress';

describe('ReadingProgress', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes labelled, clamped progress semantics as the article scrolls', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });

    render(
      <>
        <ReadingProgress />
        <article id="article-content">正文</article>
      </>,
    );

    const article = document.querySelector<HTMLElement>('#article-content')!;
    Object.defineProperty(article, 'scrollHeight', { configurable: true, value: 1_000 });
    vi.spyOn(article, 'getBoundingClientRect').mockReturnValue({
      bottom: 1_000,
      height: 1_000,
      left: 0,
      right: 0,
      top: 100,
      width: 700,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    act(() => window.dispatchEvent(new Event('resize')));

    const progress = screen.getByRole('progressbar', { name: '文章阅读进度' });
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '100');
    expect(progress).toHaveAttribute('aria-valuenow', '0');

    vi.mocked(article.getBoundingClientRect).mockReturnValue({
      bottom: 400,
      height: 1_000,
      left: 0,
      right: 0,
      top: -600,
      width: 700,
      x: 0,
      y: -600,
      toJSON: () => ({}),
    });
    act(() => window.dispatchEvent(new Event('scroll')));

    expect(progress).toHaveAttribute('aria-valuenow', '100');
  });

  it('reports a fully visible short article as complete', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });

    const { container } = render(
      <>
        <article id="article-content">短文</article>
        <ReadingProgress />
      </>,
    );
    const article = container.querySelector<HTMLElement>('#article-content')!;
    Object.defineProperty(article, 'scrollHeight', { configurable: true, value: 200 });
    vi.spyOn(article, 'getBoundingClientRect').mockReturnValue({
      bottom: 300,
      height: 200,
      left: 0,
      right: 700,
      top: 100,
      width: 700,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    act(() => window.dispatchEvent(new Event('resize')));

    expect(screen.getByRole('progressbar', { name: '文章阅读进度' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });

  it('keeps a short article below the viewport at zero', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });

    const { container } = render(
      <>
        <article id="article-content">稍后阅读</article>
        <ReadingProgress />
      </>,
    );
    const article = container.querySelector<HTMLElement>('#article-content')!;
    Object.defineProperty(article, 'scrollHeight', { configurable: true, value: 200 });
    vi.spyOn(article, 'getBoundingClientRect').mockReturnValue({
      bottom: 800,
      height: 200,
      left: 0,
      right: 700,
      top: 600,
      width: 700,
      x: 0,
      y: 600,
      toJSON: () => ({}),
    });
    act(() => window.dispatchEvent(new Event('resize')));

    expect(screen.getByRole('progressbar', { name: '文章阅读进度' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });

  it('keeps a short article complete after it passes above the viewport', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });

    const { container } = render(
      <>
        <article id="article-content">已读短文</article>
        <ReadingProgress />
      </>,
    );
    const article = container.querySelector<HTMLElement>('#article-content')!;
    Object.defineProperty(article, 'scrollHeight', { configurable: true, value: 200 });
    vi.spyOn(article, 'getBoundingClientRect').mockReturnValue({
      bottom: -50,
      height: 200,
      left: 0,
      right: 700,
      top: -250,
      width: 700,
      x: 0,
      y: -250,
      toJSON: () => ({}),
    });
    act(() => window.dispatchEvent(new Event('resize')));

    expect(screen.getByRole('progressbar', { name: '文章阅读进度' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
});
