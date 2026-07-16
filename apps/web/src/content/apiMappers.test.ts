import { describe, expect, it } from 'vitest';

import type {
  ApiArchiveGroup,
  ApiArchiveMonth,
  ApiPostDetail,
  ApiPostSummary,
  ApiProject,
  ApiTaxonomy,
} from './apiTypes';
import { ContentSourceFailure } from './apiClient';
import {
  mapApiArchiveGroups,
  mapApiArchiveMonths,
  mapApiPostDetail,
  mapApiPostSummary,
  mapApiProject,
  mapApiTaxonomy,
} from './apiMappers';

describe('api mappers', () => {
  const postSummary = {
    slug: 'matrix-rank',
    title: 'From Rank to Structure',
    summary: 'A compact linear algebra note.',
    category: { slug: 'linear-algebra', label: 'Linear Algebra', postCount: 4 },
    tags: [
      { slug: 'matrix', label: 'Matrix', postCount: 2 },
      { slug: 'rank', label: 'Rank', postCount: 1 },
    ],
    publishedAt: '2026-01-10T00:00:00.000Z',
    readingMinutes: 6,
    seoTitle: null,
    seoDescription: null,
  } satisfies ApiPostSummary;

  it('maps backend taxonomy objects and readingMinutes to frontend post summary fields', () => {
    expect(mapApiPostSummary(postSummary)).toMatchObject({
      slug: 'matrix-rank',
      category: 'Linear Algebra',
      tags: ['Matrix', 'Rank'],
      readingTime: 6,
      selected: false,
      cover: {
        alt: 'From Rank to Structure cover image',
        tone: 'orange',
      },
    });
  });

  it('maps post detail body as Markdown data', () => {
    const detail = {
      ...postSummary,
      body: '# From Rank\n\nMarkdown stays intact.',
      featured: true,
      seoTitle: 'Rank Structures',
      seoDescription: 'A compact rank guide.',
      relatedPosts: [
        {
          ...postSummary,
          slug: 'related-rank',
          title: 'Related Rank',
        },
      ],
    } satisfies ApiPostDetail;

    expect(mapApiPostDetail(detail)).toMatchObject({
      body: '# From Rank\n\nMarkdown stays intact.',
      selected: true,
      seoTitle: 'Rank Structures',
      seoDescription: 'A compact rank guide.',
      readingTime: 6,
      relatedPosts: [
        expect.objectContaining({
          slug: 'related-rank',
          title: 'Related Rank',
          readingTime: 6,
        }),
      ],
    });
  });

  it('maps taxonomy label and postCount to name and count', () => {
    const taxonomy = {
      slug: 'linear-algebra',
      label: 'Linear Algebra',
      postCount: 4,
    } satisfies ApiTaxonomy;

    expect(mapApiTaxonomy(taxonomy)).toEqual({
      slug: 'linear-algebra',
      name: 'Linear Algebra',
      count: 4,
    });
  });

  it('maps project title, description, selected state, and links', () => {
    const project = {
      slug: 'content-api',
      title: 'Content API',
      summary: 'Typed API boundary.',
      description: '# Content API\n\nShips typed DTOs.',
      technologies: ['TypeScript', 'Vite'],
      featured: true,
      links: {
        source: 'https://github.com/example/repo',
        demo: 'https://example.com/demo',
      },
    } satisfies ApiProject;

    expect(mapApiProject(project)).toEqual({
      slug: 'content-api',
      name: 'Content API',
      summary: 'Typed API boundary.',
      body: '# Content API\n\nShips typed DTOs.',
      technologies: ['TypeScript', 'Vite'],
      selected: true,
      sourceUrl: 'https://github.com/example/repo',
      demoUrl: 'https://example.com/demo',
    });
  });

  it('maps archive month/count DTOs from the backend', () => {
    const months = [
      { month: '2026-01', count: 2 },
      { month: '2025-12', count: 1 },
    ] satisfies readonly ApiArchiveMonth[];

    expect(mapApiArchiveMonths(months)).toEqual(months);
  });

  it('maps archive post summaries to existing ArchiveGroup shape', () => {
    const groups = [
      {
        year: 2026,
        month: 1,
        posts: [postSummary],
      },
    ];

    expect(mapApiArchiveGroups(groups)).toEqual([
      {
        year: 2026,
        month: 1,
        posts: [mapApiPostSummary(postSummary)],
      },
    ]);
  });

  it('throws a typed invalid-data failure for malformed post summary data', () => {
    expect(() =>
      mapApiPostSummary({ slug: 'missing-fields' } as unknown as ApiPostSummary),
    ).toThrow(ContentSourceFailure);
    expect(() =>
      mapApiPostSummary({ slug: 'missing-fields' } as unknown as ApiPostSummary),
    ).toThrow(
      expect.objectContaining({
        error: {
          kind: 'invalid-data',
          message: 'Content API returned invalid post summary data',
        },
      }),
    );
  });

  it('throws a typed invalid-data failure for malformed archive post arrays', () => {
    expect(() =>
      mapApiArchiveGroups([{ year: 2026, month: 1 } as unknown as ApiArchiveGroup]),
    ).toThrow(
      expect.objectContaining({
        error: {
          kind: 'invalid-data',
          message: 'Content API returned invalid archive data',
        },
      }),
    );
  });
});
