export interface PaginationOptions {
  page?: unknown;
  pageSize?: unknown;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TaxonomyDto {
  slug: string;
  label: string;
  postCount?: number;
}

export interface PostSummaryDto {
  slug: string;
  title: string;
  summary: string;
  coverTitle: string | null;
  coverAlt: string | null;
  publishedAt: string;
  readingMinutes: number;
  category: TaxonomyDto;
  tags: TaxonomyDto[];
}

export interface PostDetailDto extends PostSummaryDto {
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  relatedPosts: PostSummaryDto[];
}

export interface ArchiveMonthDto {
  month: string;
  count: number;
}

export interface ProjectDto {
  slug: string;
  title: string;
  summary: string;
  description: string;
  technologies: string[];
  links: unknown;
  featured: boolean;
}

export interface ListPostsOptions extends PaginationOptions {
  category?: unknown;
  tag?: unknown;
  archive?: unknown;
  q?: unknown;
  search?: unknown;
}
