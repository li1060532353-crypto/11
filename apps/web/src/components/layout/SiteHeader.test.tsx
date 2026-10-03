import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { MemoryRouter } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('exposes the labeled knowledge entry in both navigation modes', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);



    await user.click(screen.getByRole('button', { name: '打开导航' }));
    const navigation = screen.getByRole('navigation', { name: '主导航' });
    expect(within(navigation).getByRole('link', { name: '工作台' })).toHaveAttribute(
      'href',
      '/knowledge',
    );
  });

  it('disables search and its shortcut inside the workspace', () => {
    render(<MemoryRouter initialEntries={['/knowledge/notes']}><SiteHeader /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: '搜索 (⌘K)' })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('opens the drawer on a mouse entering the left edge', () => {
    render(<SiteHeader />);
    const event = new MouseEvent('pointerover', { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    fireEvent(screen.getByRole('button', { name: '展开左侧导航' }), event);
    expect(screen.getByRole('navigation', { name: '主导航' })).toHaveAttribute('data-open', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: '打开导航' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('includes the editorial context beside the site name', () => {
    render(<SiteHeader />);

    expect(screen.getByText('工程学习笔记')).toHaveClass('site-header__context');
  });

  it('opens and closes the labeled mobile navigation', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const toggle = screen.getByRole('button', { name: '打开导航' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const navigation = screen.getByRole('navigation', { name: '主导航' });
    expect(within(navigation).getByRole('link', { name: '文章' })).toHaveAttribute(
      'href',
      '/posts',
    );

    await user.click(within(navigation).getByRole('link', { name: '文章' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
