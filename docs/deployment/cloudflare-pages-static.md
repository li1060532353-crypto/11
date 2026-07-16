# Cloudflare Pages Static Deployment

This is the lowest-cost deployment path for the blog. It deploys only the Vite frontend to Cloudflare Pages and does not deploy the NestJS API or PostgreSQL database.

The frontend is already API-first with static fallback. On this static deployment, `/api/v1` will not exist, so the public pages render from the bundled static content.

## Cloudflare Pages settings

Use these settings when creating the Pages project from GitHub:

| Setting                | Value                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Framework preset       | None / Vite                                                                          |
| Build command          | `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @namdw/web build` |
| Build output directory | `apps/web/dist`                                                                      |
| Root directory         | repository root                                                                      |
| Node.js version        | `24`                                                                                 |

Environment variables are optional for the static-only deployment. If Cloudflare asks for one, use:

```text
VITE_API_BASE_URL=/api/v1
```

## SPA route fallback

`apps/web/public/_redirects` is copied into the Vite build output and tells Cloudflare Pages to serve `index.html` for deep links such as:

- `/posts`
- `/posts/prisma-seeding-patterns`
- `/projects`
- `/tags/workflow`

## Deployment steps

1. Push this repository to GitHub.
2. Open Cloudflare Dashboard → Workers & Pages → Create → Pages.
3. Connect the GitHub repository.
4. Fill in the settings above.
5. Deploy.
6. Open the generated `*.pages.dev` URL and test:
   - homepage;
   - `/posts`;
   - one article detail page;
   - `/projects`;
   - `/search`.

## Later API deployment

When a backend and PostgreSQL are deployed later, set `VITE_API_BASE_URL` to the public API prefix, for example:

```text
VITE_API_BASE_URL=https://api.example.com/api/v1
```

Until then, the static fallback keeps the public blog usable on the free Pages deployment.
