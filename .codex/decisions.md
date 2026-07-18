# Decisions

## DEC-001

Decision: `content_json` will be the only canonical editable note body; `content_text` will be server-derived.

Reason: This is the binding product requirement and avoids Markdown/HTML/JSON synchronization defects.

Impact: Markdown remains import and future export only.

## DEC-002

Decision: Wave 0 makes documentation/control-file changes only and does not alter production application code.

Reason: The binding directive requires a stop at H0 before implementation.

## DEC-003

Decision: New knowledge-base APIs use `/api/*`; the legacy Nest content API retains `/api/v1/*` until a later approved transition.

Reason: This prevents route ambiguity while preserving existing frontend/static behavior.

## DEC-004

Decision: `wrangler.example.jsonc` is intentionally non-deployable; `wrangler.jsonc` is created only at H2 after real Pages/D1/R2 values are available.

Reason: A Pages Wrangler file becomes deployment configuration source of truth; placeholders must not alter a live project.
