import { NotFoundException } from '@nestjs/common';

import type { ContentRepository } from './content.repository';
import { ContentService } from './content.service';
import type {
  ArchiveMonthDto,
  Paginated,
  PostDetailDto,
  PostSummaryDto,
  ProjectDto,
  TaxonomyDto,
} from './content.types';

describe('ContentService', () => {
  let repository: jest.Mocked<ContentRepository>;
  let service: ContentService;

  beforeEach(() => {
    repository = {
      listPosts: jest.fn(),
      listPostsByCategory: jest.fn(),
      listPostsByTag: jest.fn(),
      getPostBySlug: jest.fn(),
      listCategories: jest.fn(),
      listTags: jest.fn(),
      listArchives: jest.fn(),
      listProjects: jest.fn(),
      getProjectBySlug: jest.fn(),
      searchPosts: jest.fn(),
    } as unknown as jest.Mocked<ContentRepository>;
    service = new ContentService(repository);
  });

  it('returns paginated post summaries from the repository', async () => {
    const posts = paginated<PostSummaryDto>([postSummary]);
    repository.listPosts.mockResolvedValue(posts);
    repository.listPostsByCategory.mockResolvedValue(posts);
    repository.listPostsByTag.mockResolvedValue(posts);

    await expect(service.listPosts({ category: 'engineering', page: '2' })).resolves.toBe(posts);
    await expect(service.listPostsByCategory('engineering', { page: '2' })).resolves.toBe(posts);
    await expect(service.listPostsByTag('prisma', { page: '2' })).resolves.toBe(posts);
    expect(repository.listPosts).toHaveBeenCalledWith({ category: 'engineering', page: '2' });
    expect(repository.listPostsByCategory).toHaveBeenCalledWith('engineering', { page: '2' });
    expect(repository.listPostsByTag).toHaveBeenCalledWith('prisma', { page: '2' });
  });

  it('returns a post detail for a known slug', async () => {
    repository.getPostBySlug.mockResolvedValue(postDetail);

    await expect(service.getPostBySlug('hello-world')).resolves.toBe(postDetail);
  });

  it('throws NotFoundException when a post slug is missing', async () => {
    repository.getPostBySlug.mockResolvedValue(null);

    await expect(service.getPostBySlug('missing-post')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns categories, tags, archives, projects, and search results from the repository', async () => {
    const taxonomy: TaxonomyDto[] = [{ slug: 'engineering', label: 'Engineering', postCount: 2 }];
    const archives: ArchiveMonthDto[] = [{ month: '2026-07', count: 2 }];
    const projects: ProjectDto[] = [project];
    const results = paginated<PostSummaryDto>([postSummary]);
    repository.listCategories.mockResolvedValue(taxonomy);
    repository.listTags.mockResolvedValue(taxonomy);
    repository.listArchives.mockResolvedValue(archives);
    repository.listProjects.mockResolvedValue(projects);
    repository.searchPosts.mockResolvedValue(results);

    await expect(service.listCategories()).resolves.toBe(taxonomy);
    await expect(service.listTags()).resolves.toBe(taxonomy);
    await expect(service.listArchives()).resolves.toBe(archives);
    await expect(service.listProjects()).resolves.toBe(projects);
    await expect(service.searchPosts('prisma', { pageSize: '3' })).resolves.toBe(results);
    expect(repository.searchPosts).toHaveBeenCalledWith('prisma', { pageSize: '3' });
  });

  it('returns a project detail for a known slug', async () => {
    repository.getProjectBySlug.mockResolvedValue(project);

    await expect(service.getProjectBySlug('site-refresh')).resolves.toBe(project);
  });

  it('throws NotFoundException when a project slug is missing', async () => {
    repository.getProjectBySlug.mockResolvedValue(null);

    await expect(service.getProjectBySlug('missing-project')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

const postSummary: PostSummaryDto = {
  slug: 'hello-world',
  title: 'Hello World',
  summary: 'A first public post.',
  coverTitle: null,
  coverAlt: null,
  publishedAt: '2026-07-16T00:00:00.000Z',
  readingMinutes: 4,
  category: { slug: 'engineering', label: 'Engineering' },
  tags: [{ slug: 'prisma', label: 'Prisma' }],
};

const postDetail: PostDetailDto = {
  ...postSummary,
  body: 'Long-form post body.',
  seoTitle: 'Hello World',
  seoDescription: 'A first public post.',
  relatedPosts: [],
};

const project: ProjectDto = {
  slug: 'site-refresh',
  title: 'Site Refresh',
  summary: 'A refreshed personal site.',
  description: 'A longer project description.',
  technologies: ['NestJS', 'Prisma'],
  links: [{ label: 'Demo', href: 'https://example.com' }],
  featured: true,
};

function paginated<T>(items: T[]): Paginated<T> {
  return {
    items,
    page: 1,
    pageSize: 10,
    totalItems: items.length,
    totalPages: items.length ? 1 : 0,
  };
}
