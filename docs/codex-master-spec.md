# Codex Master Execution Specification

This document is the binding execution specification for converting this static blog into a private, single-owner knowledge base deployed through the existing Cloudflare Pages project. It is the durable copy of the user's directive received 2026-07-18; requirements below are mandatory unless the user explicitly changes them.

## Objective and scope

Build a private single-user application with Cloudflare Access authentication, notes (create, edit, archive, restore, pin, review, and manually saved versions), multi-file Markdown import, private image/PDF/file attachments, refreshed statistics, Chinese-suitable substring search, a Tiptap editor with five highlight colors, debounced autosave, learning roadmaps, and safe migration of existing static articles. Preserve all source files. The whole production application is private; do not build a public/private split. A custom domain is optional.

Deferred: multiple users or roles, public R2 delivery, VPS/Docker production, PostgreSQL/Redis/WebSockets/Durable Objects, paid CMS, OCR/AI, FTS5 or advanced Chinese tokenization, collaboration, offline sync, byte-level upload progress, relative Markdown image rewriting, automatic orphan cleanup, visual version diffs, and spaced repetition.

## Architecture and invariants

Keep the existing frontend framework, package manager/lockfile, styling system where practical, working routes, and static content. Do not create a monorepo or perform unrelated refactors. Use a root-level `functions/` directory unless inspection proves Pages Advanced Mode is necessary; never put Functions in `dist/` or `public/`.

The browser application contains Dashboard, Notes, Editor, Search, Import, Assets, and Roadmaps. Cloudflare Pages Functions provide Access validation, Notes/Search/Stats, Markdown import, Roadmaps, and private R2 proxy APIs. D1 binding name is `DB`; private R2 binding name is `KB_ASSETS` (amended at H2 after Wrangler reserved `ASSETS`).

`content_json` is the only canonical editable note body. `content_text` is server-derived search text. Markdown is import/future export only; never synchronize editable HTML, Markdown, and JSON. Use prepared D1 statements with `.bind()`, reproducible migrations, transactions/batches for atomic changes, useful indexes only, and parameterized `LIKE` search with SQL wildcard escaping.

Work in a feature branch or isolated worktree. Do not push to the default branch, delete article sources before verified migration, commit secrets, trust frontend-provided identity, store passwords, expose R2 listings/public URLs, or expose permanent R2 credentials.

## Authentication and Cloudflare configuration

Use Cloudflare Access—not a custom login—and protect the complete production knowledge-base hostname with a single allowed owner identity. Validate Access assertions on every private route. Configuration uses `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, and `LOCAL_AUTH_BYPASS`; bypass is explicit, local-development-only, and must never activate in production. Missing production configuration fails closed; missing/invalid assertions return 403.

Document current, official dashboard steps in `docs/cloudflare-setup.md`: D1/R2 creation; production and preview bindings; migrations; Access app/policy; owner-email allow rule; protection of production `project.pages.dev` and preview separately; Access audience/team domain; variables; redeployment after binding edits; and private-window verification. No custom domain is required.

## Data schema

Use UUID text IDs from `crypto.randomUUID()` unless an established convention justifies otherwise. Provide migrations for:

- `notes`: `id`, unique `slug`, `title`, `summary`, `content_json`, `content_text`, `category`, `status` (`draft|published|archived`), `is_pinned`, `review_count`, `created_at`, `updated_at`, `last_reviewed_at`; indexes for status, updated time, category, and pinned status.
- `tags`: `id`, unique `name`, unique `slug`; `note_tags` with composite primary key (`note_id`, `tag_id`).
- `roadmaps`: `id`, `title`, `description`, `status` (`active|archived`), timestamps.
- `roadmap_items`: `id`, roadmap relation, nullable note relation, title, description, status (`todo|doing|done`), `progress` constrained 0–100, `sort_order`, nullable target/completed dates, timestamps; index ordering.
- `assets`: `id`, nullable note relation, unique `r2_key`, `original_name`, `mime_type`, `size_bytes`, timestamp; index note relation.
- `note_versions`: `id`, note relation, `content_json`, `content_text`, timestamp.

Use foreign keys with cascade/set-null behavior where supported. Only explicit Save version creates a version; autosave never does.

## API contract

Follow existing route conventions. All successes are `{ "success": true, "data": {} }`; errors are `{ "success": false, "error": { "code": "STABLE_MACHINE_CODE", "message": "Readable message" } }` with correct HTTP status.

Required protected routes:

- `GET|POST /api/notes`; `GET|PATCH|DELETE /api/notes/:id`; `POST /api/notes/:id/restore`, `/review`, `/versions`; `GET /api/notes/:id/versions`.
- `GET /api/search?q=` and `GET /api/stats`.
- `GET|POST /api/roadmaps`; `GET|PATCH|DELETE /api/roadmaps/:id`; `POST /api/roadmaps/:id/items`, `/api/roadmaps/:id/reorder`; `PATCH|DELETE /api/roadmap-items/:id`.
- `POST /api/import/markdown`.
- `POST /api/assets`; `GET|DELETE /api/assets/:id`.

Validate every mutation payload, paginate/filter notes by status/category/tag/pinned, use collision-safe slugs, soft-delete via `archived`, derive `content_text` server-side, update timestamps, count direct from D1, and refresh client stats after mutations.

## UI behavior

Use the frontend’s matching Tiptap adapter with StarterKit and multicolor Highlight. Do not render untrusted raw HTML. Editor supports title, summary, category, tags, headings, bold/italic, lists, blockquote, inline/code block where available, yellow/red/green/blue/purple semantic highlights (`core`, `mistake`, `mastered`, `method`, `investigate`), remove highlight, manual save, Save version, save state, unsaved-change protection, and mobile-usable toolbar. Persist compatible Tiptap JSON.

Autosave uses a 1500–2000 ms debounce, cancels obsolete requests, displays editing/saving/saved/failed, avoids keystroke saves and version creation, and prevents stale responses overwriting later state.

Supply Dashboard, Notes, Note detail/editor, Search, Batch Import, Asset Management, and Roadmaps pages or equivalent views. Statistics include total/draft/published/archived/pinned and useful roadmap progress. Notes sort by updated time and show last review. Search has ~300 ms debounce, title/summary/category/content/tag matches, clear/loading/empty/error states and safe excerpts. No WebSockets; refresh lists/stats after mutations.

## Import, assets, roadmaps, migration

Import `.md`, `.markdown`, `.txt` by drag/drop, multiple files, one request each, client concurrency 3, and per-file queued/uploading/success/failed states. Parse optional YAML front matter, fallback title to filename, prevent collisions, produce valid Tiptap JSON/plain text, return one result per file, and show imported/failed/skipped totals. Do not rewrite relative Markdown images; document the limitation.

Assets accept PNG/JPEG/WebP/GIF/PDF only, maximum 15 MiB. Validate extension and MIME (not extension alone), generate random unguessable keys, retain original names only as metadata, proxy through authorization, set correct content/download headers, deny path traversal/arbitrary keys, and consistently delete metadata/object. Document orphan cleanup if absent.

Roadmaps support create/rename/archive; item add/edit/delete/note link/state/progress/target date/reorder/incomplete filter/aggregate progress. Prefer simple accessible reordering controls.

Build a safe importer for existing static articles that preserves sources; supports dry run; never silently overwrites; identifies duplicates; reports source/detected/imported/skipped/duplicates/failed/warnings; uses deterministic mappings; backs up D1 before production import; and documents rollback. Stop for H3 before production import.

## Execution, reviews, and durable state

Before production work, create `.codex/progress.md`, `.codex/decisions.md`, `.codex/blockers.md`, `.codex/human-actions.md`, and `.codex/reviews/`. `progress.md` is authoritative and records task, status, model, agent/worktree, allowed files, base/head commit, tests, review verdict, findings, dependencies, next action. Record decisions, blocker commands/errors/attempts/evidence, and external human actions. On resume read this document and progress, inspect status/log, verify the last task, and continue from the first incomplete task.

Use balanced/default model for controller, reconnaissance, schema, Access, R2, integration, migration, debugging, and review; use lower-cost capable coding model for isolated mechanical UI/tests/docs; highest-capability model only after human approval for unresolved high-risk security/migration/project-wide failures that survived two evidence-backed attempts. Never claim an unavailable model switch. Record assignments. Do not dispatch agents unless independent interfaces/files are frozen and isolated worktrees/branches and merge order are defined. Keep schema → shared types → API → frontend client → integration sequential.

Every implementation is independently reviewed. The reviewer issues both Specification compliance and Code quality/safety verdicts. Critical/Important findings block dependents; minor findings go to final ledger. Record task ownership before dispatch; agents may only edit allowed files. Implementers add tests, run scoped checks, self-review, commit, and report. Do not claim DONE when relevant tests were not run or failed.

Valid statuses: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_REVIEW`, `NEEDS_CONTEXT`, `MODEL_SWITCH_RECOMMENDED`, `HUMAN_ACTION_REQUIRED`, `BLOCKED`.

## Gates and waves

Wave 0: inspect stack/content/tests/deployment/design/migration risks; write reconnaissance report and task map; stop H0. H0 presents stack, content structure, deployment, proposed files, migration risks, waves, safe parallel work, models, assumptions, and deferrals.

Wave 1: Pages configuration, D1 migration, shared types, envelope, Access middleware, local setup; stop H1 with schema/routes/types/envelope/source-of-truth/deletion/asset/rollback plan. Stop H2 when the user must configure D1, R2, bindings, Access, owner identity, team domain/audience, or production variables.

Wave 2 core Notes/Search/Stats and dashboard/list shell after H1 approval and frozen contracts. Wave 3 editor/assets after note payloads freeze. Wave 4 Markdown importer/migration safety and roadmaps; stop H3 before production import. Wave 5 sequential integration and full verification. Wave 6 independent final high-risk review (highest-capability model requires approval); stop H4. Wave 7 is human-approved deployment, production smoke tests, then H5 acceptance.

Every gate report uses `CHECKPOINT: <GATE_ID>` and concisely includes status, completed work, changed files, commits, commands/tests, reviewer verdict, findings by severity, current/recommended model, required human action, risks, rollback point, and resume instruction. Model and human-action checkpoint formats must include the exact fields specified in the user directive; never request secrets.

## Testing and completion

Use existing tests; add only lightweight setup if missing. Cover validation, slugs/duplicates, Tiptap JSON-to-text, search wildcard escaping, note CRUD/archive/restore/stats, authorization, Markdown metadata and partial batch failures, asset validation/authorization, roadmap progress, highlight persistence, and stale autosave where practical. Before H4 run clean install, unit/integration tests, typecheck, lint, production build, local Functions start, and local D1 migration; record commands/outcomes.

Completion requires preserved content, reproducible migrations, private R2, verified production Access and unauthorized rejection, all specified workflows, refreshed counts, tested migration dry run/backup, documented limitations/rollback, no secrets, closed Critical/Important findings, production smoke tests, and H5 presentation. A passing build alone is insufficient.
