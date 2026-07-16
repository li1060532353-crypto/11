import { PrismaClient } from '@prisma/client';

import { seedContent } from '../../prisma/seed';

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase('seedContent', () => {
  const prisma = new PrismaClient();

  beforeEach(async () => {
    await prisma.postTag.deleteMany();
    await prisma.post.deleteMany();
    await prisma.project.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.category.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('can run twice and leave deterministic public content data', async () => {
    await seedContent(prisma);
    await seedContent(prisma);

    await expect(prisma.post.count()).resolves.toBeGreaterThanOrEqual(6);
    await expect(prisma.project.count()).resolves.toBeGreaterThanOrEqual(3);
    await expect(prisma.category.count()).resolves.toBeGreaterThan(0);
    await expect(prisma.tag.count()).resolves.toBeGreaterThan(0);

    const seededPosts = await prisma.post.findMany({
      include: { tags: true },
      orderBy: { slug: 'asc' },
    });
    const duplicateSlugs = seededPosts.filter(
      (post, index) => seededPosts.findIndex((candidate) => candidate.slug === post.slug) !== index,
    );

    expect(duplicateSlugs).toEqual([]);
    expect(seededPosts.every((post) => post.tags.length > 0)).toBe(true);
  });
});
