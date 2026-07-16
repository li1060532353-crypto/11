# Local API Docker Deployment Design

## Goal

Run the NestJS content API and PostgreSQL together through Docker Compose on Windows, avoiding host-side Prisma database connections. The API must be available at `http://127.0.0.1:3000` and expose the existing `/api/v1` endpoints.

## Architecture

The existing `postgres` Compose service remains the database and retains its named volume. A new `api` service is built from the repository source with Node 24. It joins the default Compose network and uses the service hostname `postgres` rather than `localhost` for `DATABASE_URL`.

`api` waits for the PostgreSQL health check via `depends_on`. Its startup sequence generates Prisma Client, applies committed migrations, runs the idempotent seed script, then starts the compiled NestJS application. Port `3000` is published only from the API service.

## Components

- `apps/api/Dockerfile`: builds the pnpm workspace and produces the API runtime image.
- `docker-compose.yml`: adds the API service, its database connection string, health dependency, restart policy, and port mapping.
- Existing Prisma migration and seed data: unchanged and applied at container startup.

## Data Flow and Failure Handling

Docker Compose starts PostgreSQL first. Once healthy, the API contacts `postgres:5432` over the Docker network. A failed migration, seed, or API startup makes the API container exit and leaves PostgreSQL data intact in its named volume. Logs remain available through `docker compose logs api`.

## Validation

After `docker compose up -d --build`, verify that both services are running, then request `/api/v1/health` and `/api/v1/content/posts`. The second endpoint must return seeded public content.

## Scope

This adds local deployment infrastructure only. It does not alter API routes, Prisma schema, business logic, or frontend behavior.
