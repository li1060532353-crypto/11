# Demo Walkthrough

This walkthrough presents the v1.0 release candidate without inventing data or
capabilities. Use a local Pages session with `LOCAL_AUTH_BYPASS=true`, or an
approved environment with a valid Cloudflare Access session, for the knowledge
steps.

## Public visitor flow

```text
Home
  ↓
Browse posts
  ↓
Read an article
  ↓
Search content
```

### 1. Home

Open `/`. The visitor sees the editorial homepage, featured content, and
navigation to articles, projects, search, and Knowledge. The public content
client first requests the configured legacy content API base
(`VITE_API_BASE_URL`, default `/api/v1`) and uses committed static content if
that service is unavailable.

### 2. Browse and read

Open `/posts`, then choose an article such as `/posts/matrix-rank`. The reader
shows the article body, headings, code and math rendering where the content
uses them, and the existing reading layout. The content is rendered from the
same public content path as the homepage; no analytics, popularity, or
invented metadata is shown.

### 3. Search

Open `/search`, enter a term, and show the result or empty state. Search is a
public-content discovery flow; it retains the existing URL and static fallback
behavior.

## Knowledge workflow

```text
Open Knowledge Workspace
  ↓
View overview
  ↓
Create article
  ↓
Edit with Tiptap
  ↓
Autosave
  ↓
Create version
```

### 1. Open the workspace

Open `/knowledge`. The route is lazy-loaded after the public shell and shows
real overview data: note totals/statuses and recently edited notes. It calls
`/api/stats` and `/api/notes`; those requests require Cloudflare Access in a
deployed environment.

### 2. Browse articles

Open `/knowledge/notes`. The UI calls existing `/api/notes` and `/api/search`
contracts to list and search the internal `NoteRecord` data. The presentation
uses “Articles,” but the API and persistence model retain their existing Note
naming.

### 3. Create and edit

Select the create action to open `/knowledge/notes/new`. Saving creates a note
through the existing `/api/notes` contract. Opening `/knowledge/notes/:id`
loads that note into the existing Tiptap editor. The editor preserves the
current document schema and `content_json` format.

### 4. Autosave and versions

Make a small title or body edit, wait for the visible save-status update, then
create a version through the editor's existing explicit version action.
Autosave debounce, stale-response protection, and version semantics are
unchanged. Reload the note to demonstrate persisted note content and the
version list.

## Services involved

| Demonstrated capability | UI route | Existing service boundary |
| --- | --- | --- |
| Public blog and search | `/`, `/posts/*`, `/search` | React content client; legacy API when present, otherwise bundled static content |
| Knowledge overview | `/knowledge` | Pages Functions `/api/stats`, `/api/notes` → D1 |
| Article list and search | `/knowledge/notes` | Pages Functions `/api/notes`, `/api/search` → D1 |
| Create, edit, archive/restore | Knowledge editor/list | Pages Functions `/api/notes/*` → D1 |
| Autosave and versions | Knowledge editor | Existing note update/version Functions → D1 |
| Temporary asset operations | Knowledge editor | Existing `/api/assets/*` Functions → private R2 and existing asset metadata storage |

## Do not demo as available

- Persistent note-to-asset relationships do not exist.
- There is no media library or asset-list experience.
- Knowledge Markdown import is unavailable.
- R2 objects do not have public URLs.
- Multi-user permissions are not implemented; current API access is controlled
  by the configured Cloudflare Access boundary.

No production deployment is performed by this walkthrough.
