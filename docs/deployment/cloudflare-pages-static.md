# Cloudflare Pages Static Blog Mode

This optional mode deploys only the Vite output for the public blog. It is not
the full knowledge-workspace release path.

With no Pages Functions/D1 deployment, `/api/v1` is unavailable and public
blog surfaces use their bundled static-content fallback. The `/knowledge/*`
route shell may still resolve through the SPA fallback, but knowledge data and
editing will not work because the required `/api/*` Functions are absent.

## Pages settings

| Setting | Value |
| --- | --- |
| Framework preset | None / Vite |
| Build command | `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @namdw/web build` |
| Build output directory | `apps/web/dist` |
| Root directory | repository root |
| Node.js version | `24` |

`VITE_API_BASE_URL=/api/v1` is optional and is already the application default.
It affects the retained legacy public-content client, not the knowledge API.

## SPA fallback

`apps/web/public/_redirects` is copied to the Vite output and serves
`index.html` for deep links, including `/posts`, `/projects`, `/search`, and
`/knowledge`.

## Verify after a static-only deployment

1. Load `/`, `/posts`, one public article, `/projects`, and `/search`.
2. Refresh each route directly to confirm the SPA fallback.
3. Confirm public pages show their existing fallback notice rather than a hard
   failure when their legacy content API is unavailable.
4. Do not treat static-only mode as verification of D1, R2, Pages Functions,
   or knowledge CRUD.

For the full release workflow, use
[Cloudflare setup](../cloudflare-setup.md) and
[release readiness](release-readiness.md).
