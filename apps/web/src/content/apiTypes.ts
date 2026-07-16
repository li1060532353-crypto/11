export type ApiEnvelope<T> = {
  data: T;
};

export type ApiPostSummary = {
  slug: string;
  title: string;
  summary: string;
  category: ApiTaxonomy;
  tags: readonly ApiTaxonomy[];
  publishedAt: string;
  readingMinutes: number;
  featured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type ApiPostDetail = ApiPostSummary & {
  body: string;
  relatedPosts?: readonly ApiPostSummary[];
};

export type ApiProjectLinks = Partial<Record<'source' | 'demo', string>> & Record<string, unknown>;

export type ApiProject = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  technologies: readonly string[];
  featured?: boolean;
  links?: ApiProjectLinks;
};

export type ApiTaxonomy = {
  slug: string;
  label: string;
  postCount?: number;
};

export type ApiArchiveMonth = {
  month: string;
  count: number;
};

export type ApiArchiveGroup = {
  year: number;
  month: number;
  posts: readonly ApiPostSummary[];
};
