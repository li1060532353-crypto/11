export type Cover = {
  alt: string;
  tone: 'blue' | 'violet' | 'teal' | 'orange';
};

export type ContentSource = 'api' | 'fallback';

export type ContentSourceError = {
  kind: 'network' | 'http' | 'invalid-envelope' | 'invalid-data' | 'aborted';
  message: string;
};

export type ContentResult<T> = {
  data: T;
  source: ContentSource;
  error?: ContentSourceError;
};

export type Post = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  tags: readonly string[];
  publishedAt: string;
  readingTime: number;
  selected: boolean;
  cover: Cover;
  seoTitle?: string;
  seoDescription?: string;
  relatedPosts?: readonly PostSummary[];
};

export type PostSummary = Omit<Post, 'body'>;

export type Project = {
  slug: string;
  name: string;
  summary: string;
  body: string;
  technologies: readonly string[];
  selected: boolean;
  sourceUrl?: string;
  demoUrl?: string;
};

export type Category = {
  slug: string;
  name: string;
  count: number;
};

export type Tag = {
  slug: string;
  name: string;
  count: number;
};

export type ArchiveGroup = {
  year: number;
  month: number;
  posts: readonly PostSummary[];
};

export type PostListOptions = {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
  year?: number;
  month?: number;
};

export type Paginated<T> = {
  items: readonly T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
