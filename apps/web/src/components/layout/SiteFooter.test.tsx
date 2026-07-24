import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteFooter } from './SiteFooter';

describe('SiteFooter', () => {
  it('offers compact public navigation alongside the ownership line', () => {
    render(<SiteFooter />);

    const navigation = screen.getByRole('navigation', { name: '页脚导航' });
    expect(within(navigation).getByRole('link', { name: '浏览文章' })).toHaveAttribute(
      'href',
      '/posts',
    );
    expect(within(navigation).getByRole('link', { name: '查看项目' })).toHaveAttribute(
      'href',
      '/projects',
    );
    expect(within(navigation).getByRole('link', { name: '认识我' })).toHaveAttribute('href', '/about');
  });
});
