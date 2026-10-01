import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpotlightModal } from './SpotlightModal';

function renderSpotlight(onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <SpotlightModal onClose={onClose} />
    </MemoryRouter>,
  );
}

describe('SpotlightModal', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders a dialog with search input', () => {
    renderSpotlight();
    expect(screen.getByRole('dialog', { name: '快捷搜索' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '搜索' })).toBeInTheDocument();
  });

  it('shows navigation shortcuts when query is empty', () => {
    renderSpotlight();
    expect(screen.getByText('文章列表')).toBeInTheDocument();
    expect(screen.getByText('项目目录')).toBeInTheDocument();
    expect(screen.getByText('知识库')).toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    renderSpotlight(onClose);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();
    const { container } = renderSpotlight(onClose);
    const backdrop = container.querySelector('.spotlight-backdrop')!;
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates with ArrowDown and highlights items', async () => {
    renderSpotlight();
    const user = userEvent.setup();

    await user.keyboard('{ArrowDown}');
    const activeItems = screen.getAllByRole('option', { selected: true });
    expect(activeItems).toHaveLength(1);
  });

  it('filters results when typing a query', async () => {
    renderSpotlight();
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: '搜索' });

    await user.type(input, 'zzzzz_no_match');
    expect(screen.getByText(/没有找到/)).toBeInTheDocument();
  });

  it('auto-focuses the search input on mount', () => {
    renderSpotlight();
    expect(screen.getByRole('combobox', { name: '搜索' })).toHaveFocus();
  });
});
