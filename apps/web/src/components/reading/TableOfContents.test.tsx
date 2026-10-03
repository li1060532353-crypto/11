import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableOfContents } from './TableOfContents';
import { FilterBar } from '../content/FilterBar';
import { MemoryRouter } from 'react-router-dom';

const headings = [
  { id: '第一节', level: 2 as const, text: '第一节' },
  { id: 'second', level: 3 as const, text: 'Second' },
];
function mobile(matches = true) {
  vi.stubGlobal('matchMedia', () => ({ matches, addEventListener() {}, removeEventListener() {} }));
}
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.style.overflow = '';
  window.history.replaceState(null, '', '/');
});

describe('mobile reading navigation', () => {
  it('keeps the contents off the reading flow and closes after selecting a real chapter', async () => {
    mobile();
    const user = userEvent.setup();
    render(
      <>
        <TableOfContents headings={headings} />
        <h2 id="第一节">第一节正文</h2>
      </>,
    );
    expect(screen.queryByRole('navigation', { name: '文章目录' })).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: '打开文章目录' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '文章目录' });
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(dialog).getByRole('link', { name: '第一节' })).toHaveAttribute('href', '#第一节');
    await user.click(within(dialog).getByRole('link', { name: '第一节' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(document.getElementById('第一节')).toHaveFocus();
    expect(decodeURIComponent(window.location.hash)).toBe('#第一节');
  });
  it('traps focus, closes with Escape and restores the trigger focus', async () => {
    mobile();
    const user = userEvent.setup();
    render(<TableOfContents headings={headings} />);
    const trigger = screen.getByRole('button', { name: '打开文章目录' });
    await user.click(trigger);
    await user.tab({ shift: true });
    expect(screen.getByRole('link', { name: 'Second' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('dismisses on the backdrop and keeps desktop contents visible', async () => {
    mobile();
    const user = userEvent.setup();
    const view = render(<TableOfContents headings={headings} />);
    await user.click(screen.getByRole('button', { name: '打开文章目录' }));
    fireEvent.click(screen.getByTestId('mobile-toc-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.unmount();
    mobile(false);
    render(<TableOfContents headings={headings} />);
    expect(screen.getByRole('navigation', { name: '文章目录' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打开文章目录' })).not.toBeInTheDocument();
  });
  it('restores background state when resizing an open drawer to desktop', async () => {
    let matches = true;
    let update = () => {};
    const media = {
      get matches() {
        return matches;
      },
      addEventListener(_event: string, listener: () => void) {
        update = listener;
      },
      removeEventListener() {},
    };
    vi.stubGlobal('matchMedia', () => media);
    const user = userEvent.setup();
    const view = render(<TableOfContents headings={headings} />);
    const previousInert = view.container.inert;
    await user.click(screen.getByRole('button', { name: '打开文章目录' }));
    expect(view.container.inert).toBe(true);
    act(() => {
      matches = false;
      update();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(view.container.inert).toBe(previousInert);
    expect(screen.getByRole('navigation', { name: '文章目录' })).toBeInTheDocument();
  });
  it('tracks the selected chapter without replacing the router history state', async () => {
    mobile();
    window.history.replaceState({ key: 'reader-entry', usr: { fromPath: '/posts' } }, '', '/');
    const user = userEvent.setup();
    render(
      <>
        <TableOfContents headings={headings} />
        <h2 id="第一节">第一节正文</h2>
        <h3 id="second">Second body</h3>
      </>,
    );
    await user.click(screen.getByRole('button', { name: '打开文章目录' }));
    await user.click(screen.getByRole('link', { name: 'Second' }));
    expect(window.history.state).toEqual({ key: 'reader-entry', usr: { fromPath: '/posts' } });
    await user.click(screen.getByRole('button', { name: '打开文章目录' }));
    expect(screen.getByRole('link', { name: 'Second' })).toHaveAttribute(
      'aria-current',
      'location',
    );
  });
  it('collapses filters on mobile while preserving selected values and changes', async () => {
    mobile();
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <FilterBar
          query={{ page: 1, year: 2026 }}
          categories={[]}
          tags={[]}
          onChange={onChange}
          clearTo="/posts"
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /筛选.*1/ }));
    const yearCombobox = screen.getByRole('combobox', { name: '年份' });
    expect(yearCombobox).toHaveTextContent('2026 年');
    await user.click(yearCombobox);
    await user.click(screen.getByRole('option', { name: '2025 年' }));
    expect(onChange).toHaveBeenCalledWith('year', '2025');
  });
});
