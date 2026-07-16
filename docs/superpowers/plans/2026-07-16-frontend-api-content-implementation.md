# Frontend API Content Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public React pages prefer the Module 4 content API while preserving the existing static content fallback.

**Architecture:** Add a typed web content API client, map API DTOs to existing frontend content types, and expose an async content gateway that falls back to the current synchronous static query functions. Migrate page components to consume the gateway through small React hooks while preserving routes, layouts, Markdown rendering, metadata, and accessibility behavior.

**Tech Stack:** React, React Router, TypeScript, Vite, Vitest, Testing Library, existing NestJS `/api/v1/content` API.

## Global Constraints

- Public pages prefer `/api/v1/content/*` data and fall back to the existing static content repository when the API is unavailable, returns an error, or local development has no running database.
- This module changes data loading behavior, not the visual language.
- The Module 3 routes, page layouts, Markdown reader, responsive styles, document metadata, and accessibility expectations remain in place.
- The web app reads `VITE_API_BASE_URL`, defaulting to `/api/v1`.
- Page code should not call raw `fetch`.
- The client accepts the existing shared success envelope.
- Network errors, aborts, non-2xx responses, malformed envelopes, and unknown API shapes become typed content-source failures.
- `ContentResult<T>` includes `data`, `source`, and `error`.
- The existing synchronous static query module remains available behind the fallback adapter.
- Unknown post/project/category/tag slugs render the existing not-found recovery states.
- Unknown filters render empty successful lists.
- Invalid page values normalize to safe bounds.
- Search with an empty query returns the existing empty/search-start behavior.
- Article Markdown remains rendered only by the existing safe Markdown renderer.
- No admin dashboard, editor, authentication, authorization UI, React Query/SWR, SSR, streaming, server components, frontend redesign, content editing workflow, comments, likes, analytics, or reader accounts.

---

## File Structure

- Create `apps/web/src/content/apiClient.ts`: fetch wrapper, envelope parsing, timeout/abort handling, typed failures.
- Create `apps/web/src/content/apiTypes.ts`: API DTO types matching Module 4 responses.
- Create `apps/web/src/content/apiMappers.ts`: API DTO to existing frontend `Post`, `PostSummary`, `Project`, taxonomy, archive, and featured content shapes.
- Create `apps/web/src/content/contentGateway.ts`: async API-first/static-fallback query boundary.
- Create `apps/web/src/content/useContentQuery.ts`: small React hook for loading gateway promises.
- Modify `apps/web/src/content/types.ts`: add `ContentResult`, `ContentSource`, and optional related post support if needed.
- Modify public pages under `apps/web/src/pages/` and `apps/web/src/pages/posts/`: replace synchronous query calls with hook-backed async data.
- Modify homepage components only where needed to accept async featured content data.
- Add tests beside new content modules and update page tests to cover API success and fallback.
- Modify `scripts/smoke.test.mjs` only if frontend fallback smoke expectations need to be pinned.

---

### Task 1: API Client and DTO Mapping

**Files:**
- Create: `apps/web/src/content/apiTypes.ts`
- Create: `apps/web/src/content/apiClient.ts`
- Create: `apps/web/src/content/apiMappers.ts`
- Modify: `apps/web/src/content/types.ts`
- Test: `apps/web/src/content/apiClient.test.ts`
- Test: `apps/web/src/content/apiMappers.test.ts`

**Interfaces:**
- Produces: `type ContentSource = 'api' | 'fallback'`
- Produces: `type ContentResult<T> = { data: T; source: ContentSource; error?: ContentSourceError }`
- Produces: `type ContentSourceError = { kind: 'network' | 'http' | 'invalid-envelope' | 'invalid-data' | 'aborted'; message: string }`
- Produces: `requestContent<T>(path: string, options?: { signal?: AbortSignal; search?: URLSearchParams }): Promise<T>`
- Produces mapper functions `mapApiPostSummary`, `mapApiPostDetail`, `mapApiProject`, `mapApiTaxonomy`, `mapApiArchiveGroups`

- [ ] **Step 1: Write failing API client tests**

Create `apiClient.test.ts` with tests for success envelope, non-2xx failure, malformed envelope failure, and aborted request. Mock `globalThis.fetch`.

Run: `corepack pnpm --filter @namdw/web test -- apiClient.test.ts`  
Expected: FAIL because `apiClient.ts` does not exist.

- [ ] **Step 2: Implement API client**

Read `import.meta.env.VITE_API_BASE_URL || '/api/v1'`. Build URLs by appending the provided content path. Parse JSON envelopes shaped as `{ data: T }`. Throw only typed `ContentSourceFailure` instances internally; exported gateway code will convert those into fallback results.

- [ ] **Step 3: Write failing mapper tests**

Create `apiMappers.test.ts` with concrete API DTO examples:

- post summary with `readingMinutes` maps to frontend `readingTime`;
- category/tag `label` and `postCount` map to `name` and `count`;
- project `title` and `description` map to `name` and `body`;
- archive post summaries map to existing `ArchiveGroup`;
- post detail body remains Markdown data.

Run: `corepack pnpm --filter @namdw/web test -- apiMappers.test.ts`  
Expected: FAIL because mapper functions do not exist.

- [ ] **Step 4: Implement DTO types and mappers**

Use conservative defaults for fields the API does not own yet: cover tone/alt can be derived from slug/category, `selected` defaults to `false` unless API data marks featured, and project link JSON maps to `sourceUrl`/`demoUrl` when present.

- [ ] **Step 5: Verify**

Run:

```bash
corepack pnpm --filter @namdw/web test -- apiClient.test.ts apiMappers.test.ts
corepack pnpm --filter @namdw/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/content
git commit -m "feat: add frontend content api client"
```

---

### Task 2: API-First Static-Fallback Gateway

**Files:**
- Create: `apps/web/src/content/contentGateway.ts`
- Test: `apps/web/src/content/contentGateway.test.ts`

**Interfaces:**
- Consumes: `requestContent` and mapper functions from Task 1
- Consumes: existing static functions from `apps/web/src/content/contentQueries.ts`
- Produces async functions:
  - `listPosts(options): Promise<ContentResult<Paginated<PostSummary>>>`
  - `getPostBySlug(slug): Promise<ContentResult<Post | undefined>>`
  - `listCategories(): Promise<ContentResult<readonly Category[]>>`
  - `listTags(): Promise<ContentResult<readonly Tag[]>>`
  - `listProjects(): Promise<ContentResult<readonly Project[]>>`
  - `getProjectBySlug(slug): Promise<ContentResult<Project | undefined>>`
  - `searchPosts(query, options): Promise<ContentResult<Paginated<PostSummary>>>`
  - `groupPostsByArchive(): Promise<ContentResult<readonly ArchiveGroup[]>>`
  - `listFeaturedContent(): Promise<ContentResult<readonly FeaturedContent[]>>`

- [ ] **Step 1: Write failing gateway tests**

Mock `requestContent` and static query functions. Cover:

- API success returns `source: 'api'`;
- network failure returns static data with `source: 'fallback'`;
- malformed API data returns fallback;
- `listPosts({ q })` sends `q` to `/content/posts`;
- category/tag post routes call `/content/categories/:slug/posts` and `/content/tags/:slug/posts` when those filters are present;
- empty search preserves existing static search-start behavior.

Run: `corepack pnpm --filter @namdw/web test -- contentGateway.test.ts`  
Expected: FAIL because `contentGateway.ts` does not exist.

- [ ] **Step 2: Implement gateway**

Keep all raw fetch calls inside `apiClient.ts`. Convert every API failure into fallback data. Preserve current static ordering, pagination, invalid page normalization, and not-found semantics when fallback is used.

- [ ] **Step 3: Verify**

Run:

```bash
corepack pnpm --filter @namdw/web test -- contentGateway.test.ts
corepack pnpm --filter @namdw/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/content/contentGateway.ts apps/web/src/content/contentGateway.test.ts
git commit -m "feat: add api-first content gateway"
```

---

### Task 3: Async Page Migration

**Files:**
- Create: `apps/web/src/content/useContentQuery.ts`
- Create: `apps/web/src/components/content/FallbackNotice.tsx`
- Modify: `apps/web/src/pages/HomePage.tsx`
- Modify: `apps/web/src/components/home/FeaturedContent.tsx`
- Modify: `apps/web/src/pages/posts/PostsPage.tsx`
- Modify: `apps/web/src/pages/posts/PostDetailPage.tsx`
- Modify: `apps/web/src/pages/posts/CategoryIndexPage.tsx`
- Modify: `apps/web/src/pages/posts/CategoryPostsPage.tsx`
- Modify: `apps/web/src/pages/posts/TagIndexPage.tsx`
- Modify: `apps/web/src/pages/posts/TagPostsPage.tsx`
- Modify: `apps/web/src/pages/posts/ArchivesPage.tsx`
- Modify: `apps/web/src/pages/posts/SearchPage.tsx`
- Modify: `apps/web/src/pages/ProjectsPage.tsx`
- Modify: `apps/web/src/pages/ProjectDetailPage.tsx`
- Test: update existing page tests under `apps/web/src/pages/**/*.test.tsx`

**Interfaces:**
- Consumes: async gateway from Task 2
- Produces: `useContentQuery<T>(load: () => Promise<ContentResult<T>>, deps: readonly unknown[]): { state: 'loading' | 'ready'; result?: ContentResult<T> }`
- Produces: `FallbackNotice({ error }: { error?: ContentSourceError })`

- [ ] **Step 1: Write failing hook tests**

Test loading state, ready state, dependency reload, and ignoring stale promise results after dependency changes.

Run: `corepack pnpm --filter @namdw/web test -- useContentQuery.test.tsx`  
Expected: FAIL because hook does not exist.

- [ ] **Step 2: Implement hook and fallback notice**

Use `useEffect`, `useMemo` or stable callbacks in pages, and a cancellation flag. `FallbackNotice` should be visually restrained and accessible with `role="status"`.

- [ ] **Step 3: Migrate list/index pages**

Update list-style pages to render loading, ready API data, fallback notice, empty states, and pagination. Keep route URLs and query parsing unchanged.

- [ ] **Step 4: Migrate detail pages**

Update post/project detail pages to load by slug. Keep document metadata accurate for loading, found, and not-found states. Preserve Markdown renderer and article navigation behavior; use API `relatedPosts` when present and static neighbors when fallback needs them.

- [ ] **Step 5: Migrate homepage featured content**

Load featured content from the gateway and preserve the existing hero/about layout. If API has no explicit featured marker, derive a small featured set from latest posts and selected/static fallback.

- [ ] **Step 6: Update page tests**

Use mocked gateway responses for API success and fallback. Preserve existing route recovery, metadata, Markdown safety, pagination, and accessibility expectations.

- [ ] **Step 7: Verify**

Run:

```bash
corepack pnpm --filter @namdw/web test
corepack pnpm --filter @namdw/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat: load public pages from content gateway"
```

---

### Task 4: Smoke, Docs, and Final Quality Gate

**Files:**
- Modify: `README.md`
- Modify: `scripts/smoke.test.mjs` if needed
- Modify: `scripts/smoke.mjs` if needed

**Interfaces:**
- Consumes: frontend fallback behavior from Task 3
- Produces: documented local behavior for API-backed and fallback frontend modes

- [ ] **Step 1: Add smoke/fallback test coverage if current smoke does not pin it**

If smoke helpers can mock API unavailability, add a test proving the frontend can still render with fallback. If current smoke helpers are process-level only, document the fallback test coverage in web tests and leave smoke unchanged.

- [ ] **Step 2: Update README**

Document:

- API-backed mode requires `docker compose up -d postgres`, Prisma migrate, and seed;
- fallback mode works when the API/database is unavailable;
- `VITE_API_BASE_URL` defaults to `/api/v1`.

- [ ] **Step 3: Run full available verification**

Run:

```bash
export HOME=/tmp
export XDG_CACHE_HOME=/tmp/.cache
export COREPACK_HOME=/tmp/corepack
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm smoke
git diff --check
git status --short --branch
```

Expected: all non-DB commands exit 0. If `pnpm smoke` requires a live seeded PostgreSQL database in this environment, record the exact blocker and verify fallback behavior through web tests.

- [ ] **Step 4: Commit**

```bash
git add README.md scripts apps/web/src
git commit -m "docs: document frontend api fallback mode"
```

If scripts did not need changes, omit `scripts` from `git add`.

---

## Self-Review

- Spec coverage: API client and envelope failures are Task 1; DTO normalization is Task 1; API-first/static fallback gateway is Task 2; async page loading, fallback notices, not-found behavior, metadata, Markdown preservation, and route behavior are Task 3; smoke/docs/quality gate are Task 4.
- Placeholder scan: no placeholder markers are intentionally left.
- Type consistency: `ContentResult`, `ContentSourceError`, gateway function names, and page hook names are consistent across tasks.
