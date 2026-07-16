# Cloudflare Pages Static Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the blog for free Cloudflare Pages static deployment without deploying the API/database.

**Architecture:** Build only `apps/web` to `apps/web/dist`; Cloudflare Pages serves the static SPA. Existing frontend API fallback keeps content available when `/api/v1` has no backend.

**Tech Stack:** Cloudflare Pages, Vite, React Router, pnpm.

## Global Constraints

- Do not deploy NestJS API or PostgreSQL in this module.
- Cloudflare Pages output directory is `apps/web/dist`.
- SPA refresh routes must fall back to `index.html`.
- Existing static content fallback remains the production content source for free static hosting.
- No backend, database, auth, admin, or custom domain implementation.

---

### Task 1: Cloudflare Pages static config and docs

**Files:**
- Create: `apps/web/public/_redirects`
- Create: `docs/deployment/cloudflare-pages-static.md`
- Modify: `README.md`

**Steps:**
- Add `_redirects` with `/* /index.html 200`.
- Document Cloudflare Pages settings: build command `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @namdw/web build`, output `apps/web/dist`, env optional `VITE_API_BASE_URL=/api/v1`.
- Update README with the quick deployment path.
- Verify with web build and full available quality checks.
