# Wave 2 Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` task-by-task.

**Goal:** Implement protected D1 note CRUD, search/statistics, and an isolated dashboard/notes visual shell.

**Architecture:** Terra implements Functions after the frozen `ApiRouteContractMap`; Luna may implement only presentational frontend components after API contracts remain unchanged. Frontend API integration is a later controller-only sequential task.

**Tech Stack:** Pages Functions, D1, React/Vite, TypeScript, Vitest.

## Global Constraints

- Use `/api/*`, `DB`, and `KB_ASSETS`; preserve legacy `/api/v1/*`.
- Every route is protected by existing Access middleware.
- Use `.bind()`, server-derived text, archived soft delete, and shared envelopes.
- Do not alter migrations, shared contracts, Access middleware, router, or API client in parallel work.

### Task 1: Notes API (Terra, sequential)

**Files:** Create `functions/lib/{notes,validation}.ts`, `functions/api/notes/[[path]].ts`; test `functions/lib/notes.test.ts`.

**Interfaces:** Consume `ApiRequestFor<'GET /api/notes'>`, `ApiRequestFor<'POST /api/notes'>`, `ApiRequestFor<'PATCH /api/notes/:id'>`; produce matching `ApiResponseFor` types.

- [ ] Write failing tests for CRUD, archive/restore, review increment, duplicate slug, validation, and tags.
- [ ] Run focused tests; implement only required D1 prepared statements and handlers; rerun tests; commit.

### Task 2: Search and stats (Terra, sequential after Task 1 review)

**Files:** Create `functions/lib/search.ts`, `functions/api/{search,stats}.ts`; test `functions/lib/search.test.ts`.

**Interfaces:** Consume `ApiRequestFor<'GET /api/search'>`; produce `ApiResponseFor<'GET /api/search'>` and `ApiResponseFor<'GET /api/stats'>`.

- [ ] Write failing tests for escaped LIKE wildcards, title/content/tag search, pagination, and D1 counts.
- [ ] Run focused tests; implement; rerun tests; commit.

### Task 3: Presentational shell (Luna, only after Task 2 contracts stay frozen)

**Files:** Create `apps/web/src/knowledge-ui/{DashboardPage,NotesPage}.tsx`, `knowledge.css`; test `KnowledgeShell.test.tsx`.

**Interfaces:** Consume static view-model props equivalent to `KnowledgeStats`, `NoteRecord`, and `NoteListQuery`; do not use fetch or modify router/shared/API files.

- [ ] Write failing loading, empty, error, pinned, archived, and filter UI tests.
- [ ] Implement injected-prop accessible presentation; rerun tests; commit.

### Task 4: Review gate

- [ ] Independently review Access coverage, `.bind()` use, contract conformance, and test evidence.
- [ ] Resolve Critical/Important findings before controller-owned frontend integration.
