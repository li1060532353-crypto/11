# Local API Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the NestJS content API and PostgreSQL together through Docker Compose, exposing the seeded API at `http://127.0.0.1:3000`.

**Architecture:** Add a Node 24 API image that installs the pnpm workspace, builds `@namdw/shared` and `@namdw/api`, then starts the compiled API. Compose runs the existing PostgreSQL service and the new API on its default network; the API connects to the `postgres` service hostname and applies migrations and seed data before listening on port 3000.

**Tech Stack:** Docker Compose, Dockerfile, Node.js 24 Alpine, pnpm 11.13.0, NestJS, Prisma 6, PostgreSQL 17.

## Global Constraints

- Preserve the existing `personal_blog_postgres` named volume.
- API database connections must use `postgres:5432` inside Compose, never Windows `localhost:5432`.
- Keep existing API routes and Prisma schema unchanged.
- API startup must apply only committed migrations and use the existing idempotent seed script.

---

### Task 1: Build and run the API as a Compose service

**Files:**
- Create: `apps/api/Dockerfile`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: `apps/api/package.json` scripts `build`, `prisma:generate`, and `prisma:seed`; committed Prisma migrations under `apps/api/prisma/migrations`.
- Produces: Compose service `api`, reachable from the host at `127.0.0.1:3000` and internally connected to `postgres:5432`.

- [ ] **Step 1: Add a failing deployment check**

Run:

```powershell
docker compose config --quiet
docker compose up -d --build api
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/v1/health
```

Expected before implementation: Compose reports that no `api` service exists and the health request cannot connect.

- [ ] **Step 2: Create the API image definition**

Create `apps/api/Dockerfile` with this content:

```dockerfile
FROM node:24-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.13.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN pnpm --filter @namdw/shared build && pnpm --filter @namdw/api build

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@11.13.0 --activate

COPY --from=build /app /app

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @namdw/api prisma:migrate -- --name local_content_api && pnpm --filter @namdw/api prisma:seed && pnpm --filter @namdw/api start"]
```

- [ ] **Step 3: Add the Compose API service**

Add this `api` service beneath `postgres` in `docker-compose.yml`:

```yaml
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - '3000:3000'
    environment:
      API_HOST: 0.0.0.0
      API_PORT: 3000
      DATABASE_URL: postgresql://personal_blog:personal_blog@postgres:5432/personal_blog?schema=public
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
```

- [ ] **Step 4: Run the deployment check**

Run:

```powershell
docker compose config --quiet
docker compose up -d --build api
docker compose ps
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/v1/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/v1/content/posts
```

Expected: both services are running; the health endpoint returns HTTP 200; the posts endpoint returns HTTP 200 with seeded post data.

- [ ] **Step 5: Verify restart safety**

Run:

```powershell
docker compose restart api
docker compose logs --tail 100 api
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/v1/content/posts
```

Expected: the API restarts without migration or seed errors, and the posts endpoint continues to return HTTP 200.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/Dockerfile docker-compose.yml
git commit -m "feat: dockerize local content api"
```

### Task 2: Document local API operations

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Compose services `postgres` and `api` from `docker-compose.yml`.
- Produces: Windows-compatible commands to start, verify, inspect, and stop the local API stack.

- [ ] **Step 1: Add a failing documentation check**

Run:

```powershell
rg -n "docker compose up -d --build api|api/v1/health|docker compose logs api" README.md
```

Expected before implementation: no Docker API workflow is documented.

- [ ] **Step 2: Add the local Docker API workflow to README**

Add a `## Local Docker API` section after `## Setup`:

```markdown
## Local Docker API

Start the database and API together:

```powershell
docker compose up -d --build api
```

Verify the API:

```text
http://127.0.0.1:3000/api/v1/health
http://127.0.0.1:3000/api/v1/content/posts
```

Inspect service state and logs:

```powershell
docker compose ps
docker compose logs api
```

Stop the local stack while retaining database data:

```powershell
docker compose down
```
```

- [ ] **Step 3: Run the documentation check**

Run:

```powershell
rg -n "docker compose up -d --build api|api/v1/health|docker compose logs api" README.md
```

Expected: the command and both API operations are present.

- [ ] **Step 4: Commit**

```powershell
git add README.md
git commit -m "docs: add local Docker API workflow"
```

## Final Verification

- [ ] Run `docker compose config --quiet`.
- [ ] Run `docker compose up -d --build api`.
- [ ] Confirm `docker compose ps` reports healthy PostgreSQL and running API.
- [ ] Confirm `/api/v1/health` and `/api/v1/content/posts` both return HTTP 200.
- [ ] Run `docker compose down` only if the user requests stopping the local deployment; otherwise leave the stack running.
