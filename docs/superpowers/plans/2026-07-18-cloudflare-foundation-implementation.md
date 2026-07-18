# Cloudflare Knowledge-Base Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the tested, deploy-safe D1/Pages Functions foundation without frontend API integration.

**Architecture:** A D1 SQL migration defines the knowledge-base data model. Shared package contracts define the complete response envelope and resource shapes. Pages middleware protects `/api/*`, allowing only an explicit local bypass and otherwise validating a Cloudflare Access JWT against the configured team JWKS and audience. Wrangler configuration remains a non-deployable template until H2 supplies real resource identifiers.

**Tech Stack:** React/Vite (unchanged), Cloudflare Pages Functions, D1, R2 bindings, TypeScript, Vitest, `jose`, Wrangler.

## Global Constraints

- Preserve the pnpm lockfile and existing static content/routes; do not touch frontend API integration in Wave 1.
- D1 binding name is `DB`; R2 binding name is `ASSETS`; R2 is private.
- `content_json` is canonical and `content_text` is server-derived.
- Every `/api/*` route is protected; production fails closed when Access configuration is missing.
- Use prepared statements and reproducible SQL migrations; do not add FTS5.
- Never commit resource IDs, Access values, credentials, or local development secrets.

---

### Task 1: Freeze database and API contracts

**Files:** Create `migrations/0001_knowledge_base.sql`, `packages/shared/src/knowledge.ts`, `packages/shared/src/knowledge.test.ts`; modify `packages/shared/src/api.ts`, `packages/shared/src/index.ts`.

**Produces:** SQL tables/indexes/constraints and shared `ApiSuccess`, `ApiFailure`, `ApiResponse`, note/roadmap/asset/request types consumed by later Functions.

- [ ] Write failing tests asserting success/error envelopes are discriminated by `success`, note status rejects invalid literals at compile time, and route descriptors expose the required methods/paths.
- [ ] Run `pnpm --filter @namdw/shared test` and record the expected missing-module/type failure.
- [ ] Implement only the contracts and the SQL migration: UUID text primary keys; archive-based deletion; cascade joins/versions and set-null asset/item note references; required indexes; roadmap progress checks; timestamps stored as ISO UTC text.
- [ ] Re-run shared tests; run SQLite syntax/foreign-key validation via a disposable local D1 database after Wrangler is installed.
- [ ] Commit the focused contract/migration task.

### Task 2: Add verified Access middleware

**Files:** Create `functions/_middleware.ts`, `functions/lib/auth.ts`, `functions/lib/http.ts`, `functions/lib/auth.test.ts`; create `functions/tsconfig.json`.

**Consumes:** Shared envelopes and `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `LOCAL_AUTH_BYPASS` environment bindings.

**Produces:** `requireApiAccess` behavior: non-API paths proceed; development bypass only when runtime is local and variable equals `true`; all other API requests require `Cf-Access-Jwt-Assertion`, JWKS signature/issuer/audience validation, and return a 403 error envelope on any invalid/missing/configuration state.

- [ ] Write failing tests for missing assertions, missing production configuration, wrong audience, valid token, and rejected production bypass.
- [ ] Run the auth test and observe the expected missing-module failure.
- [ ] Implement minimal `jose`-based remote JWKS validation, cache the JWKS resolver by team domain, use `https://<team>.cloudflareaccess.com` issuer, and avoid trusting frontend headers/cookies as identity.
- [ ] Re-run auth tests and the function typecheck.
- [ ] Commit the focused middleware task.

### Task 3: Add safe local Wrangler setup and documentation

**Files:** Create `wrangler.example.jsonc`, `.dev.vars.example`, `docs/cloudflare-setup.md`, `scripts/verify-cloudflare-config.mjs`; modify `.gitignore`, root `package.json`.

**Consumes:** Binding names and auth variable names from previous tasks.

**Produces:** A checked-in template—not a deployable production configuration—with explicit placeholder detection, local D1/R2 mode, non-secret example variables, documented H2 dashboard actions, and scripts for `pages:dev`, migration apply, and config verification.

- [ ] Write failing node tests for placeholder/config validation and run them before implementing the verifier.
- [ ] Install only `wrangler`, `jose`, and required type packages using pnpm; retain existing lockfile/package manager.
- [ ] Implement the verifier and templates. `wrangler.jsonc` is intentionally not created until H2 generates/downloads production-aligned configuration; this avoids silently replacing a live Pages project’s dashboard bindings.
- [ ] Run config tests, `wrangler d1 migrations apply --local` using a temporary copied config with local-only resource values, and `wrangler pages dev` smoke only after the frontend build exists.
- [ ] Commit the local setup task.

### Task 4: Review and H1 evidence

**Files:** Create `.codex/reviews/w1-foundation-review.md`; update `.codex/progress.md`, `.codex/decisions.md`, `.codex/blockers.md`, `.codex/human-actions.md`.

- [ ] Independently inspect migration constraints, Access failure paths, generated diff, package-lock changes, and secret exposure.
- [ ] Record specification compliance and code quality/safety verdicts; resolve Critical/Important findings before H1.
- [ ] Run scope-appropriate shared/function/config tests, project typecheck/lint/build, and record baseline failures separately from new failures.
- [ ] Commit review and durable-state updates, then present H1 without invoking frontend integration or Cloudflare dashboard changes.
