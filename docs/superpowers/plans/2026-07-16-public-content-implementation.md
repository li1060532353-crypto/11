# Public Content and Reading Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the complete static public-content experience to the React visitor site: all public routes, typed article/project content, discovery controls, and a safe Markdown reading interface.

**Architecture:** React Router 7 owns public navigation while a typed content/query boundary owns static data, filtering, pagination, archive grouping, and search. Presentational pages consume query results and reuse the Module 2 shell; article rendering is isolated behind a safe Markdown adapter so a future API source can replace the repository without changing page contracts.

**Tech Stack:** React 19.2.7, React Router DOM 7.18.1, TypeScript 5.9.3, Vite 8.1.4, Vitest 4.1.10, Testing Library 16.3.2, react-markdown 10.1.0, remark-gfm 4.0.1, remark-math 6.0.0, rehype-katex 7.0.1, rehype-highlight 7.0.2, highlight.js 11.11.1, KaTeX 0.17.0, CSS custom properties

## Global Constraints

- Keep this module frontend-presentational: no NestJS public content endpoints, Prisma, PostgreSQL, admin UI, authentication, reader accounts, comments, likes, or CMS workflow.
- Use the existing React/Vite app and Module 2 shell, preserving the `data-app="personal-blog"` production marker.
- Implement the public routes `/`, `/posts`, `/posts/:slug`, `/categories`, `/categories/:slug`, `/tags`, `/tags/:slug`, `/archives`, `/projects`, `/about`, `/search`, and a wildcard 404.
- Store approximately six Chinese engineering articles and three projects under `apps/web/src/content/`, with strict TypeScript types and one shared source for homepage cards and public pages.
- Keep the approved palette and responsive minimum viewport: fog white `#F5F5F7`, ink `#1D1D1F`, interaction blue `#0071E3`, and 320px minimum width.
- Treat route/query input as untrusted: invalid slugs render not-found, invalid pages normalize, and unknown filters never crash the page.
- Search title, summary, and Markdown body; preserve filter, search, and page state in URL query parameters.
- Render GFM Markdown, fenced code, and KaTeX; disable raw HTML and preserve accessible semantic headings, links, lists, tables, and code blocks.
- Respect `prefers-reduced-motion`, restore scroll position to the top on route changes, and expose current navigation with `aria-current="page"`.
- Update document title and description per route; use article SEO fields when present and title/summary as fallback. Sitemap, robots, canonical URLs, and social-image generation are out of scope.
- Every task uses TDD: write a focused failing test, run it to verify the intended failure, implement the smallest change, run the focused test and affected suite, then commit.
- Verification commands use `HOME=/tmp XDG_CACHE_HOME=/tmp/.cache COREPACK_HOME=/tmp/corepack` and `corepack pnpm` because the repository enforces pnpm 11.13.0 and supply-chain checks.

---

## Planned File Map

```text
apps/web/
├── package.json                         # Router and Markdown dependencies
├── src/
│   ├── App.tsx                          # Router entry and shared shell
│   ├── App.test.tsx                     # Public route semantic contract
│   ├── router.tsx                       # BrowserRouter, route table, scroll reset
│   ├── content/
│   │   ├── types.ts                      # Post, project, taxonomy, pagination types
│   │   ├── posts.ts                       # Six Chinese engineering articles
│   │   ├── projects.ts                    # Three project records
│   │   ├── site.ts                        # About and site identity data
│   │   ├── homeContent.ts                 # Shared featured projections
│   │   ├── contentQueries.ts              # Query boundary and archive/search logic
│   │   └── contentQueries.test.ts         # Query behavior contract
│   ├── components/
│   │   ├── content/                       # PostCard, metadata, filters, pagination
│   │   ├── reading/                       # Markdown, TOC, progress, reading styles
│   │   └── ui/                            # EmptyState and route-level primitives
│   ├── pages/
│   │   ├── posts/                         # List, detail, category/tag/archive/search
│   │   ├── ProjectsPage.tsx
│   │   ├── AboutPage.tsx
│   │   ├── NotFoundPage.tsx
│   │   └── RouteStub.tsx                  # Removed as real pages land
│   ├── hooks/
│   │   ├── useDocumentMeta.ts
│   │   └── useScrollToTop.ts
│   └── styles/
│       ├── content.css                    # Discovery cards, filters, pagination
│       ├── reading.css                    # Article typography, code, math, TOC
│       └── index.css                      # Import content and reading layers
```

### Task 1: Add router and Markdown dependencies with a tested route foundation

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Create: `apps/web/src/router.tsx`
- Create: `apps/web/src/pages/RouteStub.tsx`
- Create: `apps/web/src/pages/NotFoundPage.tsx`
- Create: `apps/web/src/hooks/useScrollToTop.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Module 2 `SiteHeader`, `SiteFooter`, skip-link styles, and `HomePage`.
- Produces: `AppRoutes`, the public route table, `RouteStub`, `NotFoundPage`, and a scroll-reset hook for later page implementations.

- [ ] **Step 1: Add exact dependencies**

Add these runtime dependencies to `apps/web/package.json`:

```json
{
  "react-router-dom": "7.18.1",
  "react-markdown": "10.1.0",
  "remark-gfm": "4.0.1",
  "remark-math": "6.0.0",
  "rehype-katex": "7.0.1",
  "rehype-highlight": "7.0.2",
  "highlight.js": "11.11.1",
  "katex": "0.17.0"
}
```

Run `corepack pnpm install` and confirm the policy hook accepts the lockfile before writing application code.

- [ ] **Step 2: Write the failing route contract**

Extend `apps/web/src/App.test.tsx` with a test that renders `App` under `MemoryRouter` and expects `/posts`, `/categories`, `/tags`, `/archives`, `/projects`, `/about`, and `/search` to expose their route labels, while `/missing` exposes the 404 heading. Add `cleanup` to the Testing Library imports. The test should initially fail because the route table does not exist.

```tsx
const routeLabels: Record<string, string> = {
  '/posts': '文章',
  '/categories': '分类',
  '/tags': '标签',
  '/archives': '归档',
  '/projects': '项目',
  '/about': '关于',
  '/search': '搜索',
};

it('exposes every public route and a wildcard not-found page', () => {
  const paths = ['/posts', '/categories', '/tags', '/archives', '/projects', '/about', '/search'];
  for (const path of paths) {
    render(<App initialPath={path} />);
    expect(screen.getByRole('main')).toHaveTextContent(routeLabels[path]);
    cleanup();
  }
  render(<App initialPath="/missing" />);
  expect(screen.getByRole('heading', { name: '页面不存在' })).toBeInTheDocument();
});
```

Add a test-only `initialPath?: string` prop to `App` so browser startup still uses the real URL while tests can use `MemoryRouter`.

- [ ] **Step 3: Verify the test fails for the missing router**

Run:

```bash
HOME=/tmp XDG_CACHE_HOME=/tmp/.cache COREPACK_HOME=/tmp/corepack corepack pnpm --filter @namdw/web test -- App.test.tsx
```

Expected: FAIL because the new public route labels and `App` test path prop are not implemented.

- [ ] **Step 4: Implement the route table and shell**

Create `apps/web/src/router.tsx` with the following route contract:

```tsx
export const publicRoutes = [
  { path: '/', element: <HomePage /> },
  { path: '/posts', element: <RouteStub title="文章" /> },
  { path: '/posts/:slug', element: <RouteStub title="文章详情" /> },
  { path: '/categories', element: <RouteStub title="分类" /> },
  { path: '/categories/:slug', element: <RouteStub title="分类文章" /> },
  { path: '/tags', element: <RouteStub title="标签" /> },
  { path: '/tags/:slug', element: <RouteStub title="标签文章" /> },
  { path: '/archives', element: <RouteStub title="归档" /> },
  { path: '/projects', element: <RouteStub title="项目" /> },
  { path: '/about', element: <RouteStub title="关于" /> },
  { path: '/search', element: <RouteStub title="搜索" /> },
  { path: '*', element: <NotFoundPage /> },
] as const;
```

Use `BrowserRouter` for production and `MemoryRouter` when `initialPath` is provided. Keep the existing skip link, header, main landmark, and footer in one `RouteShell` so all pages share the same accessible structure. `useScrollToTop` calls `window.scrollTo({ top: 0, behavior: 'auto' })` on `useLocation().pathname` changes.

- [ ] **Step 5: Run focused tests and commit**

Run the focused web tests, typecheck, and format check:

```bash
corepack pnpm --filter @namdw/web test -- App.test.tsx
corepack pnpm --filter @namdw/web typecheck
corepack pnpm format:check
```

Expected: route contract passes and the existing Module 2 semantic tests remain green. Commit as `feat: add public route foundation`.

### Task 2: Build the typed static content repository and query boundary

**Files:**
- Create: `apps/web/src/content/types.ts`
- Create: `apps/web/src/content/posts.ts`
- Create: `apps/web/src/content/projects.ts`
- Create: `apps/web/src/content/site.ts`
- Modify: `apps/web/src/content/homeContent.ts`
- Create: `apps/web/src/content/contentQueries.ts`
- Create: `apps/web/src/content/contentQueries.test.ts`

**Interfaces:**
- Consumes: existing homepage featured item shape and route foundation.
- Produces: strict content records and these functions:

```ts
type PostListOptions = {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
  year?: number;
  month?: number;
};

type Paginated<T> = {
  items: readonly T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export function listPosts(options?: PostListOptions): Paginated<PostSummary>;
export function getPostBySlug(slug: string): Post | undefined;
export function listCategories(): readonly Category[];
export function listTags(): readonly Tag[];
export function listProjects(): readonly Project[];
export function searchPosts(query: string, options?: PostListOptions): Paginated<PostSummary>;
export function groupPostsByArchive(): readonly ArchiveGroup[];
```

- [ ] **Step 1: Write query tests first**

Create tests covering stable newest-first ordering, page normalization, category/tag/year/month filters, exact slug lookup, archive grouping, and case-insensitive search across title, summary, and body.

```ts
it('normalizes an invalid page and returns bounded metadata', () => {
  const result = listPosts({ page: 999, pageSize: 2 });
  expect(result.page).toBe(result.totalPages);
  expect(result.items).toHaveLength(2);
});

it('searches title, summary, and markdown body case-insensitively', () => {
  expect(searchPosts('RFID').totalItems).toBeGreaterThan(0);
  expect(searchPosts('nonexistent-term').totalItems).toBe(0);
});
```

- [ ] **Step 2: Run the query tests and verify RED**

Run `corepack pnpm --filter @namdw/web test -- contentQueries.test.ts`. Expected: FAIL because the types, records, and query functions do not exist.

- [ ] **Step 3: Define types and dataset**

Use strict types with these required records:

| Kind | Required slugs/titles |
| --- | --- |
| Posts | `discrete-convolution`, `matrix-rank`, `smart-cold-chain-iotda`, `stm32-esp01s`, `rsa-in-practice`, `signal-period-analysis` |
| Projects | `smart-cold-chain`, `embedded-observability`, `personal-blog` |

Each post must include `slug`, `title`, `summary`, `body`, `category`, `tags`, ISO `publishedAt`, integer `readingTime`, `selected`, `cover`, and optional `seoTitle`/`seoDescription`. Each project must include `slug`, `name`, `summary`, `body`, `technologies`, `selected`, and optional `sourceUrl`/`demoUrl`.

Use Chinese titles and summaries centered on electronic information, embedded systems, signals, linear algebra, cryptography, and software engineering. Bodies must contain at least one heading, one paragraph, one fenced code example or formula where relevant, and valid Markdown.

- [ ] **Step 4: Implement query functions and shared homepage projections**

Filter records before pagination, sort by `publishedAt` descending, clamp `page` to `1..totalPages` (with an empty result using page `1`), and use `pageSize` default `6` with a maximum of `12`. Normalize query strings with lowercase trimming. `searchPosts` searches `title`, `summary`, and `body`.

Replace the duplicate `featuredContent` literals with projections from selected posts/projects while preserving the current `/posts/...` and `/projects/...` links.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
corepack pnpm --filter @namdw/web test -- contentQueries.test.ts
corepack pnpm --filter @namdw/web typecheck
corepack pnpm --filter @namdw/web build
```

Expected: query tests and the existing homepage tests pass. Commit as `feat: add typed static content repository`.

### Task 3: Replace route stubs with shared page metadata and URL utilities

**Files:**
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/pages/RouteStub.tsx`
- Create: `apps/web/src/hooks/useDocumentMeta.ts`
- Create: `apps/web/src/hooks/useDocumentMeta.test.tsx`
- Create: `apps/web/src/pages/PageIntro.tsx`
- Create: `apps/web/src/pages/NotFoundPage.test.tsx`
- Create: `apps/web/src/content/queryParams.ts`
- Create: `apps/web/src/content/queryParams.test.ts`

**Interfaces:**
- Consumes: Task 1 `AppRoutes` and Task 2 content types/query boundary.
- Produces: metadata hook and URL query helpers:

```ts
export type PostQuery = {
  page: number;
  category?: string;
  tag?: string;
  year?: number;
  month?: number;
  q?: string;
};

export function parsePostQuery(search: string): PostQuery;
export function buildPostQuery(query: PostQuery): string;
export function useDocumentMeta(meta: { title: string; description: string }): void;
```

- [ ] **Step 1: Write failing query and metadata tests**

Test that `parsePostQuery('?page=abc&category=Signals&year=2025')` returns `{ page: 1, category: 'signals', year: 2025 }`, `buildPostQuery` omits defaults, and rendering a test component updates `document.title` and the description meta tag.

- [ ] **Step 2: Run focused tests and verify RED**

Run `corepack pnpm --filter @namdw/web test -- queryParams.test.ts useDocumentMeta.test.tsx`. Expected: FAIL because helpers and hook are absent.

- [ ] **Step 3: Implement utilities and route page shell**

Use `URLSearchParams`, lowercase taxonomy values, positive integer page parsing, and `history.replaceState` only through React Router navigation in page components. `useDocumentMeta` sets `document.title` and creates or updates `meta[name="description"]` in an effect.

`PageIntro` must render one `h1`, an optional eyebrow, description, and an optional right-side action using the existing `Container` and shell classes.

- [ ] **Step 4: Replace stubs that are not yet implemented with typed page placeholders**

The placeholders must use `PageIntro` and route-specific metadata so every public route has meaningful structure while Tasks 4–6 fill the page bodies. Keep the wildcard page as the real `NotFoundPage`.

- [ ] **Step 5: Verify and commit**

Run the focused tests, all web tests, typecheck, and format check. Commit as `feat: add public page metadata contracts`.

### Task 4: Implement article discovery, filtering, pagination, and search pages

**Files:**
- Create: `apps/web/src/components/content/PostMeta.tsx`
- Create: `apps/web/src/components/content/PostCard.tsx`
- Create: `apps/web/src/components/content/FilterBar.tsx`
- Create: `apps/web/src/components/content/Pagination.tsx`
- Create: `apps/web/src/components/ui/EmptyState.tsx`
- Create: `apps/web/src/pages/posts/PostsPage.tsx`
- Create: `apps/web/src/pages/posts/CategoryIndexPage.tsx`
- Create: `apps/web/src/pages/posts/CategoryPostsPage.tsx`
- Create: `apps/web/src/pages/posts/TagIndexPage.tsx`
- Create: `apps/web/src/pages/posts/TagPostsPage.tsx`
- Create: `apps/web/src/pages/posts/ArchivesPage.tsx`
- Create: `apps/web/src/pages/posts/SearchPage.tsx`
- Create: `apps/web/src/pages/posts/DiscoveryPages.test.tsx`
- Create: `apps/web/src/styles/content.css`
- Modify: `apps/web/src/styles/index.css`
- Modify: `apps/web/src/router.tsx`

**Interfaces:**
- Consumes: `PostSummary`, `Paginated`, `parsePostQuery`, `buildPostQuery`, `listPosts`, `searchPosts`, taxonomy queries, `PageIntro`, and Module 2 shell.
- Produces: accessible discovery pages and reusable cards/filter/pagination components.

- [ ] **Step 1: Write discovery-page tests first**

Cover article cards, category/tag links, page navigation query strings, search query persistence, archive groups, empty states, and `aria-current` on the active global navigation.

```tsx
it('keeps search and page state in the URL', async () => {
  renderAt('/search?q=RFID&page=1');
  expect(screen.getByRole('searchbox')).toHaveValue('RFID');
  await user.click(screen.getByRole('link', { name: '下一页' }));
  expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute('href', '/search?q=RFID&page=2');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `corepack pnpm --filter @namdw/web test -- DiscoveryPages.test.tsx`. Expected: FAIL because discovery components and real route pages do not exist.

- [ ] **Step 3: Implement shared content components**

`PostCard` exposes an article link with title, summary, date, reading time, category, and tags. `FilterBar` uses labelled native `select` controls and a clear link. `Pagination` renders only valid previous/next links, preserves all existing query parameters, and marks the current page with `aria-current="page"`. `EmptyState` includes a recovery link.

- [ ] **Step 4: Implement pages and URL synchronization**

Each page reads `useSearchParams`, calls the query boundary, and updates only its own query keys. `/categories/:slug` and `/tags/:slug` show a not-found state for unknown taxonomy values. `/archives` links to `/posts?year=YYYY&month=MM`. `/search` uses a labelled `role="search"` form and searches title, summary, and body.

- [ ] **Step 5: Add responsive content styles and verify**

Use the existing `--space-page`, `--content-max`, `--radius-card`, and accent tokens. At widths below `47.99rem`, stack filters and make cards single-column; pagination remains keyboard reachable without horizontal clipping.

Run focused discovery tests, all web tests, typecheck, build, and format check. Commit as `feat: add public discovery pages`.

### Task 5: Implement projects, about, and complete not-found states

**Files:**
- Create: `apps/web/src/pages/ProjectsPage.tsx`
- Create: `apps/web/src/pages/AboutPage.tsx`
- Create: `apps/web/src/pages/PortfolioPages.test.tsx`
- Modify: `apps/web/src/pages/NotFoundPage.tsx`
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/styles/content.css`

**Interfaces:**
- Consumes: `listProjects`, site content, `PageIntro`, `PostCard` styling, and Task 3 metadata hook.
- Produces: `/projects`, `/about`, and wildcard/slug-specific recovery states.

- [ ] **Step 1: Write failing portfolio tests**

Assert three project names, technology labels, optional links with safe `rel="noreferrer"` behavior, about contact links, and a 404 recovery link to `/posts`.

- [ ] **Step 2: Run focused tests and verify RED**

Run `corepack pnpm --filter @namdw/web test -- PortfolioPages.test.tsx`. Expected: FAIL because the real project/about pages are not present.

- [ ] **Step 3: Implement project and about pages**

Projects use selected and all project records from the same repository. External links render only when a URL is present and use `target="_blank" rel="noreferrer"` with an accessible label. About content uses semantic sections for introduction, focus areas, and contact links.

- [ ] **Step 4: Implement not-found variants and verify**

Use one `NotFoundPage` with a `resource` prop for missing article/category/tag/project records. Set a dedicated title and description, and provide links to `/`, `/posts`, and the relevant index when available.

- [ ] **Step 5: Run tests and commit**

Run all web tests, typecheck, build, and format check. Commit as `feat: add portfolio and about pages`.

### Task 6: Build the safe Markdown article reader

**Files:**
- Create: `apps/web/src/components/reading/MarkdownRenderer.tsx`
- Create: `apps/web/src/components/reading/MarkdownRenderer.test.tsx`
- Create: `apps/web/src/components/reading/TableOfContents.tsx`
- Create: `apps/web/src/components/reading/TableOfContents.test.tsx`
- Create: `apps/web/src/components/reading/ReadingProgress.tsx`
- Create: `apps/web/src/components/reading/ReadingProgress.test.tsx`
- Create: `apps/web/src/pages/posts/PostDetailPage.tsx`
- Create: `apps/web/src/pages/posts/PostDetailPage.test.tsx`
- Create: `apps/web/src/styles/reading.css`
- Modify: `apps/web/src/styles/index.css`
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/styles/motion.css`

**Interfaces:**
- Consumes: `getPostBySlug`, `Post`, `useDocumentMeta`, `NotFoundPage`, and Task 1 Markdown dependencies.
- Produces: safe Markdown rendering, heading extraction, article detail route, collapsible TOC, and progress indicator.

- [ ] **Step 1: Write failing reader tests**

Test that a Markdown body renders headings, GFM table, fenced code, inline math, and a link; raw `<script>` or arbitrary HTML is not rendered as an element. Test that heading extraction creates stable IDs and TOC links, and that the progress component exposes a labelled `progressbar`.

```tsx
it('does not render raw HTML from article Markdown', () => {
  render(<MarkdownRenderer source={'# 标题\n<script>alert(1)</script>'} />);
  expect(screen.getByRole('heading', { name: '标题' })).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run `corepack pnpm --filter @namdw/web test -- MarkdownRenderer.test.tsx TableOfContents.test.tsx ReadingProgress.test.tsx PostDetailPage.test.tsx`. Expected: FAIL because reader components and route are absent.

- [ ] **Step 3: Implement `MarkdownRenderer` with safe plugins**

Use `react-markdown` with `remarkPlugins={[remarkGfm, remarkMath]}` and `rehypePlugins={[rehypeKatex, rehypeHighlight]}`. Do not pass `rehypeRaw`. Add a link transformer that preserves relative routes and marks external links with `rel="noreferrer"`. Import KaTeX CSS through `reading.css`.

- [ ] **Step 4: Implement heading extraction, TOC, and progress**

Extract only `h2` and `h3` headings from the article source, slugify them deterministically, and pass matching IDs to Markdown heading components. `TableOfContents` is a labelled `<nav>`; on mobile it uses a native `<details>` element. `ReadingProgress` observes the article element with scroll/resize listeners, clamps the percentage to `0..100`, and renders a labelled `role="progressbar"` with `aria-valuenow`.

- [ ] **Step 5: Implement `PostDetailPage`**

Read `slug` from `useParams`, return resource not-found for missing posts, update article metadata, render cover/meta/summary/TOC/reader/progress, and provide previous/next article links based on the stable query ordering. The article region must have `id="article-content"` and `tabIndex={-1}` for navigation.

- [ ] **Step 6: Add responsive reader styles and verify**

Use `--reading-max`, serif body typography, readable code overflow, visible heading focus targets, and narrow-screen spacing. Add `@media (prefers-reduced-motion: reduce)` behavior for progress transitions and anchor scrolling.

Run focused reader tests, all web tests, typecheck, build, and format check. Commit as `feat: add safe article reader`.

### Task 7: Integrate metadata, accessibility contracts, documentation, and final quality gate

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/components/home/FeaturedContent.tsx`
- Modify: `apps/web/src/styles/visual-contract.test.ts`
- Modify: `README.md`
- Modify: `apps/web/index.html`

**Interfaces:**
- Consumes: all public routes, content/query boundary, discovery pages, portfolio pages, and reader.
- Produces: final cross-page semantic contract, module documentation, and a clean production-ready main branch.

- [ ] **Step 1: Add integration regression tests**

Assert that the homepage cards use the content repository, every route has exactly one main landmark and one page heading, current navigation gets `aria-current`, route metadata changes, the 320px styles contain no fixed-width overflow, and reduced-motion rules remain present.

- [ ] **Step 2: Run integration tests RED where contracts are missing**

Run `corepack pnpm --filter @namdw/web test -- App.test.tsx visual-contract.test.ts`. Record the intended failures before changing the missing bindings.

- [ ] **Step 3: Implement final bindings and documentation**

Update `FeaturedContent` to consume the shared projections if any stale literals remain. Add any necessary CSS contracts without changing the approved palette. Update `README.md` with:

```md
- Module 3: React Router public pages, typed static articles/projects, discovery filters, search, and safe Markdown reading experience
```

Keep `apps/web/index.html`'s `data-app="personal-blog"` marker intact.

- [ ] **Step 4: Run the complete quality gate**

```bash
set -e
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

Expected: frozen install passes supply-chain policy; all tests, lint, format, typecheck, build, and production smoke exit 0; ports 3100 and 4173 are released after smoke.

- [ ] **Step 5: Commit and hand off**

Commit documentation and final integration changes as `docs: complete public content module`, then use `superpowers:requesting-code-review`, `superpowers:verification-before-completion`, and `superpowers:finishing-a-development-branch` before claiming completion.
