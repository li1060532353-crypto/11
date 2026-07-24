import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('exposes the labeled knowledge entry in both navigation modes', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: '知识库' })).toHaveAttribute('href', '/knowledge');

    await user.click(screen.getByRole('button', { name: '打开导航' }));
    const navigation = screen.getByRole('navigation', { name: '移动端导航' });
    expect(within(navigation).getByRole('link', { name: '知识库' })).toHaveAttribute(
      'href',
      '/knowledge',
    );
  });

  it('opens and closes the labeled mobile navigation', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const toggle = screen.getByRole('button', { name: '打开导航' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const navigation = screen.getByRole('navigation', { name: '移动端导航' });
    expect(within(navigation).getByRole('link', { name: '文章' })).toHaveAttribute(
      'href',
      '/posts',
    );

    await user.click(within(navigation).getByRole('link', { name: '文章' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
