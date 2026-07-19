# Wave 3 Editor and Private Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private Tiptap-compatible JSON editor, explicit version saves, and single-file private R2 attachments without changing the canonical note schema or beginning import/migration work.

**Architecture:** `content_json` remains the canonical editable Tiptap document and `content_text` remains the server-derived search projection. The asset API is an Access-protected Pages Function using R2-first upload compensation and metadata-first delete compensation; binary download is explicitly marked as a non-JSON transport. Fixture-only editor presentation is isolated from all API and persistence work until Terra performs the sequential integration.

**Tech Stack:** Cloudflare Pages Functions, D1, private R2 (`KB_ASSETS`), React 19, React Router 7, Tiptap, TypeScript, Vitest, Testing Library.

## Global Constraints

- Preserve the frozen Notes schema, `contentJson` request field, `content_json` canonical storage, `content_text` derivation, and explicit version route. Neither create, PATCH, nor autosave creates a version.
- The only highlight values are `core`, `mistake`, `mastered`, `method`, and `investigate`; they are stored in Tiptap mark attributes inside `content_json`.
- `POST /api/assets` uses one `multipart/form-data` file field and an optional `noteId`; callers never select object keys/paths or provide trusted name, MIME type, or byte size.
- R2 remains private `KB_ASSETS`; the application proxies every authorized download and never returns an R2 key or public URL.
- Permitted assets are PNG, JPEG, WebP, GIF, and PDF only; each is at most 15 MiB. Validate extension, declared MIME, actual received bytes, and signature before storage.
- Asset success download is a binary transport exception. Every error, including download errors, uses the existing `{ success: false, error: { code, message } }` envelope with no provider exception text.
- Do not add Markdown canonical storage, `content_markdown` migrations, Markdown import, batch import, content hashes, import-source metadata, local filesystem reads, URL fetching, relative-link rewriting, public R2 URLs, range support, inline asset rendering, real-time collaboration, full Notion block parity, production migration, bulk deletion, automatic orphan cleanup, production writes, production deletes, or production cleanup.
- Preserve the existing unrelated untracked `docs/superpowers/plans/2026-07-17-local-api-docker-deployment-implementation.md` file and do not address the five known `contentQueries.test.ts` baseline failures.
- No production write, deletion, migration, or orphan cleanup may occur without the final human checkpoint in Task 7.

## Frozen Wave 3 Transport Amendment

`packages/shared/src/knowledge.ts` will keep JSON response contracts separate from non-JSON asset transports. `ApiRouteContractMap` contains JSON routes only; it has entries for asset POST and DELETE but no entry for asset GET.

```ts
export type JsonRouteContract = {
  transport: 'json'; method: ApiMethod; path: string; request: unknown; response: unknown;
};
export type MultipartRouteContract = {
  transport: 'multipart'; method: 'POST'; path: '/api/assets';
  fields: { file: 'single-file'; noteId?: 'string' }; response: AssetUploadResult;
};
export type AssetUploadRequest = MultipartRouteContract['fields'];
export type BinaryRouteContract = {
  transport: 'binary'; method: 'GET'; path: '/api/assets/:id'; errorResponse: ApiFailure;
};

export const assetUploadRoute: MultipartRouteContract = {
  transport: 'multipart', method: 'POST', path: '/api/assets',
  fields: { file: 'single-file', noteId: 'string' }, response: {} as AssetUploadResult,
};
export const assetDownloadRoute: BinaryRouteContract = {
  transport: 'binary', method: 'GET', path: '/api/assets/:id',
  errorResponse: {} as ApiFailure,
};

export type AssetJsonRouteEntries = {
  'POST /api/assets': { request: AssetUploadRequest; response: AssetUploadResult };
  'DELETE /api/assets/:id': { request: EmptyResponse; response: AssetRecord };
};
// Merge AssetJsonRouteEntries into the existing ApiRouteContractMap. It deliberately has no GET asset key.
```

`AssetUploadRequest` is a multipart descriptor, not caller-supplied trusted file metadata. The existing `AssetRecord`, `AssetUploadResult`, and JSON DELETE response remain. Binary GET has no generic JSON response type and no JSON-response-map entry. The frontend uses a dedicated `downloadAsset(assetId): Promise<void>`/navigation path that consumes a binary `Response` and never invokes the generic JSON client.

## File Map

- `packages/shared/src/knowledge.ts`, `packages/shared/src/index.ts`, `packages/shared/src/knowledge.test.ts` — frozen transport metadata and highlight-kind type.
- `functions/lib/assets.ts`, `functions/api/assets/[[path]].ts`, `packages/shared/src/assets-route.test.ts` — asset validation, D1/R2 compensation, proxy route, and failure injection tests.
- `apps/web/package.json`, `pnpm-lock.yaml` — Tiptap dependencies, installed only by the Terra integration task.
- `apps/web/src/knowledge-ui/{EditorPage.tsx,AssetPanel.tsx,editor-fixtures.ts,knowledge.css,EditorPage.test.tsx}` — Luna-owned fixture presentation only.
- `apps/web/src/knowledge/{knowledge-api.ts,KnowledgeEditorRoute.tsx,useNoteAutosave.ts,knowledge-editor.test.tsx}` — Terra mutation client, abortable autosave, asset calls, and integration tests.
- `apps/web/src/router.tsx` — private note creation/detail routes and route metadata.
- `.codex/progress.md`, `.codex/reviews/w3-assets-security-review.md`, `.codex/reviews/w3-final-review.md` — task ownership, review evidence, and checkpoint record only.

Additional Terra-owned files used by Task 5: `apps/web/src/knowledge-editor/KnowledgeHighlight.ts`, `functions/lib/notes.ts`, `functions/api/notes/[[path]].ts`, `packages/shared/src/notes-api.test.ts`, and `packages/shared/src/notes-route.test.ts`.

### Task 1: Freeze shared highlight and asset transport contracts (Terra)

**Files:**
- Modify: `packages/shared/src/knowledge.ts`, `packages/shared/src/index.ts`, `packages/shared/src/knowledge.test.ts`
- Modify: `.codex/progress.md`

**Interfaces:**
- Consumes: existing `AssetRecord`, `AssetUploadResult`, `ApiRouteContractMap`, `NoteRecord`, and `CreateNoteRequest`.
- Produces: exported `HighlightKind`, `JsonRouteContract`, `MultipartRouteContract`, `BinaryRouteContract`, `assetUploadRoute`, `assetDownloadRoute`, and JSON-only asset POST/DELETE map entries.

**Non-goals / stop:** This task does not alter Notes payloads, storage, Functions, or frontend behavior. Stop after the shared contract test and commit; Task 2 cannot begin until this transport separation is reviewed.

- [ ] **Step 1: Record ownership and frozen boundaries**

Add a Wave 3 Task 1 entry to `.codex/progress.md` naming Terra, the listed shared files, commit `ee5f46f` as the base, and the prohibition on Notes request/schema changes other than exported highlight typing.

- [ ] **Step 2: Write the failing contract tests**

Add assertions equivalent to:

```ts
const kinds: readonly HighlightKind[] = ['core', 'mistake', 'mastered', 'method', 'investigate'];
expect(kinds).toHaveLength(5);
expect(assetUploadRoute).toMatchObject({ transport: 'multipart', fields: { file: 'single-file', noteId: 'string' } });
expect(assetDownloadRoute).toMatchObject({ transport: 'binary', method: 'GET', path: '/api/assets/:id' });
type JsonKeys = keyof ApiRouteContractMap;
expect((['POST /api/assets', 'DELETE /api/assets/:id'] satisfies readonly JsonKeys[])).toHaveLength(2);
```

- [ ] **Step 3: Run the focused test before implementation**

Run: `pnpm --filter @namdw/shared test -- knowledge.test.ts`

Expected: FAIL because the transport and highlight exports do not yet exist.

- [ ] **Step 4: Implement only the shared amendment**

Add `HighlightKind` and discriminated transport metadata. Keep `CreateNoteRequest`, `UpdateNoteRequest`, `NoteRecord`, `NoteVersionRecord`, `contentJson`, and the database schema byte-for-byte compatible. Remove the GET-asset key from `ApiRouteContractMap`; do not expose `ReadableStream` or metadata-only binary success through a JSON route type.

- [ ] **Step 5: Verify and commit the contract-only task**

Run: `pnpm --filter @namdw/shared test -- knowledge.test.ts`

Expected: PASS.

Commit: `git add packages/shared/src/knowledge.ts packages/shared/src/index.ts packages/shared/src/knowledge.test.ts .codex/progress.md && git commit -m "feat: freeze Wave 3 asset transport contract"`

### Task 2: Implement asset validation, storage, compensation, and proxy route (Terra)

**Files:**
- Create: `functions/lib/assets.ts`, `functions/api/assets/[[path]].ts`, `packages/shared/src/assets-route.test.ts`
- Modify: `functions/env.ts`, `.codex/progress.md`

**Interfaces:**
- Consumes: `KnowledgeBaseEnv.DB`, `KnowledgeBaseEnv.KB_ASSETS`, `AssetRecord`, `AssetUploadResult`, `jsonError`, `apiSuccess`, and the transport metadata from Task 1.
- Produces: `createAssetService(store, bucket)`, `AssetDomainError`, `onRequest`, and stable error codes `ASSET_VALIDATION_ERROR`, `ASSET_TYPE_NOT_ALLOWED`, `ASSET_TOO_LARGE`, `ASSET_NOTE_NOT_FOUND`, `ASSET_NOT_FOUND`, `ASSET_OBJECT_MISSING`, `ASSET_METADATA_READ_FAILED`, `ASSET_STORAGE_WRITE_FAILED`, `ASSET_STORAGE_DELETE_FAILED`, `ASSET_METADATA_WRITE_FAILED`, and `ASSET_COMPENSATION_FAILED`.

**Non-goals / stop:** This task has no migration, importer, batch upload, public delivery, range/inline rendering, cleanup job, or production operation. Stop after focused tests and the Task 3 security review; Luna work cannot begin on a Critical/Important review finding.

- [ ] **Step 1: Write failure-injection tests before implementation**

Create fake D1 and R2 adapters that capture calls and can fail each transition. Cover these cases exactly:

```ts
// Upload: parseable Content-Length >15 MiB rejects before formData(); actual parsed bytes >15 MiB rejects.
// Upload: malformed multipart Content-Type/body or formData() throw => ASSET_VALIDATION_ERROR.
// Upload: missing file; multiple file fields; file field containing a string/non-File => ASSET_VALIDATION_ERROR.
// Filename fixtures: ../secret.pdf, ..\\secret.pdf, C:\\Users\\name\\secret.pdf, /etc/passwd,
// embedded / and \\, NUL/control bytes, NFKC compatibility characters, empty sanitized names,
// >120 UTF-8-byte names, and multibyte truncation without splitting a code point.
// Upload: every valid PNG/JPEG/WebP/GIF/PDF signature succeeds; all resulting names are safe basenames.
// Upload: extension+wrong MIME; extension/MIME+wrong signature; signature/MIME+wrong extension;
// unsupported extension+recognized bytes; and truncated signatures all reject.
// Upload: R2 put failure => no D1 insert and ASSET_STORAGE_WRITE_FAILED.
// Upload: D1 insert failure => one R2 delete attempt; successful cleanup => ASSET_METADATA_WRITE_FAILED.
// Upload: D1 insert + compensation delete failure => ASSET_COMPENSATION_FAILED.
// Download: D1 missing => 404 ASSET_NOT_FOUND; R2 missing => 409 ASSET_OBJECT_MISSING.
// Download: valid object => exact binary bytes and required safe headers.
// Delete: D1 lookup failure => no R2 call and stable metadata-read failure.
// Delete: absent metadata => 404 ASSET_NOT_FOUND and no R2 call.
// Delete: D1 delete failure => no R2 delete and ASSET_METADATA_WRITE_FAILED.
// Delete: object already absent => idempotent R2-delete success and metadata remains deleted.
// Delete: D1 delete then R2 delete failure => D1 restore attempt and ASSET_STORAGE_DELETE_FAILED.
// Delete: R2 failure plus D1 restore failure => ASSET_COMPENSATION_FAILED.
// Delete: both operations succeed => returned AssetRecord and no R2 key in body.
```

Use fixtures for PNG (`89 50 4E 47 0D 0A 1A 0A`), JPEG (`FF D8 FF`), WebP (`RIFF....WEBP`), GIF (`GIF87a`/`GIF89a`), and PDF (`%PDF-`). Assert the normalized extension, declared MIME, and recognized signature agree before storing. Assert every failure JSON equals an envelope with the stable code and a generic message, never the injected `Error` text.

- [ ] **Step 2: Run the focused route test before implementation**

Run: `pnpm --filter @namdw/shared test -- assets-route.test.ts`

Expected: FAIL because the asset route and service do not exist.

- [ ] **Step 3: Implement strict validation and server-owned metadata**

Implement a `parseAssetUpload(request)` function that first parses a numeric `Content-Length` when present and returns `ASSET_TOO_LARGE` before `request.formData()` when it exceeds `15 * 1024 * 1024`. Map invalid multipart content types, malformed bodies, and thrown `formData()` calls to `ASSET_VALIDATION_ERROR`. Require exactly one `file` value that is a `File`, reject missing/multiple/non-File field values, and permit zero or one nonempty `noteId`. After parsing, verify actual received bytes are at most 15 MiB.

Normalize a browser name with NFKC, take only its basename, remove control bytes and `/`/`\\`, retain a safe extension, truncate the basename to 120 UTF-8 bytes on code-point boundaries, and generate `upload.<validated-extension>` if the sanitized basename is empty. The fixtures in Step 1 define the required outcomes for traversal, Windows paths, controls, compatibility characters, and multibyte truncation. Validate only the approved extension/declaration/signature combinations:

```ts
const allowedTypes = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.pdf':  'application/pdf',
} as const;
```

Generate `assetId = crypto.randomUUID()` and `r2Key = 'kb-assets/' + assetId + '/' + crypto.randomUUID() + extension`. Validate a supplied note relation with a prepared D1 statement before R2 writes. Store the received bytes, validated MIME, normalized name, and actual byte count; no caller field supplies a trusted equivalent.

- [ ] **Step 4: Implement the two compensating workflows**

Upload sequence: R2 `put` first, D1 metadata insert second; on D1 failure call R2 `delete` once. A successful cleanup returns `ASSET_METADATA_WRITE_FAILED`; a failed cleanup returns `ASSET_COMPENSATION_FAILED`.

DELETE ordering decision: (1) read exact D1 metadata, (2) delete D1 metadata, (3) delete the R2 object, (4) restore the exact D1 metadata if R2 deletion fails, and (5) return `ASSET_COMPENSATION_FAILED` when that restoration fails. This minimizes unrecoverable states: a D1 delete failure leaves the object untouched; an R2 delete failure can restore the user-visible metadata; deleting R2 first risks losing the object before a later D1 delete failure. R2 deletion of an already absent object is idempotent success. No distributed transaction, automated orphan cleanup, bulk reconciliation, or production cleanup is claimed.

| State/failure | Required behavior |
| --- | --- |
| D1 lookup fails | No R2 call; stable `ASSET_METADATA_READ_FAILED` failure. |
| Metadata absent | `404 ASSET_NOT_FOUND`; no R2 call. |
| D1 metadata delete fails | No R2 call; stable `ASSET_METADATA_WRITE_FAILED` failure. |
| R2 object exists and deletion succeeds | Complete deletion and return the deleted record. |
| R2 object is already absent | Treat R2 deletion as idempotent success; finish metadata cleanup. |
| R2 deletion throws/fails | Restore exact D1 metadata. |
| D1 restoration succeeds | Return stable `ASSET_STORAGE_DELETE_FAILED`; report no successful deletion. |
| D1 restoration fails | `ASSET_COMPENSATION_FAILED`; human-reviewed reconciliation only. |

- [ ] **Step 5: Implement the proxy route and safe headers**

Route behavior:

```ts
POST /api/assets             // 201 JSON envelope { asset }
GET /api/assets/:id          // binary Response on success, JSON failure envelope on error
DELETE /api/assets/:id       // JSON envelope AssetRecord
```

Validate `:id` with the existing notes alphanumeric-hyphen identifier policy. For successful GET, use only the validated D1 MIME/name and R2 object body. Set `Content-Type`, safe RFC 5987 `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, `Cross-Origin-Resource-Policy: same-origin`, and `Content-Length` only when R2 provides a safe numeric size. Do not implement `Range`, `inline`, listing, or redirect behavior.

- [ ] **Step 6: Run focused security evidence and commit**

Run:

```powershell
pnpm --filter @namdw/shared test -- assets-route.test.ts
pnpm exec tsc -p functions/tsconfig.json --noEmit
```

Expected: both PASS.

Commit: `git add functions/lib/assets.ts functions/api/assets/[[path]].ts functions/env.ts packages/shared/src/assets-route.test.ts .codex/progress.md && git commit -m "feat: add private asset storage API"`

### Task 3: Independent asset security review (Terra)

**Files:**
- Create: `.codex/reviews/w3-assets-security-review.md`
- Modify: `.codex/progress.md`

**Interfaces:**
- Consumes: Task 1 transport contract, Task 2 code/tests, global Access middleware.
- Produces: separate Specification compliance and Code quality/safety verdicts, with Critical/Important findings blocking Task 4.

- [ ] **Step 1: Review authorization and transport boundaries**

Confirm all `/api/assets` paths pass through `functions/_middleware.ts`; inspect that the route neither emits bucket/object keys nor constructs public URLs; verify binary GET success is never passed to `Response.json` or a JSON client parser.

- [ ] **Step 2: Review validation and headers against the approved limits**

Confirm exact 15 MiB actual-byte enforcement, all five allowed type/signature pairs, normalized 120-byte basename cap, no caller key/path acceptance, `attachment` disposition, `nosniff`, private no-store cache, same-origin resource policy, and conditional safe length.

- [ ] **Step 3: Review every compensation transition using test evidence**

Confirm the focused test covers every upload and deletion transition table row, including early Content-Length rejection, malformed multipart, all five valid signatures, every listed mismatch, D1 lookup/delete failures, absent metadata, absent R2 object, R2 failure, and D1 restoration failure. Confirm the written ordering decision explicitly prefers D1-delete then R2-delete because it minimizes unrecoverable object loss; record its unavoidable compensation/orphan limitation.

- [ ] **Step 4: Record verdict and gate continuation**

Write the two verdicts, commands, commit IDs, findings by severity, and remediation status. If any Critical/Important finding exists, stop and repair/re-review before Task 4. Otherwise update `progress.md` with approval.

Commit: `git add .codex/reviews/w3-assets-security-review.md .codex/progress.md && git commit -m "docs: record Wave 3 asset security review"`

**Non-goals / stop:** Do not remediate by adding cleanup automation or production reconciliation. A Critical/Important verdict stops the plan here; only an approved verdict opens Task 4.

### Task 4: Fixture-only editor and attachment presentation (Luna eligible)

**Files:**
- Create: `apps/web/src/knowledge-ui/EditorPage.tsx`, `apps/web/src/knowledge-ui/AssetPanel.tsx`, `apps/web/src/knowledge-ui/editor-fixtures.ts`, `apps/web/src/knowledge-ui/EditorPage.test.tsx`
- Modify: `apps/web/src/knowledge-ui/knowledge.css`, `.codex/progress.md`

**Interfaces:**
- Consumes: exported `HighlightKind` and fixture props only; no `fetch`, router, D1, R2, or Tiptap package imports.
- Produces: accessible presentational components with injected `EditorViewModel`, `EditorPresentationState`, callbacks, five highlight controls, explicit-version button, asset upload affordance, and delete confirmation affordance.

- [ ] **Step 1: Write component tests first**

Test fixture rendering for title/summary/category/tags, five named controls, remove-highlight control, manual Save, Save version, editing/saving/saved/failed labels, attachment upload input, attachment download control, and a delete confirmation that requires a second affirmative action before calling its injected callback.

- [ ] **Step 2: Run presentation tests before implementation**

Run: `pnpm --filter @namdw/web test -- EditorPage.test.tsx`

Expected: FAIL because the fixture components do not exist.

- [ ] **Step 3: Implement prop-driven, mobile-usable presentation**

Use an `EditorViewModel` containing JSON text, metadata, asset rows, dirty state, and save state. Render buttons labeled `Core`, `Mistake`, `Mastered`, `Method`, `Investigate`, and `Remove highlight`; render no `dangerouslySetInnerHTML`. The editable surface remains an injected placeholder/children slot in this task so Luna cannot alter document serialization or persistence.

- [ ] **Step 4: Verify and commit the isolated frontend task**

Run: `pnpm --filter @namdw/web test -- EditorPage.test.tsx`

Expected: PASS.

Commit: `git add apps/web/src/knowledge-ui/EditorPage.tsx apps/web/src/knowledge-ui/AssetPanel.tsx apps/web/src/knowledge-ui/editor-fixtures.ts apps/web/src/knowledge-ui/EditorPage.test.tsx apps/web/src/knowledge-ui/knowledge.css .codex/progress.md && git commit -m "feat: add knowledge editor presentation"`

**Non-goals / stop:** Luna owns fixture props, controls, accessibility, and CSS only. Luna must not modify shared contracts, D1 schema, Functions, Access middleware, R2 logic, mutation semantics, version semantics, or the canonical highlight schema. Stop after the component test and commit; Terra owns all live integration.

### Task 5: Authoritatively validate Tiptap JSON and integrate mutations, versions, and assets (Terra)

**Files:**
- Modify: `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/src/knowledge/knowledge-api.ts`, `apps/web/src/router.tsx`, `apps/web/src/knowledge-ui/EditorPage.tsx`, `functions/lib/notes.ts`, `functions/api/notes/[[path]].ts`, `packages/shared/src/notes-api.test.ts`, `packages/shared/src/notes-route.test.ts`
- Create: `apps/web/src/knowledge/KnowledgeEditorRoute.tsx`, `apps/web/src/knowledge/useNoteAutosave.ts`, `apps/web/src/knowledge/knowledge-editor.test.tsx`, `apps/web/src/knowledge-editor/KnowledgeHighlight.ts`, `apps/web/src/knowledge-editor/KnowledgeHighlight.test.ts`
- Modify: `.codex/progress.md`

**Interfaces:**
- Consumes: Notes JSON routes, explicit `POST /api/notes/:id/versions`, Task 1 transport metadata, Task 2 asset routes, and Task 4 presentation callbacks.
- Produces: server-authoritative narrow Tiptap validation and text derivation; `/knowledge/notes/new` and `/knowledge/notes/:id` flows; a five-kind persisted semantic Highlight extension; safe JSON mutation helpers; a dedicated binary download helper; abortable 1500 ms autosave; manual save; explicit version save; and asset upload/download/delete interactions.

**Non-goals / stop:** Do not change note request field names, D1 schema, version route semantics, Markdown/import scope, or add arbitrary ProseMirror schema support. Stop after focused server/client verification; Task 6 independently reviews all changes.

- [ ] **Step 1: Add failing integration tests**

Cover client integration: create sends a valid `contentJson` Tiptap document; loading hydrates the editor; each highlight button serializes a `highlight` mark with exactly one approved `kind`; PATCH follows a 1500 ms debounce; a later edit aborts/invalidates the earlier request; a stale success cannot replace current content; manual Save/PATCH does not call `/versions`; Save version calls only `POST /api/notes/:id/versions`; upload posts `FormData` with `file` and optional `noteId`; the dedicated binary download helper bypasses the JSON client; delete needs confirmed UI action; successful mutations refresh list/stats when navigating back.

Cover server validation with focused Notes service/route tests: minimal valid `doc`; representative headings, paragraphs, lists, code, and all highlight marks; malformed root; malformed child; malformed mark; every unknown/missing highlight kind; deterministic derived `contentText`; create/PATCH leave version count unchanged; explicit version snapshot behavior remains unchanged.

- [ ] **Step 2: Run the integration test before implementation**

Run: `pnpm --filter @namdw/web test -- knowledge-editor.test.tsx`

Expected: FAIL because mutation helpers, routes, and editor integration do not exist.

- [ ] **Step 3: Install approved editor dependencies and implement the safe client API**

Install only `@tiptap/react`, `@tiptap/starter-kit`, and `@tiptap/extension-highlight` in `apps/web`. Extend `knowledge-api.ts` with JSON mutation helpers that parse the frozen success/failure envelope and multipart helpers that do not set a manual `Content-Type`. Implement a dedicated `downloadAsset(assetId)` navigation/object-URL path for `/api/assets/:id`; it never calls the generic JSON envelope parser.

- [ ] **Step 4: Implement Tiptap and highlight serialization**

Create `apps/web/src/knowledge-editor/KnowledgeHighlight.ts` by extending/configuring Tiptap Highlight so `kind` is a real persisted mark attribute, not a stock Highlight assumption:

```ts
type HighlightKind = 'core' | 'mistake' | 'mastered' | 'method' | 'investigate';
type HighlightAttrs = { kind: HighlightKind };
```

The canonical JSON form is `{ type: 'highlight', attrs: { kind: 'core' } }`. Missing or unknown `kind` is rejected by the Notes API; the client strips it before rendering as defense in depth. The extension renders only a stable `data-kb-highlight` attribute/class from the five allowed kinds, parses that same semantic attribute back into `kind`, and maps colors/styles in CSS rather than canonical JSON. Add serialization/deserialization tests for all five kinds and rejection tests for unknown kinds. Persist `JSON.stringify(editor.getJSON())` as `contentJson`; do not accept/render raw HTML.

- [ ] **Step 5: Implement authoritative server document validation and derived text**

In `functions/lib/notes.ts`, replace JSON-parse-only acceptance with a narrow recursive validator: the root is `{ type: 'doc', content: Node[] }`; permitted node objects have bounded object/array shapes; text nodes have string `text`; supported headings, paragraphs, lists, list items, blockquotes, code blocks, hard breaks, and text use structurally valid content; marks are structurally valid; and `highlight` marks contain exactly one approved string `kind`. Reject malformed JSON, unsupported structures, malformed marks, missing kind, and unknown kind through the existing `VALIDATION_ERROR` envelope. Derive `contentText` by walking accepted content; ignore any client-supplied text projection. Preserve the existing create/PATCH and explicit-version persistence paths so only `/versions` writes `note_versions`.

- [ ] **Step 6: Implement mutation and stale-autosave behavior**

`useNoteAutosave` starts a 1500 ms timer after an edit, cancels the prior timer and `AbortController`, assigns a monotonically increasing generation to each PATCH, and applies a response only if it matches the latest generation. Display `editing`, `saving`, `saved`, and `failed`. Manual save uses the same current payload; only the separate Save version button posts to `/versions` after current save completion.

- [ ] **Step 7: Add routes and complete asset UI integration**

Add the exact routes before the wildcard:

```tsx
{ path: '/knowledge/notes/new', element: <KnowledgeEditorRoute mode="create" /> },
{ path: '/knowledge/notes/:id', element: <KnowledgeEditorRoute mode="edit" /> },
```

Use `POST /api/assets` for one selected file, show the returned safe original name/size, link downloads only to `/api/assets/:id`, and call DELETE only after the Task 4 confirmation callback. Never surface an R2 key.

- [ ] **Step 8: Verify and commit integration**

Run:

```powershell
pnpm --filter @namdw/web test -- knowledge-editor.test.tsx
pnpm --filter @namdw/web test -- KnowledgeHighlight.test.ts
pnpm --filter @namdw/shared test -- notes-api.test.ts notes-route.test.ts
pnpm --filter @namdw/web typecheck
pnpm exec tsc -p functions/tsconfig.json --noEmit
pnpm --filter @namdw/web build
```

Expected: all PASS.

Commit: `git add apps/web/package.json pnpm-lock.yaml apps/web/src/knowledge apps/web/src/knowledge-editor apps/web/src/knowledge-ui/EditorPage.tsx apps/web/src/router.tsx functions/lib/notes.ts functions/api/notes/[[path]].ts packages/shared/src/notes-api.test.ts packages/shared/src/notes-route.test.ts .codex/progress.md && git commit -m "feat: integrate knowledge editor and private assets"`

### Task 6: Full Wave 3 verification and independent final review (Terra)

**Files:**
- Create: `.codex/reviews/w3-final-review.md`
- Modify: `.codex/progress.md`

**Interfaces:**
- Consumes: completed Tasks 1-5 and prior Wave 2 baseline evidence.
- Produces: final Wave 3 compliance/safety verdicts that gate the separate Task 7 human checkpoint.

- [ ] **Step 1: Run Wave 3-focused verification**

Run:

```powershell
pnpm --filter @namdw/shared test
pnpm --filter @namdw/web test -- EditorPage.test.tsx knowledge-editor.test.tsx knowledge-integration.test.tsx
pnpm exec tsc -p functions/tsconfig.json --noEmit
pnpm typecheck
pnpm lint
pnpm --filter @namdw/web build
git diff --check
```

Expected: Wave 3-focused tests, typechecks, lint, build, and whitespace check PASS. Record the known five `contentQueries.test.ts` failures only if a broad web suite reproduces them; do not alter them.

- [ ] **Step 2: Review all mandatory Wave 3 properties**

Verify: immutable `content_json` canonical decision; narrow authoritative server document validation; derived server-side `content_text`; only explicit version creation; five allowed persisted mark kinds; custom `KnowledgeHighlight` serialization/deserialization; no raw HTML; Access coverage; multipart-only upload; early/actual size limits; all filename and signature cases; private proxy headers; no R2 key leak; every compensation-transition table row tested; no import/rewrite/migration scope; confirmed single-delete UI; and stale autosave protection.

- [ ] **Step 3: Record final verdict**

The review must separately state Specification compliance and Code quality/safety, list Critical/Important/Minor findings, state whether each blocker is closed, cite commands and commit IDs, and name the next authorized wave as Wave 4 design only.

- [ ] **Step 4: Stop before the human checkpoint**

Record final-review status in `.codex/progress.md`. Do not authorize production work; Task 7 alone records `HUMAN_ACTION_REQUIRED` after the human decision is requested.

Commit: `git add .codex/reviews/w3-final-review.md .codex/progress.md && git commit -m "docs: record Wave 3 final review"`

**Non-goals / stop:** This review does not authorize a deployment, D1 migration/write, asset deletion, reconciliation, cleanup, batch action, importer, or unrelated baseline-test fix. A Critical/Important finding blocks the final human gate.

### Task 7: Human checkpoint before production or destructive operations

**Files:**
- Modify: `.codex/progress.md`

**Ownership:** Human approval required; Terra records the decision only.

**Required human decision:** Confirm whether any later production deployment, production D1 write or migration, real asset deletion, orphan reconciliation, cleanup operation, batch action, or other destructive operation is authorized. Until explicit approval, every item in that list remains prohibited.

**Verification / stop:** Confirm the final review has no open Critical/Important findings and that the working tree contains no unreviewed implementation scope. Record `HUMAN_ACTION_REQUIRED` and stop. Do not run production commands or commit a production-operation change.

## Plan Self-Review

- Contract coverage: Task 1 removes binary GET success from the JSON map and freezes multipart/binary discriminated transports; Tasks 2-3 implement and independently review assets; Task 4 is fixture-only; Task 5 adds server-authoritative documents, marks, mutations, versions, autosave, and assets; Task 6 verifies; Task 7 is the required human gate.
- Scope coverage: no task creates Markdown canonical storage, a `content_markdown` migration, importer, batch feature, path resolver, import-source table, filesystem reader, external fetcher, public R2 URL, range/inline route, collaboration feature, Notion-parity feature, production operation, or cleanup job.
- Failure coverage: Task 2 defines injected failures for every upload/deletion matrix transition, and Task 3 independently reviews every row and the D1-first deletion decision.
- Model boundaries: Tasks 1-3, 5-6 are Terra; only Task 4 is Luna-eligible and fixture-only; Task 7 requires a human decision.
- Baseline isolation: the plan explicitly preserves the unrelated plan and excludes the five pre-existing content-query failures.
