# Personal Blog and Knowledge Workspace

This repository contains a React/Vite personal blog and a knowledge workspace
served by Cloudflare Pages Functions. The public blog can fall back to bundled
content; the knowledge workspace uses the existing Pages Functions, D1, and
private R2 bindings.

## Runtime boundaries

- Public blog routes: `/`, `/posts/*`, `/projects/*`, `/about`, and `/search`.
  Their content client uses `VITE_API_BASE_URL` (default: `/api/v1`) and falls
  back to bundled static content if that legacy content API is unavailable.
- Knowledge UI routes: `/knowledge`, `/knowledge/notes`, and
  `/knowledge/notes/:id` (including `/new`). They call the existing `/api/*`
  Pages Functions for note, search, stats, version, and asset operations.
- API boundary: the current Functions middleware requires a valid Cloudflare
  Access assertion for **every** `/api/*` request. This includes knowledge read
  requests as well as mutations. Local Pages development may use the explicit
  `LOCAL_AUTH_BYPASS=true` setting in `.dev.vars`.
- Storage: D1 is bound as `DB`; R2 is bound as `KB_ASSETS` and stays private.
  Assets are downloaded through the authenticated API and never receive public
  R2 URLs.

The previous NestJS/PostgreSQL application remains in the monorepo for its
own development path. It is not the deployment target for the Pages knowledge
workspace described below.

## Requirements

- Node.js 24 or later
- Corepack with pnpm 11.13.0
- Cloudflare account access only when preparing Pages, D1, R2, or Access
  settings (not required for a frontend-only build)

Install dependencies:

```bash
corepack enable
corepack prepare pnpm@11.13.0 --activate
pnpm install --frozen-lockfile
```

## Local development

### Public blog only

```bash
pnpm --filter @namdw/web dev
```

Open `http://127.0.0.1:5173`. Without a separately running legacy content
API, public blog pages use bundled static content and display the existing
fallback notice where applicable.

### Pages Functions with local D1/R2 emulation

This is the supported workflow for exercising the knowledge API locally.

```bash
Copy-Item .dev.vars.example .dev.vars
pnpm d1:migrate:local
pnpm --filter @namdw/web build
pnpm pages:dev
```

`LOCAL_AUTH_BYPASS=true` is allowed only by the local hostname check in the
Functions middleware. Never commit `.dev.vars` and never set that value to
`true` in a deployed environment.

Use the local Pages URL printed by Wrangler to verify `/knowledge` and its API
flows. The checked-in `wrangler.jsonc` supplies the non-secret binding mapping;
the `--local` migration creates local Wrangler state only.

## Environment and bindings

| Location | Name | Purpose |
| --- | --- | --- |
| `.dev.vars` (local only) | `LOCAL_AUTH_BYPASS=true` | Allows local Functions requests without an Access assertion. |
| `wrangler.jsonc` Production and Preview vars | `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` | Cloudflare Access JWT verification. |
| `wrangler.jsonc` Production and Preview vars | `LOCAL_AUTH_BYPASS=false` | Prevents a deployed bypass. |
| `wrangler.jsonc` Production and Preview bindings | `DB`, `KB_ASSETS` | D1 knowledge data and private R2 asset storage. |
| `.env` (legacy standalone API only) | `DATABASE_URL`, `API_HOST`, `API_PORT`, `VITE_API_BASE_URL` | Supports the retained NestJS/PostgreSQL content API workflow; it is not read by Pages Functions. |

`CF_ACCESS_AUD`, D1 database IDs, and R2 bucket names are deployment
configuration values, not browser-exposed variables. Do not copy them into
`VITE_*` values.

## Cloudflare Pages release workflow

1. Review the Pages configuration without contacting or changing Cloudflare:

   ```bash
   pnpm cloudflare:verify-config
   ```

2. Run the release checks below and build `apps/web/dist`.
3. In Cloudflare Pages, use repository root as the root directory, the build
   command `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @namdw/web build`,
   and `apps/web/dist` as the output directory.
4. Confirm Production and Preview each have distinct D1 and R2 resources with
   the exact binding names `DB` and `KB_ASSETS`. Keep R2 private.
5. Confirm the deployed Pages project uses the same Access team-domain and AUD
   variables as `wrangler.jsonc`, with `LOCAL_AUTH_BYPASS=false`.
6. Deploy through the approved release process. This repository does not deploy
   automatically.
7. Run the preview verification checklist in
   [`docs/deployment/release-readiness.md`](docs/deployment/release-readiness.md).

`apps/web/public/_redirects` is included in the Vite output and supplies the
SPA deep-link fallback (`/* /index.html 200`).

## Release checks

```bash
pnpm cloudflare:verify-config
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The repository-wide linter currently traverses local Wrangler output when it
exists, even though `.wrangler/` is ignored by Git; use the scoped source lint
command documented in the release report while that baseline tooling issue
remains unresolved. The full web test suite also has pre-existing static
content-count expectations that do not match the committed content set. Both
conditions are documented as known baseline failures rather than release
changes.

## Current limitations

- There is no persistent note-to-asset relationship.
- There is no media library or asset-list API.
- Markdown import is not implemented for the knowledge workspace.
- The Tiptap schema does not store asset references.
- R2 objects have no public URLs.
- Because the current middleware protects all `/api/*`, an unauthenticated
  production visitor can open the knowledge route shell but cannot load
  knowledge data. Making public knowledge reads available requires a later,
  separately approved authentication-boundary change.

See [Cloudflare Pages setup](docs/cloudflare-setup.md) for the configuration
mapping and [release readiness](docs/deployment/release-readiness.md) for the
handoff checklist and verification record.
