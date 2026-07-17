# Personal Blog

Apple-inspired personal blog built as a pnpm monorepo with React, Vite, NestJS, and PostgreSQL.

## Requirements

- Node.js 24
- Corepack
- Docker, for local PostgreSQL

## Setup

```bash
corepack enable
corepack prepare pnpm@11.13.0 --activate
pnpm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to the local PostgreSQL database:

```bash
DATABASE_URL="postgresql://personal_blog:personal_blog@localhost:5432/personal_blog?schema=public"
```

Start PostgreSQL, apply migrations, and seed the content API data:

```bash
docker compose up -d postgres
pnpm --filter @namdw/api prisma:migrate -- --name local_content_api
pnpm --filter @namdw/api prisma:seed
```

## Development

```bash
pnpm dev
```

- Web: `http://127.0.0.1:5173`
- API health: `http://127.0.0.1:3000/api/v1/health`
- API posts: `http://127.0.0.1:3000/api/v1/content/posts`

The web app requests content from `VITE_API_BASE_URL`, which defaults to `/api/v1`.
For API-backed local content, keep PostgreSQL running, apply Prisma migrations, and seed the
database before starting development:

```bash
docker compose up -d postgres
pnpm --filter @namdw/api prisma:migrate -- --name local_content_api
pnpm --filter @namdw/api prisma:seed
```

If the API or database is unavailable, the frontend still renders from the bundled static
content fallback and shows a fallback notice on API-backed content surfaces.

To run only the built API against the local database:

```bash
pnpm --filter @namdw/shared build
pnpm --filter @namdw/api build
API_HOST=127.0.0.1 API_PORT=3100 pnpm --filter @namdw/api start
```

## Quality checks

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

`pnpm test` runs the package unit tests, the API end-to-end suite, and focused smoke-script tests.
`pnpm smoke` verifies the built API health endpoint, public content posts endpoint, and Vite preview,
so run `pnpm build` first and keep local PostgreSQL running with seeded data. Frontend fallback
behavior for API unavailability is covered by the web content gateway tests rather than the
process-level smoke script.

The detailed product design and module plans are stored under `docs/superpowers/`.

## Free static deployment

For the lowest-cost public deployment, use Cloudflare Pages and deploy only the frontend. The
frontend will automatically use bundled static content when the API/database is not deployed.

- Build command: `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @namdw/web build`
- Build output directory: `apps/web/dist`
- Root directory: repository root
- Optional environment variable: `VITE_API_BASE_URL=/api/v1`

Detailed steps are in `docs/deployment/cloudflare-pages-static.md`.

## Static content import

To add or update articles without the API/database, use the local Markdown import workflow:

- Article template: `content/posts/_template/index.md`
- Import guide: `docs/deployment/static-content-import.md`
- Validate content: `pnpm content:check`
- Generate static content: `pnpm content:import`
- Preview locally: `pnpm content:preview`

## Current implementation

- Module 1: pnpm monorepo, shared API contracts, React/Vite web app, NestJS health API
- Module 2: Apple-inspired responsive homepage shell, accessible navigation, design tokens, and reduced-motion support
- Module 3: React Router public pages, typed static articles/projects, discovery filters, search, and safe Markdown reading experience
- Module 4: PostgreSQL-backed content API, Prisma data access, public content endpoints, and production smoke coverage
- Module 5: frontend API-first content gateway with static fallback for no-backend deployments
- Module 6: Cloudflare Pages static deployment path for the free public blog
