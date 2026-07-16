# Personal Blog Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a clean pnpm monorepo in which the React/Vite visitor application, NestJS API, and shared TypeScript package install, test, build, and start through root commands.

**Architecture:** The repository uses pnpm workspaces with `apps/web`, `apps/api`, and `packages/shared`. The shared package owns transport-safe API types and constants; both applications consume its compiled CommonJS output. Root scripts coordinate type checking, tests, builds, development servers, and a production-bundle smoke test.

**Tech Stack:** Node.js 24 LTS, pnpm 11.13.0, TypeScript 5.9.3, React 19.2.7, Vite 8.1.4, NestJS 11.1.28, Vitest 4.1.10, Jest 29.7.0, ESLint 10.7.0, Prettier 3.9.5

## Global Constraints

- Use React, Vite, and TypeScript for the frontend.
- Use Node.js, NestJS, and TypeScript for the backend.
- Use a monorepo with `apps/web`, `apps/api`, and `packages/shared` boundaries.
- Reserve `/api/v1` as the API prefix.
- Keep secrets out of version control; commit only `.env.example`.
- Use strict TypeScript settings and do not suppress type errors.
- This plan implements only Module 1, the testable engineering foundation; visual design and business features remain in later module plans.

---

## Planned File Map

```text
personal-blog/
├── .editorconfig                       # Editor-neutral whitespace rules
├── .env.example                        # Non-secret local configuration contract
├── .gitignore                          # Generated and secret-file exclusions
├── .nvmrc                              # Node major version
├── eslint.config.mjs                   # Shared flat ESLint configuration
├── package.json                        # Root workspace commands and tool versions
├── pnpm-lock.yaml                      # Reproducible dependency graph
├── pnpm-workspace.yaml                 # Workspace membership
├── .prettierignore                     # Generated and planning-file exclusions
├── prettier.config.mjs                 # Formatting policy
├── tsconfig.base.json                  # Shared strict compiler defaults
├── README.md                           # Foundation setup and command guide
├── scripts/smoke.mjs                   # Production web/API startup verification
├── packages/shared/
│   ├── package.json                    # Shared package manifest
│   ├── tsconfig.json                   # Declaration-emitting CommonJS build
│   └── src/
│       ├── api.ts                      # API prefix and success-envelope contract
│       ├── api.test.ts                 # Shared contract unit tests
│       └── index.ts                    # Public package exports
├── apps/web/
│   ├── index.html                      # Vite HTML entry
│   ├── package.json                    # React/Vite commands and dependencies
│   ├── tsconfig.json                   # Browser TypeScript settings
│   ├── vite.config.ts                  # React and Vitest configuration
│   └── src/
│       ├── App.tsx                     # Foundation status screen
│       ├── App.test.tsx                # Server-rendered smoke unit test
│       ├── main.tsx                    # React bootstrap
│       └── styles.css                  # Minimal accessible foundation styles
└── apps/api/
    ├── jest.config.cjs                 # Unit-test configuration
    ├── nest-cli.json                   # Nest build configuration
    ├── package.json                    # Nest commands and dependencies
    ├── tsconfig.json                   # API compiler settings
    ├── tsconfig.build.json             # Production-build exclusions
    ├── src/
    │   ├── app.module.ts               # Root Nest module
    │   ├── health.controller.ts        # Public health contract
    │   ├── health.controller.spec.ts   # Health-controller unit test
    │   └── main.ts                     # Nest bootstrap and `/api/v1` prefix
    └── test/
        ├── health.e2e-spec.ts           # Real HTTP health test
        └── jest-e2e.config.cjs          # End-to-end Jest configuration
```

### Task 1: Establish the workspace toolchain

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `.prettierignore`
- Create: `prettier.config.mjs`
- Create: `.editorconfig`
- Create: `.nvmrc`
- Create: `.env.example`
- Modify: `.gitignore`
- Generate: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the approved monorepo layout and Node.js 24 baseline.
- Produces: root commands `dev`, `build`, `typecheck`, `test`, `lint`, `format:check`, and `smoke`; workspace package discovery for `apps/*` and `packages/*`; shared compiler rules inherited by every package.

- [ ] **Step 1: Add the root package manifest**

Create `package.json`:

```json
{
  "name": "personal-blog",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@11.13.0",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "dev": "pnpm --filter @namdw/shared build && pnpm --parallel --filter @namdw/web --filter @namdw/api dev",
    "build": "pnpm --filter @namdw/shared build && pnpm --filter @namdw/web build && pnpm --filter @namdw/api build",
    "typecheck": "pnpm --filter @namdw/shared build && pnpm -r --if-present typecheck",
    "test": "pnpm --filter @namdw/shared build && pnpm -r --if-present test",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "smoke": "node scripts/smoke.mjs"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "eslint": "10.7.0",
    "globals": "17.7.0",
    "prettier": "3.9.5",
    "typescript": "5.9.3",
    "typescript-eslint": "8.64.0",
    "vitest": "4.1.10"
  }
}
```

- [ ] **Step 2: Add workspace and TypeScript configuration**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 3: Add linting and formatting configuration**

Create `eslint.config.mjs`:

```js
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/coverage/**', '**/dist/**', '**/node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
```

Create `prettier.config.mjs`:

```js
export default {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
};
```

Create `.prettierignore`:

```gitignore
coverage/
dist/
docs/superpowers/
node_modules/
.superpowers/
```

Create `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: Add runtime and environment contracts**

Create `.nvmrc`:

```text
24
```

Create `.env.example`:

```dotenv
API_HOST=127.0.0.1
API_PORT=3000
WEB_PORT=5173
VITE_API_BASE_URL=/api/v1
```

Append the following entries to `.gitignore` if they are not already present:

```gitignore
.pnpm-store/
*.tsbuildinfo
```

- [ ] **Step 5: Install the root toolchain and verify workspace discovery**

Run:

```bash
corepack enable
corepack prepare pnpm@11.13.0 --activate
pnpm install
pnpm list --depth -1
```

Expected: `pnpm-lock.yaml` is created and the root package is listed without dependency errors.

- [ ] **Step 6: Commit the workspace toolchain**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json eslint.config.mjs prettier.config.mjs .prettierignore .editorconfig .nvmrc .env.example .gitignore
git commit -m "chore: establish pnpm monorepo toolchain"
```

### Task 2: Create the shared API contract package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/api.test.ts`
- Create: `packages/shared/src/api.ts`
- Create: `packages/shared/src/index.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: root TypeScript and Vitest configuration from Task 1.
- Produces: `API_PREFIX: 'api/v1'`, `ApiSuccess<T>`, and `apiSuccess<T>(data: T): ApiSuccess<T>` from `@namdw/shared`.

- [ ] **Step 1: Add the shared package manifest and compiler configuration**

Create `packages/shared/package.json`:

```json
{
  "name": "@namdw/shared",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  }
}
```

Create `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 2: Write the failing shared-contract test**

Create `packages/shared/src/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { API_PREFIX, apiSuccess } from './api';

describe('API contracts', () => {
  it('uses the approved versioned prefix', () => {
    expect(API_PREFIX).toBe('api/v1');
  });

  it('wraps successful payloads without changing them', () => {
    const data = { status: 'ok' as const };

    expect(apiSuccess(data)).toEqual({ data });
  });
});
```

- [ ] **Step 3: Run the test and confirm the contract is missing**

Run:

```bash
pnpm install
pnpm --filter @namdw/shared test
```

Expected: FAIL because `packages/shared/src/api.ts` does not exist.

- [ ] **Step 4: Implement the shared contract**

Create `packages/shared/src/api.ts`:

```ts
export const API_PREFIX = 'api/v1' as const;

export interface ApiSuccess<T> {
  data: T;
}

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { data };
}
```

Create `packages/shared/src/index.ts`:

```ts
export { API_PREFIX, apiSuccess } from './api';
export type { ApiSuccess } from './api';
```

- [ ] **Step 5: Verify tests, types, and package output**

Run:

```bash
pnpm --filter @namdw/shared test
pnpm --filter @namdw/shared typecheck
pnpm --filter @namdw/shared build
test -f packages/shared/dist/index.js
test -f packages/shared/dist/index.d.ts
```

Expected: two tests pass, type checking succeeds, and both output files exist.

- [ ] **Step 6: Commit the shared contract**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat: add shared API contracts"
```

### Task 3: Create the React and Vite web foundation

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/App.test.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/styles.css`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `API_PREFIX` from `@namdw/shared`.
- Produces: the `@namdw/web` commands `dev`, `build`, `preview`, `typecheck`, and `test`; a React mount point at `#root`; a foundation status screen for smoke verification.

- [ ] **Step 1: Add the web package manifest and TypeScript configuration**

Create `apps/web/package.json`:

```json
{
  "name": "@namdw/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -p tsconfig.json && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@namdw/shared": "workspace:*",
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
  "devDependencies": {
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.3",
    "vite": "8.1.4"
  }
}
```

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `apps/web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 2: Write the failing web smoke test**

Create `apps/web/src/App.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the foundation status and API prefix', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('Personal Blog');
    expect(html).toContain('/api/v1');
  });
});
```

- [ ] **Step 3: Install dependencies and verify the app is missing**

Run:

```bash
pnpm install
pnpm --filter @namdw/web test
```

Expected: FAIL because `apps/web/src/App.tsx` does not exist.

- [ ] **Step 4: Implement the React foundation screen**

Create `apps/web/src/App.tsx`:

```tsx
import { API_PREFIX } from '@namdw/shared';

export function App() {
  return (
    <main className="foundation-shell">
      <p className="eyebrow">Module 1 · Foundation</p>
      <h1>Personal Blog</h1>
      <p>React and NestJS are connected through the shared /{API_PREFIX} contract.</p>
    </main>
  );
}
```

Create `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `apps/web/src/styles.css`:

```css
:root {
  color: #1d1d1f;
  background: #f5f5f7;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
}

.foundation-shell {
  display: grid;
  min-height: 100vh;
  place-content: center;
  padding: 2rem;
  text-align: center;
}

.eyebrow {
  color: #0071e3;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(3rem, 10vw, 7rem);
  letter-spacing: -0.06em;
}
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="namdw 的个人博客" />
    <title>Personal Blog</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Verify the web package**

Run:

```bash
pnpm --filter @namdw/shared build
pnpm --filter @namdw/web test
pnpm --filter @namdw/web typecheck
pnpm --filter @namdw/web build
test -f apps/web/dist/index.html
```

Expected: the App test passes, type checking and the Vite production build succeed, and `apps/web/dist/index.html` exists.

- [ ] **Step 6: Commit the web foundation**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: add React web foundation"
```

### Task 4: Create the NestJS API foundation

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/jest.config.cjs`
- Create: `apps/api/test/jest-e2e.config.cjs`
- Create: `apps/api/src/health.controller.spec.ts`
- Create: `apps/api/src/health.controller.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/test/health.e2e-spec.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `API_PREFIX`, `ApiSuccess<T>`, and `apiSuccess<T>()` from `@namdw/shared`.
- Produces: `GET /api/v1/health`, returning `{ "data": { "status": "ok" } }`; the `@namdw/api` commands `dev`, `build`, `start`, `typecheck`, `test`, and `test:e2e`.

- [ ] **Step 1: Add the API package and compiler configuration**

Create `apps/api/package.json`:

```json
{
  "name": "@namdw/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "jest --config jest.config.cjs --runInBand",
    "test:e2e": "jest --config test/jest-e2e.config.cjs --runInBand"
  },
  "dependencies": {
    "@namdw/shared": "workspace:*",
    "@nestjs/common": "11.1.28",
    "@nestjs/core": "11.1.28",
    "@nestjs/platform-express": "11.1.28",
    "reflect-metadata": "0.2.2",
    "rxjs": "7.8.2"
  },
  "devDependencies": {
    "@nestjs/cli": "11.0.24",
    "@nestjs/testing": "11.1.28",
    "@types/jest": "29.5.14",
    "@types/node": "24.10.1",
    "@types/supertest": "7.2.0",
    "jest": "29.7.0",
    "supertest": "7.2.2",
    "ts-jest": "29.4.11"
  }
}
```

Create `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "declaration": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "incremental": true,
    "outDir": "dist",
    "removeComments": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

Create `apps/api/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts"]
}
```

Create `apps/api/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.build.json"
  }
}
```

- [ ] **Step 2: Configure Jest and write the failing controller test**

Create `apps/api/jest.config.cjs`:

```js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};
```

Create `apps/api/src/health.controller.spec.ts`:

```ts
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the stable health envelope', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({ data: { status: 'ok' } });
  });
});
```

- [ ] **Step 3: Install dependencies and verify the controller is missing**

Run:

```bash
pnpm install
pnpm --filter @namdw/shared build
pnpm --filter @namdw/api test
```

Expected: FAIL because `apps/api/src/health.controller.ts` does not exist.

- [ ] **Step 4: Implement the health controller, root module, and bootstrap**

Create `apps/api/src/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { apiSuccess } from '@namdw/shared';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return apiSuccess({ status: 'ok' as const });
  }
}
```

Create `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class AppModule {}
```

Create `apps/api/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@namdw/shared';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const host = process.env.API_HOST ?? '127.0.0.1';
  const port = Number(process.env.API_PORT ?? 3000);

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  await app.listen(port, host);
}

void bootstrap();
```

- [ ] **Step 5: Write the HTTP end-to-end test**

Create `apps/api/test/jest-e2e.config.cjs`:

```js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};
```

Create `apps/api/test/health.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_PREFIX } from '@namdw/shared';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports a healthy API through the versioned prefix', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ data: { status: 'ok' } });
  });
});
```

- [ ] **Step 6: Verify API tests, types, and production output**

Run:

```bash
pnpm --filter @namdw/api test
pnpm --filter @namdw/api test:e2e
pnpm --filter @namdw/api typecheck
pnpm --filter @namdw/api build
test -f apps/api/dist/main.js
```

Expected: unit and end-to-end tests pass, type checking and the Nest build succeed, and `apps/api/dist/main.js` exists.

- [ ] **Step 7: Commit the API foundation**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat: add NestJS API foundation"
```

### Task 5: Add production smoke verification and foundation documentation

**Files:**
- Create: `scripts/smoke.mjs`
- Create: `README.md`

**Interfaces:**
- Consumes: `@namdw/web` production preview at port `4173` and `@namdw/api` health endpoint at port `3100`.
- Produces: `pnpm smoke`, which starts built artifacts, verifies HTTP responses, terminates child processes, and exits nonzero on failure; documented foundation commands for future module work.

- [ ] **Step 1: Confirm the smoke check is not yet usable**

Run:

```bash
pnpm build
pnpm smoke
```

Expected: FAIL because `scripts/smoke.mjs` does not exist.

- [ ] **Step 2: Implement the production smoke script**

Create `scripts/smoke.mjs`:

```js
import { spawn } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const children = [];

function start(args, env = {}) {
  const child = spawn(pnpm, args, {
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  children.push(child);
  return child;
}

async function waitFor(url, validate, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok && (await validate(response))) return;
    } catch {
      // The server can refuse connections during startup; retry until the deadline.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function stopChildren() {
  for (const child of children) child.kill('SIGTERM');
  await Promise.all(
    children.map((child) =>
      child.exitCode === null
        ? new Promise((resolve) => child.once('exit', resolve))
        : Promise.resolve(),
    ),
  );
}

try {
  start(['--filter', '@namdw/api', 'start'], { API_HOST: '127.0.0.1', API_PORT: '3100' });
  start(['--filter', '@namdw/web', 'preview', '--host', '127.0.0.1', '--port', '4173']);

  await waitFor('http://127.0.0.1:3100/api/v1/health', async (response) => {
    const body = await response.json();
    return body.data?.status === 'ok';
  });

  await waitFor('http://127.0.0.1:4173', async (response) => {
    const body = await response.text();
    return body.includes('<div id="root"></div>');
  });

  console.log('Production smoke check passed.');
} finally {
  await stopChildren();
}
```

- [ ] **Step 3: Write the foundation README**

Create `README.md`:

```markdown
# Personal Blog

Apple-inspired personal blog built as a pnpm monorepo with React, Vite, NestJS, and PostgreSQL.

## Requirements

- Node.js 24
- Corepack

## Setup

\`\`\`bash
corepack enable
corepack prepare pnpm@11.13.0 --activate
pnpm install
cp .env.example .env
\`\`\`

## Development

\`\`\`bash
pnpm dev
\`\`\`

- Web: `http://127.0.0.1:5173`
- API health: `http://127.0.0.1:3000/api/v1/health`

## Quality checks

\`\`\`bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
\`\`\`

The detailed product design and module plans are stored under `docs/superpowers/`.
```

- [ ] **Step 4: Run the complete Module 1 verification**

Run:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
git status --short
```

Expected: linting, formatting, type checking, all tests, all builds, and the production smoke check pass. `git status --short` lists only the files added in this task.

- [ ] **Step 5: Commit the verified foundation**

```bash
git add README.md scripts/smoke.mjs
git commit -m "test: add production foundation smoke check"
```

## Module 1 Completion Gate

Before starting the visual-shell plan, verify all of the following:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
git status --short
```

Expected final state:

- Every command exits with status `0`.
- `GET /api/v1/health` returns `{ "data": { "status": "ok" } }`.
- The React production preview returns the generated application shell.
- `git status --short` prints no output.
- The next plan can build the approved visual shell without changing workspace boundaries.
