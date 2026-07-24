import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { listFeaturedContent } from '../../content/contentGateway';
import { FeaturedContent } from './FeaturedContent';

vi.mock('../../content/contentGateway', () => ({ listFeaturedContent: vi.fn() }));

describe('FeaturedContent', () => {
  it('groups existing featured articles and projects without inventing records', async () => {
    vi.mocked(listFeaturedContent).mockResolvedValueOnce({
      data: [
        {
          kind: '文章',
          title: 'Existing article',
          summary: 'From the existing projection.',
          meta: 'Engineering · 5 分钟',
          href: '/posts/existing-article',
        },
        {
          kind: '项目',
          title: 'Existing project',
          summary: 'From the existing projection.',
          meta: 'TypeScript',
          href: '/projects/existing-project',
        },
      ],
      source: 'api',
    });

    render(<FeaturedContent />);

    const articles = await screen.findByRole('region', { name: '近期文章' });
    const projects = screen.getByRole('region', { name: '精选项目' });
    expect(
      within(articles).getByRole('heading', { level: 4, name: 'Existing article' }).closest('a'),
    ).toHaveAttribute('href', '/posts/existing-article');
    expect(
      within(projects).getByRole('heading', { level: 4, name: 'Existing project' }).closest('a'),
    ).toHaveAttribute('href', '/projects/existing-project');
    expect(
      within(articles).queryByRole('heading', { level: 4, name: 'Existing project' }),
    ).toBeNull();
  });

  it('omits a grouping whose kind is unavailable from the existing projection', async () => {
    vi.mocked(listFeaturedContent).mockResolvedValueOnce({
      data: [
        {
          kind: '文章',
          title: 'Article only',
          summary: 'No project record was supplied.',
          meta: 'Engineering · 5 分钟',
          href: '/posts/article-only',
        },
      ],
      source: 'api',
    });

    render(<FeaturedContent />);

    expect(await screen.findByRole('region', { name: '近期文章' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '精选项目' })).toBeNull();
  });
});
