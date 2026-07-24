# Cloudflare Pages, D1, R2, and Access Setup

This is a configuration runbook. It describes the checked-in application
requirements but does not change the Cloudflare Dashboard, deploy code, or
apply migrations remotely.

## Checked-in configuration

`wrangler.jsonc` is the source of truth for the Pages project mapping:

| Environment | D1 binding | R2 binding | Access variables |
| --- | --- | --- | --- |
| Production (top level) | `DB` → `personal-blog-db` | `KB_ASSETS` → `personal-blog-assets` | `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `LOCAL_AUTH_BYPASS=false` |
| Preview (`env.preview`) | `DB` → `personal-blog-db-preview` | `KB_ASSETS` → `personal-blog-assets-preview` | Same names, Preview-specific Access audience, `LOCAL_AUTH_BYPASS=false` |

`KB_ASSETS` is intentionally private. `ASSETS` must not be used as the binding
name because Pages reserves it. The config validator checks binding names,
distinct Production/Preview resources, concrete D1 IDs, required variables,
and the `apps/web/dist` Pages build output:

```bash
pnpm cloudflare:verify-config
```

The validator proves configuration structure only. It does not assert that a
remote resource exists and does not make a control-plane request.

## Dashboard verification before a later deployment

1. In Workers & Pages, ensure the Pages project matches the `name` field in
   `wrangler.jsonc` and uses `apps/web/dist` as its output directory.
2. Ensure Production has D1 binding `DB` and R2 binding `KB_ASSETS`; ensure
   Preview has the corresponding distinct resources.
3. Keep the R2 buckets private. The application accesses them only through the
   existing authenticated asset Functions; do not enable a public bucket URL.
4. Set the three Access variables in both Pages environments. The AUD is the
   Access application audience tag, not an identity or email address.
5. Keep `LOCAL_AUTH_BYPASS=false` for Production and Preview.
6. Verify `migrations/0001_knowledge_base.sql` has been applied to each target
   D1 database by the separately approved data-release process. Do not apply a
   migration merely to perform this documentation review.

## Current Access boundary

`functions/_middleware.ts` validates every `/api/*` request using the
`Cf-Access-Jwt-Assertion` header. It does not add a client-side login gate and
does not protect non-API SPA routes.

This means the current deployed behavior is:

- public blog routes can render, including their static-content fallback;
- `/knowledge/*` routes can load their SPA shell without a route guard;
- knowledge list, detail, stats, version, and asset requests require Access,
  because all of them use `/api/*`;
- create, update, archive/restore, version creation, and asset mutations also
  require Access.

An eventual public-read/protected-mutation split is not configured by this
runbook and must be designed and approved independently.

## Local Functions verification

```powershell
Copy-Item .dev.vars.example .dev.vars
pnpm d1:migrate:local
pnpm --filter @namdw/web build
pnpm pages:dev
```

The copied `.dev.vars` enables the local-only bypass. Wrangler creates local
state under `.wrangler/`; that directory is generated, ignored, and should not
be committed. Remove it only as local runtime cleanup, never as a deployment
step.

After `pages:dev` reports a local URL, verify a blog route, `/knowledge`, and
the existing note CRUD flow. See
[release readiness](deployment/release-readiness.md) for the full checklist.
