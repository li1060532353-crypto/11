# Progressive Product Shell Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a content-first public blog and private knowledge workspace through a gradual visual-shell refactor without changing API contracts, data models, authentication behavior, or persistence semantics.

**Architecture:** The existing React application keeps its router, content gateway, API client, Cloudflare Pages Functions, and Tiptap persistence flow. Semantic CSS tokens and small reusable UI primitives underpin separate public, knowledge, and editor shells. Route aliases preserve the existing knowledge-note URLs while the visible product language becomes “articles”.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite, Vitest, Testing Library, CSS custom properties, Tiptap, Cloudflare Pages Functions, D1, private R2.

## Global Constraints

- Do not change frozen API paths, request/response envelopes, database schema, D1 migrations, R2 behavior, authentication protocol, Cloudflare Dashboard configuration, or editor persistence semantics.
- Preserve `VITE_API_BASE_URL`, static-content fallback, `data-app="personal-blog"`, `apps/web/public/_redirects`, and existing smoke checks.
- Keep the current `content_json` canonical-document model, autosave debounce/race protection, and explicit-version behavior.
- Do not introduce a large UI framework or replace React Router/state management.
- Preserve the unrelated untracked `docs/superpowers/plans/2026-07-17-local-api-docker-deployment-implementation.md` file.
- A need to alter Access routing, API/data contracts, or persistence behavior stops the active phase and requires user approval.
- Every phase ends with an acceptance checkpoint containing changed files, tests, screenshots at required viewports, incomplete items, and `git status --short`.

---

## Planned File Structure

| Area | Files | Responsibility |
| --- | --- | --- |
| Design foundation | `apps/web/src/styles/tokens.css`, `global.css`, `shell.css`, `motion.css`, `visual-contract.test.ts` | Theme tokens, global rules, focus/motion contracts, shared layout rules |
| Shared primitives | `apps/web/src/components/ui/*` | Low-level buttons, inputs, status, empty/loading and overlay primitives |
| Public experience | `components/layout/*`, `components/home/*`, `components/content/*`, `components/reading/*`, `pages/*`, public CSS/tests | Editorial navigation, homepage, discovery, reading, and recovery surfaces |
| Knowledge experience | `knowledge-ui/*`, `knowledge/*`, `router.tsx`, knowledge tests | Private navigation, overview, articles, compatibility aliases, media/settings presentation |
| Editor | `knowledge-ui/EditorPage.tsx`, `knowledge/KnowledgeEditorRoute.tsx`, `knowledge-editor/*`, editor tests | Focus shell, toolbar composition, drawer UI, unchanged autosave/version behavior |
| Verification | existing component tests, route tests, visual contract test, package scripts | Regression, route, build, bundle, and configuration evidence |

## Phase 1: Design Tokens and Shared Shell

**Files:**
- Modify: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/global.css`, `apps/web/src/styles/shell.css`, `apps/web/src/styles/motion.css`, `apps/web/src/styles/visual-contract.test.ts`
- Create: `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/ui/IconButton.tsx`, `apps/web/src/components/ui/Input.tsx`, `apps/web/src/components/ui/StatusBadge.tsx`, `apps/web/src/components/ui/EmptyState.tsx`, `apps/web/src/components/ui/Skeleton.tsx`, and focused tests beside each shared primitive

**Dependencies:** Existing CSS import order in `apps/web/src/styles/index.css`; existing `Container`; existing reduced-motion test contract.

**Risks:** Token replacement can change contrast, focus visibility, or existing layout dimensions. New primitives can become a second styling system if page migrations are not deliberate.

**Rollback:** Revert only the Phase 1 commit(s); no API, data, auth, or persisted content is affected.

- [ ] Add semantic light/dark token groups for background, surfaces, text, borders, accent, semantic states, spacing, radii, shadows, typography, z-index, and motion.
- [ ] Keep existing aliases temporarily so un-migrated pages render correctly; remove aliases only after all consumers are migrated.
- [ ] Implement small semantic primitives with native elements, accessible names, keyboard behavior, and `focus-visible` states; do not add a UI package.
- [ ] Update global shell rules for 320px minimum width, color-scheme support, reduced motion, skip link, and thin-border/high-whitespace visual language.
- [ ] Extend `visual-contract.test.ts` to assert required semantic tokens, light/dark contrast, reduced motion, and absence of prohibited large-gradient/heavy-shadow patterns in shared styles.
- [ ] Run `pnpm --filter @namdw/web test -- visual-contract.test.ts`, `pnpm --filter @namdw/web typecheck`, `pnpm lint`, and `pnpm --filter @namdw/web build`.
- [ ] Checkpoint: inspect `/` and an existing knowledge route at 1440px and 320px; record screenshots, changed files, test results, `git status --short`, and that no API/auth/persistence files changed.

## Phase 2: Public Blog Experience

**Files:**
- Modify: `apps/web/src/components/layout/SiteHeader.tsx`, `SiteFooter.tsx`, `components/home/Hero.tsx`, `FeaturedContent.tsx`, `AboutBand.tsx`, `components/content/PostCard.tsx`, `PostMeta.tsx`, `FilterBar.tsx`, `components/reading/MarkdownRenderer.tsx`, `TableOfContents.tsx`, `ReadingProgress.tsx`, `pages/HomePage.tsx`, `pages/PageIntro.tsx`, `pages/posts/*.tsx`, `pages/ProjectsPage.tsx`, `pages/AboutPage.tsx`, `apps/web/src/styles/home.css`, `content.css`, `reading.css`
- Create: focused public-shell, homepage, article-list, search, and reading interaction tests as needed

**Dependencies:** Phase 1 tokens/primitives; existing content gateway/query behavior and static fallback.

**Risks:** Public pages may accidentally look like uniform card grids, add prohibited dashboard content, or change URL-driven filters. Reader work can break safe Markdown or heading anchors.

**Rollback:** Revert Phase 2 commits; public data, routes, APIs, and Markdown source remain untouched.

- [ ] Convert the public header/footer to the restrained editorial shell and add a labeled `/knowledge` entry without changing its Access behavior.
- [ ] Recompose the homepage into hero, recent updates, curated learning/topics, selected projects, personal introduction, and footer; keep articles/ideas primary and search secondary.
- [ ] Preserve existing homepage content loaders while presenting lead/supporting editorial groupings instead of a dashboard or repeated card wall.
- [ ] Update discovery, category, tag, archive, and search pages to use accessible SearchInput/filter/list/empty/skeleton states while preserving query parameters and fallback notices.
- [ ] Refine article reading into a 720–760px body column with reading progress, responsive TOC, active-section treatment, copy-link/back-to-top affordances, previous/next navigation, and related-content presentation where existing data supports it.
- [ ] Keep `MarkdownRenderer` safe: raw HTML remains disabled; code, tables, math, headings, and external-link behavior retain existing contracts.
- [ ] Treat `MarkdownRenderer` changes as presentation-only: typography, spacing, visual wrappers, and responsive reading layout are allowed; parsing rules, sanitization behavior, generated content structure, and existing Markdown rendering semantics are forbidden.
- [ ] Run focused public tests: `pnpm --filter @namdw/web test -- SiteHeader.test.tsx DiscoveryPages.test.tsx PostDetailPage.test.tsx MarkdownRenderer.test.tsx TableOfContents.test.tsx ReadingProgress.test.tsx`.
- [ ] Run `pnpm --filter @namdw/web typecheck`, `pnpm lint`, and `pnpm --filter @namdw/web build`; smoke `/`, `/posts`, `/posts/:slug`, `/search`, `/projects`, and `/about` in built preview.
- [ ] Checkpoint: capture 1440px, 1024px, 390px, and 320px public screenshots; verify no dashboard statistics above the fold and no uncontrolled horizontal scrolling.

## Phase 3: Knowledge Workspace Shell

**Files:**
- Modify: `apps/web/src/router.tsx`, `apps/web/src/knowledge/KnowledgeDashboardRoute.tsx`, `KnowledgeNotesRoute.tsx`, `apps/web/src/knowledge-ui/DashboardPage.tsx`, `NotesPage.tsx`, `knowledge.css`, `KnowledgeShell.test.tsx`, and route recovery tests
- Create: `apps/web/src/knowledge-ui/KnowledgeShell.tsx`, `AdminSidebar.tsx`, `PageHeader.tsx`, `KnowledgeMobileNav.tsx`, `KnowledgeShell.test.tsx` additions

**Dependencies:** Phase 1 primitives; existing knowledge API client and Notes view models; current API-only Access middleware.

**Risks:** Rebranding notes as articles can leak into API calls; route migration can break existing bookmarks; an Access policy that protects an entire hostname cannot be changed in code without separate approval.

**Rollback:** Revert Phase 3 commits; legacy `/knowledge/notes*` routes remain available until the redirect tests pass.

- [ ] Add a desktop private shell with exactly Overview, Articles, Media, and Settings as first-level destinations; render a keyboard-accessible mobile drawer below 1024px.
- [ ] Register new visible routes for `/knowledge/articles`, `/knowledge/articles/new`, and `/knowledge/articles/:id/edit` using the existing route components and API client.
- [ ] Turn `/knowledge/notes`, `/knowledge/notes/new`, and `/knowledge/notes/:id` into client-side compatibility redirects to the new article URLs; retain IDs unchanged.
- [ ] Refactor the overview to welcome the owner, offer create/import actions, and show only compact, truthful metrics plus recent editing/activity—never fake analytics or a metric wall.
- [ ] Verify `functions/_middleware.ts` remains API-only and does not change. Record whether an external Cloudflare Access hostname policy prevents the approved public/private split; if it does, stop and request a separate configuration approval rather than changing the policy.
- [ ] Run `pnpm --filter @namdw/web test -- KnowledgeShell.test.tsx knowledge-integration.test.tsx RouteRecovery.test.tsx`, then typecheck/lint/build.
- [ ] Checkpoint: test new and legacy URLs, keyboard navigation, 1024px sidebar collapse, and 390px menu behavior; record the Access-policy verification result separately from code tests.

## Phase 4: Article Management

**Files:**
- Modify: `apps/web/src/knowledge-ui/NotesPage.tsx`, `knowledge.css`, `apps/web/src/knowledge/KnowledgeNotesRoute.tsx`, `knowledge-adapter.ts`, `knowledge-integration.test.tsx`
- Create: `apps/web/src/knowledge-ui/ArticleListItem.tsx`, `ArticleFilters.tsx`, `ArticleBulkActions.tsx`, `ArticleListItem.test.tsx`, and a focused article-management presentation test

**Dependencies:** Phase 3 route aliases/shell; existing `loadKnowledgeNotes` and search APIs; no new API filters beyond the existing contract.

**Risks:** The current notes API may not expose every requested list field. The UI must hide unavailable fields rather than invent values, requesting an API contract change, or fabricating statistics.

**Rollback:** Revert Phase 4 commits; the existing Notes page and API client still provide the previous management workflow.

- [ ] Rename visible product language from Notes to Articles while retaining `NoteRecord`, existing client method names, and API URLs internally.
- [ ] Treat “Article” solely as a presentation and navigation concept: internal `NoteRecord` types, API paths, database fields, fixtures, and persistence semantics remain unchanged.
- [ ] Build a light desktop list/table with search, existing supported filters, title, category, status, updated time, and an ellipsis menu for low-frequency presentation actions.
- [ ] Show only filter controls backed by the current client/API; do not add unpublished API parameters, taxonomy mutations, or fabricated tags/reading metadata.
- [ ] Render mobile article cards below 768px instead of a scrollable desktop table.
- [ ] Add truthful loading, empty, error, and selection/batch-action presentation; batch actions remain disabled or absent until an existing supported mutation exists.
- [ ] Run focused article-management tests plus `pnpm --filter @namdw/web typecheck`, `pnpm lint`, and `pnpm --filter @namdw/web build`.
- [ ] Checkpoint: demonstrate desktop list and 390px card views with real fixture/API response data; confirm no API client or shared-contract file changed.

## Phase 5: Immersive Tiptap Editor

**Files:**
- Modify: `apps/web/src/knowledge-ui/EditorPage.tsx`, `knowledge-ui/AssetPanel.tsx`, `knowledge-ui/knowledge.css`, `apps/web/src/knowledge/KnowledgeEditorRoute.tsx`, `knowledge-editor/KnowledgeHighlight.ts`, `knowledge-editor/KnowledgeHighlight.test.ts`, `knowledge-editor.test.tsx`, `EditorPage.test.tsx`
- Create: `apps/web/src/knowledge-ui/EditorToolbar.tsx`, `ArticleSettingsDrawer.tsx`, `VersionHistoryDrawer.tsx`, `SaveStatus.tsx`, `CommandMenu.tsx`, and focused component tests

**Dependencies:** Phase 1 primitives; existing Tiptap StarterKit/Highlight extension; existing autosave hook, API client, and explicit-version route.

**Risks:** Toolbar/drawer work can alter canonical JSON, autosave ordering, or version creation. Those are hard stop conditions. Bubble/slash UI must use existing supported extensions or small local composition only.

**Rollback:** Revert Phase 5 commits; saved JSON, versions, assets, and API behavior are untouched by the UI rollback.

- [ ] Replace the persistent management layout on editor routes with a dedicated focus shell whose top bar contains return, SaveStatus, preview, article settings, and publish actions.
- [ ] Restyle title/summary as low-chrome writing fields and keep the document column within 720–760px.
- [ ] Extract a presentational toolbar/Bubble Menu and slash-command UI around existing Tiptap commands; preserve the established document schema and five semantic highlight kinds.
- [ ] Add a responsive settings drawer and version-history drawer that present only fields/actions the current contract already supports; do not claim persistence for unavailable metadata.
- [ ] Reuse `useNoteAutosave`, `createKnowledgeNoteVersion`, and existing asset helpers without changing debounce, stale-response, mutation ordering, version behavior, or binary-download flow.
- [ ] Verify EditorPage states for editing, saving, saved, failed, and unsynchronized changes; retain unsaved-leave warning.
- [ ] Run `pnpm --filter @namdw/web test -- EditorPage.test.tsx knowledge-editor.test.tsx KnowledgeHighlight.test.ts`, shared notes contract tests, web typecheck, Functions typecheck, lint, and web build.
- [ ] Checkpoint: manually verify create/edit at 1440px, 1024px, 390px, and 320px; record a regression table proving API payloads, autosave timing, and explicit version calls are unchanged.

## Phase 6: Markdown Import and Media UI

**Files:**
- Modify: `apps/web/src/knowledge-ui/AssetPanel.tsx`, `knowledge.css`, `apps/web/src/knowledge/knowledge-assets.test.ts`, `knowledge-api.test.ts`
- Create: `apps/web/src/knowledge-ui/MarkdownImportDialog.tsx`, `ImportFileRow.tsx`, `MediaPage.tsx`, `MediaCard.tsx`, `MediaDetailDrawer.tsx`, and focused tests
- Modify only if already supported by a frozen client contract: `apps/web/src/router.tsx`, `apps/web/src/knowledge/knowledge-api.ts`

**Dependencies:** Existing asset upload/download/delete endpoints and existing frozen import routes, if present. If an import or media-list endpoint is absent, the corresponding live workflow is a stop condition rather than an invitation to add an API.

**Risks:** A presentation-only plan cannot invent multi-file import, reference counts, or media listings that the APIs do not expose. Assets must never reveal R2 keys/public URLs or permit unsafe deletion.

**Rollback:** Revert Phase 6 commits; R2 objects and D1 metadata are not altered by opening, closing, or restyling UI.

- [ ] Inventory existing frozen import/media endpoints before UI work. Record supported request/response fields and stop for approval if a needed endpoint or mutation does not exist.
- [ ] Implement the Markdown-import interface only for supported behavior: file selection/drop, per-file queued/uploading/success/failed display, parse/conflict results, confirmation, and final report.
- [ ] Implement private media presentation only for supported behavior: search/type controls, media grid, safe detail drawer, controlled download/copy action, and delete protection.
- [ ] Keep referenced-asset deletion behavior enforced by the existing backend; do not duplicate it with client-only logic or add public R2 links.
- [ ] Run focused import/asset tests, shared asset tests, Functions typecheck, web typecheck, lint, and web build.
- [ ] Checkpoint: record endpoint inventory, test results, 1440px/390px screenshots, and confirmation that no D1/R2/API-contract change was required. If it was required, stop with the missing-contract report.

## Phase 7: Responsive, Accessibility, and Performance Validation

**Files:**
- Modify: only defect-specific files already in scope from Phases 1–6, plus corresponding tests
- Create: `apps/web/src/test/product-shell-routes.test.tsx` and lightweight accessibility/responsive regression tests where current test setup supports them

**Dependencies:** All prior phase checkpoints approved; existing `package.json` scripts and Cloudflare configuration verifier.

**Risks:** Broad cleanup may become an unrelated refactor; baseline failures must be identified, preserved, and documented rather than hidden or weakened.

**Rollback:** Revert only the isolated defect-fix commit; never use destructive resets or production operations.

- [ ] Verify all required public/private routes at 1440px, 1024px, 390px, and 320px with no uncontrolled horizontal scrolling.
- [ ] Verify one `main` landmark per route, skip link, heading order, accessible labels, `aria-current`, dialog/drawer focus behavior, focus-visible contrast, non-color status labels, and reduced-motion behavior.
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm cloudflare:verify-config`, and `pnpm smoke` only when their documented prerequisites are available; record unmet prerequisites rather than changing infrastructure.
- [ ] Run public route smoke checks, SPA deep-link fallback, and inspect Vite build output for chunks over 500 KB. Use route/feature splitting only when it preserves behavior.
- [ ] Capture final key-page screenshots at all required widths and compile `git diff --stat`, `git status --short`, changed-file list, test/build outputs, bundle sizes, incomplete items, known limitations, and a declaration of no deployment/API/data/Cloudflare changes.
- [ ] If screenshot automation is unavailable, provide route-verification output, a viewport checklist, and manual verification evidence instead; do not block implementation solely because automated screenshots cannot be produced.
- [ ] Checkpoint: require all applicable checks to pass or clearly list pre-existing/infrastructure-blocked checks. Do not proceed to deployment; wait for explicit user approval.

## Plan Self-Review

- **Spec coverage:** Phase 1 establishes tokens and boundaries; Phase 2 covers public editorial surfaces; Phase 3 creates the private shell and compatibility URLs; Phase 4 covers article management; Phase 5 preserves the immersive editor semantics; Phase 6 gates import/media UI on existing contracts; Phase 7 validates responsiveness, accessibility, performance, and configuration.
- **Boundary coverage:** Every phase prohibits API, data-model, authentication, Cloudflare, and persistence changes. The Access-policy and missing-endpoint cases explicitly stop for approval.
- **Rollback coverage:** Each phase uses code-only, commit-level rollback and explicitly excludes destructive operations.
- **Placeholder scan:** No task relies on an unspecified dependency, API mutation, or later hidden implementation. Unsupported current endpoints are stop conditions, not assumed work.
