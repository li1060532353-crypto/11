# Blockers

## B-001 Baseline test mismatch

Command: `pnpm --filter @namdw/web test`

Error: 5 failures in `apps/web/src/content/contentQueries.test.ts`; expectations assume 6 legacy posts while generated Markdown content adds 2 posts.

Affected commit: `3b4b75f` plus existing untracked static-import plan/content state.

Attempts: one read-only baseline run; no code changes attempted because Wave 0 forbids production implementation.

Evidence: test output recorded in the Wave 0 controller log; `pnpm content:check` passed with 2 validated Markdown articles.

Recommended next action: classify and repair this fixture/expectation mismatch as a scoped, reviewed maintenance task only after H0 approval; do not weaken tests.

## B-002 Pages R2 binding compatibility

Command: `pnpm exec wrangler d1 migrations apply DB --local --config test-fixtures/wrangler.local.jsonc`

Error: Wrangler 4.112.0 rejects the Pages R2 binding name `ASSETS` as reserved.

Affected commit: `b2516b5` (binding template); no production resource was contacted.

Evidence: local command output logged 2026-07-18; D1-only fixture is used only to verify migration reproducibility.

Recommended next action: retain the binding name required by the master specification until H1 approval, then resolve the Cloudflare naming conflict before H2 production configuration.
