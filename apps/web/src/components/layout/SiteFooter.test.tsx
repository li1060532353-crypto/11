import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteFooter } from './SiteFooter';

describe('SiteFooter', () => {
  it('offers compact public navigation alongside the ownership line', () => {
    render(<SiteFooter />);

    const navigation = screen.getByRole('navigation', { name: '页脚导航' });
    expect(within(navigation).getByRole('link', { name: '文章索引' })).toHaveAttribute(
      'href',
      '/posts',
    );
    expect(within(navigation).getByRole('link', { name: '项目目录' })).toHaveAttribute(
      'href',
      '/projects',
    );
    expect(within(navigation).getByRole('link', { name: '关于作者' })).toHaveAttribute('href', '/about');
  });

  it('uses a concise editorial sign-off', () => {
    render(<SiteFooter />);

    expect(screen.getByText('工程学习、推导与复盘')).toHaveClass('site-footer__context');
  });
});
