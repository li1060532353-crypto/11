# Draft and Image Reliability Implementation Plan

> For agentic workers: follow test-driven-development and executing-plans. User approved implementation of the completed audit on 2026-10-01.

**Goal:** Preserve draft edits across saving and publication and persist actual private images through editing and reading.
**Architecture:** A serialized editor save queue acknowledges server snapshots independently of newer local input. Private image blocks use assetId and alt; backend validation, editor schema and renderer share that contract.
**Tech Stack:** Existing React, Tiptap, Pages Functions, D1 and private R2; no new dependencies.
**Spec:** E:/AIblog/editor-audit-evidence/draft-and-image-analysis.md; existing docs/codex-master-spec.md.

## Constraints and ownership

- Keep Access and production resources unchanged. Chinese files use UTF-8 BOM.
- Controller owns frontend, integration, documentation and final checks on codex/draft-image-fixes.
- Backend worker owns notes/assets service and related shared tests in existing wt-backend on codex/draft-image-backend, based on 995d621. Integrate its commit before whole-repo checks.
- Reviewer inspects combined changes independently. Never treat mock tests as production verification.

## Frozen interfaces

- Image block: `{type:'image',attrs:{assetId:string,alt:string}}`; private URL derived as `/api/assets/:id?inline=1`.
- Ordinary asset GET remains download; inline query permits supported raster images only.
- Existing note envelopes/routes remain; autosave no longer changes publication status.
- Existing automatic save debounce stays 1500ms. onPersisted acknowledges each successful snapshot even if local editing advances. Manual flush waits for newest queued edit.

## Tasks

- [x] Backend: failing tests for real link default attrs, valid/invalid image blocks, asset ownership and deletion references, inline raster responses; implement; run shared tests and Functions typecheck; commit.
- [x] Save queue: convert audit A->B->A probe to expected behavior; cover failed/stale writes, manual flush, unmount and note identity; implement useNoteAutosave; run focused tests.
- [x] Editor lifecycle: preserve edits during first create/publish, keep identity after partial publish failure, flush before unpublish, loaded-only writes and reactive busy state. Add delayed-response and recovery tests before changes.
- [x] Images: custom KnowledgeImage extension, actual image insertion, normal asset reload/error state, preview/reader rendering; test real editor JSON through real validator and render/reopen.
- [x] Navigation/preview: show live draft preview without leaving editor; router-aware unsaved protection including browser navigation. Verify save/discard and current draft retention.
- [x] Integration: apply backend commit, run relevant tests, typecheck, lint, build, local Functions/D1/R2 smoke; independently review; record any verification limitations.

## Review focus

1. A->B in flight->A must write A back after B acknowledgement.
2. Creating note identity must not overwrite edits or repeat POST after publication failure.
3. Status actions must not race ordinary autosaves or overwrite fresh text.
4. Images must round-trip through actual editor JSON, validation and reading; saved attachments must reload.
5. Unavailable note load must never enable writes; leaving with writes in flight must not falsely promise rollback.

## Verification record

See ../../draft-image-fixes-verification.md for final results and remaining verification boundaries. Backend integration: f7b0fca and 093b012.
