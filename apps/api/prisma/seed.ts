import { PrismaClient } from '@prisma/client';

const categories = [
  { slug: 'engineering', label: 'Engineering' },
  { slug: 'design-systems', label: 'Design Systems' },
  { slug: 'field-notes', label: 'Field Notes' },
];

const tags = [
  { slug: 'typescript', label: 'TypeScript' },
  { slug: 'nestjs', label: 'NestJS' },
  { slug: 'prisma', label: 'Prisma' },
  { slug: 'react', label: 'React' },
  { slug: 'accessibility', label: 'Accessibility' },
  { slug: 'workflow', label: 'Workflow' },
];

const posts = [
  {
    slug: 'building-content-apis-with-nestjs',
    title: 'Building Content APIs with NestJS',
    summary: 'A pragmatic walkthrough for shaping NestJS modules around public content.',
    body: 'Content APIs stay maintainable when their models, services, and route contracts grow together.',
    coverTitle: 'NestJS Content API',
    coverAlt: 'Abstract interface panels representing an API',
    published: true,
    publishedAt: new Date('2026-01-08T09:00:00.000Z'),
    readingMinutes: 6,
    seoTitle: 'Building Content APIs with NestJS',
    seoDescription: 'How to model and seed public blog content for a NestJS API.',
    categorySlug: 'engineering',
    tagSlugs: ['typescript', 'nestjs', 'prisma'],
  },
  {
    slug: 'prisma-seeding-patterns',
    title: 'Prisma Seeding Patterns',
    summary: 'Use idempotent writes to keep local and test databases predictable.',
    body: 'Seed scripts should be safe to rerun and explicit about relation state.',
    coverTitle: 'Prisma Seed Data',
    coverAlt: 'Database rows arranged in a repeatable pattern',
    published: true,
    publishedAt: new Date('2026-01-15T09:00:00.000Z'),
    readingMinutes: 5,
    seoTitle: 'Prisma Seeding Patterns',
    seoDescription: 'Reliable Prisma seed data with upsert and deterministic relations.',
    categorySlug: 'engineering',
    tagSlugs: ['prisma', 'workflow'],
  },
  {
    slug: 'designing-readable-dashboard-states',
    title: 'Designing Readable Dashboard States',
    summary: 'Small interface choices that make operational dashboards easier to scan.',
    body: 'Readable dashboards depend on hierarchy, rhythm, and honest empty states.',
    coverTitle: 'Dashboard States',
    coverAlt: 'A compact dashboard layout with status panels',
    published: true,
    publishedAt: new Date('2026-02-03T09:00:00.000Z'),
    readingMinutes: 7,
    seoTitle: 'Designing Readable Dashboard States',
    seoDescription: 'Practical dashboard state design for dense product interfaces.',
    categorySlug: 'design-systems',
    tagSlugs: ['react', 'accessibility'],
  },
  {
    slug: 'accessibility-checks-for-content-pages',
    title: 'Accessibility Checks for Content Pages',
    summary: 'A compact checklist for keeping editorial pages usable and navigable.',
    body: 'Content pages benefit from semantic structure, useful alt text, and predictable focus order.',
    coverTitle: 'Accessible Content',
    coverAlt: 'A document outline with accessibility markers',
    published: true,
    publishedAt: new Date('2026-02-17T09:00:00.000Z'),
    readingMinutes: 4,
    seoTitle: 'Accessibility Checks for Content Pages',
    seoDescription: 'Simple accessibility checks for blog and portfolio content.',
    categorySlug: 'design-systems',
    tagSlugs: ['accessibility', 'workflow'],
  },
  {
    slug: 'notes-on-shipping-small',
    title: 'Notes on Shipping Small',
    summary: 'Why tight increments make product work calmer and easier to review.',
    body: 'Small releases reduce hidden coupling and make feedback arrive while choices are still cheap.',
    coverTitle: 'Shipping Small',
    coverAlt: 'A sequence of small release cards',
    published: true,
    publishedAt: new Date('2026-03-01T09:00:00.000Z'),
    readingMinutes: 3,
    seoTitle: 'Notes on Shipping Small',
    seoDescription: 'Field notes on smaller, reviewable product increments.',
    categorySlug: 'field-notes',
    tagSlugs: ['workflow', 'typescript'],
  },
  {
    slug: 'mapping-a-personal-knowledge-base',
    title: 'Mapping a Personal Knowledge Base',
    summary: 'A lightweight structure for turning scattered notes into reusable knowledge.',
    body: 'A useful knowledge base favors retrieval paths over perfect taxonomy.',
    coverTitle: 'Knowledge Map',
    coverAlt: 'Connected notes arranged as a simple map',
    published: false,
    publishedAt: null,
    readingMinutes: 5,
    seoTitle: 'Mapping a Personal Knowledge Base',
    seoDescription: 'How to organize notes so they become reusable while writing.',
    categorySlug: 'field-notes',
    tagSlugs: ['workflow'],
  },
];

const projects = [
  {
    slug: 'content-ops-dashboard',
    title: 'Content Ops Dashboard',
    summary: 'A dashboard for tracking publishing status across editorial workflows.',
    description: 'A focused admin surface for planning, reviewing, and publishing public content.',
    technologies: ['TypeScript', 'NestJS', 'Prisma'],
    links: {
      demo: 'https://example.com/content-ops',
      source: 'https://example.com/content-ops/source',
    },
    featured: true,
    public: true,
    sortOrder: 10,
  },
  {
    slug: 'portfolio-design-system',
    title: 'Portfolio Design System',
    summary: 'Reusable interface primitives for a personal portfolio and writing site.',
    description:
      'A compact design system that keeps portfolio pages consistent without slowing iteration.',
    technologies: ['React', 'CSS', 'Accessibility'],
    links: { demo: 'https://example.com/portfolio-system' },
    featured: true,
    public: true,
    sortOrder: 20,
  },
  {
    slug: 'publishing-workflow-kit',
    title: 'Publishing Workflow Kit',
    summary: 'Utilities for drafting, tagging, and preparing content releases.',
    description: 'A set of workflow helpers for repeatable editorial preparation and review.',
    technologies: ['TypeScript', 'Prisma'],
    links: { source: 'https://example.com/publishing-kit/source' },
    featured: false,
    public: true,
    sortOrder: 30,
  },
];

export async function seedContent(prisma: PrismaClient): Promise<void> {
  const categoriesBySlug = new Map<string, string>();
  const tagsBySlug = new Map<string, string>();

  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: { label: category.label },
    });
    categoriesBySlug.set(record.slug, record.id);
  }

  for (const tag of tags) {
    const record = await prisma.tag.upsert({
      where: { slug: tag.slug },
      create: tag,
      update: { label: tag.label },
    });
    tagsBySlug.set(record.slug, record.id);
  }

  for (const post of posts) {
    const categoryId = categoriesBySlug.get(post.categorySlug);
    if (!categoryId) {
      throw new Error(`Missing category for seeded post: ${post.categorySlug}`);
    }

    const seededPost = await prisma.post.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        body: post.body,
        coverTitle: post.coverTitle,
        coverAlt: post.coverAlt,
        published: post.published,
        publishedAt: post.publishedAt,
        readingMinutes: post.readingMinutes,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        categoryId,
      },
      update: {
        title: post.title,
        summary: post.summary,
        body: post.body,
        coverTitle: post.coverTitle,
        coverAlt: post.coverAlt,
        published: post.published,
        publishedAt: post.publishedAt,
        readingMinutes: post.readingMinutes,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        categoryId,
      },
    });

    await prisma.postTag.deleteMany({ where: { postId: seededPost.id } });
    await prisma.postTag.createMany({
      data: post.tagSlugs.map((tagSlug) => {
        const tagId = tagsBySlug.get(tagSlug);
        if (!tagId) {
          throw new Error(`Missing tag for seeded post: ${tagSlug}`);
        }

        return { postId: seededPost.id, tagId };
      }),
    });
  }

  for (const project of projects) {
    await prisma.project.upsert({
      where: { slug: project.slug },
      create: project,
      update: {
        title: project.title,
        summary: project.summary,
        description: project.description,
        technologies: project.technologies,
        links: project.links,
        featured: project.featured,
        public: project.public,
        sortOrder: project.sortOrder,
      },
    });
  }
}

async function main() {
  const prisma = new PrismaClient();

  try {
    await seedContent(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
