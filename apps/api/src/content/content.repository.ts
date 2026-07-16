import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type {
  ArchiveMonthDto,
  ListPostsOptions,
  Paginated,
  PaginationOptions,
  PostDetailDto,
  PostSummaryDto,
  ProjectDto,
  TaxonomyDto,
} from './content.types';
import {
  normalizeArchiveMonth,
  normalizePagination,
  normalizeSearch,
  normalizeSlug,
} from './query-normalizers';

type PostWithTaxonomy = Prisma.PostGetPayload<{
  include: {
    category: true;
    tags: { include: { tag: true } };
  };
}>;

type ProjectRecord = Prisma.ProjectGetPayload<Record<string, never>>;

@Injectable()
export class ContentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async listPosts(options: ListPostsOptions = {}): Promise<Paginated<PostSummaryDto>> {
    const { where, page, pageSize } = this.buildPostListQuery(options);
    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: postTaxonomyInclude,
        orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);

    return paginate(items.map(mapPostSummary), total, page, pageSize);
  }

  listPostsByCategory(
    category: unknown,
    options: PaginationOptions = {},
  ): Promise<Paginated<PostSummaryDto>> {
    return this.listPosts({ ...options, category });
  }

  listPostsByTag(
    tag: unknown,
    options: PaginationOptions = {},
  ): Promise<Paginated<PostSummaryDto>> {
    return this.listPosts({ ...options, tag });
  }

  async searchPosts(
    query: unknown,
    options: PaginationOptions = {},
  ): Promise<Paginated<PostSummaryDto>> {
    const search = normalizeSearch(query);
    const { page, pageSize } = normalizePagination(options);

    if (!search) {
      return paginate([], 0, page, pageSize);
    }

    return this.listPosts({ ...options, search });
  }

  async getPostBySlug(slug: unknown): Promise<PostDetailDto | null> {
    const normalizedSlug = normalizeSlug(slug);

    if (!normalizedSlug) {
      return null;
    }

    const post = await this.prisma.post.findFirst({
      where: {
        slug: normalizedSlug,
        ...publishedPostWhere,
      },
      include: postTaxonomyInclude,
    });

    if (!post) {
      return null;
    }

    const relatedPosts = await this.prisma.post.findMany({
      where: {
        ...publishedPostWhere,
        id: { not: post.id },
        OR: [
          { categoryId: post.categoryId },
          { tags: { some: { tagId: { in: post.tags.map(({ tagId }) => tagId) } } } },
        ],
      },
      include: postTaxonomyInclude,
      orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
      take: 3,
    });

    return mapPostDetail(post, relatedPosts.map(mapPostSummary));
  }

  async listCategories(): Promise<TaxonomyDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { posts: { some: publishedPostWhere } },
      include: {
        posts: {
          where: publishedPostWhere,
          select: { id: true },
        },
      },
      orderBy: { label: 'asc' },
    });

    return categories.map(({ slug, label, posts }) => ({ slug, label, postCount: posts.length }));
  }

  async listTags(): Promise<TaxonomyDto[]> {
    const tags = await this.prisma.tag.findMany({
      where: { posts: { some: { post: publishedPostWhere } } },
      include: {
        posts: {
          where: { post: publishedPostWhere },
          select: { postId: true },
        },
      },
      orderBy: { label: 'asc' },
    });

    return tags.map(({ slug, label, posts }) => ({ slug, label, postCount: posts.length }));
  }

  async listArchives(): Promise<ArchiveMonthDto[]> {
    const posts = await this.prisma.post.findMany({
      where: publishedPostWhere,
      select: { publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    });

    const months = new Map<string, number>();
    for (const post of posts) {
      if (!post.publishedAt) {
        continue;
      }

      const month = post.publishedAt.toISOString().slice(0, 7);
      months.set(month, (months.get(month) ?? 0) + 1);
    }

    return [...months.entries()].map(([month, count]) => ({ month, count }));
  }

  async listProjects(): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { public: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });

    return projects.map(mapProject);
  }

  async getProjectBySlug(slug: unknown): Promise<ProjectDto | null> {
    const normalizedSlug = normalizeSlug(slug);

    if (!normalizedSlug) {
      return null;
    }

    const project = await this.prisma.project.findFirst({
      where: { slug: normalizedSlug, public: true },
    });

    return project ? mapProject(project) : null;
  }

  private buildPostListQuery(options: ListPostsOptions): {
    where: Prisma.PostWhereInput;
    page: number;
    pageSize: number;
  } {
    const { page, pageSize } = normalizePagination(options);
    const category = normalizeSlug(options.category);
    const tag = normalizeSlug(options.tag);
    const archive = normalizeArchiveMonth(options.archive);
    const search = normalizeSearch(options.q) || normalizeSearch(options.search);
    const where: Prisma.PostWhereInput = { ...publishedPostWhere };

    if (category) {
      where.category = { slug: category };
    }

    if (tag) {
      where.tags = { some: { tag: { slug: tag } } };
    }

    if (archive) {
      const start = new Date(`${archive}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      where.publishedAt = { gte: start, lt: end };
    }

    if (search) {
      where.OR = ['title', 'summary', 'body'].map((field) => ({
        [field]: { contains: search, mode: 'insensitive' },
      })) as Prisma.PostWhereInput[];
    }

    return { where, page, pageSize };
  }
}

const publishedPostWhere = {
  published: true,
  publishedAt: { not: null },
} satisfies Prisma.PostWhereInput;

const postTaxonomyInclude = {
  category: true,
  tags: { include: { tag: true }, orderBy: { tag: { label: 'asc' } } },
} satisfies Prisma.PostInclude;

function paginate<T>(items: T[], totalItems: number, page: number, pageSize: number): Paginated<T> {
  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
  };
}

function mapPostSummary(post: PostWithTaxonomy): PostSummaryDto {
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    coverTitle: post.coverTitle,
    coverAlt: post.coverAlt,
    publishedAt: post.publishedAt?.toISOString() ?? '',
    readingMinutes: post.readingMinutes,
    category: {
      slug: post.category.slug,
      label: post.category.label,
    },
    tags: post.tags.map(({ tag }) => ({ slug: tag.slug, label: tag.label })),
  };
}

function mapPostDetail(post: PostWithTaxonomy, relatedPosts: PostSummaryDto[]): PostDetailDto {
  return {
    ...mapPostSummary(post),
    body: post.body,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    relatedPosts,
  };
}

function mapProject(project: ProjectRecord): ProjectDto {
  return {
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    description: project.description,
    technologies: project.technologies,
    links: project.links,
    featured: project.featured,
  };
}
