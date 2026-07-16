# Frontend API Content Integration Design

Date: 2026-07-16  
Status: Approved for implementation planning

## 1. Goal and scope

Module 5 connects the public React frontend to the Module 4 content API. Public pages prefer `/api/v1/content/*` data and fall back to the existing static content repository when the API is unavailable, returns an error, or local development has no running database.

This module changes data loading behavior, not the visual language. The Module 3 routes, page layouts, Markdown reader, responsive styles, document metadata, and accessibility expectations remain in place.

## 2. Data source strategy

The frontend uses a small content gateway:

1. Try the API through a typed fetch client.
2. Normalize API DTOs into the existing frontend content shapes.
3. If the request fails, times out, returns a non-success envelope, or returns invalid data, read from the current static query functions.
4. Surface a non-blocking fallback marker to page code so pages can show a restrained unavailable-data notice when useful.

The static content files remain in the repository and are treated as a development/offline fallback, not as duplicate primary data. Existing static query behavior remains the source of truth for fallback ordering, pagination, search, and route recovery.

## 3. API client contract

The web app reads `VITE_API_BASE_URL`, defaulting to `/api/v1`, and calls:

| Frontend need | API endpoint |
| --- | --- |
| Posts list and filters | `GET /content/posts` |
| Post detail | `GET /content/posts/:slug` |
| Categories | `GET /content/categories` |
| Category posts | `GET /content/categories/:slug/posts` |
| Tags | `GET /content/tags` |
| Tag posts | `GET /content/tags/:slug/posts` |
| Archives | `GET /content/archives` |
| Projects | `GET /content/projects` |
| Project detail | `GET /content/projects/:slug` |
| Search | `GET /content/search` |
| Homepage featured content | derived from API posts/projects, falling back to static featured content |

The client accepts the existing shared success envelope. It must not throw raw fetch errors into React rendering. Network errors, aborts, non-2xx responses, malformed envelopes, and unknown API shapes become typed content-source failures.

## 4. Frontend query boundary

Page code should not call raw `fetch`. It consumes asynchronous query functions that mirror the existing query boundary:

```ts
listPosts(options): Promise<ContentResult<Paginated<PostSummary>>>
getPostBySlug(slug): Promise<ContentResult<Post | undefined>>
listCategories(): Promise<ContentResult<Category[]>>
listTags(): Promise<ContentResult<Tag[]>>
listProjects(): Promise<ContentResult<Project[]>>
getProjectBySlug(slug): Promise<ContentResult<Project | undefined>>
searchPosts(query, options): Promise<ContentResult<Paginated<PostSummary>>>
groupPostsByArchive(): Promise<ContentResult<ArchiveGroup[]>>
listFeaturedContent(): Promise<ContentResult<FeaturedContent[]>>
```

`ContentResult<T>` includes:

- `data`: normalized page-ready data;
- `source`: `api` or `fallback`;
- `error`: a short diagnostic value only when fallback was used because API loading failed.

The existing synchronous static query module remains available behind the fallback adapter. Page components migrate to async hooks or route-level loaders without changing route URLs.

## 5. Loading, empty, and fallback states

Pages show stable loading states that reuse the current visual system: compact skeleton rows or subdued status text, not a new visual theme.

If API data loads successfully, pages render normally. If fallback data is used, pages still render the full public experience. A small non-blocking notice can appear on list/detail pages, phrased as development/offline context rather than an alarming error.

Not-found behavior remains unchanged:

- unknown post/project/category/tag slugs render the existing not-found recovery states;
- unknown filters render empty successful lists;
- invalid page values normalize to safe bounds;
- search with an empty query returns the existing empty/search-start behavior.

## 6. Metadata and reading behavior

Document titles and descriptions continue to derive from normalized content. Article Markdown remains rendered only by the existing safe Markdown renderer. The API body is data, not trusted HTML. Table of contents, reading progress, related navigation, and reduced-motion behavior remain unchanged.

API post details may include `relatedPosts`; when absent or when fallback is active, the frontend can use the existing neighbor/related behavior from static content.

## 7. Testing and acceptance

Tests cover:

- API client success-envelope parsing and typed failure handling;
- fallback on network failure, non-2xx response, malformed envelope, and aborted request;
- DTO normalization for posts, post detail, categories with counts, tags with counts, archives, projects, and search;
- page rendering for API success and fallback paths;
- existing route recovery, query parameters, metadata, Markdown safety, and pagination behavior after async migration;
- smoke behavior when API is available and when the frontend is using fallback during local development.

Module 5 is accepted when public pages can render from the Module 4 API, still render without a running API/database, preserve Module 3 visual/accessibility behavior, and the repository quality gate remains green.

## 8. Explicit non-goals

- No admin dashboard or editor
- No authentication or authorization UI
- No React Query/SWR adoption unless a later module needs it
- No SSR, streaming, or server components
- No frontend redesign
- No content editing workflow
- No comments, likes, analytics, or reader accounts
