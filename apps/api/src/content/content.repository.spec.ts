import { PrismaClient } from '@prisma/client';

import { seedContent } from '../../prisma/seed';
import { ContentRepository } from './content.repository';

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase('ContentRepository', () => {
  const prisma = new PrismaClient();
  const repository = new ContentRepository(prisma);

  beforeEach(async () => {
    await prisma.postTag.deleteMany();
    await prisma.post.deleteMany();
    await prisma.project.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.category.deleteMany();
    await seedContent(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lists published posts newest-first without database IDs', async () => {
    const result = await repository.listPosts({ pageSize: 12 });

    expect(result.totalItems).toBe(5);
    expect(result).not.toHaveProperty('total');
    expect(result.items.map((post) => post.slug)).toEqual([
      'notes-on-shipping-small',
      'accessibility-checks-for-content-pages',
      'designing-readable-dashboard-states',
      'prisma-seeding-patterns',
      'building-content-apis-with-nestjs',
    ]);
    expect(result.items.map((post) => post.slug)).not.toContain(
      'mapping-a-personal-knowledge-base',
    );
    expect(result.items[0]).not.toHaveProperty('id');
    expect(result.items[0]?.category).toEqual({ slug: 'field-notes', label: 'Field Notes' });
  });

  it('filters published posts by category and tag slugs', async () => {
    await expect(
      repository.listPosts({ category: 'DESIGN-SYSTEMS', pageSize: 12 }),
    ).resolves.toMatchObject({
      totalItems: 2,
      items: [
        { slug: 'accessibility-checks-for-content-pages' },
        { slug: 'designing-readable-dashboard-states' },
      ],
    });

    await expect(repository.listPosts({ tag: 'Prisma', pageSize: 12 })).resolves.toMatchObject({
      totalItems: 2,
      items: [{ slug: 'prisma-seeding-patterns' }, { slug: 'building-content-apis-with-nestjs' }],
    });
  });

  it('accepts documented q query values when listing posts', async () => {
    await expect(repository.listPosts({ q: 'PRAGMATIC', pageSize: 12 })).resolves.toMatchObject({
      totalItems: 1,
      items: [{ slug: 'building-content-apis-with-nestjs' }],
    });
  });

  it('includes published post counts for categories and tags', async () => {
    await expect(repository.listCategories()).resolves.toEqual([
      { slug: 'design-systems', label: 'Design Systems', postCount: 2 },
      { slug: 'engineering', label: 'Engineering', postCount: 2 },
      { slug: 'field-notes', label: 'Field Notes', postCount: 1 },
    ]);

    await expect(repository.listTags()).resolves.toEqual([
      { slug: 'accessibility', label: 'Accessibility', postCount: 2 },
      { slug: 'nestjs', label: 'NestJS', postCount: 1 },
      { slug: 'prisma', label: 'Prisma', postCount: 2 },
      { slug: 'react', label: 'React', postCount: 1 },
      { slug: 'typescript', label: 'TypeScript', postCount: 2 },
      { slug: 'workflow', label: 'Workflow', postCount: 3 },
    ]);
  });

  it('groups published posts by archive month newest-first', async () => {
    await expect(repository.listArchives()).resolves.toEqual([
      { month: '2026-03', count: 1 },
      { month: '2026-02', count: 2 },
      { month: '2026-01', count: 2 },
    ]);

    await expect(repository.listPosts({ archive: '2026-02', pageSize: 12 })).resolves.toMatchObject(
      {
        totalItems: 2,
        items: [
          { slug: 'accessibility-checks-for-content-pages' },
          { slug: 'designing-readable-dashboard-states' },
        ],
      },
    );
  });

  it('searches published post title, summary, and body case-insensitively', async () => {
    await expect(repository.searchPosts('PRAGMATIC', { pageSize: 12 })).resolves.toMatchObject({
      totalItems: 1,
      items: [{ slug: 'building-content-apis-with-nestjs' }],
    });

    await expect(repository.searchPosts('relation state', { pageSize: 12 })).resolves.toMatchObject(
      {
        totalItems: 1,
        items: [{ slug: 'prisma-seeding-patterns' }],
      },
    );
  });

  it('returns only public projects sorted by sort order', async () => {
    await prisma.project.create({
      data: {
        slug: 'private-project',
        title: 'Private Project',
        summary: 'Hidden project summary',
        description: 'Hidden project detail',
        technologies: ['TypeScript'],
        links: {},
        public: false,
        sortOrder: 5,
      },
    });

    const projects = await repository.listProjects();

    expect(projects.map((project) => project.slug)).toEqual([
      'content-ops-dashboard',
      'portfolio-design-system',
      'publishing-workflow-kit',
    ]);
    expect(projects[0]).not.toHaveProperty('id');
  });

  it('does not return unpublished posts or private projects by slug', async () => {
    await prisma.project.create({
      data: {
        slug: 'private-project',
        title: 'Private Project',
        summary: 'Hidden project summary',
        description: 'Hidden project detail',
        technologies: ['TypeScript'],
        links: {},
        public: false,
        sortOrder: 5,
      },
    });

    await expect(repository.getPostBySlug('mapping-a-personal-knowledge-base')).resolves.toBeNull();
    await expect(repository.getProjectBySlug('private-project')).resolves.toBeNull();
    await expect(repository.getPostBySlug(' PRISMA-SEEDING-PATTERNS ')).resolves.toMatchObject({
      slug: 'prisma-seeding-patterns',
      body: expect.stringContaining('Seed scripts'),
      relatedPosts: [
        { slug: 'notes-on-shipping-small' },
        { slug: 'accessibility-checks-for-content-pages' },
        { slug: 'building-content-apis-with-nestjs' },
      ],
    });
  });
});
