PRAGMA foreign_keys = ON;

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL,
  content_text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_reviewed_at TEXT
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE roadmaps (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE roadmap_items (
  id TEXT PRIMARY KEY,
  roadmap_id TEXT NOT NULL,
  note_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  target_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  note_id TEXT,
  r2_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
);

CREATE TABLE note_versions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  content_json TEXT NOT NULL,
  content_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_status ON notes(status);
CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX idx_notes_category ON notes(category);
CREATE INDEX idx_notes_is_pinned ON notes(is_pinned);
CREATE INDEX idx_roadmap_items_order ON roadmap_items(roadmap_id, sort_order);
CREATE INDEX idx_assets_note_id ON assets(note_id);
