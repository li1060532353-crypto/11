# Content API and Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Docker Compose PostgreSQL, Prisma data models, seed data, and public read-only NestJS content API endpoints for the blog.

**Architecture:** Keep Module 4 backend-only. Prisma owns persistence, a NestJS `PrismaModule` owns client lifecycle, and a `ContentModule` exposes read-only controllers through services/repositories. Frontend static content remains unchanged until a later module.

**Tech Stack:** NestJS, Prisma, PostgreSQL via Docker Compose, TypeScript, Jest/Supertest, pnpm.

## Global Constraints

- Local development uses Docker Compose PostgreSQL as the default database runtime.
- The API reads its database connection from `DATABASE_URL`.
- Public endpoints only return published posts and public projects.
- Slugs are unique and canonical lowercase.
- Seed execution is idempotent by slug.
- Responses use the existing shared API success/error envelope where practical.
- Pagination returns `items`, `page`, `pageSize`, `totalItems`, and `totalPages`.
- Invalid pagination is normalized to safe bounds.
- Unknown slugs return a typed 404.
- Unknown filters return empty successful lists rather than server errors.
- Search trims whitespace and returns an empty list for empty queries.
- Markdown body content is returned as data and is not rendered by the API.
- No frontend API migration, admin dashboard, editor, authentication, comments, deployment work, sitemap work, or external search service.

---

## File Structure

- Create `docker-compose.yml`: local PostgreSQL service.
- Create `.env.example`: documented `DATABASE_URL`.
- Modify `apps/api/package.json`: add Prisma scripts and dependencies.
- Create `apps/api/prisma/schema.prisma`: database models and relations.
- Create `apps/api/prisma/seed.ts`: idempotent seed from Module 3 content.
- Create `apps/api/src/prisma/prisma.module.ts` and `prisma.service.ts`: Prisma client lifecycle.
- Create `apps/api/src/content/content.types.ts`: API DTO and query types.
- Create `apps/api/src/content/query-normalizers.ts`: pagination, archive, slug, and search normalization.
- Create `apps/api/src/content/content.repository.ts`: Prisma query boundary.
- Create `apps/api/src/content/content.service.ts`: public visibility and not-found behavior.
- Create `apps/api/src/content/content.controller.ts`: `/content` routes.
- Create `apps/api/src/content/content.module.ts`: NestJS module assembly.
- Modify `apps/api/src/app.module.ts`: import Prisma and content modules.
- Add tests under `apps/api/src/content/*.spec.ts` and `apps/api/test/content.e2e-spec.ts`.
- Modify `scripts/smoke.mjs` and `scripts/smoke.test.mjs` only if smoke needs a content endpoint check.

---

### Task 1: PostgreSQL and Prisma Foundation

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/prisma/prisma.service.spec.ts`

**Interfaces:**
- Produces: `PrismaService extends PrismaClient`
- Produces: `PrismaModule` exported for feature modules
- Produces: Prisma models `Post`, `Project`, `Category`, `Tag`, `PostTag`

- [ ] **Step 1: Add a failing Prisma service lifecycle test**

```ts
// apps/api/src/prisma/prisma.service.spec.ts
import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('is injectable and exposes prisma model delegates', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const service = moduleRef.get(PrismaService);
    expect(service).toBeInstanceOf(PrismaService);
    expect(service.post).toBeDefined();
    expect(service.project).toBeDefined();
  });
});
```

Run: `corepack pnpm --filter @namdw/api test -- prisma.service.spec.ts`  
Expected: FAIL because `PrismaService` does not exist.

- [ ] **Step 2: Add Prisma dependencies and scripts**

Install: `corepack pnpm --filter @namdw/api add @prisma/client`  
Install: `corepack pnpm --filter @namdw/api add -D prisma tsx`

Add scripts in `apps/api/package.json`:

```json
{
  "prisma:generate": "prisma generate --schema prisma/schema.prisma",
  "prisma:migrate": "prisma migrate dev --schema prisma/schema.prisma",
  "prisma:seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Add Docker and environment files**

`docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: personal_blog
      POSTGRES_USER: personal_blog
      POSTGRES_PASSWORD: personal_blog
    volumes:
      - personal_blog_postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U personal_blog -d personal_blog"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  personal_blog_postgres:
```

`.env.example`:

```env
DATABASE_URL="postgresql://personal_blog:personal_blog@localhost:5432/personal_blog?schema=public"
```

- [ ] **Step 4: Add Prisma schema**

Create `apps/api/prisma/schema.prisma` with PostgreSQL datasource, client generator, and models:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Category {
  id        String   @id @default(cuid())
  slug      String   @unique
  label     String
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Tag {
  id        String    @id @default(cuid())
  slug      String    @unique
  label     String
  posts     PostTag[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model PostTag {
  postId String
  tagId  String
  post   Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
}

model Post {
  id             String    @id @default(cuid())
  slug           String    @unique
  title          String
  summary        String
  body           String
  coverTitle     String?
  coverAlt       String?
  published      Boolean   @default(false)
  publishedAt    DateTime?
  readingMinutes Int
  seoTitle       String?
  seoDescription String?
  categoryId     String
  category       Category  @relation(fields: [categoryId], references: [id])
  tags           PostTag[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([published, publishedAt])
  @@index([categoryId])
}

model Project {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  summary     String
  description String
  technologies String[]
  links       Json
  featured    Boolean  @default(false)
  public      Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([public, sortOrder])
}
```

- [ ] **Step 5: Add Prisma module and wire AppModule**

`PrismaService` implements `OnModuleInit` and `OnModuleDestroy`; `PrismaModule` provides and exports it. Import `PrismaModule` in `apps/api/src/app.module.ts`.

- [ ] **Step 6: Verify**

Run:

```bash
export DATABASE_URL="postgresql://personal_blog:personal_blog@localhost:5432/personal_blog?schema=public"
corepack pnpm --filter @namdw/api prisma:generate
corepack pnpm --filter @namdw/api test -- prisma.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml .env.example apps/api/package.json apps/api/prisma/schema.prisma apps/api/src/prisma apps/api/src/app.module.ts pnpm-lock.yaml
git commit -m "feat: add prisma postgres foundation"
```

---

### Task 2: Idempotent Seed Data

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Test: `apps/api/src/content/seed-data.spec.ts`

**Interfaces:**
- Produces: `seedContent(prisma: PrismaClient): Promise<void>`
- Consumes: Prisma models from Task 1

- [ ] **Step 1: Write failing seed tests**

Test that `seedContent()` can run twice and leaves at least six posts, three projects, categories, and tags. Use the real Prisma client against the test database.

Run: `corepack pnpm --filter @namdw/api test -- seed-data.spec.ts`  
Expected: FAIL because `seedContent` does not exist.

- [ ] **Step 2: Implement seed data**

Create `seedContent(prisma)` in `apps/api/prisma/seed.ts`. Use `upsert` by slug for categories, tags, posts, and projects. For posts, delete and recreate `PostTag` rows per seeded post to keep tag relations deterministic.

- [ ] **Step 3: Verify seed**

Run:

```bash
docker compose up -d postgres
export DATABASE_URL="postgresql://personal_blog:personal_blog@localhost:5432/personal_blog?schema=public"
corepack pnpm --filter @namdw/api prisma:migrate -- --name init_content
corepack pnpm --filter @namdw/api prisma:seed
corepack pnpm --filter @namdw/api test -- seed-data.spec.ts
```

Expected: migration applies, seed exits 0, test PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma apps/api/src/content/seed-data.spec.ts
git commit -m "feat: seed public content data"
```

---

### Task 3: Content Query Boundary

**Files:**
- Create: `apps/api/src/content/content.types.ts`
- Create: `apps/api/src/content/query-normalizers.ts`
- Create: `apps/api/src/content/content.repository.ts`
- Test: `apps/api/src/content/query-normalizers.spec.ts`
- Test: `apps/api/src/content/content.repository.spec.ts`

**Interfaces:**
- Produces: `normalizePagination(input): { page: number; pageSize: number }`
- Produces: `normalizeSearch(value: unknown): string`
- Produces: `ContentRepository.listPosts(options): Promise<Paginated<PostSummaryDto>>`
- Produces: `ContentRepository.getPostBySlug(slug): Promise<PostDetailDto | null>`
- Produces: taxonomy, archive, project, and search repository methods

- [ ] **Step 1: Write failing normalizer tests**

Cover invalid page, excessive page size, empty search, whitespace search, and archive strings shaped as `YYYY-MM`.

Run: `corepack pnpm --filter @namdw/api test -- query-normalizers.spec.ts`  
Expected: FAIL because normalizers do not exist.

- [ ] **Step 2: Implement normalizers and DTO types**

Use min page `1`, default page size `6`, max page size `24`, lower-case slug normalization with `toLowerCase()`, and trimmed search strings.

- [ ] **Step 3: Write failing repository tests**

Seed the database, then assert post sorting newest-first, category/tag filters, archive grouping, search matching, project visibility, and no private/unpublished rows.

Run: `corepack pnpm --filter @namdw/api test -- content.repository.spec.ts`  
Expected: FAIL because repository does not exist.

- [ ] **Step 4: Implement repository**

Use Prisma `findMany`, `count`, `include`, and parameterized `contains` filters with `mode: 'insensitive'` where supported. Map Prisma rows to DTOs without exposing database IDs.

- [ ] **Step 5: Verify**

Run:

```bash
corepack pnpm --filter @namdw/api test -- query-normalizers.spec.ts content.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/content
git commit -m "feat: add content query repository"
```

---

### Task 4: Public Content API

**Files:**
- Create: `apps/api/src/content/content.service.ts`
- Create: `apps/api/src/content/content.controller.ts`
- Create: `apps/api/src/content/content.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/content/content.service.spec.ts`
- Test: `apps/api/test/content.e2e-spec.ts`

**Interfaces:**
- Consumes: `ContentRepository` from Task 3
- Produces: routes under `/content`

- [ ] **Step 1: Write failing service tests**

Mock `ContentRepository`; assert detail methods return values and throw `NotFoundException` for missing post/project slugs.

Run: `corepack pnpm --filter @namdw/api test -- content.service.spec.ts`  
Expected: FAIL because service does not exist.

- [ ] **Step 2: Implement service**

Add thin service methods for posts, categories, tags, archives, projects, and search. Keep public visibility in repository queries and typed 404 behavior in service.

- [ ] **Step 3: Write failing e2e tests**

Cover:

- `GET /content/posts`
- `GET /content/posts/:slug`
- `GET /content/categories`
- `GET /content/tags`
- `GET /content/archives`
- `GET /content/projects`
- `GET /content/projects/:slug`
- `GET /content/search?q=...`
- 404 for unknown post/project

Run: `corepack pnpm --filter @namdw/api test:e2e -- content.e2e-spec.ts`  
Expected: FAIL because routes do not exist.

- [ ] **Step 4: Implement controller and module**

Use `@Controller('content')`. Return shared `apiSuccess(...)` envelopes. Import `ContentModule` in `AppModule`.

- [ ] **Step 5: Verify**

Run:

```bash
corepack pnpm --filter @namdw/api test -- content.service.spec.ts
corepack pnpm --filter @namdw/api test:e2e -- content.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/content apps/api/src/app.module.ts apps/api/test/content.e2e-spec.ts
git commit -m "feat: expose public content api"
```

---

### Task 5: Smoke, Documentation, and Quality Gate

**Files:**
- Modify: `scripts/smoke.mjs`
- Modify: `scripts/smoke.test.mjs`
- Create or modify: `README.md` only if the repository already documents local setup there

**Interfaces:**
- Consumes: public `/content` endpoints from Task 4
- Produces: verified local startup path for PostgreSQL-backed API

- [ ] **Step 1: Add failing smoke helper test if content smoke changes**

Assert the smoke script checks `/health` and at least one stable content endpoint such as `/content/posts`.

Run: `corepack pnpm test:smoke`  
Expected: FAIL until smoke supports content endpoint expectations.

- [ ] **Step 2: Update smoke and setup docs**

Make smoke use the existing API port and call `/content/posts`. Document local database startup, migrate, seed, and API start commands in the existing setup docs if present.

- [ ] **Step 3: Run full verification**

Run:

```bash
export HOME=/tmp
export XDG_CACHE_HOME=/tmp/.cache
export COREPACK_HOME=/tmp/corepack
export DATABASE_URL="postgresql://personal_blog:personal_blog@localhost:5432/personal_blog?schema=public"
docker compose up -d postgres
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @namdw/api prisma:migrate -- --name verify_content_api
corepack pnpm --filter @namdw/api prisma:seed
corepack pnpm lint
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm smoke
git diff --check
git status --short --branch
```

Expected: all commands exit 0; git status shows only intentional tracked changes before the final commit.

- [ ] **Step 4: Commit**

```bash
git add scripts README.md
git commit -m "test: add content api smoke coverage"
```

If README did not exist or did not need changes, omit it from `git add`.

---

## Self-Review

- Spec coverage: Docker Compose PostgreSQL is Task 1; Prisma schema and client lifecycle are Task 1; seed idempotency is Task 2; repository filtering/search/archive behavior is Task 3; public endpoints and 404 behavior are Task 4; smoke and full quality gate are Task 5.
- Placeholder scan: no placeholder markers are intentionally left.
- Type consistency: repository/service/controller names are consistent across tasks.
