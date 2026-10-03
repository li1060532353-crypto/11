import { ContentSourceFailure, requestContent } from './apiClient';
import type {
  ApiArchiveMonth,
  ApiPostDetail,
  ApiPostSummary,
  ApiProject,
  ApiTaxonomy,
} from './apiTypes';
import {
  mapApiArchiveMonths,
  mapApiPostDetail,
  mapApiPostSummary,
  mapApiProject,
  mapApiTaxonomy,
} from './apiMappers';
import {
  findPostNeighbors,
  getPostNeighbors as getStaticPostNeighbors,
  type PostNeighbors,
  getDynamicPosts,
  syncDynamicPosts,
  getPostBySlug as getStaticPostBySlug,
  groupPostsByArchive as groupStaticPostsByArchive,
  listCategories as listStaticCategories,
  listFeaturedContent as listStaticFeaturedContent,
  listPosts as listStaticPosts,
  listProjects as listStaticProjects,
  listTags as listStaticTags,
  searchPosts as searchStaticPosts,
  type FeaturedContent,
} from './contentQueries';
import {
  syncPublishedNotes,
  fetchPublishedNoteBySlug,
  fetchWithTimeout,
  noteToPost,
  toSummary,
} from './dynamicContentSync';
import type {
  ArchiveGroup,
  Category,
  ContentResult,
  ContentSourceError,
  Paginated,
  Post,
  PostListOptions,
  PostSummary,
  Project,
  Tag,
} from './types';

export type GatewayPostListOptions = PostListOptions & {
  q?: string;
  archive?: string;
};

const featuredPageSize = 12;
const featuredItemLimit = 3;

export async function getPostNeighbors(slug: string): Promise<ContentResult<PostNeighbors>> {
  if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
    if (typeof fetch === 'function') {
      try {
        const response = await fetchWithTimeout(`/api/public/neighbors?slug=${encodeURIComponent(slug)}`);
        if (response.ok) {
          const json = await response.json();
          if (json && json.success !== false && json.data) {
            return { source: 'api', data: json.data };
          }
        }
      } catch {
        // Fall back to static
      }
    }
    return { source: 'fallback', data: getStaticPostNeighbors(slug) };
  }

  return withFallback(async () => {
    let previousPageLast: PostSummary | undefined;
    for (let page = 1; ; page += 1) {
      const result = mapPaginatedPosts(await requestContent('/content/posts', {
        search: toSearchParams({ page, pageSize: 24 }),
      }));
      const index = result.items.findIndex((post) => post.slug === slug);
      if (index >= 0) {
        const neighbors = findPostNeighbors(result.items, slug);
        if (index === 0) neighbors.previous = previousPageLast;
        if (!neighbors.next && page < result.totalPages) {
          const nextPage = mapPaginatedPosts(await requestContent('/content/posts', {
            search: toSearchParams({ page: page + 1, pageSize: 24 }),
          }));
          neighbors.next = nextPage.items[0];
        }
        return neighbors;
      }
      if (page >= result.totalPages || result.items.length === 0) {
        return { previous: undefined, next: undefined };
      }
      previousPageLast = result.items.at(-1);
    }
  }, () => getStaticPostNeighbors(slug));
}

export async function listPosts(
  options: GatewayPostListOptions = {},
): Promise<ContentResult<Paginated<PostSummary>>> {
  return withFallback(
    async () =>
      mapPaginatedPosts(
        await requestContent(apiPostListPath(options), { search: toSearchParams(options) }),
      ),
    () => listStaticPosts(options),
  );
}

export async function getPostBySlug(slug: string): Promise<ContentResult<Post | undefined>> {
  if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
    const directPost = await fetchPublishedNoteBySlug(slug);
    if (directPost) {
      syncDynamicPosts([...getDynamicPosts().filter(post => post.slug !== slug), directPost]);
      return { data: directPost, source: 'api' };
    }
    if (directPost === null) {
      syncDynamicPosts(getDynamicPosts().filter(post => post.slug !== slug));
    }
    return { data: getStaticPostBySlug(slug), source: 'fallback' };
  }
  return withFallback(
    async () =>
      mapApiPostDetail(
        await requestContent<ApiPostDetail>(`/content/posts/${encodeURIComponent(slug)}`),
      ),
    async () => {
      const cached = getStaticPostBySlug(slug);
      if (cached) return cached;
      const directNote = await fetchPublishedNoteBySlug(slug);
      if (directNote) {
        syncDynamicPosts([...getDynamicPosts(), directNote]);
        return directNote;
      }
      return undefined;
    },
  );
}

export async function listCategories(): Promise<ContentResult<readonly Category[]>> {
  return withFallback(
    async () =>
      (await requestContent<readonly ApiTaxonomy[]>('/content/categories')).map(mapApiTaxonomy),
    listStaticCategories,
  );
}

export async function listTags(): Promise<ContentResult<readonly Tag[]>> {
  return withFallback(
    async () => (await requestContent<readonly ApiTaxonomy[]>('/content/tags')).map(mapApiTaxonomy),
    listStaticTags,
  );
}

export async function listProjects(): Promise<ContentResult<readonly Project[]>> {
  return withFallback(
    async () =>
      (await requestContent<readonly ApiProject[]>('/content/projects')).map(mapApiProject),
    listStaticProjects,
  );
}

export async function getProjectBySlug(slug: string): Promise<ContentResult<Project | undefined>> {
  return withFallback(
    async () =>
      mapApiProject(
        await requestContent<ApiProject>(`/content/projects/${encodeURIComponent(slug)}`),
      ),
    () => listStaticProjects().find((project) => project.slug === slug),
  );
}

export async function searchPosts(
  query: string,
  options: PostListOptions = {},
): Promise<ContentResult<Paginated<PostSummary>>> {
  if (!query.trim()) {
    return { data: searchStaticPosts(query, options), source: 'fallback' };
  }

  if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 12;
    if (typeof fetch === 'function') {
      try {
        const response = await fetchWithTimeout(
          `/api/public/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
        );
        if (response.ok) {
          const json = await response.json();
          if (json && json.success !== false) {
            const payload = json.data ?? json;
            const rawItems = Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload)
                ? payload
                : null;
            if (rawItems) {
              const items = rawItems.map((item: unknown) =>
                toSummary(noteToPost(item as Record<string, unknown>)),
              );
              const totalItems = Number.isFinite(Number(payload?.totalItems))
                ? Number(payload?.totalItems)
                : items.length;
              return {
                source: 'api',
                data: {
                  items,
                  page: Number(payload?.page) || page,
                  pageSize: Number(payload?.pageSize) || pageSize,
                  totalItems,
                  totalPages:
                    Number(payload?.totalPages) ||
                    Math.max(1, Math.ceil(totalItems / pageSize)),
                },
              };
            }
          }
        }
      } catch {
        // Fall back to static search
      }
    }
    return { data: searchStaticPosts(query, options), source: 'fallback' };
  }

  return withFallback(
    async () =>
      mapPaginatedPosts(
        await requestContent('/content/search', {
          search: toSearchParams({ ...options, q: query }),
        }),
      ),
    () => searchStaticPosts(query, options),
  );
}

export async function groupPostsByArchive(): Promise<ContentResult<readonly ArchiveGroup[]>> {
  return withFallback(loadApiArchiveGroups, groupStaticPostsByArchive);
}

export async function listFeaturedContent(): Promise<ContentResult<readonly FeaturedContent[]>> {
  return withFallback(loadApiFeaturedContent, listStaticFeaturedContent);
}

async function withFallback<T>(
  loadApi: () => Promise<T>,
  loadFallback: () => T | Promise<T>,
): Promise<ContentResult<T>> {
  if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
    await syncPublishedNotes();
    return { data: await loadFallback(), source: 'api' };
  }
  try {
    return { data: await loadApi(), source: 'api' };
  } catch (error) {
    return {
      data: await loadFallback(),
      source: 'fallback',
      error: toContentSourceError(error),
    };
  }
}

function mapPaginatedPosts(value: unknown): Paginated<PostSummary> {
  assertPaginatedPosts(value);

  return {
    items: value.items.map(mapApiPostSummary),
    page: value.page,
    pageSize: value.pageSize,
    totalItems: value.totalItems,
    totalPages: value.totalPages,
  };
}

async function loadApiArchiveGroups(): Promise<readonly ArchiveGroup[]> {
  const archives = mapApiArchiveMonths(
    await requestContent<readonly ApiArchiveMonth[]>('/content/archives'),
  );
  const groups = await Promise.all(
    archives.map(async (archive) => {
      const posts = mapPaginatedPosts(
        await requestContent('/content/posts', {
          search: toSearchParams({ archive: archive.month, pageSize: archive.count }),
        }),
      );
      const [year, month] = archive.month.split('-').map(Number);

      return {
        year: year!,
        month: month!,
        posts: posts.items,
      } satisfies ArchiveGroup;
    }),
  );

  return groups;
}

async function loadApiFeaturedContent(): Promise<readonly FeaturedContent[]> {
  const [projects, posts] = await Promise.all([
    requestContent<readonly ApiProject[]>('/content/projects').then((items) =>
      items.map(mapApiProject),
    ),
    requestContent('/content/posts', {
      search: toSearchParams({ pageSize: featuredPageSize }),
    }).then((value) => mapPaginatedPosts(value).items),
  ]);
  const selectedItems = [
    ...projects.filter((project) => project.selected).map(projectToFeaturedContent),
    ...posts.filter((post) => post.selected).map(postToFeaturedContent),
  ];

  if (selectedItems.length > 0) {
    return selectedItems.slice(0, featuredItemLimit);
  }

  return [
    ...projects.slice(0, 1).map(projectToFeaturedContent),
    ...posts.map(postToFeaturedContent),
  ].slice(0, featuredItemLimit);
}

function assertPaginatedPosts(value: unknown): asserts value is Paginated<ApiPostSummary> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !isNumber(value.page) ||
    !isNumber(value.pageSize) ||
    !isNumber(value.totalItems) ||
    !isNumber(value.totalPages)
  ) {
    throwInvalidData('Content API returned invalid post summary data');
  }
}

function projectToFeaturedContent(project: Project): FeaturedContent {
  return {
    kind: '项目',
    title: project.name,
    summary: project.summary,
    meta: project.technologies.join(' · '),
    href: `/projects/${project.slug}`,
  };
}

function postToFeaturedContent(post: PostSummary): FeaturedContent {
  return {
    kind: '文章',
    title: post.title,
    summary: post.summary,
    meta: `${post.category} · ${post.readingTime} 分钟`,
    href: `/posts/${post.slug}`,
  };
}

function apiPostListPath(options: GatewayPostListOptions): string {
  if (options.category) {
    return `/content/categories/${encodeURIComponent(options.category)}/posts`;
  }

  if (options.tag) {
    return `/content/tags/${encodeURIComponent(options.tag)}/posts`;
  }

  return '/content/posts';
}

function toSearchParams(options: GatewayPostListOptions): URLSearchParams {
  const search = new URLSearchParams();
  appendNumber(search, 'page', options.page);
  appendNumber(search, 'pageSize', options.pageSize);
  appendNumber(search, 'year', options.year);
  appendNumber(search, 'month', options.month);
  appendString(search, 'archive', options.archive);
  appendString(search, 'q', options.q);
  return search;
}

function appendNumber(search: URLSearchParams, key: string, value: number | undefined): void {
  if (value !== undefined) {
    search.set(key, String(value));
  }
}

function appendString(search: URLSearchParams, key: string, value: string | undefined): void {
  if (value !== undefined) {
    search.set(key, value);
  }
}

function toContentSourceError(error: unknown): ContentSourceError {
  if (error instanceof ContentSourceFailure) {
    return error.error;
  }

  return {
    kind: 'invalid-data',
    message: error instanceof Error ? error.message : 'Content API returned invalid data',
  };
}

function throwInvalidData(message: string): never {
  throw new ContentSourceFailure({ kind: 'invalid-data', message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
