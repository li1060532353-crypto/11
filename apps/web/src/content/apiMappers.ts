import type {
  ApiArchiveGroup,
  ApiArchiveMonth,
  ApiPostDetail,
  ApiPostSummary,
  ApiProject,
  ApiTaxonomy,
} from './apiTypes';
import { ContentSourceFailure } from './apiClient';
import type { ArchiveGroup, Category, Cover, Post, PostSummary, Project } from './types';

const coverTones: readonly Cover['tone'][] = ['blue', 'violet', 'teal', 'orange'];
const categoryCoverTones: Readonly<Record<string, Cover['tone']>> = {
  'Linear Algebra': 'orange',
  线性代数: 'orange',
  Cryptography: 'violet',
  密码学: 'violet',
  'Embedded Systems': 'teal',
  嵌入式系统: 'teal',
  'Signals and Systems': 'blue',
  信号与系统: 'blue',
};

export function mapApiPostSummary(post: ApiPostSummary): PostSummary {
  assertApiPostSummary(post, 'Content API returned invalid post summary data');

  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    category: post.category.label,
    tags: post.tags.map((tag) => tag.label),
    publishedAt: post.publishedAt,
    readingTime: post.readingMinutes,
    selected: post.featured ?? false,
    cover: mapApiCover(post),
    ...(post.seoTitle ? { seoTitle: post.seoTitle } : {}),
    ...(post.seoDescription ? { seoDescription: post.seoDescription } : {}),
  };
}

export function mapApiPostDetail(post: ApiPostDetail): Post {
  assertApiPostDetail(post);

  return {
    ...mapApiPostSummary(post),
    body: post.body,
    ...(post.relatedPosts ? { relatedPosts: post.relatedPosts.map(mapApiPostSummary) } : {}),
  };
}

export function mapApiProject(project: ApiProject): Project {
  assertApiProject(project);

  return {
    slug: project.slug,
    name: project.title,
    summary: project.summary,
    body: project.description,
    technologies: project.technologies,
    selected: project.featured ?? false,
    ...mapApiProjectLinks(project),
  };
}

export function mapApiTaxonomy(taxonomy: ApiTaxonomy): Category {
  assertApiTaxonomy(taxonomy);

  return {
    slug: taxonomy.slug,
    name: taxonomy.label,
    count: taxonomy.postCount ?? 0,
  };
}

export function mapApiArchiveGroups(groups: readonly ApiArchiveGroup[]): readonly ArchiveGroup[] {
  assertApiArchiveGroups(groups);

  return groups.map((group) => ({
    year: group.year,
    month: group.month,
    posts: group.posts.map(mapApiPostSummary),
  }));
}

function mapApiCover(post: ApiPostSummary): Cover {
  return {
    alt: `${post.title} cover image`,
    tone:
      categoryCoverTones[post.category.label] ??
      coverTones[Math.abs(hashText(post.slug)) % coverTones.length]!,
  };
}

function mapApiProjectLinks(project: ApiProject): Partial<Pick<Project, 'sourceUrl' | 'demoUrl'>> {
  const sourceUrl = isString(project.links?.source) ? project.links.source : undefined;
  const demoUrl = isString(project.links?.demo) ? project.links.demo : undefined;

  return {
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(demoUrl ? { demoUrl } : {}),
  };
}

export function mapApiArchiveMonths(
  months: readonly ApiArchiveMonth[],
): readonly ApiArchiveMonth[] {
  assertApiArchiveMonths(months);
  return months;
}

function assertApiPostSummary(value: unknown, message: string): asserts value is ApiPostSummary {
  if (
    !isRecord(value) ||
    !isString(value.slug) ||
    !isString(value.title) ||
    !isString(value.summary) ||
    !isApiTaxonomy(value.category) ||
    !isApiTaxonomyArray(value.tags) ||
    !isString(value.publishedAt) ||
    !isNumber(value.readingMinutes) ||
    !isOptionalBoolean(value.featured) ||
    !isOptionalString(value.seoTitle) ||
    !isOptionalString(value.seoDescription)
  ) {
    throwInvalidData(message);
  }
}

function assertApiPostDetail(value: unknown): asserts value is ApiPostDetail {
  assertApiPostSummary(value, 'Content API returned invalid post detail data');

  const post = value as Record<string, unknown>;
  if (!isString(post.body) || !isOptionalPostSummaries(post.relatedPosts)) {
    throwInvalidData('Content API returned invalid post detail data');
  }
}

function assertApiProject(value: unknown): asserts value is ApiProject {
  if (
    !isRecord(value) ||
    !isString(value.slug) ||
    !isString(value.title) ||
    !isString(value.summary) ||
    !isString(value.description) ||
    !isStringArray(value.technologies) ||
    !isOptionalBoolean(value.featured) ||
    !isOptionalRecord(value.links)
  ) {
    throwInvalidData('Content API returned invalid project data');
  }
}

function assertApiTaxonomy(value: unknown): asserts value is ApiTaxonomy {
  if (!isApiTaxonomy(value)) {
    throwInvalidData('Content API returned invalid taxonomy data');
  }
}

function assertApiArchiveMonths(value: unknown): asserts value is readonly ApiArchiveMonth[] {
  if (!Array.isArray(value)) {
    throwInvalidData('Content API returned invalid archive data');
  }

  for (const archive of value) {
    if (!isRecord(archive) || !isArchiveMonth(archive.month) || !isNumber(archive.count)) {
      throwInvalidData('Content API returned invalid archive data');
    }
  }
}

function isApiTaxonomy(value: unknown): value is ApiTaxonomy {
  if (
    !isRecord(value) ||
    !isString(value.slug) ||
    !isString(value.label) ||
    !isOptionalNumber(value.postCount)
  ) {
    return false;
  }

  return true;
}

function assertApiArchiveGroups(value: unknown): asserts value is readonly ApiArchiveGroup[] {
  if (!Array.isArray(value)) {
    throwInvalidData('Content API returned invalid archive data');
  }

  for (const group of value) {
    if (
      !isRecord(group) ||
      !isNumber(group.year) ||
      !isNumber(group.month) ||
      !Array.isArray(group.posts)
    ) {
      throwInvalidData('Content API returned invalid archive data');
    }

    for (const post of group.posts) {
      assertApiPostSummary(post, 'Content API returned invalid archive data');
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isNumber(value);
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || isString(value);
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

function isApiTaxonomyArray(value: unknown): value is readonly ApiTaxonomy[] {
  return Array.isArray(value) && value.every(isApiTaxonomy);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isString);
}

function isOptionalPostSummaries(value: unknown): value is readonly ApiPostSummary[] | undefined {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;

  try {
    value.forEach((post) =>
      assertApiPostSummary(post, 'Content API returned invalid post detail data'),
    );
    return true;
  } catch (error) {
    if (error instanceof ContentSourceFailure) return false;
    throw error;
  }
}

function isOptionalRecord(value: unknown): value is Record<string, unknown> | undefined {
  return value === undefined || isRecord(value);
}

function isArchiveMonth(value: unknown): value is string {
  return isString(value) && /^\d{4}-\d{2}$/.test(value);
}

function throwInvalidData(message: string): never {
  throw new ContentSourceFailure({
    kind: 'invalid-data',
    message,
  });
}

function hashText(value: string): number {
  return Array.from(value).reduce((hash, character) => hash + character.charCodeAt(0), 0);
}
