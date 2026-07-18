import { type ApiRequestFor, type ApiResponseFor, type NoteRecord } from '../../packages/shared/src/index';

export class NoteDomainError extends Error { constructor(readonly code: string, message: string) { super(message); } }
export type NoteStore = {
  list(query: ApiRequestFor<'GET /api/notes'>): Promise<ApiResponseFor<'GET /api/notes'>>;
  find(id: string): Promise<NoteRecord | null>;
  save(note: NoteRecord): Promise<NoteRecord>;
  saveWithVersion(note: NoteRecord, tags?: readonly string[]): Promise<NoteRecord>;
};

export function createNoteService(store: NoteStore, id = crypto.randomUUID, now = () => new Date().toISOString()) {
  return {
    list: (query: ApiRequestFor<'GET /api/notes'> = {}) => store.list(query), get: (id: string) => store.find(id),
    async create(input: ApiRequestFor<'POST /api/notes'>) {
      validateCreate(input);
      const timestamp = now(); const noteId=id(); const note: NoteRecord = { id: noteId, slug: `${slugify(input.title)}-${noteId}`, title: input.title, summary: input.summary, contentJson: input.contentJson, contentText: toText(input.contentJson), category: input.category, status: input.status, isPinned: input.isPinned, reviewCount: 0, createdAt: timestamp, updatedAt: timestamp, lastReviewedAt: null };
      return store.saveWithVersion(note, input.tags);
    },
    async update(noteId: string, input: ApiRequestFor<'PATCH /api/notes/:id'>) {
      validateUpdate(input);
      if (!Object.keys(input).length) throw new NoteDomainError('VALIDATION_ERROR', 'Update payload cannot be empty');
      const existing = await store.find(noteId); if (!existing) return null;
      const contentJson = input.contentJson ?? existing.contentJson;
      return store.saveWithVersion({ ...existing, ...input, contentJson, contentText: input.contentJson === undefined ? existing.contentText : toText(contentJson), updatedAt: now() }, input.tags);
    },
    async archive(noteId: string) { const existing = await store.find(noteId); return existing ? store.save({ ...existing, status: 'archived', updatedAt: now() }) : null; },
  };
}

export function createD1NoteStore(db: D1Database): NoteStore {
  const map = (row: Record<string, unknown>): NoteRecord => ({ id: String(row.id), title: String(row.title), slug: String(row.slug), summary: String(row.summary), contentJson: String(row.content_json), contentText: String(row.content_text), category: String(row.category), status: row.status as NoteRecord['status'], isPinned: Number(row.is_pinned) === 1, reviewCount: Number(row.review_count), createdAt: String(row.created_at), updatedAt: String(row.updated_at), lastReviewedAt: row.last_reviewed_at ? String(row.last_reviewed_at) : null });
  return {
    async list(query) { const page=Math.max(1,query.page??1), pageSize=Math.min(100,Math.max(1,query.pageSize??20)); const where:string[]=[]; const values:unknown[]=[]; if(query.status){where.push('notes.status = ?');values.push(query.status);} if(query.category){where.push('notes.category = ?');values.push(query.category);} if(query.pinned!==undefined){where.push('notes.is_pinned = ?');values.push(query.pinned?1:0);} if(query.tag){where.push('EXISTS (SELECT 1 FROM note_tags nt JOIN tags t ON t.id=nt.tag_id WHERE nt.note_id=notes.id AND t.slug=?)');values.push(query.tag);} const clause=where.length?` WHERE ${where.join(' AND ')}`:''; const result=await db.prepare(`SELECT * FROM notes${clause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).bind(...values,pageSize,(page-1)*pageSize).all<Record<string,unknown>>(); const count=await db.prepare(`SELECT COUNT(*) AS count FROM notes${clause}`).bind(...values).first<{count:number}>(); const totalItems=Number(count?.count??0); return {items:result.results.map(map),page,pageSize,totalItems,totalPages:Math.max(1,Math.ceil(totalItems/pageSize))}; },
    async find(id) { const row = await db.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first<Record<string, unknown>>(); return row ? map(row) : null; },
    async save(note) { await db.prepare('INSERT INTO notes (id,title,slug,summary,content_json,content_text,category,status,is_pinned,review_count,created_at,updated_at,last_reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,content_json=excluded.content_json,content_text=excluded.content_text,category=excluded.category,status=excluded.status,is_pinned=excluded.is_pinned,updated_at=excluded.updated_at,last_reviewed_at=excluded.last_reviewed_at').bind(note.id,note.title,note.slug,note.summary,note.contentJson,note.contentText,note.category,note.status,note.isPinned?1:0,note.reviewCount,note.createdAt,note.updatedAt,note.lastReviewedAt).run(); return note; },
    async saveWithVersion(note,tags) { const statement = db.prepare('INSERT INTO notes (id,title,slug,summary,content_json,content_text,category,status,is_pinned,review_count,created_at,updated_at,last_reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,content_json=excluded.content_json,content_text=excluded.content_text,category=excluded.category,status=excluded.status,is_pinned=excluded.is_pinned,updated_at=excluded.updated_at,last_reviewed_at=excluded.last_reviewed_at').bind(note.id,note.title,note.slug,note.summary,note.contentJson,note.contentText,note.category,note.status,note.isPinned?1:0,note.reviewCount,note.createdAt,note.updatedAt,note.lastReviewedAt); const version = db.prepare('INSERT INTO note_versions (id,note_id,content_json,content_text,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),note.id,note.contentJson,note.contentText,note.updatedAt); const statements:D1PreparedStatement[]=[statement,version]; if(tags!==undefined){statements.push(db.prepare('DELETE FROM note_tags WHERE note_id=?').bind(note.id)); for(const tag of [...new Set(tags)]){const slug=slugify(tag);statements.push(db.prepare('INSERT INTO tags (id,name,slug) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET slug=excluded.slug').bind(crypto.randomUUID(),tag,slug),db.prepare('INSERT OR IGNORE INTO note_tags (note_id,tag_id) SELECT ?,id FROM tags WHERE name=?').bind(note.id,tag));}} await db.batch(statements); return note; },
  };
}
function slugify(value: string) { return value.normalize('NFKC').toLowerCase().replace(/[^\p{Letter}\p{Number}\s-]/gu,'').trim().replace(/[\s-]+/gu,'-') || 'note'; }
function toText(json: string) { try { const walk=(v: unknown): string[] => typeof v==='string'?[v]:Array.isArray(v)?v.flatMap(walk):v&&typeof v==='object'?Object.values(v).flatMap(walk):[]; return walk(JSON.parse(json)).join(' ').trim(); } catch { return ''; } }
function validTags(value: unknown){return value===undefined||(Array.isArray(value)&&value.every((tag)=>typeof tag==='string'&&tag.trim()));}
function validJson(value: unknown){if(typeof value!=='string')return false;try{JSON.parse(value);return true;}catch{return false;}}
function validateCreate(value: unknown): asserts value is ApiRequestFor<'POST /api/notes'> { if (!value || typeof value !== 'object'||Array.isArray(value)) throw new NoteDomainError('VALIDATION_ERROR','Invalid note payload'); const v=value as Record<string,unknown>; if (typeof v.title!=='string'||!v.title.trim()||typeof v.summary!=='string'||!validJson(v.contentJson)||typeof v.category!=='string'||!['draft','published','archived'].includes(String(v.status))||typeof v.isPinned!=='boolean'||!validTags(v.tags)) throw new NoteDomainError('VALIDATION_ERROR','Invalid note payload'); }
function validateUpdate(value: unknown): asserts value is ApiRequestFor<'PATCH /api/notes/:id'> { if (!value||typeof value!=='object'||Array.isArray(value)) throw new NoteDomainError('VALIDATION_ERROR','Invalid update payload'); const v=value as Record<string,unknown>; const allowed=['title','summary','contentJson','category','status','isPinned','tags']; if (!Object.keys(v).length||Object.keys(v).some((key)=>!allowed.includes(key))||(v.title!==undefined&&(typeof v.title!=='string'||!v.title.trim()))||(v.summary!==undefined&&typeof v.summary!=='string')||(v.contentJson!==undefined&&!validJson(v.contentJson))||(v.category!==undefined&&typeof v.category!=='string')||(v.status!==undefined&&!['draft','published','archived'].includes(String(v.status)))||(v.isPinned!==undefined&&typeof v.isPinned!=='boolean')||!validTags(v.tags)) throw new NoteDomainError('VALIDATION_ERROR','Invalid update payload'); }
