# Public Content and Reading Experience Design

Date: 2026-07-16  
Status: Approved for implementation planning

## 1. Goal and scope

Module 3 turns the Module 2 visual shell into a complete static public-content experience. It adds React Router, a typed in-repository content source, all public visitor routes, article discovery, and a full article reading experience.

The module remains frontend-presentational. It does not add PostgreSQL, Prisma, API fetching, administrator pages, authentication, or reader accounts. A later API module can replace the content query implementation without changing page-level contracts.

## 2. Public routes

The application exposes these visitor routes:

| Route | Responsibility |
| --- | --- |
| `/` | Existing homepage, backed by the shared static content source |
| `/posts` | Paginated article list with category, tag, and archive filters |
| `/posts/:slug` | Article detail and reading experience |
| `/categories` | Category index |
| `/categories/:slug` | Articles in one category |
| `/tags` | Tag index |
| `/tags/:slug` | Articles carrying one tag |
| `/archives` | Articles grouped by publication year and month |
| `/projects` | Project portfolio |
| `/about` | Personal introduction and contact links |
| `/search` | Full-text search over static article fields |
| `*` | Accessible not-found page with recovery links |

Route parameters and query parameters are treated as untrusted input. Invalid slugs render a not-found state; invalid page values are normalized to a valid page; unknown filters produce an empty state without crashing.

## 3. Content model and query boundary

Static content lives under `apps/web/src/content/` and is represented by strict TypeScript types. The initial dataset contains approximately six Chinese engineering articles and three projects, covering electronic information, embedded systems, and software development.

The page layer consumes a small query boundary rather than raw arrays:

```ts
listPosts(options): Paginated<PostSummary>
getPostBySlug(slug): Post | undefined
listCategories(): Category[]
listTags(): Tag[]
listProjects(): Project[]
searchPosts(query, options): Paginated<PostSummary>
groupPostsByArchive(): ArchiveGroup[]
```

The query boundary owns filtering, stable sorting, pagination, archive grouping, and search matching. Search covers title, summary, and Markdown body. Query state is reflected in the URL so refresh, back/forward navigation, and shareable filtered views work consistently.

The homepage's featured cards consume the same content source to prevent duplicate article and project definitions.

## 4. Page and component structure

All pages reuse the Module 2 header, footer, container, tokens, motion policy, and responsive layout. New focused components include:

- `PostCard` and `PostMeta` for consistent article summaries
- `FilterBar` for category, tag, archive, and search controls
- `Pagination` for bounded URL-based navigation
- `MarkdownRenderer` for safe Markdown output
- `TableOfContents` for heading navigation
- `ReadingProgress` for article progress feedback
- `EmptyState` for no-result and recovery states

The article page uses a narrow reading column, cover visual, publication metadata, summary, generated table of contents, Markdown body, and related navigation. The mobile table of contents is collapsible so it does not compete with the reading column.

## 5. Markdown reading experience

Article bodies support Markdown with GitHub-flavored features, fenced code blocks with syntax highlighting, and KaTeX mathematical formulas. Raw HTML is disabled or sanitized; static content must not create an XSS path when the source is later replaced by API content.

The renderer produces semantic headings, lists, links, blockquotes, tables, code blocks, and mathematical content. Heading IDs are stable so the table of contents can link into the article. Code blocks use horizontal scrolling on narrow screens and preserve readable contrast.

Reading progress is derived from the article reading region and updates without causing layout shifts. All non-essential motion and smooth scrolling respect `prefers-reduced-motion: reduce`.

## 6. States, accessibility, and SEO

State behavior:

- nonexistent article, category, tag, or project renders a clear not-found state;
- empty filters and searches render an explanation plus a reset action;
- route changes restore the viewport to the page top;
- navigation exposes the current route with `aria-current="page"`;
- controls, pagination, table of contents, and progress indicators have useful accessible names;
- heading levels remain ordered and all interactive elements are keyboard accessible.

Each route updates the document title and description. Article metadata uses the article SEO fields when present, otherwise the title and summary. A dedicated 404 title is used for unknown paths. Sitemap, robots, canonical URL generation, and social-image metadata remain deployment/SEO work for a later module.

## 7. Testing and acceptance

Tests cover:

- route rendering for every public route and the wildcard 404;
- query functions for sorting, filtering, pagination, archive grouping, and search;
- slug and invalid-parameter behavior;
- URL query-state restoration;
- safe Markdown rendering with raw HTML disabled;
- generated table-of-contents links and reading-progress behavior;
- keyboard navigation, accessible labels, current-route state, and mobile collapsible navigation;
- dynamic document metadata;
- production build and smoke verification.

Module 3 is accepted when all public routes render from the static repository, the complete reading experience works at the 320px minimum viewport, the documented accessibility and security rules hold, and the existing repository quality gate remains green.

## 8. Explicit non-goals

- No NestJS public content endpoints
- No Prisma schema or PostgreSQL setup
- No admin or authentication screens
- No reader accounts, comments, likes, or social feeds
- No CMS/editor workflow
- No deployment-specific sitemap or social-image generation
