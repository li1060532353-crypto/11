# Personal Blog System Design

Date: 2026-07-15  
Status: Approved

## 1. Goal

Build a production-ready personal blog with an Apple-inspired minimalist visual style. The project will be developed and accepted module by module, then delivered as a complete downloadable ZIP.

The final project must include the visitor-facing website, administrator console, backend API, PostgreSQL database, authentication, configuration examples, automated tests, Docker deployment, and complete setup and deployment documentation.

## 2. Confirmed Technology Stack

- Frontend: React, Vite, TypeScript
- Backend: Node.js, NestJS, TypeScript
- Database: PostgreSQL
- ORM and migrations: Prisma
- Repository structure: monorepo
- API style: versioned REST under `/api/v1`
- Deployment: Docker Compose and Nginx
- Account scope: one or more administrators only; no reader accounts

## 3. Scope

### 3.1 Included in the first complete release

- Apple-inspired visitor homepage
- Article list and article detail pages
- Categories, tags, archives, and full-text article search
- Project portfolio and about page
- Administrator login and session renewal
- Administrator dashboard
- Article, category, tag, project, media, and site-setting management
- Markdown editing and preview, including code highlighting and mathematical formulas
- Responsive visitor experience and tablet-compatible administration
- SEO metadata, sitemap, robots file, canonical URLs, and social preview metadata
- Automated testing, Docker deployment, backup instructions, and final ZIP

### 3.2 Explicitly excluded from the first release

- Reader registration or login
- Comments
- Likes, favorites, and social feeds
- Multi-author editorial workflows
- Cloud object storage integration

These exclusions keep the first release focused. The interfaces must not prevent later addition of reader accounts or object storage.

## 4. Architecture

The monorepo layout will be:

```text
personal-blog/
├── apps/
│   ├── web/                 # React visitor site and admin console
│   └── api/                 # NestJS REST API
├── packages/
│   ├── shared/              # Shared API types, constants, and schemas
│   └── eslint-config/       # Shared lint configuration
├── prisma/                  # Prisma schema, migrations, and seed scripts
├── docker/                  # Nginx and container configuration
├── docs/                    # Design, API, setup, and deployment documents
├── docker-compose.yml
└── README.md
```

The visitor site and administrator console share one React application but use separate route groups, layouts, and authorization boundaries. The browser never accesses PostgreSQL directly. All business data is accessed through the NestJS API.

### 4.1 Public routes

- `/`
- `/posts`
- `/posts/:slug`
- `/categories`
- `/categories/:slug`
- `/tags`
- `/tags/:slug`
- `/archives`
- `/projects`
- `/about`
- `/search`

### 4.2 Administrator routes

- `/admin/login`
- `/admin/dashboard`
- `/admin/posts`
- `/admin/posts/new`
- `/admin/posts/:id/edit`
- `/admin/categories`
- `/admin/tags`
- `/admin/projects`
- `/admin/media`
- `/admin/settings`

All administrator routes except the login page require an authenticated administrator.

## 5. Visual System

The approved direction is the product-storytelling layout.

### 5.1 Visitor experience

- Glass-effect navigation with restrained blur and clear fallbacks
- Large, concise hero copy with immersive low-saturation gradient artwork
- Selected project and article cards with generous spacing
- Fog-white background (`#F5F5F7`), ink-black text (`#1D1D1F`), and interaction blue (`#0071E3`)
- Subtle hover, scroll, and page-transition motion that respects `prefers-reduced-motion`
- Responsive layouts for mobile, tablet, laptop, and wide desktop screens

The article reader uses a narrow content column, serif body copy, a table of contents, reading progress, code blocks, mathematical formulas, and accessible typography.

### 5.2 Administrator experience

- Dark navigation sidebar and light work area
- Compact tables and forms optimized for content management
- Shared color, spacing, radius, focus, and feedback tokens with the visitor site
- Desktop-first layout with tablet support

### 5.3 Accessibility

- Semantic HTML and keyboard-accessible navigation
- Visible focus states
- Sufficient text and control contrast
- Useful alternative text for meaningful images
- Form labels and accessible validation messages
- Motion reduction support

## 6. Functional Design

### 6.1 Visitor modules

#### Homepage

Displays the hero, selected articles, latest articles, selected projects, and a short personal introduction. Content is driven by published database records and site settings.

#### Articles

Supports pagination, category and tag filtering, and article details. Article details render Markdown, syntax-highlighted code, formulas, headings-based table of contents, cover media, publication metadata, and reading progress.

#### Discovery

Categories and tags show their associated published articles. Archives group published articles by year and month. Search checks article title, summary, and body and persists query and pagination state in the URL.

#### Projects and About

Projects display their image, technology stack, description, and optional demonstration and source links. The about page is driven by site settings and editable structured content.

Only `PUBLISHED` content is available through public endpoints. Draft, archived, deleted, and future-scheduled content must not leak through public requests.

### 6.2 Administrator modules

#### Authentication

Administrators can log in and log out. The application renews a valid session without exposing refresh tokens to JavaScript.

#### Dashboard

Displays counts for articles, drafts, categories, tags, and projects, plus recent content activity.

#### Article management

Administrators can create, edit, preview, publish, withdraw, archive, and soft-delete articles. The editor provides Markdown editing, real-time preview, code and formula support, cover selection, metadata, categories, tags, and SEO fields.

Drafts save automatically. A failed automatic save is shown as unsaved, and leaving with unsaved content triggers a warning. Publishing validates the title, slug, summary, body, and category.

#### Taxonomy, project, media, and settings management

Administrators can create, rename, sort, and delete categories and tags; manage projects and external links; upload and manage images; and edit site identity, social links, and default SEO values.

Destructive actions require confirmation. A media item cannot be deleted while referenced by active content.

## 7. Data Model

### 7.1 `Admin`

Stores username, password hash, enabled state, creation and update timestamps, and last login time. Usernames are unique.

### 7.2 `RefreshToken`

Stores only a token hash, expiry time, revocation time, creation metadata, and its administrator relation. Tokens are rotated on refresh and can be revoked on logout.

### 7.3 `Post`

Stores title, unique slug, summary, Markdown body, cover media relation, status, selected flag, publication time, scheduled publication time, SEO title, SEO description, canonical URL override, timestamps, and soft-deletion time.

Statuses are `DRAFT`, `PUBLISHED`, and `ARCHIVED`.

Each post belongs to one category and can have multiple tags. A post cannot be publicly visible unless its status is `PUBLISHED`, it is not soft-deleted, and its publication time is not in the future.

### 7.4 `Category`

Stores unique name, unique slug, optional description, sort order, and timestamps. One category contains many posts.

### 7.5 `Tag`

Stores unique name, unique slug, and timestamps. Tags and posts have a many-to-many relation through an explicit join table.

### 7.6 `Project`

Stores unique slug, name, summary, Markdown body, cover relation, technology list, optional source URL, optional demonstration URL, selected flag, visibility status, sort order, and timestamps.

### 7.7 `Media`

Stores original filename, generated storage key, public URL, MIME type, byte size, width, height, alternative text, creator relation, and timestamps.

### 7.8 `SiteSetting`

Stores the single active site configuration, including blog name, introduction, profile image, about content, contact links, social links, and default SEO metadata.

## 8. API Design

### 8.1 Public API

```text
GET /api/v1/posts
GET /api/v1/posts/:slug
GET /api/v1/categories
GET /api/v1/categories/:slug/posts
GET /api/v1/tags
GET /api/v1/tags/:slug/posts
GET /api/v1/archives
GET /api/v1/projects
GET /api/v1/projects/:slug
GET /api/v1/search?q=
GET /api/v1/site
```

Collection endpoints use bounded pagination and return pagination metadata. Filters and sorting use documented query parameters.

### 8.2 Authentication API

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

### 8.3 Administrator API

Administrator CRUD endpoints are grouped under:

```text
/api/v1/admin/posts
/api/v1/admin/categories
/api/v1/admin/tags
/api/v1/admin/projects
/api/v1/admin/media
/api/v1/admin/settings
```

Article publishing uses an explicit action endpoint so publication rules are separate from ordinary edits.

All administrator input is validated. Slugs are unique, normalized, and checked for reserved paths.

## 9. Security

- Passwords are hashed using Argon2id and never logged or returned.
- Access tokens have a short lifetime.
- Refresh tokens are stored in `HttpOnly`, `Secure`, and appropriately scoped cookies.
- Only refresh-token hashes are stored in PostgreSQL.
- Refresh tokens rotate on use and are revoked on logout.
- Administrator endpoints use NestJS authentication guards and authorization checks.
- Cross-origin behavior is restricted to configured origins.
- State-changing cookie-authenticated requests receive CSRF protection.
- Rate limiting applies to login and other sensitive endpoints.
- Uploads use an allowlist of image MIME types, verified file signatures, size limits, generated filenames, and non-executable storage.
- Security headers are set at Nginx and application level where appropriate.
- Secrets are supplied through environment variables and excluded from version control.

## 10. Error Handling and Observability

The API uses a stable error contract:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Submitted data is invalid",
  "details": [],
  "requestId": "request-correlation-id"
}
```

The frontend maps validation errors to fields, preserves editor state during network failure, retries safe reads when appropriate, and attempts one token refresh after authentication expiry. A failed refresh redirects to login without discarding recoverable draft content.

The API emits structured logs with request IDs and useful error categories. Passwords, cookies, access tokens, refresh tokens, and sensitive request fields are redacted.

The frontend includes designed loading, empty, offline, unauthorized, not-found, and unexpected-error states.

## 11. Testing and Quality Gates

### 11.1 Automated testing

- Vitest for frontend utilities and state logic
- Testing Library for React components, forms, filters, and error states
- Jest for NestJS services, authorization, and validation
- Supertest for authentication, public queries, and administrator CRUD integration tests
- Playwright for visitor reading and administrator article-publication workflows

### 11.2 Quality checks

- TypeScript type checking
- ESLint
- Production builds for both applications
- Prisma migration validation
- Docker image builds
- Docker Compose health and startup checks

Each module must pass its relevant checks before acceptance. Final delivery requires the full automated test suite, production builds, and Docker startup verification to pass.

## 12. Deployment

The production request flow is:

```text
Internet -> Nginx -> React static files
                  -> /api/ to NestJS
                  -> /uploads/ to persistent media storage

NestJS -> PostgreSQL
```

Docker Compose starts:

- `nginx`: HTTPS termination, reverse proxy, static delivery, and caching
- `api`: NestJS production server
- `db`: PostgreSQL with a persistent data volume
- `backup`: scheduled PostgreSQL backups with documented retention and restore procedures

Uploaded media uses a persistent Docker volume in the first release. The storage service is isolated behind an application interface so a later object-storage implementation does not change content-management behavior.

The project includes development and production configurations, `.env.example`, database migrations, an administrator initialization command, local setup instructions, test and build commands, HTTPS and domain guidance, and backup restoration instructions.

## 13. Module Delivery Order and Acceptance

1. **Foundation:** the monorepo installs cleanly; web and API development servers start; shared configuration works.
2. **Visual shell:** the approved homepage shell, navigation, design tokens, responsive layout, and accessibility foundations are implemented.
3. **Visitor content:** article, category, tag, archive, project, about, and search screens work against typed mock boundaries.
4. **Database and public API:** Prisma migrations succeed and public endpoints return only eligible public content.
5. **Authentication:** login, refresh rotation, logout, route protection, and security tests pass.
6. **Administration:** all approved management modules work, including draft saving and publication validation.
7. **Media and Markdown:** safe upload, media reuse protection, Markdown, code, formulas, and preview work end to end.
8. **SEO and resilience:** metadata, sitemap, error states, logging, and accessibility checks are complete.
9. **Deployment:** production images build and the full Docker stack passes health checks.
10. **Final package:** documentation is complete, all checks pass, and the downloadable ZIP is created.

## 14. Final Deliverables

- Complete source code
- Frontend, backend, database, and infrastructure configuration
- `.env.example` without real secrets
- Database migration and seed workflow
- Administrator initialization workflow
- API, setup, testing, and deployment documentation
- Verified production build and Docker Compose configuration
- Complete downloadable ZIP
