# Progressive Product Shell Refactor Design

Date: 2026-07-24
Status: Awaiting user review

## 1. Goal

Redesign the existing personal blog and private knowledge-management product as a calm, content-first experience without replacing its working application architecture. The public blog must be available without login. The private knowledge workspace and its management APIs remain protected by Cloudflare Access.

The visual direction draws from Apple, Linear, Medium, and Notion: generous whitespace and typography, dense but restrained management workflows, a focused reading surface, and an immersive low-distraction editor. The supplied “Personal Knowledge Base and Public Blog UI Reference Board” is a reference for hierarchy, whitespace, and content priority only; its fake content, literal layout, and decorative treatments are not copied.

## 2. Confirmed Constraints

- Keep React, Vite, React Router, Cloudflare Pages Functions, D1, private R2, and Tiptap.
- Keep the current data model and frozen API contracts. No D1 migration, data rewrite, or API endpoint redesign is part of this work.
- Do not add a large UI framework. Reusable components are built from the existing application, React, CSS, and already installed dependencies.
- Do not replace the router, state-management approach, content gateway, or business workflows.
- Preserve `VITE_API_BASE_URL`, static-content fallback, `data-app="personal-blog"`, `_redirects`, and existing production smoke-check expectations.
- Do not deploy, change Cloudflare Dashboard settings, run production migrations, modify Access policies, or operate on production D1/R2 as part of this redesign without a later explicit approval.
- Preserve unrelated working-tree changes, including the existing untracked local API/Docker implementation plan.

## 3. Product Boundary and Access Model

### 3.1 Public blog

The visitor-facing experience remains public and does not require Cloudflare Access authentication. Its primary routes are:

| Route | Purpose |
| --- | --- |
| `/` | Editorial home with an explicit entry to the private knowledge workspace |
| `/posts` and `/posts/:slug` | Article discovery and reading |
| `/categories`, `/categories/:slug`, `/tags`, `/tags/:slug`, `/archives` | Content discovery |
| `/projects`, `/projects/:slug`, `/about` | Portfolio and personal context |
| `/search` | Public content search |

The public header links to the public information architecture and provides a clearly labeled “Knowledge workspace” action to `/knowledge`. It is an entry point, not a login flow; Cloudflare Access determines whether the visitor can proceed.

### 3.2 Private knowledge workspace

The Cloudflare Access-protected product surface is consolidated under `/knowledge`:

| Route | Purpose |
| --- | --- |
| `/knowledge` | Overview dashboard |
| `/knowledge/articles` | Article management |
| `/knowledge/articles/new` | Create article |
| `/knowledge/articles/:id/edit` | Edit an existing article |
| `/knowledge/media` | Private media management |
| `/knowledge/settings` | Workspace and publishing settings |

Existing APIs remain at their frozen routes. The private API boundary includes the existing knowledge-management routes (currently under `/api/notes`, `/api/search`, `/api/stats`, and `/api/assets`) in addition to any pre-existing protected management API routes. This design does not rename them to `/api/admin/*`; that would violate the frozen-contract constraint.

### 3.3 Compatibility

`/knowledge/notes`, `/knowledge/notes/new`, and `/knowledge/notes/:id` remain compatibility entry points. They redirect client-side to `/knowledge/articles`, `/knowledge/articles/new`, and `/knowledge/articles/:id/edit`, respectively. Existing note data retains its existing IDs and semantics; “article” is a product-language and navigation change, not a schema or API rename.

Before changing middleware behavior, implementation must verify the current Access middleware and Pages configuration. Public page routes must be reachable without authentication while private pages and management APIs fail closed. This is a routing/access-shell concern only; it does not authorize a Cloudflare policy or Dashboard change.

## 4. Information Architecture

### 4.1 Shared shell principles

The system has two distinct shells that share tokens and primitive components:

- **Public shell:** minimal header, content-width container, editorial footer, and quiet route transitions.
- **Knowledge shell:** compact side navigation on desktop, a mobile drawer below 1024px, page headers, scoped actions, and high-density work areas.
- **Editor shell:** a dedicated focus layout without the persistent knowledge sidebar. It exposes only return navigation, save state, preview, article settings, and publish controls in its top bar.

Public pages never inherit administrative navigation, tables, metrics, or controls. The knowledge workspace never adopts the public hero or magazine layout for operational screens.

### 4.2 Knowledge navigation

Only four first-level destinations appear in knowledge navigation:

1. Overview
2. Articles
3. Media
4. Settings

Draft, published, archived, and trash-like states are article-list filters, not global destinations. Markdown import is an article-list action. Version history is an editor-local drawer. Taxonomy controls live in article settings or settings rather than expanding first-level navigation.

## 5. Visual System

### 5.1 Design tokens

All color, spacing, radius, elevation, typography, z-index, and motion values are centralized in CSS custom properties. Existing scattered page-specific colors and dimensions are progressively replaced with semantic tokens.

The token system supports light and dark themes using the following semantic groups:

- `background`, `surface`, and `surface-subtle`
- `text-primary`, `text-secondary`, and `text-tertiary`
- `border` and `border-strong`
- `accent`, `accent-hover`, and `accent-soft`
- `success`, `warning`, and `danger`
- spacing scale, radius scale, restrained shadow scale, typography scale, z-index scale, and motion durations

Light mode centers on `#f7f7f5` background, white surfaces, `#18181a` primary text, and `#2563eb` accent. Dark mode centers on `#111113` background, `#18181b` surfaces, `#f5f5f5` primary text, and `#6d9cff` accent. The implementation keeps contrast-compliant focus colors for each surface.

The design forbids large gradients, glow buttons, neon, heavy glass effects, thick shadows, dashboard-style metric-card walls, and wrapping all content in cards. Borders are thin, shadows are rare, and selected/interactive state is expressed by more than color alone.

### 5.2 Type and motion

The product uses system sans typography for navigation, metadata, controls, and titles. Article bodies use a readable serif stack. The reading and editing column max width is 720–760px. Type hierarchy relies on scale, weight, and whitespace before containers or decorative effects.

Motion is short and functional: opacity, small position changes, menus, drawers, and progress feedback. Every motion path respects `prefers-reduced-motion`; no interaction depends on animation.

### 5.3 Reusable primitives

The existing component set is reorganized or extended into focused primitives: Button, IconButton, Input, SearchInput, Textarea, Select, Checkbox, Switch, Badge, StatusBadge, Tabs, DropdownMenu, Popover, Tooltip, Dialog, Drawer, Toast, CommandMenu, EmptyState, Skeleton, ArticleCard, ArticleListItem, MediaCard, PageHeader, PublicHeader, AdminSidebar, EditorToolbar, and SaveStatus.

Primitive adoption is incremental. Pages may retain an existing focused component when it already meets the new token, interaction, accessibility, and responsive requirements.

## 6. Public Experience

### 6.1 Home

The homepage sequence is:

1. Public header
2. Hero
3. Recent updates
4. Curated topics or learning paths
5. Selected projects
6. Brief personal introduction
7. Footer

The hero centers the purpose: “Build, learn, and leave reusable thinking behind.” Supporting copy explains that the site records technical practice, course learning, project retrospectives, and long-running learning paths. It includes a quiet public primary action and the explicit `/knowledge` workspace entry. It does not display a large operations dashboard or a wall of statistics.

Recent updates use an editorial layout: one lead story beside two supporting stories on large screens, collapsing to a single column on small screens. Project and about sections use simple content groupings rather than uniform card grids.

### 6.2 Discovery and search

Article lists contain a page title and description, prominent search input, category/topic filters, article summaries, tags, update time, reading time, loading skeletons, empty states, and error states. They remain editorial lists, not administrative tables.

Search is a dedicated, keyboard-friendly discovery experience that retains existing URL behavior and data-loading boundaries. Filter changes remain reflected in the URL. Empty and fallback states explain the condition and give a recovery action.

### 6.3 Reading

Article reading remains centered in a 720–760px body column. It supports headings, lists, task lists where current rendering supports them, quotations, figures/captions, copyable code blocks, inline code, tables, mathematics, links, semantic highlights, notices, and dividers.

The page includes reading progress, generated table of contents, active-section indication, mobile table-of-contents behavior, back-to-top action, previous/next articles, related articles, and copy-link action. The implementation builds on the existing safe Markdown renderer and does not render untrusted raw HTML.

## 7. Knowledge Experience

### 7.1 Overview

The overview opens with a personal welcome and immediate actions for creating an article and importing Markdown. It presents four compact metrics—total articles, drafts, published, and updated this week—followed by recent edits and recent activity. It explicitly avoids complex charts and oversized dashboard treatments.

### 7.2 Article management

The articles page header provides search, import, and create actions. Status tabs or filters are All, Draft, Published, and Archived. Desktop uses a lightweight list/table that favors title, category, tags, updated time, reading metadata, status, and a compact action menu. Lower-frequency actions live in an ellipsis menu. Batch controls appear only after selection.

At narrow widths, the same content becomes article cards rather than a horizontally scrolling table. Loading, empty, and error states are designed and keyboard reachable.

### 7.3 Media

The media page provides search, upload, type filter, private media grid, and a detail drawer. The drawer shows filename, size, uploaded date, reference count, referencing articles, controlled-address copy action, and a protected delete action. A referenced attachment cannot be directly deleted. R2 remains private and no public R2 address is displayed.

### 7.4 Settings and import

Settings contains workspace-level presentation and content-management controls only. Category and tag management can live here when not attached to the article workflow.

Markdown import is a staged interface: select/drop multiple files; parse front matter; identify title, tags, slug, and relative-image warnings; show results and conflicts; choose skip, duplicate, or overwrite-draft behavior; confirm; import as drafts; then report a result for every file. Published articles are never automatically overwritten. The design preserves the current canonical `content_json` and avoids changing Markdown/data relationships in this wave.

## 8. Editor Experience

The editor is a dedicated immersive route. Its top bar contains return, save status, preview, article settings, and publish actions only. Save status clearly represents editing, saving, saved, failed, and unsynchronized offline changes.

The main document column is 720–760px. Title and summary are presentation-first fields without traditional heavy input-box chrome. The editor uses Tiptap with the existing safe document schema and semantic highlights. A selection-based Bubble Menu exposes common formatting; a `/` command menu exposes structured blocks and actions. Their behavior must build on supported extensions or small local components, not a UI framework.

Article settings open in a right drawer (full-screen or bottom sheet on small screens) and include status, publication date, category, tags, slug, cover, visibility, SEO title, and SEO description. Version history is an editor-local drawer or dialog. Restoring a prior version always creates a new version rather than mutating history.

The editor preserves autosave semantics: debounce, one active mutation, stale-response protection, no automatic version creation, explicit save-version action, and leave-with-unsaved-change protection. The redesign changes presentation and interaction composition, not these persistence guarantees.

## 9. Responsive and Accessibility Requirements

The supported minimum width is 320px. Reference breakpoints are 640px, 768px, 1024px, 1280px, and 1536px.

- Below 1024px, knowledge navigation collapses and the reading table of contents becomes collapsible.
- Below 768px, public navigation uses an accessible mobile menu; article-management rows become cards; the editor drawer becomes a bottom sheet or full-screen panel; horizontal page padding is 16–20px.
- No key route may create uncontrolled horizontal scrolling.

Every route has one primary `main` landmark, a skip link, semantic headings, keyboard operation, visible `focus-visible` states, meaningful icon-button names, valid form labels/error associations, useful image alternatives, `aria-current`, dialog focus management, sufficient contrast, and reduced-motion support. Statuses require an icon/text/label in addition to color.

## 10. Performance and Safety

- Maintain split boundaries between public and knowledge code where practical.
- Do not load Tiptap or editor extensions in the ordinary public-home path.
- Load editor-only extensions on demand.
- Do not load full article bodies on the home page; lazy-load non-critical images.
- Preserve SPA deep-link fallback and static content fallback.
- Inspect any main bundle over 500 KB and reduce it through route-level or feature-level splitting where it is safe.
- Keep existing safe Markdown rendering and do not introduce untrusted HTML rendering.

## 11. Incremental Migration and Checkpoints

Implementation proceeds in this order. Each phase is independently reviewed before the next begins.

| Phase | Scope | Checkpoint evidence |
| --- | --- | --- |
| 1 | Design tokens, shared primitives, global style cleanup | modified files, focused visual/accessibility tests, screenshots, `git status --short` |
| 2 | Public header/footer, home, discovery, article detail, search, projects, about | route smoke results, desktop/tablet/mobile screenshots, public accessibility checks |
| 3 | Knowledge shell, overview, article management, mobile navigation | protected-route presentation tests, responsive evidence, unchanged API contracts |
| 4 | Immersive Tiptap editor, save status, bubble/slash controls, settings/version drawers, publish flow | editor integration tests, autosave/version regression evidence, screenshots |
| 5 | Markdown import and media-management UI | per-file state tests, asset protection regression evidence, screenshots |
| 6 | Responsive, accessibility, bundle, full test/build/config validation, obsolete visual-code cleanup | full verification record and final diff/status |

At every checkpoint, report completed content, changed files, test results, screenshot or visual evidence, unfinished work, and `git status --short`. A failed acceptance checkpoint stops the next phase.

## 12. Validation Plan

The implementation plan must use scripts confirmed from `package.json` and cover at least:

- Type checking and linting
- Existing unit/component tests plus focused tests for changed components and flows
- Production build
- Public route smoke checks and SPA fallback
- Cloudflare configuration validation without modifying external configuration
- Bundle-size inspection
- Key routes at 1440px, 1024px, 390px, and 320px

Key route coverage includes `/`, `/posts`, `/posts/:slug`, `/search`, `/projects`, `/about`, `/knowledge`, `/knowledge/articles`, `/knowledge/articles/new`, `/knowledge/articles/:id/edit`, `/knowledge/media`, and `/knowledge/settings`.

## 13. Explicit Non-Goals

- A database migration, new schema, data conversion, or content canonicalization change
- API contract, API-path, authentication protocol, or Cloudflare Access-policy rewrite
- Public R2 access or an R2 listing endpoint
- A large UI framework, full router replacement, state-management rewrite, or unrelated business refactor
- Comments, multi-user roles, OAuth, notifications, webhooks, AI authoring, MCP, theme marketplace, complex analytics, or public deployment

## 14. Known Design Risks and Decisions Needed During Implementation

1. The current Access middleware was originally designed for a private knowledge base. Phase 1 must verify its route filtering so public browser routes remain reachable while management routes and existing private APIs remain fail-closed. If this cannot be achieved without a change to the approved authentication contract or Cloudflare Dashboard policy, stop at the checkpoint and request approval.
2. Current data and APIs use “note” terminology. The interface uses “article” in private navigation while preserving existing API/schema names and IDs. Any request to rename the contract is out of scope.
3. Current editor capabilities and available Tiptap extensions determine whether Bubble Menu and slash command behavior can be implemented locally without a new dependency. If a requested interaction requires a large dependency or a canonical-document change, preserve the current behavior and surface the gap at the phase checkpoint.

## 15. Acceptance Criteria

The redesign is accepted only when the public blog is accessible without login, the knowledge workspace and existing management APIs are private, compatibility redirects work, the approved visual direction is consistently tokenized, public and knowledge experiences have distinct appropriate shells, the editor is focused without changing persistence behavior, all target sizes remain usable, and the applicable quality/build/smoke checks pass. No API, data-model, Cloudflare Dashboard, production-resource, or deployment change may be claimed as part of acceptance unless separately approved and evidenced.
