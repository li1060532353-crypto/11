# Content API and Data Layer Design

Date: 2026-07-16  
Status: Approved for implementation planning

## 1. Goal and scope

Module 4 adds the backend content foundation for the personal blog. It introduces Docker Compose PostgreSQL, Prisma, seed data, and public read-only NestJS endpoints for posts, projects, taxonomy, archives, and search.

The frontend stays on the Module 3 static content repository in this module. Module 5 can switch the frontend query boundary to the API once the backend contract is stable.

## 2. Database runtime

Local development uses Docker Compose PostgreSQL as the default database runtime. The repository will include a compose service with a project-scoped database, user, password, and exposed local port. The API reads its database connection from `DATABASE_URL`.

The expected developer flow is:

1. Start PostgreSQL with Docker Compose.
2. Run Prisma migration and generation.
3. Seed the database with the current public content.
4. Start the NestJS API and call public content endpoints.

The design keeps environment values local-development friendly. Production secrets, managed database provisioning, backups, and deployment infrastructure are later deployment work.

## 3. Data model

Prisma models cover the public content already present in Module 3:

| Model | Responsibility |
| --- | --- |
| `Post` | Article identity, slug, title, summary, body Markdown, cover metadata, publication state, dates, reading metadata, SEO fields |
| `Project` | Portfolio identity, slug, title, summary, description, project links, technologies, featured state, sort order |
| `Category` | Canonical category slug and display label |
| `Tag` | Canonical tag slug and display label |
| `PostTag` | Many-to-many relation between posts and tags |

Posts belong to one category and can have many tags. Slugs are unique and canonical lowercase. Public endpoints only return published posts and public projects.

The seed source mirrors the current static frontend content so the backend can become a drop-in source later. Seed execution is idempotent by slug, allowing repeated local resets without duplicate rows.

## 4. API contract

The API exposes public, read-only routes under `/content`:

| Route | Response |
| --- | --- |
| `GET /content/posts` | Paginated post summaries with optional `page`, `pageSize`, `category`, `tag`, `archive`, and `q` filters |
| `GET /content/posts/:slug` | Full post detail, including Markdown body, category, tags, SEO, and related summaries |
| `GET /content/categories` | Categories with published post counts |
| `GET /content/categories/:slug/posts` | Paginated posts in one category |
| `GET /content/tags` | Tags with published post counts |
| `GET /content/tags/:slug/posts` | Paginated posts for one tag |
| `GET /content/archives` | Year/month archive groups with counts |
| `GET /content/projects` | Public project summaries |
| `GET /content/projects/:slug` | Project detail |
| `GET /content/search` | Paginated search over published post title, summary, and body |

Responses use the existing shared API success/error envelope where practical. Pagination returns `items`, `page`, `pageSize`, `totalItems`, and `totalPages`.

Invalid pagination is normalized to safe bounds. Unknown slugs return a typed 404. Unknown filters return empty successful lists rather than server errors. Search trims whitespace and returns an empty list for empty queries.

## 5. Backend structure

The NestJS API adds focused modules:

- `PrismaModule` owns the Prisma client lifecycle.
- `ContentModule` owns public content controllers, services, DTOs, and mappers.
- `ContentRepository` contains Prisma queries and keeps controller logic thin.
- DTOs define stable response shapes for the future frontend API adapter.

Controllers validate and normalize query parameters before calling services. Services enforce public visibility rules. Repository methods own sorting, filtering, pagination, archive grouping, and search.

## 6. Safety and behavior

Markdown body content is returned as data and is not rendered by the API. The frontend renderer remains responsible for safe Markdown rendering.

The API must not expose draft posts, private projects, internal Prisma fields, database IDs, or deleted content. Slugs, filters, and search text are treated as untrusted input and passed through Prisma parameterized queries.

Search is implemented with simple PostgreSQL-backed matching in this module. Full-text search ranking, typo tolerance, indexing strategy, and external search services are future enhancements.

## 7. Testing and acceptance

Tests cover:

- Prisma seed idempotency and required content counts;
- content repository sorting, filtering, pagination, archive grouping, and search;
- public API routes for lists, details, taxonomy, archives, projects, and 404 states;
- visibility rules for unpublished or private content;
- input normalization for pagination, empty search, unknown filters, and invalid slugs;
- build, typecheck, lint, and smoke verification.

Module 4 is accepted when Docker Compose PostgreSQL can run locally, Prisma migrations apply cleanly, seed data loads current public content, every documented API endpoint returns stable envelopes, backend tests cover the query behavior, and the existing repository quality gate remains green.

## 8. Explicit non-goals

- No frontend API migration
- No admin dashboard or editor
- No authentication or authorization UI
- No comments, likes, analytics, or reader accounts
- No production deployment or managed database setup
- No sitemap, robots, canonical URL, or social-image generation
- No external search service
