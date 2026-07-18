import {
  type ApiRequestFor,
  type ApiResponseFor,
  type NoteRecord,
  type NoteVersionRecord,
} from '../../packages/shared/src/index';

export class NoteDomainError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

export type NoteStore = {
  list(query: ApiRequestFor<'GET /api/notes'>): Promise<ApiResponseFor<'GET /api/notes'>>;
  find(id: string): Promise<NoteRecord | null>;
  save(note: NoteRecord): Promise<NoteRecord>;
  saveWithTags(note: NoteRecord, tags?: readonly string[]): Promise<NoteRecord>;
  createVersion(note: NoteRecord, versionId: string): Promise<NoteVersionRecord>;
  listVersions(noteId: string): Promise<readonly NoteVersionRecord[]>;
};

export function createNoteService(store: NoteStore, id = crypto.randomUUID, now = () => new Date().toISOString()) {
  return {
    list: (query: ApiRequestFor<'GET /api/notes'> = {}) => store.list(query),
    get: (noteId: string) => store.find(noteId),
    async create(input: ApiRequestFor<'POST /api/notes'>) {
      validateCreate(input);
      const timestamp = now();
      const noteId = id();
      const note: NoteRecord = {
        id: noteId,
        slug: `${slugify(input.title)}-${noteId}`,
        title: input.title,
        summary: input.summary,
        contentJson: input.contentJson,
        contentText: toText(input.contentJson),
        category: input.category,
        status: input.status,
        isPinned: input.isPinned,
        reviewCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastReviewedAt: null,
      };
      return store.saveWithTags(note, input.tags);
    },
    async update(noteId: string, input: ApiRequestFor<'PATCH /api/notes/:id'>) {
      validateUpdate(input);
      const existing = await store.find(noteId);
      if (!existing) return null;
      const { tags, ...changes } = input;
      const contentJson = changes.contentJson ?? existing.contentJson;
      return store.saveWithTags({
        ...existing,
        ...changes,
        contentJson,
        contentText: changes.contentJson === undefined ? existing.contentText : toText(contentJson),
        updatedAt: now(),
      }, tags);
    },
    async archive(noteId: string) {
      const existing = await store.find(noteId);
      return existing ? store.save({ ...existing, status: 'archived', updatedAt: now() }) : null;
    },
    async restore(noteId: string) {
      const existing = await store.find(noteId);
      return existing ? store.save({ ...existing, status: 'draft', updatedAt: now() }) : null;
    },
    async review(noteId: string) {
      const existing = await store.find(noteId);
      return existing ? store.save({ ...existing, reviewCount: existing.reviewCount + 1, lastReviewedAt: now(), updatedAt: now() }) : null;
    },
    async saveVersion(noteId: string) {
      const existing = await store.find(noteId);
      return existing ? store.createVersion(existing, id()) : null;
    },
    async versions(noteId: string) {
      const existing = await store.find(noteId);
      return existing ? store.listVersions(noteId) : null;
    },
  };
}

const noteColumns = 'id,title,slug,summary,content_json,content_text,category,status,is_pinned,review_count,created_at,updated_at,last_reviewed_at';
const noteWrite = `INSERT INTO notes (${noteColumns}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,content_json=excluded.content_json,content_text=excluded.content_text,category=excluded.category,status=excluded.status,is_pinned=excluded.is_pinned,review_count=excluded.review_count,updated_at=excluded.updated_at,last_reviewed_at=excluded.last_reviewed_at`;

function mapNote(row: Record<string, unknown>): NoteRecord {
  return {
    id: String(row.id), title: String(row.title), slug: String(row.slug), summary: String(row.summary),
    contentJson: String(row.content_json), contentText: String(row.content_text), category: String(row.category),
    status: row.status as NoteRecord['status'], isPinned: Number(row.is_pinned) === 1,
    reviewCount: Number(row.review_count), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    lastReviewedAt: row.last_reviewed_at ? String(row.last_reviewed_at) : null,
  };
}

function bindNote(statement: D1PreparedStatement, note: NoteRecord) {
  return statement.bind(note.id, note.title, note.slug, note.summary, note.contentJson, note.contentText, note.category,
    note.status, note.isPinned ? 1 : 0, note.reviewCount, note.createdAt, note.updatedAt, note.lastReviewedAt);
}

export function createD1NoteStore(db: D1Database): NoteStore {
  return {
    async list(query) {
      const page = query.page ?? 1;
      const pageSize = Math.min(100, query.pageSize ?? 20);
      const where: string[] = [];
      const values: unknown[] = [];
      if (query.status) { where.push('notes.status = ?'); values.push(query.status); }
      if (query.category) { where.push('notes.category = ?'); values.push(query.category); }
      if (query.pinned !== undefined) { where.push('notes.is_pinned = ?'); values.push(query.pinned ? 1 : 0); }
      if (query.tag) { where.push('EXISTS (SELECT 1 FROM note_tags nt JOIN tags t ON t.id=nt.tag_id WHERE nt.note_id=notes.id AND t.slug=?)'); values.push(query.tag); }
      const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
      const result = await db.prepare(`SELECT * FROM notes${clause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
        .bind(...values, pageSize, (page - 1) * pageSize).all<Record<string, unknown>>();
      const count = await db.prepare(`SELECT COUNT(*) AS count FROM notes${clause}`).bind(...values).first<{ count: number }>();
      const totalItems = Number(count?.count ?? 0);
      return { items: result.results.map(mapNote), page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) };
    },
    async find(noteId) {
      const row = await db.prepare('SELECT * FROM notes WHERE id = ?').bind(noteId).first<Record<string, unknown>>();
      return row ? mapNote(row) : null;
    },
    async save(note) {
      await bindNote(db.prepare(noteWrite), note).run();
      return note;
    },
    async saveWithTags(note, tags) {
      const statements: D1PreparedStatement[] = [bindNote(db.prepare(noteWrite), note)];
      if (tags !== undefined) {
        statements.push(db.prepare('DELETE FROM note_tags WHERE note_id = ?').bind(note.id));
        for (const tag of [...new Set(tags)]) {
          statements.push(
            db.prepare('INSERT INTO tags (id,name,slug) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET slug=excluded.slug').bind(crypto.randomUUID(), tag, slugify(tag)),
            db.prepare('INSERT OR IGNORE INTO note_tags (note_id,tag_id) SELECT ?,id FROM tags WHERE name=?').bind(note.id, tag),
          );
        }
      }
      await db.batch(statements);
      return note;
    },
    async createVersion(note, versionId) {
      await db.prepare('INSERT INTO note_versions (id,note_id,content_json,content_text,created_at) VALUES (?,?,?,?,?)')
        .bind(versionId, note.id, note.contentJson, note.contentText, note.updatedAt).run();
      return { id: versionId, contentJson: note.contentJson, contentText: note.contentText, createdAt: note.updatedAt };
    },
    async listVersions(noteId) {
      const versions = await db.prepare('SELECT id,content_json,content_text,created_at FROM note_versions WHERE note_id = ? ORDER BY created_at DESC')
        .bind(noteId).all<Record<string, unknown>>();
      return versions.results.map((row) => ({ id: String(row.id), contentJson: String(row.content_json), contentText: String(row.content_text), createdAt: String(row.created_at) }));
    },
  };
}

export const maximumPage = 10_000;

export function parseNoteListQuery(request: Request): ApiRequestFor<'GET /api/notes'> {
  const params = new URL(request.url).searchParams;
  const result: { page?: number; pageSize?: number; status?: NoteRecord['status']; category?: string; tag?: string; pinned?: boolean } = {};
  for (const key of ['page', 'pageSize'] as const) {
    if (!params.has(key)) continue;
    const value = Number(params.get(key));
    if (!Number.isSafeInteger(value) || value < 1 || (key === 'page' && value > maximumPage)) throw new NoteDomainError('VALIDATION_ERROR', `Invalid ${key}`);
    result[key] = value;
  }
  const status = params.get('status');
  if (status !== null) {
    if (!['draft', 'published', 'archived'].includes(status)) throw new NoteDomainError('VALIDATION_ERROR', 'Invalid status');
    result.status = status as NoteRecord['status'];
  }
  for (const key of ['category', 'tag'] as const) { const value = params.get(key); if (value !== null) result[key] = value; }
  if (params.has('pinned')) {
    const value = params.get('pinned');
    if (value !== 'true' && value !== 'false') throw new NoteDomainError('VALIDATION_ERROR', 'Invalid pinned');
    result.pinned = value === 'true';
  }
  return result;
}

function slugify(value: string) { return value.normalize('NFKC').toLowerCase().replace(/[^\p{Letter}\p{Number}\s-]/gu, '').trim().replace(/[\s-]+/gu, '-') || 'note'; }
function toText(json: string) { try { const walk = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(walk) : value && typeof value === 'object' ? Object.values(value).flatMap(walk) : []; return walk(JSON.parse(json)).join(' ').trim(); } catch { return ''; } }
function validTags(value: unknown) { return value === undefined || (Array.isArray(value) && value.every((tag) => typeof tag === 'string' && tag.trim())); }
function validJson(value: unknown) { if (typeof value !== 'string') return false; try { JSON.parse(value); return true; } catch { return false; } }
function validateCreate(value: unknown): asserts value is ApiRequestFor<'POST /api/notes'> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload'); const input = value as Record<string, unknown>; if (typeof input.title !== 'string' || !input.title.trim() || typeof input.summary !== 'string' || !validJson(input.contentJson) || typeof input.category !== 'string' || !['draft', 'published', 'archived'].includes(String(input.status)) || typeof input.isPinned !== 'boolean' || !validTags(input.tags)) throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload'); }
function validateUpdate(value: unknown): asserts value is ApiRequestFor<'PATCH /api/notes/:id'> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NoteDomainError('VALIDATION_ERROR', 'Invalid update payload'); const input = value as Record<string, unknown>; const allowed = ['title', 'summary', 'contentJson', 'category', 'status', 'isPinned', 'tags']; if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.includes(key)) || (input.title !== undefined && (typeof input.title !== 'string' || !input.title.trim())) || (input.summary !== undefined && typeof input.summary !== 'string') || (input.contentJson !== undefined && !validJson(input.contentJson)) || (input.category !== undefined && typeof input.category !== 'string') || (input.status !== undefined && !['draft', 'published', 'archived'].includes(String(input.status))) || (input.isPinned !== undefined && typeof input.isPinned !== 'boolean') || !validTags(input.tags)) throw new NoteDomainError('VALIDATION_ERROR', 'Invalid update payload'); }
