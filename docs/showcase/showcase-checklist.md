# Showcase Checklist

## Demo preparation

- [ ] Install the locked dependency set with Node.js 24 and pnpm 11.13.0.
- [ ] Run `pnpm --filter @namdw/web build` before using a production preview.
- [ ] For knowledge interactions, use local Pages development with the
  documented local-only bypass, or an approved Access-authenticated environment.
- [ ] Prepare a disposable note only in an environment approved for mutation.
- [ ] Start on `/`, then use the walkthrough in [Demo Walkthrough](demo-walkthrough.md).
- [ ] Do not claim persistent attachments, a media library, Markdown import,
  multi-user permissions, or public R2 URLs.

## Recommended screenshot capture plan

Capture real application state only. Do not fabricate data, overlays, or
screenshots.

| Screenshot | Route | Capture guidance |
| --- | --- | --- |
| Public homepage | `/` | Use the desktop layout; include the main content hierarchy and navigation. |
| Article reading | `/posts/matrix-rank` | Capture the title, reading layout, and real article body. |
| Knowledge overview | `/knowledge` | Capture after real stats and recent-note data load successfully. |
| Article list | `/knowledge/notes` | Show real list/search or the truthful empty state. |
| Editor | `/knowledge/notes/:id` or `/knowledge/notes/new` | Show a real existing note or an unsaved new-note state; do not imply persistent attachments. |
| Mobile responsive view | Any public page and one Knowledge page | Capture at 390px or 320px after checking navigation and actions do not overflow. |

Before capture, hide personal browser UI where possible, verify readable text,
and include no secrets, Access assertions, resource IDs, or private asset URLs.

## Deployment verification

- [ ] Run `pnpm cloudflare:verify-config`.
- [ ] Confirm `apps/web/dist` is the Pages build output and `_redirects` is in
  the built artifact.
- [ ] Confirm Production and Preview retain distinct `DB` and `KB_ASSETS`
  resources in the approved configuration.
- [ ] Confirm `LOCAL_AUTH_BYPASS=false` in deployed environments.
- [ ] In an approved deployed target, verify an unauthenticated `/api/*`
  request is denied and an authorized request follows the Access policy.
- [ ] Do not deploy, modify the Dashboard, or apply migrations as part of this
  checklist.

See [Release Readiness](../deployment/release-readiness.md) for the complete
deployment handoff and post-deployment verification procedure.

## Capability matrix

| Capability | Status | Notes |
| --- | --- | --- |
| Public blog | Implemented | Public routes with legacy API/static fallback behavior. |
| Search | Implemented | Public content search route. |
| Knowledge overview | Implemented | Real stats and recent notes through protected API requests. |
| Article management | Implemented | List, search, create, edit, archive, and restore using Note APIs. |
| Tiptap editor | Implemented | Existing document schema and `content_json` persistence. |
| Autosave | Implemented | Existing debounce and stale-response protection. |
| Versions | Implemented | Explicit version creation and existing version APIs. |
| Basic asset operations | Implemented with limitation | Upload, download, and delete only; no durable note attachment reference. |
| Media library | Not implemented | No asset-list API or UI. |
| Persistent attachments | Not implemented | No note-asset relationship or Tiptap asset reference. |
| Markdown import | Not implemented | Not available for the knowledge workspace. |
| Multi-user permissions | Not implemented | No product-level multi-user permission model. |

## Release checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Record the bundle sizes from the build output and retain the current known
limitation that Vite reports a public-entry chunk-size advisory. No production
deployment is performed by this checklist.
