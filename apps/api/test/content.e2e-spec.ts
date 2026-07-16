import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { API_PREFIX } from '@namdw/shared';
import request from 'supertest';

import { seedContent } from '../prisma/seed';
import { AppModule } from '../src/app.module';

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase('content endpoints', () => {
  const prisma = new PrismaClient();
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

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
    await app?.close();
  });

  it('lists published posts through the versioned prefix', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/content/posts')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          totalItems: 5,
          items: [
            { slug: 'notes-on-shipping-small' },
            { slug: 'accessibility-checks-for-content-pages' },
            { slug: 'designing-readable-dashboard-states' },
            { slug: 'prisma-seeding-patterns' },
            { slug: 'building-content-apis-with-nestjs' },
          ],
        });
      });
  });

  it('filters published posts by documented query and taxonomy routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/content/posts')
      .query({ q: 'PRAGMATIC' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          totalItems: 1,
          items: [{ slug: 'building-content-apis-with-nestjs' }],
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/content/categories/design-systems/posts')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          totalItems: 2,
          items: [
            { slug: 'accessibility-checks-for-content-pages' },
            { slug: 'designing-readable-dashboard-states' },
          ],
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/content/tags/prisma/posts')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          totalItems: 2,
          items: [
            { slug: 'prisma-seeding-patterns' },
            { slug: 'building-content-apis-with-nestjs' },
          ],
        });
      });
  });

  it('returns a published post by slug', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/content/posts/prisma-seeding-patterns')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
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

  it('returns public categories, tags, and archives', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/content/categories')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toContainEqual({
          slug: 'field-notes',
          label: 'Field Notes',
          postCount: 1,
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/content/tags')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toContainEqual({ slug: 'prisma', label: 'Prisma', postCount: 2 });
      });

    await request(app.getHttpServer())
      .get('/api/v1/content/archives')
      .expect(200)
      .expect({
        data: [
          { month: '2026-03', count: 1 },
          { month: '2026-02', count: 2 },
          { month: '2026-01', count: 2 },
        ],
      });
  });

  it('lists public projects and returns project detail by slug', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/content/projects')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.map((project: { slug: string }) => project.slug)).toEqual([
          'content-ops-dashboard',
          'portfolio-design-system',
          'publishing-workflow-kit',
        ]);
      });

    await request(app.getHttpServer())
      .get('/api/v1/content/projects/content-ops-dashboard')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          slug: 'content-ops-dashboard',
          featured: true,
        });
      });
  });

  it('searches public posts by query', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/content/search')
      .query({ q: 'PRAGMATIC' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          totalItems: 1,
          items: [{ slug: 'building-content-apis-with-nestjs' }],
        });
      });
  });

  it('returns 404 for unknown post and project slugs', async () => {
    await request(app.getHttpServer()).get('/api/v1/content/posts/unknown-post').expect(404);
    await request(app.getHttpServer()).get('/api/v1/content/projects/unknown-project').expect(404);
  });
});
