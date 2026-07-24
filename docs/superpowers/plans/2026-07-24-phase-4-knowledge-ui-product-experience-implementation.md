# Phase 4 Knowledge UI and Product Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the existing knowledge workspace's presentation and interaction clarity while consuming only the verified Notes, search, stats, versions, and session-scoped asset workflows.

**Architecture:** Keep the current React routes, `KnowledgeDashboardRoute`, `KnowledgeNotesRoute`, `KnowledgeEditorRoute`, `knowledge-api.ts`, and Tiptap document model. Phase 4 is a composition and presentation pass: view models remain derived from existing API responses, while route components remain responsible for loading, mutation, and explicit error states. No feature in this phase requires a new API request shape, persistence field, Tiptap node, or Cloudflare behavior.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite, Vitest, Testing Library, existing CSS, Tiptap StarterKit plus `KnowledgeHighlight`, Cloudflare Pages Functions, D1, private R2.

## Runtime Capability Record

### Available and permitted

- `GET /api/stats` drives truthful overview statistics.
- `GET /api/notes` and `GET /api/search` drive list and search presentation.
- Existing Note CRUD, archive/restore, and explicit versions remain callable through the established client functions.
- `POST /api/assets`, `GET /api/assets/:id`, and `DELETE /api/assets/:id` support an attachment within the current editor session. Downloads remain proxied through the protected API.

### Phase 3B blocked record

Phase 3B is blocked by backend/data-model capability, not by UI work:

1. No persistent note-asset relationship can be represented in the existing canonical note document.
2. No existing API queries asset metadata by note.
3. The current Tiptap document validator does not support asset-reference nodes or link marks.

Do not change `content_json`, the Tiptap schema, asset endpoints, D1 schema, R2 permissions, or public R2 exposure to address these gaps. Do not create a Media Library, persistent attachment experience, or Markdown import surface in this phase.

## Global Constraints

- Do not change API paths, query parameters, request/response envelopes, API client contracts, Functions, D1 migrations/schema, R2 bindings/permissions, Cloudflare configuration, authentication behavior, or persistence semantics.
- Keep `NoteRecord`, internal Note method names, database fields, fixtures/contracts, `contentJson`, autosave ordering, and explicit version creation unchanged. “Article” is presentation copy only.
- Do not add dependencies, a frontend authentication state, route guards, fake data, fake statistics, unavailable metadata, public R2 URLs, or a media-library/listing UI.
- Existing API errors, including Access failures, must remain explicit UI errors; the phase does not redesign login or change the Access boundary.
- Preserve the existing untracked `docs/superpowers/plans/2026-07-17-local-api-docker-deployment-implementation.md` and `.wrangler/` local runtime artifacts.
- Follow the visual guardrails: use hierarchy, whitespace, alignment, subtle borders, and controlled density; avoid dashboard-widget grids, excessive cards, gradients, oversized heroes, and decorative empty panels.
- Stop and request approval if a desired UI behavior needs unavailable data or a new persistence/API/Tiptap capability.

## File Scope

| Area | Files | Responsibility |
| --- | --- | --- |
| Knowledge shell | `apps/web/src/knowledge-ui/KnowledgeShell.tsx`, `knowledge.css`, `KnowledgeShell.test.tsx`, `DashboardPage.tsx`, `NotesPage.tsx` | Shared visual frame, restrained navigation, page hierarchy, and responsive shell behavior without route/auth changes. |
| Knowledge overview | `apps/web/src/knowledge-ui/DashboardPage.tsx`, `apps/web/src/knowledge/KnowledgeDashboardRoute.tsx`, `apps/web/src/knowledge-ui/knowledge.css`, `apps/web/src/knowledge/knowledge-integration.test.tsx` | Content-first overview using real stats/loading/error state only. |
| Article browsing | `apps/web/src/knowledge-ui/NotesPage.tsx`, `apps/web/src/knowledge/KnowledgeNotesRoute.tsx`, `apps/web/src/knowledge/knowledge-adapter.ts`, `knowledge.css`, `knowledge-integration.test.tsx`, `KnowledgeShell.test.tsx` | Present existing Notes as Articles without modifying the Notes API or routes. |
| Editor experience | `apps/web/src/knowledge-ui/EditorPage.tsx`, `apps/web/src/knowledge/KnowledgeEditorRoute.tsx`, `apps/web/src/knowledge-ui/AssetPanel.tsx`, `knowledge.css`, `knowledge-editor.test.tsx`, `EditorPage.test.tsx`, `knowledge-assets.test.ts` | Improve current save/version/attachment-state presentation without changing document JSON or asset semantics. |
| Validation | Existing focused tests and `apps/web/src/router.tsx` only if metadata/copy requires a narrow update | Preserve route behavior and demonstrate no API client, Functions, shared-contract, schema, or config changes. |

## Dependencies

- Completed Phase 3A runtime integration commits `2aa2651`, `62be9a0`, and `62e603a`.
- Existing `loadKnowledgeStats`, `loadKnowledgeNotes`, `createKnowledgeNoteVersion`, `uploadKnowledgeAsset`, `downloadKnowledgeAsset`, and `deleteKnowledgeAsset` functions.
- Existing `useNoteAutosave`, strict content validator, `KnowledgeHighlight`, and asset route protections.

## Risks and Rollback

- A visual refactor can accidentally replace explicit loading/error states with fixtures. Keep runtime-state tests mandatory.
- Copy changes can accidentally rename internal Note concepts. Keep imports, types, methods, API URLs, and route IDs unchanged; assert request URLs in tests.
- Editor composition can change autosave timing or JSON. Do not alter `onUpdate`, `setContent`, autosave hook parameters, or version flow; retain current regression tests.
- Asset affordances can imply persistence after reload. Label attachments as current-session only where needed and never add an invented list/recovery path.
- Roll back by reverting only the isolated Phase 4 commits. No persistence, API, data, R2 object, or Cloudflare operation is part of a UI rollback.

## Phase Breakdown

### Phase 4.1 / Task 1: Knowledge Shell

**Files:**
- Create: `apps/web/src/knowledge-ui/KnowledgeShell.tsx`
- Modify: `apps/web/src/knowledge-ui/DashboardPage.tsx`, `apps/web/src/knowledge-ui/NotesPage.tsx`, `apps/web/src/knowledge-ui/knowledge.css`, `apps/web/src/knowledge-ui/KnowledgeShell.test.tsx`
- Do not modify: `apps/web/src/router.tsx`, `apps/web/src/knowledge/knowledge-api.ts`, `functions/**`, `packages/shared/**`

**Consumes:** Existing dashboard and notes presentation components, existing `/knowledge` and `/knowledge/notes` URLs, and the global application `main` landmark.

**Produces:** A shared `KnowledgeShell` section-level frame with user-facing navigation/copy only. It does not add routes, guards, authentication state, or API requests.

- [ ] **Step 1: Write the failing shell composition test**

```tsx
it('wraps overview and article content in one labelled knowledge shell without a nested main landmark', () => {
  render(<MemoryRouter><KnowledgeShell title="Knowledge"><p>Runtime content</p></KnowledgeShell></MemoryRouter>);
  expect(screen.getByRole('region', { name: 'Knowledge' })).toHaveTextContent('Runtime content');
  expect(screen.queryAllByRole('main')).toHaveLength(0);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @namdw/web test -- KnowledgeShell.test.tsx`

Expected: FAIL because `KnowledgeShell` does not yet exist.

- [ ] **Step 3: Implement the minimum shell**

Create a presentational `KnowledgeShell` with a `section` root, `aria-label={title}`, optional eyebrow/actions slots, and a compact navigation area containing only already-valid destinations. Do not add a Media destination because no media-list contract exists. Apply the shell in `DashboardPage` and `NotesPage`; keep their route ownership, data loading, and action callbacks unchanged. Use CSS for a desktop side/inline hierarchy and a narrow-width stacked form without horizontal overflow.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter @namdw/web test -- KnowledgeShell.test.tsx knowledge-integration.test.tsx`

Expected: PASS; existing dashboard and note request assertions remain unchanged and the shell adds no nested `main` landmark.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/knowledge-ui/KnowledgeShell.tsx apps/web/src/knowledge-ui/DashboardPage.tsx apps/web/src/knowledge-ui/NotesPage.tsx apps/web/src/knowledge-ui/knowledge.css apps/web/src/knowledge-ui/KnowledgeShell.test.tsx
git commit -m "feat(web): add knowledge workspace shell"
```

### Phase 4.2 / Task 2: Runtime-Safe Knowledge Overview

**Files:**
- Modify: `apps/web/src/knowledge-ui/DashboardPage.tsx`, `apps/web/src/knowledge-ui/knowledge.css`, `apps/web/src/knowledge/knowledge-integration.test.tsx`
- Do not modify: `apps/web/src/knowledge/knowledge-api.ts`, `functions/**`, `packages/shared/**`

**Consumes:** `DashboardViewModel`, existing `KnowledgeDashboardRoute` states (`loading`, `ready`, `error`), and `GET /api/stats`.

**Produces:** A compact, truthful overview whose hierarchy presents real totals and useful note actions without a fake dashboard grid.

- [ ] **Step 1: Write the failing overview presentation test**

```tsx
it('does not render statistics until the real stats request succeeds', async () => {
  let resolveStats!: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveStats = resolve; }));
  render(<MemoryRouter><KnowledgeDashboardRoute /></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveTextContent('Loading dashboard');
  expect(screen.queryByText('24')).not.toBeInTheDocument();
  resolveStats(response({ success: true, data: { total: 7, draft: 1, published: 4, archived: 2, pinned: 2, roadmapProgress: 40 } }));
  await expect(screen.findByText('7')).resolves.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @namdw/web test -- knowledge-integration.test.tsx`

Expected: FAIL only if the revised overview removes the current runtime state or introduces a fixture fallback.

- [ ] **Step 3: Implement the minimum presentation-only overview change**

Keep the route contract unchanged. Render the existing `DashboardViewModel` statistics only for `state === 'ready'`; keep `role="status"` during loading and `role="alert"` on failure. Use CSS hierarchy and a small action grouping instead of adding new metrics, data requests, or components that require unavailable data.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter @namdw/web test -- knowledge-integration.test.tsx KnowledgeShell.test.tsx`

Expected: PASS; the overview still issues exactly `GET /api/stats` and no statistic appears from fixtures on error.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/knowledge-ui/DashboardPage.tsx apps/web/src/knowledge-ui/knowledge.css apps/web/src/knowledge/knowledge-integration.test.tsx
git commit -m "feat(web): refine knowledge overview hierarchy"
```

### Phase 4.3 / Task 3: Article Browsing and Existing Management Actions

**Files:**
- Modify: `apps/web/src/knowledge-ui/NotesPage.tsx`, `apps/web/src/knowledge/KnowledgeNotesRoute.tsx`, `apps/web/src/knowledge/knowledge-adapter.ts`, `apps/web/src/knowledge-ui/knowledge.css`, `apps/web/src/knowledge/knowledge-integration.test.tsx`, `apps/web/src/knowledge-ui/KnowledgeShell.test.tsx`
- Do not modify: `apps/web/src/knowledge/knowledge-api.ts`, `packages/shared/src/knowledge.ts`, `functions/api/notes/[[path]].ts`

**Consumes:** Existing `loadKnowledgeNotes({ q, page, pageSize })`, `DELETE /api/notes/:id`, `POST /api/notes/:id/restore`, and `NoteCardViewModel`.

**Produces:** A responsive, content-dense Article presentation that preserves current note URLs and APIs, shows truthful empty/loading/error states, and gives clear existing archive/restore feedback.

- [ ] **Step 1: Write the failing article-copy and request-preservation test**

```tsx
it('uses Article presentation copy while preserving the existing Notes API and IDs', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { items: [note], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }));
  render(<MemoryRouter><KnowledgeNotesRoute /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Articles' })).toBeInTheDocument();
  expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/notes?page=1&pageSize=20', expect.any(Object));
  expect(screen.getByRole('link', { name: note.title })).toHaveAttribute('href', `/knowledge/notes/${note.id}`);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @namdw/web test -- knowledge-integration.test.tsx KnowledgeShell.test.tsx`

Expected: FAIL because the current presentation labels the page as Notes rather than Articles; it must not fail due to an altered endpoint.

- [ ] **Step 3: Implement the minimum article presentation change**

Change only user-facing headings, labels, descriptions, layout classes, and responsive composition. Keep `NotesPage`, `KnowledgeNotesRoute`, `NoteRecord`, `/knowledge/notes/:id`, and all client calls intact. Retain the synchronous mutation lock, the same list refresh behavior, and explicit error messaging. Do not add filters, batch actions, status fields, media metadata, or pagination controls beyond fields already supplied by the route.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter @namdw/web test -- knowledge-api.test.ts knowledge-integration.test.tsx KnowledgeShell.test.tsx`

Expected: PASS; exact `/api/notes`, `/api/search`, archive, and restore calls remain asserted.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/knowledge-ui/NotesPage.tsx apps/web/src/knowledge/KnowledgeNotesRoute.tsx apps/web/src/knowledge/knowledge-adapter.ts apps/web/src/knowledge-ui/knowledge.css apps/web/src/knowledge/knowledge-integration.test.tsx apps/web/src/knowledge-ui/KnowledgeShell.test.tsx
git commit -m "feat(web): present knowledge notes as articles"
```

### Phase 4.4 / Task 4: Focused Editor and Session-Scoped Attachment Feedback

**Files:**
- Modify: `apps/web/src/knowledge-ui/EditorPage.tsx`, `apps/web/src/knowledge-ui/AssetPanel.tsx`, `apps/web/src/knowledge/KnowledgeEditorRoute.tsx`, `apps/web/src/knowledge-ui/knowledge.css`, `apps/web/src/knowledge/knowledge-editor.test.tsx`, `apps/web/src/knowledge-ui/EditorPage.test.tsx`, `apps/web/src/knowledge/knowledge-assets.test.ts`
- Do not modify: `apps/web/src/knowledge/knowledge-api.ts`, `apps/web/src/knowledge-editor/KnowledgeHighlight.ts`, `functions/**`, `packages/shared/**`

**Consumes:** Existing Tiptap JSON string, autosave hook, explicit-version callback, and `AssetRecord` returned from upload.

**Produces:** A calmer writing surface with clear save/version states and attachment controls that accurately communicate upload/download/delete results without claiming persistence, insertion, or post-refresh recovery.

- [ ] **Step 1: Write the failing asset-boundary and editor-state tests**

```tsx
it('keeps an uploaded attachment in the session panel without inserting an asset node into contentJson', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: note }));
  renderEditor();
  await screen.findByLabelText('Title');
  vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { asset } }, 201));
  fireEvent.change(document.querySelector('#knowledge-asset-upload')!, { target: { files: [new File(['png'], 'safe.png', { type: 'image/png' })] } });
  await screen.findByText('safe.png');
  expect(vi.mocked(fetch)).toHaveBeenLastCalledWith('/api/assets', expect.objectContaining({ method: 'POST' }));
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => JSON.stringify(init?.body).includes('asset-1'))).toBe(false);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @namdw/web test -- knowledge-editor.test.tsx knowledge-assets.test.ts`

Expected: FAIL only if the revised editor incorrectly describes assets as embedded/persistent or mutates canonical document content while uploading.

- [ ] **Step 3: Implement the minimum editor composition change**

Use existing callbacks and state to improve save, version, upload, download, delete, busy, and error presentation. Keep attachments in the existing current-session panel and make no claim that they are in document content or recoverable after reload. Preserve the existing protected binary proxy download and delete confirmation behavior. Do not add image/link extensions, `contentJson` serialization, asset-list loading, media navigation, or new backend calls.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter @namdw/web test -- EditorPage.test.tsx knowledge-editor.test.tsx knowledge-assets.test.ts`

Expected: PASS; editor autosave/version tests and asset upload/download/delete request assertions remain green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/knowledge-ui/EditorPage.tsx apps/web/src/knowledge-ui/AssetPanel.tsx apps/web/src/knowledge/KnowledgeEditorRoute.tsx apps/web/src/knowledge-ui/knowledge.css apps/web/src/knowledge/knowledge-editor.test.tsx apps/web/src/knowledge-ui/EditorPage.test.tsx apps/web/src/knowledge/knowledge-assets.test.ts
git commit -m "feat(web): clarify knowledge editor workflow"
```

### Phase 4.5 / Task 5: Responsive and Runtime Regression Checkpoint

**Files:**
- Modify only defect-specific Phase 4 files and their associated tests.
- Do not modify: API client contracts, Functions, shared types, migrations, `wrangler.jsonc`, `_middleware.ts`, or dependency manifests.

**Consumes:** Completed Task 1–4 UI changes and existing runtime routes.

**Produces:** Evidence that the UI remains functional at desktop and mobile widths without unauthorized architectural changes.

- [ ] **Step 1: Write a failing viewport regression only if a changed layout overflows**

```tsx
it('keeps the knowledge article controls reachable at a narrow viewport', () => {
  window.innerWidth = 390;
  window.dispatchEvent(new Event('resize'));
  render(<MemoryRouter><NotesPage model={notesFixture} /></MemoryRouter>);
  expect(screen.getByLabelText('Search notes')).toBeVisible();
});
```

- [ ] **Step 2: Verify RED when a regression test is added**

Run: `pnpm --filter @namdw/web test -- KnowledgeShell.test.tsx`

Expected: FAIL because a concrete changed-layout regression is present; do not add speculative viewport tests that already pass unchanged.

- [ ] **Step 3: Apply the smallest CSS or presentational correction**

Keep page padding, document slots, attachment rows, and action groups within the available width at 1440px, 1024px, 390px, and 320px. Do not use horizontal-scroll tables or hide actionable error/recovery controls.

- [ ] **Step 4: Run final verification**

Run:

```bash
pnpm --filter @namdw/web test -- knowledge-api.test.ts knowledge-integration.test.tsx knowledge-editor.test.tsx knowledge-assets.test.ts KnowledgeShell.test.tsx EditorPage.test.tsx
pnpm --filter @namdw/shared test -- assets-route.test.ts notes-route.test.ts search-route.test.ts
pnpm --filter @namdw/web typecheck
pnpm exec tsc -p functions/tsconfig.json --noEmit
pnpm exec eslint apps functions packages
pnpm --filter @namdw/web build
git diff --check
git status --short
```

Expected: focused web and shared suites pass, source lint is clean, both typechecks and web build exit `0`, and the diff contains no API/data/auth/Cloudflare/config changes. If repository-wide lint sees Wrangler-generated files under `.wrangler/tmp`, record that pre-existing generated-file limitation and retain the source-directory lint result without changing lint configuration.

- [ ] **Step 5: Manual route and viewport evidence**

Verify `/knowledge`, `/knowledge/notes`, `/knowledge/notes/new`, and `/knowledge/notes/:id` at 1440px, 1024px, 390px, and 320px. Record loading/ready/error states for overview and articles; create/edit autosave and explicit version behavior; attachment upload/download/delete in the current session; and the known post-refresh attachment limitation. If screenshot automation is unavailable, record routes, viewport checklist, and manual evidence instead of blocking the checkpoint.

- [ ] **Step 6: Commit any isolated responsive correction**

```bash
git add -- apps/web/src/knowledge-ui/DashboardPage.tsx apps/web/src/knowledge-ui/NotesPage.tsx apps/web/src/knowledge-ui/EditorPage.tsx apps/web/src/knowledge-ui/AssetPanel.tsx apps/web/src/knowledge/KnowledgeDashboardRoute.tsx apps/web/src/knowledge/KnowledgeNotesRoute.tsx apps/web/src/knowledge/KnowledgeEditorRoute.tsx apps/web/src/knowledge/knowledge-adapter.ts apps/web/src/knowledge-ui/knowledge.css apps/web/src/knowledge/knowledge-integration.test.tsx apps/web/src/knowledge/knowledge-editor.test.tsx apps/web/src/knowledge/knowledge-assets.test.ts apps/web/src/knowledge-ui/KnowledgeShell.test.tsx apps/web/src/knowledge-ui/EditorPage.test.tsx
git commit -m "fix(web): refine knowledge responsive layout"
```

Do not run this commit command if Phase 4.5 needs no source change.

## Phase 4 Checkpoint Report

Report changed files and their purpose; a route/API matrix; test/typecheck/lint/build outputs; desktop/mobile evidence; any screenshot fallback evidence; `git status --short`; the Phase 3B blocked record; and these confirmations:

- API unchanged.
- D1/R2 unchanged.
- Cloudflare unchanged.
- Auth unchanged.
- Persistence semantics unchanged.

## Plan Self-Review

- **Phase sequence coverage:** Phase 4.1 is the shell; Phase 4.2 is the overview; Phase 4.3 is the articles list; Phase 4.4 is the editor experience; Phase 4.5 is responsive and regression validation.
- **Capability coverage:** Tasks use only stats, notes/search, note mutations/versions, and the existing protected asset upload/download/delete flows. The three unavailable capabilities are explicit non-goals and stop conditions.
- **Contract protection:** No task touches Functions, shared contracts, migrations, R2 configuration, Cloudflare, authentication, `contentJson`, or the Tiptap schema.
- **Product scope:** The plan improves real overview, article-list, and editor presentation without a media library, fake metadata, placeholder analytics, or a new content workflow.
- **Rollback and verification:** Every implementation task is code-only, test-first, independently committable, and has rollback/verification evidence. The final task distinguishes source lint from Wrangler-generated local files.
