CREATE TABLE note_publication_metadata (
  note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  is_featured INTEGER NOT NULL
);
INSERT INTO note_publication_metadata (note_id,slug,category,tags_json,is_featured)
SELECT notes.id,notes.slug,notes.category,
  COALESCE((SELECT json_group_array(tags.name) FROM tags JOIN note_tags ON tags.id=note_tags.tag_id WHERE note_tags.note_id=notes.id),'[]'),
  notes.is_featured
FROM notes WHERE notes.status='published' AND notes.published_content_json IS NOT NULL;
