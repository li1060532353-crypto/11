# Release Readiness and Handoff

## Release target

The current release is a Cloudflare Pages application built from
`apps/web/dist`, with Pages Functions in `functions/`, D1 bound as `DB`, and
private R2 bound as `KB_ASSETS`.

The public blog uses the existing API-first/static-fallback content client. The
knowledge workspace uses the existing note, search, stats, version, and asset
Functions. Knowledge/editor code is route-lazy-loaded, so public blog routes do
not load the Tiptap editor bundle initially.

## Deployment requirements

- Node.js 24 and pnpm 11.13.0.
- A Pages project matching `wrangler.jsonc`.
- Production and Preview D1 databases with `migrations/0001_knowledge_base.sql`
  applied through an approved data-release process.
- Production and Preview private R2 buckets bound as `KB_ASSETS`.
- `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, and `LOCAL_AUTH_BYPASS=false` set
  for both Pages environments.
- `apps/web/dist` as the Pages build output and the committed `_redirects`
  fallback included in the deployed artifact.

## Pre-release commands

Run from repository root:

```bash
pnpm cloudflare:verify-config
pnpm typecheck
pnpm exec eslint apps/web/src functions packages/shared/src
pnpm --filter @namdw/shared test
pnpm --filter @namdw/web test -- router.performance.test.ts App.test.tsx knowledge-api.test.ts knowledge-integration.test.tsx knowledge-editor.test.tsx knowledge-assets.test.ts EditorPage.test.tsx KnowledgeShell.test.tsx
pnpm --filter @namdw/web build
```

The final command emits the deployable Vite artifact. Record its manifest and
gzip sizes with the release evidence; the most recent verified public entry was
`890,614 B` (`277.39 kB` gzip), while the editor route chunk was `398,704 B`
(`124.92 kB` gzip). Filenames are content-hashed and will change on a later
build.

## Preview verification checklist

After an explicitly approved deployment, verify the following in the target
environment:

| Area | Check |
| --- | --- |
| SPA | Directly load and refresh `/`, `/posts`, `/search`, `/knowledge`, `/knowledge/notes`, and a known note route. |
| Public blog | Confirm homepage, post lists/detail, projects, search, and fallback notices render without an available legacy content API. |
| Access | In a private browser, an unauthenticated `/api/*` request returns the existing Access-denied response; an authenticated request follows the configured Access policy. |
| Knowledge | With Access, load stats/list/detail, create/update/archive or restore a test note, create an explicit version, and confirm reload persistence. |
| Assets | With Access, upload, download, and delete a test asset; confirm no public R2 URL is shown. |
| Responsive | Recheck the 1440px, 1280px, 1024px, 390px, and 320px layouts for no horizontal overflow. |

Use a disposable test record/asset only in a separately approved environment
that permits mutations. This document does not authorize production writes.

## Known limitations and baseline findings

- No persistent note-to-asset relationship exists.
- No media library or asset-list endpoint exists.
- Knowledge Markdown import is unavailable.
- The current Tiptap schema has no asset-reference node.
- R2 remains private; there is no public R2 URL exposure.
- Current middleware protects every `/api/*` request. Therefore knowledge
  reading requires Access even though the SPA routes themselves do not have a
  frontend route guard.
- Vite reports a chunk-size advisory for the public entry bundle. The knowledge
  and editor dependencies are already separated into lazy route chunks; no
  broad refactor is included in release preparation.
- `pnpm lint` can report generated `.wrangler/tmp` files when local Wrangler
  state exists because ESLint does not honor `.gitignore` for that invocation.
  The scoped source lint command above is the reproducible release check.
- The full web suite has five pre-existing content-query expectation failures:
  it expects six static posts while the committed content set contains eight.
  This phase does not alter content fixtures or tests.

## Repository hygiene

`.wrangler/` and `test-fixtures/.wrangler/` are confirmed local runtime state;
they are ignored. `apps/web/dist/`, `node_modules/`, coverage, `.dev.vars`, and
environment files are also generated or local-only and are ignored. Preserve
`docs/superpowers/plans/2026-07-17-local-api-docker-deployment-implementation.md`;
it is an unrelated untracked planning document and must not be removed during
release cleanup.

## Recommended next steps

1. Obtain separate approval for a Preview deployment and run the checklist.
2. Resolve the static content-query test expectations in a focused maintenance
   change.
3. Decide whether public knowledge reads are required. If so, design the
   authentication/API boundary before changing middleware or Cloudflare Access.
4. Design persistent asset references only if product requirements require a
   note-to-asset data model and Tiptap schema change.
