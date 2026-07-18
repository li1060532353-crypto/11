# Wave 0 Reconnaissance Report

Date: 2026-07-18  
Repository: `E:\AIblog\personal-blog-source`  
Branch: `codex/local-api-docker` at `3b4b75f`

## Detected stack

- Package manager: pnpm 11.13.0, Node.js >=24, workspace layout.
- Frontend: React 19, React Router 7, Vite 8, TypeScript, CSS modules-by-purpose under `apps/web/src/styles`, Vitest/Testing Library.
- Current backend: NestJS 11 + Prisma 6 + PostgreSQL in `apps/api`; local Docker Compose only.
- Shared contracts: `packages/shared`.
- Existing deployment document: static Cloudflare Pages frontend build of `apps/web/dist`; no Pages Functions, Wrangler configuration, D1, R2, or Access configuration exists.

## Current content and routes

- Public SPA routes reside in `apps/web/src/router.tsx`: home, posts/detail, categories, tags, archive, projects/detail, about, and search.
- Markdown source: two non-template articles in `content/posts/*/index.md`; importer validates required public-blog front matter and generates `apps/web/src/content/generatedPosts.ts`.
- Legacy static TypeScript data: six articles in `apps/web/src/content/posts.ts`.
- Prisma seed data: six separate sample posts in `apps/api/prisma/seed.ts` plus projects/categories/tags.
- The content gateway currently prefers `/api/v1` Nest endpoints and falls back to bundled content when unavailable.

## Migration assessment

The data sources are overlapping rather than a single authoritative corpus. The new migration must inventory each source separately, use deterministic source identifiers and slug/content-hash duplicate detection, and report—not overwrite—collisions. Existing `content/posts/` source files must remain untouched. Do not migrate Prisma seed fixtures to production notes unless the user later approves their inclusion; they appear to be sample API data and are not source articles.

Static Markdown content already relies on local-image rewriting for its public-blog build. The private knowledge-base importer must not reproduce this behavior in MVP; existing source remains preserved and relative image rewriting is documented as deferred.

## Baseline evidence

- `pnpm content:check`: passed; validated 2 articles.
- `pnpm --filter @namdw/web test`: failed with 5 assertions in `src/content/contentQueries.test.ts`. The tests expect six legacy posts, while the generated Markdown import currently adds two July 2026 posts for a combined eight. This is a pre-existing baseline/content-fixture mismatch, not changed by Wave 0.
- No Functions directory or Wrangler config is present.
- The existing untracked file `docs/superpowers/plans/2026-07-17-local-api-docker-deployment-implementation.md` predates this work and is preserved.

## Proposed target structure (not yet created)

```text
functions/
  _middleware.ts                 # Access assertion validation and local-only bypass
  api/notes/[[path]].ts          # Note CRUD, review, versions
  api/search.ts                  # LIKE search with escaped wildcards
  api/stats.ts                   # D1 counts
  api/roadmaps/[[path]].ts       # Roadmaps/items/reorder
  api/import/markdown.ts         # One-file Markdown import
  api/assets/[[path]].ts         # Private upload/proxy/delete
  lib/{auth,db,errors,notes,validation}.ts
migrations/
  0001_knowledge_base.sql
apps/web/src/knowledge/
  api/, components/, hooks/, pages/, types/, utils/
scripts/
  migrate-static-articles.mjs    # dry run, report, backup/rollback guidance
docs/
  cloudflare-setup.md
  migration-runbook.md
```

The exact module/file names will be frozen at H1 after the selected Cloudflare Pages Functions routing convention and shared API types are approved.

## Work waves and ownership proposal

1. Wave 1, sequential Terra/controller work: Pages-compatible config, D1 schema/migration, contracts, response helpers, Access middleware, local setup. Stop H1; stop H2 for Cloudflare dashboard setup.
2. Wave 2 after H1: Notes/Search/Stats API and Dashboard/Notes visual shell may run in parallel only after contracts are frozen and with non-overlapping files; independent review follows.
3. Wave 3: Tiptap UI and R2 API may run in parallel after note payloads freeze; independent review follows.
4. Wave 4: importer/migration safety and roadmap work after interfaces are frozen; stop H3 before production import.
5. Wave 5: sequential integration and full verification.
6. Wave 6: independent security/migration review; highest-capability review requires explicit human approval if it means using Sol.
7. Wave 7: human-approved production deployment and smoke tests; H5 acceptance.

No parallel agents are proposed for Wave 1 because schema, shared types, API contracts, and Access are sequential dependencies.

## Model proposal

- Controller/reconnaissance/schema/Access/D1/R2/migration/integration/review: Terra-equivalent balanced coding model (the current runtime model; no explicit switch is claimed).
- Isolated editor controls, states, focused tests, and small styling: Luna-equivalent lower-cost coding model only after frozen contracts.
- Sol-equivalent highest-capability model: only for an unresolved high-risk authentication/migration/integration problem after two evidence-backed Terra attempts, and only with human approval.

## Assumptions awaiting H0 approval

- The nested `personal-blog-source` directory, not `E:\AIblog`, is the repository to transform.
- The existing Pages project can be repointed from static output to a Pages + Functions deployment without changing the frontend framework.
- The separate NestJS/PostgreSQL local backend is legacy/development material; it will not be deployed as the new production backend. Whether it remains supported locally will be decided in Wave 1 without deleting it.
- Existing public routes/content remain in source but the production hostname becomes Access-protected.

## Deferred features

Exactly those listed in `docs/codex-master-spec.md`, including public/private split, multi-user roles, public R2, real-time/offline collaboration, FTS5/advanced Chinese tokenization, AI/OCR, relative Markdown image rewriting, automatic orphan cleanup, and visual version diffs.
