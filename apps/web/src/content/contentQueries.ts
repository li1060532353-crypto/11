import { posts } from './posts';
import { projects } from './projects';
import type {
  ArchiveGroup,
  Category,
  Paginated,
  Post,
  PostListOptions,
  PostSummary,
  Project,
  Tag,
} from './types';

export type {
  ArchiveGroup,
  Category,
  Paginated,
  PostListOptions,
  PostSummary,
  Project,
  Tag,
} from './types';

export type FeaturedContent = {
  kind: '项目' | '文章';
  title: string;
  summary: string;
  meta: string;
  href: string;
};

const defaultPageSize = 6;
const maximumPageSize = 12;

const newestFirstPosts = [...posts].sort(
  (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
);

function normalizeText(value: string | undefined): string | undefined {
  const normalized = value ? toTaxonomySlug(value) : undefined;
  return normalized || undefined;
}

export function toTaxonomySlug(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function toSummary(post: Post): PostSummary {
  const { body, ...summary } = post;
  void body;
  return summary;
}

function matchesOptions(post: Post, options: PostListOptions): boolean {
  const date = new Date(post.publishedAt);
  const category = normalizeText(options.category);
  const tag = normalizeText(options.tag);

  return (
    (!category || normalizeText(post.category) === category) &&
    (!tag || post.tags.some((item) => normalizeText(item) === tag)) &&
    (options.year === undefined || date.getUTCFullYear() === options.year) &&
    (options.month === undefined || date.getUTCMonth() + 1 === options.month)
  );
}

function paginate(items: readonly Post[], options: PostListOptions): Paginated<PostSummary> {
  const requestedPageSize = Number.isFinite(options.pageSize)
    ? Math.floor(options.pageSize as number)
    : defaultPageSize;
  const pageSize = Math.min(maximumPageSize, Math.max(1, requestedPageSize));
  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const requestedPage = Number.isFinite(options.page) ? Math.floor(options.page as number) : 1;
  const page = totalPages === 0 ? 1 : Math.min(totalPages, Math.max(1, requestedPage));
  const offset = (page - 1) * pageSize;

  return {
    items: items.slice(offset, offset + pageSize).map(toSummary),
    page,
    pageSize,
    totalItems,
    totalPages,
  };
}

function filteredPosts(options: PostListOptions = {}): readonly Post[] {
  return newestFirstPosts.filter((post) => matchesOptions(post, options));
}

export function listPosts(options: PostListOptions = {}): Paginated<PostSummary> {
  return paginate(filteredPosts(options), options);
}

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}

export type PostNeighbors = {
  previous: PostSummary | undefined;
  next: PostSummary | undefined;
};

export function findPostNeighbors(
  orderedPosts: readonly PostSummary[],
  slug: string,
): PostNeighbors {
  const currentIndex = orderedPosts.findIndex((post) => post.slug === slug);
  if (currentIndex < 0) return { previous: undefined, next: undefined };

  return {
    previous: currentIndex > 0 ? orderedPosts[currentIndex - 1] : undefined,
    next: orderedPosts[currentIndex + 1],
  };
}

export function getPostNeighbors(slug: string): PostNeighbors {
  return findPostNeighbors(newestFirstPosts.map(toSummary), slug);
}

function listTaxonomy(
  values: readonly string[],
): readonly { slug: string; name: string; count: number }[] {
  const taxonomy = new Map<string, { name: string; count: number }>();
  for (const name of values) {
    const slug = toTaxonomySlug(name);
    const existing = taxonomy.get(slug);
    taxonomy.set(slug, { name: existing?.name ?? name, count: (existing?.count ?? 0) + 1 });
  }

  return [...taxonomy.entries()]
    .sort(([, left], [, right]) => left.name.localeCompare(right.name, 'zh-Hans-CN'))
    .map(([slug, { name, count }]) => ({ slug, name, count }));
}

export function listCategories(): readonly Category[] {
  return listTaxonomy(posts.map((post) => post.category));
}

export function listTags(): readonly Tag[] {
  return listTaxonomy(posts.flatMap((post) => post.tags));
}

export function listProjects(): readonly Project[] {
  return projects;
}

export function listFeaturedContent(): readonly FeaturedContent[] {
  const selectedProject = projects.find((project) => project.selected);
  const selectedPosts = posts.filter((post) => post.selected);

  return [
    ...(selectedProject
      ? [
          {
            kind: '项目' as const,
            title: selectedProject.name,
            summary: selectedProject.summary,
            meta: selectedProject.technologies.join(' · '),
            href: `/projects/${selectedProject.slug}`,
          },
        ]
      : []),
    ...selectedPosts.map((post) => ({
      kind: '文章' as const,
      title: post.title,
      summary: post.summary,
      meta: `${post.category} · ${post.readingTime} 分钟`,
      href: `/posts/${post.slug}`,
    })),
  ];
}

export function searchPosts(query: string, options: PostListOptions = {}): Paginated<PostSummary> {
  const normalizedQuery = normalizeText(query);
  const matchingPosts = filteredPosts(options).filter((post) => {
    if (!normalizedQuery) return true;
    const searchable = `${post.title}\n${post.summary}\n${post.body}`.toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  });

  return paginate(matchingPosts, options);
}

export function groupPostsByArchive(): readonly ArchiveGroup[] {
  const groups = new Map<string, ArchiveGroup>();
  for (const post of newestFirstPosts) {
    const date = new Date(post.publishedAt);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const group = groups.get(key);

    if (group) {
      group.posts = [...group.posts, toSummary(post)];
    } else {
      groups.set(key, { year, month, posts: [toSummary(post)] });
    }
  }
  return [...groups.values()];
}
