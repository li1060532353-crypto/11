ALTER TABLE note_publication_metadata ADD COLUMN published_at TEXT;
UPDATE note_publication_metadata SET published_at=(SELECT notes.published_at FROM notes WHERE notes.id=note_publication_metadata.note_id);
