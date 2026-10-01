-- Add is_featured and published_at columns to notes table
ALTER TABLE notes ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1));
ALTER TABLE notes ADD COLUMN published_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notes_is_featured ON notes(is_featured);
CREATE INDEX IF NOT EXISTS idx_notes_published_at ON notes(published_at);
