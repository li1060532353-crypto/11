# Decisions

## DEC-001

Decision: `content_json` will be the only canonical editable note body; `content_text` will be server-derived.

Reason: This is the binding product requirement and avoids Markdown/HTML/JSON synchronization defects.

Impact: Markdown remains import and future export only.

## DEC-002

Decision: Wave 0 makes documentation/control-file changes only and does not alter production application code.

Reason: The binding directive requires a stop at H0 before implementation.
