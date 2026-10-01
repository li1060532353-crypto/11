-- Migration: 0003_add_published_snapshots.sql
-- Description: Add published snapshot columns to notes table, composite index, and backfill existing published articles

-- 1. Add published snapshot columns
ALTER TABLE notes ADD COLUMN published_title TEXT;
ALTER TABLE notes ADD COLUMN published_summary TEXT;
ALTER TABLE notes ADD COLUMN published_content_json TEXT;
ALTER TABLE notes ADD COLUMN published_content_text TEXT;

-- 2. Composite index for fast published lookups
CREATE INDEX IF NOT EXISTS idx_notes_published_lookup ON notes (status, published_at DESC) WHERE status = 'published';

-- 3. Backfill existing published articles
UPDATE notes
SET published_title = title,
    published_summary = summary,
    published_content_json = content_json,
    published_content_text = content_text,
    published_at = COALESCE(published_at, updated_at, datetime('now'))
WHERE status = 'published' AND published_content_json IS NULL;

