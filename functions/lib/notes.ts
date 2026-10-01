import {
  type ApiRequestFor,
  type ApiResponseFor,
  highlightKinds,
  type NoteRecord,
  type NoteSortOption,
  noteSortOptions,
  type NoteVersionRecord,
} from '../../packages/shared/src/index';

export class NoteDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const maximumDocumentBytes = 256 * 1024;
export const maximumDocumentDepth = 32;
export const maximumDocumentNodes = 10_000;
export const maximumDocumentStringLength = 16 * 1024;
export const maximumMarksPerTextNode = 16;

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
};
type TiptapMark = { type: string; attrs?: Record<string, unknown> };
export type TiptapDocument = TiptapNode & { type: 'doc'; content: TiptapNode[] };

const highlightKindSet = new Set<string>(highlightKinds);
const blockTypes = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'table',
  'image',
]);
const inlineTypes = new Set(['text', 'hardBreak']);
const basicMarkTypes = new Set(['bold', 'italic', 'strike', 'code']);

function documentError(message = 'Invalid document'): never {
  throw new NoteDomainError('VALIDATION_ERROR', message);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}
function readString(value: unknown) {
  if (typeof value !== 'string' || value.length > maximumDocumentStringLength) documentError();
  return value;
}
function optionalContent(value: Record<string, unknown>) {
  if (value.content === undefined) return [];
  if (!Array.isArray(value.content)) documentError();
  return value.content;
}
function requiredContent(value: Record<string, unknown>) {
  if (!Array.isArray(value.content)) documentError();
  return value.content;
}
function isHighlightKind(value: unknown): value is string {
  return typeof value === 'string' && highlightKindSet.has(value);
}

export function parseTiptapDocument(json: string): TiptapDocument {
  if (typeof json !== 'string' || new TextEncoder().encode(json).byteLength > maximumDocumentBytes)
    documentError();
  let root: unknown;
  try {
    root = JSON.parse(json);
  } catch {
    documentError();
  }
  let nodeCount = 0;
  const validateMarks = (value: unknown) => {
    if (value === undefined) return;
    if (!Array.isArray(value) || value.length > maximumMarksPerTextNode) documentError();
    const seen = new Set<string>();
    for (const mark of value) {
      if (
        !isRecord(mark) ||
        typeof mark.type !== 'string' ||
        !hasOnlyKeys(mark, ['type', 'attrs']) ||
        seen.has(mark.type)
      )
        documentError();
      seen.add(mark.type);
      if (basicMarkTypes.has(mark.type)) {
        if (mark.attrs !== undefined) documentError();
        continue;
      }
      if (mark.type === 'link') {
        if (!isRecord(mark.attrs) || typeof mark.attrs.href !== 'string') documentError();
        const href = mark.attrs.href.trim();
        if (href.length === 0 || href.length > maximumDocumentStringLength) documentError();
        if (/^(?:javascript|vbscript|data):/i.test(href)) documentError();
        if ([...href].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
          documentError();
        if (!hasOnlyKeys(mark.attrs, ['href', 'target', 'rel', 'class', 'title'])) documentError();
        if (mark.attrs.class !== undefined && mark.attrs.class !== null) documentError();
        if (mark.attrs.title !== undefined && mark.attrs.title !== null) documentError();
        if (
          mark.attrs.target !== undefined &&
          (typeof mark.attrs.target !== 'string' || mark.attrs.target.length > 32)
        )
          documentError();
        if (
          mark.attrs.rel !== undefined &&
          (typeof mark.attrs.rel !== 'string' || mark.attrs.rel.length > 64)
        )
          documentError();
        continue;
      }
      if (
        mark.type !== 'highlight' ||
        !isRecord(mark.attrs) ||
        !hasOnlyKeys(mark.attrs, ['kind']) ||
        !isHighlightKind(mark.attrs.kind)
      )
        documentError();
    }
  };
  const validateNodes = (values: unknown[], allowed: ReadonlySet<string>, depth: number) => {
    for (const value of values) validateNode(value, allowed, depth);
  };
  const validateNode = (
    value: unknown,
    allowed: ReadonlySet<string>,
    depth: number,
  ): TiptapNode => {
    if (
      !isRecord(value) ||
      typeof value.type !== 'string' ||
      !allowed.has(value.type) ||
      depth > maximumDocumentDepth ||
      ++nodeCount > maximumDocumentNodes
    )
      documentError();
    switch (value.type) {
      case 'image':
        if (
          !hasOnlyKeys(value, ['type', 'attrs']) ||
          !isRecord(value.attrs) ||
          !hasOnlyKeys(value.attrs, ['assetId', 'alt']) ||
          typeof value.attrs.assetId !== 'string' ||
          !/^[A-Za-z0-9-]+$/u.test(value.attrs.assetId)
        )
          documentError();
        readString(value.attrs.alt);
        break;
      case 'doc':
        if (!hasOnlyKeys(value, ['type', 'content'])) documentError();
        validateNodes(requiredContent(value), blockTypes, depth + 1);
        break;
      case 'paragraph':
        if (!hasOnlyKeys(value, ['type', 'content'])) documentError();
        validateNodes(optionalContent(value), inlineTypes, depth + 1);
        break;
      case 'heading': {
        if (!hasOnlyKeys(value, ['type', 'attrs', 'content'])) documentError();
        if (
          value.attrs !== undefined &&
          (!isRecord(value.attrs) ||
            !hasOnlyKeys(value.attrs, ['level']) ||
            !Number.isInteger(value.attrs.level) ||
            Number(value.attrs.level) < 1 ||
            Number(value.attrs.level) > 6)
        )
          documentError();
        validateNodes(optionalContent(value), inlineTypes, depth + 1);
        break;
      }
      case 'bulletList':
        if (!hasOnlyKeys(value, ['type', 'content']) || requiredContent(value).length === 0)
          documentError();
        validateNodes(requiredContent(value), new Set(['listItem']), depth + 1);
        break;
      case 'orderedList': {
        if (
          !hasOnlyKeys(value, ['type', 'attrs', 'content']) ||
          requiredContent(value).length === 0
        )
          documentError();
        if (
          value.attrs !== undefined &&
          (!isRecord(value.attrs) ||
            !hasOnlyKeys(value.attrs, ['start']) ||
            !Number.isSafeInteger(value.attrs.start) ||
            Number(value.attrs.start) < 1)
        )
          documentError();
        validateNodes(requiredContent(value), new Set(['listItem']), depth + 1);
        break;
      }
      case 'listItem':
        if (!hasOnlyKeys(value, ['type', 'content']) || requiredContent(value).length === 0)
          documentError();
        validateNodes(
          requiredContent(value),
          new Set(['paragraph', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'image']),
          depth + 1,
        );
        break;
      case 'blockquote':
        if (!hasOnlyKeys(value, ['type', 'content']) || requiredContent(value).length === 0)
          documentError();
        validateNodes(requiredContent(value), blockTypes, depth + 1);
        break;
      case 'codeBlock': {
        if (!hasOnlyKeys(value, ['type', 'attrs', 'content'])) documentError();
        if (
          value.attrs !== undefined &&
          (!isRecord(value.attrs) ||
            !hasOnlyKeys(value.attrs, ['language']) ||
            (value.attrs.language !== null && typeof value.attrs.language !== 'string') ||
            (typeof value.attrs.language === 'string' &&
              value.attrs.language.length > maximumDocumentStringLength))
        )
          documentError();
        validateNodes(optionalContent(value), inlineTypes, depth + 1);
        break;
      }
      case 'horizontalRule':
        if (!hasOnlyKeys(value, ['type'])) documentError();
        break;
      case 'table':
        if (!hasOnlyKeys(value, ['type', 'content']) || requiredContent(value).length === 0)
          documentError();
        validateNodes(requiredContent(value), new Set(['tableRow']), depth + 1);
        break;
      case 'tableRow':
        if (!hasOnlyKeys(value, ['type', 'content']) || requiredContent(value).length === 0)
          documentError();
        validateNodes(requiredContent(value), new Set(['tableHeader', 'tableCell']), depth + 1);
        break;
      case 'tableHeader':
      case 'tableCell': {
        if (!hasOnlyKeys(value, ['type', 'attrs', 'content'])) documentError();
        if (value.attrs !== undefined) {
          if (!isRecord(value.attrs)) documentError();
          const allowedAttrs = ['colspan', 'rowspan', 'colwidth', 'align'];
          if (!hasOnlyKeys(value.attrs, allowedAttrs)) documentError();
          if (
            value.attrs.colspan !== undefined &&
            (!Number.isInteger(value.attrs.colspan) || Number(value.attrs.colspan) < 1)
          )
            documentError();
          if (
            value.attrs.rowspan !== undefined &&
            (!Number.isInteger(value.attrs.rowspan) || Number(value.attrs.rowspan) < 1)
          )
            documentError();
          if (
            value.attrs.colwidth !== undefined &&
            value.attrs.colwidth !== null &&
            (!Array.isArray(value.attrs.colwidth) ||
              !value.attrs.colwidth.every((w) => typeof w === 'number'))
          )
            documentError();
          if (
            value.attrs.align !== undefined &&
            value.attrs.align !== null &&
            !['left', 'center', 'right'].includes(String(value.attrs.align))
          )
            documentError();
        }
        validateNodes(optionalContent(value), new Set(['paragraph', 'image']), depth + 1);
        break;
      }
      case 'hardBreak':
        if (!hasOnlyKeys(value, ['type'])) documentError();
        break;
      case 'text':
        if (!hasOnlyKeys(value, ['type', 'text', 'marks']) || readString(value.text).length === 0)
          documentError();
        validateMarks(value.marks);
        break;
      default:
        documentError();
    }
    return value as TiptapNode;
  };
  return validateNode(root, new Set(['doc']), 0) as TiptapDocument;
}

export function projectTiptapDocumentText(document: TiptapDocument): string {
  const inline = (nodes: readonly TiptapNode[] = []): string =>
    nodes
      .map((node) =>
        node.type === 'text' ? (node.text ?? '') : node.type === 'hardBreak' ? '\n' : '',
      )
      .join('');
  const block = (node: TiptapNode): string => {
    if (node.type === 'image') return String(node.attrs?.alt ?? '');
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock')
      return inline(node.content);
    if (
      node.type === 'bulletList' ||
      node.type === 'orderedList' ||
      node.type === 'blockquote' ||
      node.type === 'listItem'
    )
      return (node.content ?? []).map(block).filter(Boolean).join('\n');
    if (
      node.type === 'table' ||
      node.type === 'tableRow' ||
      node.type === 'tableHeader' ||
      node.type === 'tableCell'
    )
      return (node.content ?? []).map(block).filter(Boolean).join(' ');
    return '';
  };
  return document.content.map(block).filter(Boolean).join('\n\n');
}

export function contentTextFromTiptapJson(json: string) {
  return projectTiptapDocumentText(parseTiptapDocument(json));
}

export type NoteStore = {
  findImageAsset?(assetId: string): Promise<{ noteId: string | null; mimeType: string } | null>;
  list(query: ApiRequestFor<'GET /api/notes'>): Promise<ApiResponseFor<'GET /api/notes'>>;
  find(id: string): Promise<NoteRecord | null>;
  save(note: NoteRecord): Promise<NoteRecord>;
  saveWithTags(note: NoteRecord, tags?: readonly string[]): Promise<NoteRecord>;
  createVersion(note: NoteRecord, versionId: string): Promise<NoteVersionRecord>;
  listVersions(noteId: string): Promise<readonly NoteVersionRecord[]>;
  findVersion?(noteId: string, versionId: string): Promise<NoteVersionRecord | null>;
};

export function createNoteService(
  store: NoteStore,
  id = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
) {
  const validateImages = async (noteId: string, json: string) => {
    const assets = new Set<string>();
    const visit = (node: TiptapNode) => {
      if (node.type === 'image') assets.add(String(node.attrs!.assetId));
      node.content?.forEach(visit);
    };
    visit(parseTiptapDocument(json));
    for (const assetId of assets) {
      const asset = await store.findImageAsset?.(assetId);
      if (
        !asset ||
        asset.noteId !== noteId ||
        !/^image\/(png|jpeg|webp|gif)$/u.test(asset.mimeType)
      ) {
        throw new NoteDomainError(
          'VALIDATION_ERROR',
          'Image must reference a raster asset uploaded to this note',
        );
      }
    }
  };
  return {
    list: (query: ApiRequestFor<'GET /api/notes'> = {}) => store.list(query),
    get: (noteId: string) => store.find(noteId),
    async create(input: ApiRequestFor<'POST /api/notes'>) {
      validateCreate(input);
      const timestamp = now();
      const noteId = id();
      await validateImages(noteId, input.contentJson);
      if (input.publishedContentJson) await validateImages(noteId, input.publishedContentJson);
      const status = input.status;
      const isFeatured = Boolean(input.isFeatured);
      const publishedAt =
        input.publishedAt !== undefined
          ? input.publishedAt
          : status === 'published'
            ? timestamp
            : null;
      const contentText = contentTextFromTiptapJson(input.contentJson);
      const isPublished = status === 'published';
      const note: NoteRecord = {
        id: noteId,
        slug: input.slug ? slugify(input.slug) : `${slugify(input.title)}-${noteId}`,
        title: input.title,
        summary: input.summary,
        contentJson: input.contentJson,
        contentText,
        publishedTitle: isPublished
          ? (input.publishedTitle ?? input.title)
          : (input.publishedTitle ?? null),
        publishedSummary: isPublished
          ? (input.publishedSummary ?? input.summary)
          : (input.publishedSummary ?? null),
        publishedContentJson: isPublished
          ? (input.publishedContentJson ?? input.contentJson)
          : (input.publishedContentJson ?? null),
        publishedContentText: isPublished
          ? (input.publishedContentText ?? contentText)
          : (input.publishedContentText ?? null),
        category: input.category,
        status,
        isPinned: input.isPinned,
        isFeatured,
        publishedAt,
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
      if (changes.contentJson !== undefined) await validateImages(noteId, contentJson);
      const status = changes.status ?? existing.status;
      let publishedAt: string | null =
        changes.publishedAt !== undefined
          ? (changes.publishedAt ?? null)
          : (existing.publishedAt ?? null);
      if (status === 'published' && !publishedAt) {
        publishedAt = now();
      }
      let slug = existing.slug;
      if (changes.slug !== undefined) {
        const nextSlug = slugify(changes.slug);
        if (nextSlug !== existing.slug) {
          const conflicting = await store.list({ slug: nextSlug });
          if (conflicting.items.some((item) => item.id !== noteId)) {
            throw new NoteDomainError('SLUG_CONFLICT', 'A note with this slug already exists');
          }
          slug = nextSlug;
        }
      }
      return store.saveWithTags(
        {
          ...existing,
          ...changes,
          slug,
          status,
          publishedAt,
          contentJson,
          contentText:
            changes.contentJson === undefined
              ? existing.contentText
              : contentTextFromTiptapJson(contentJson),
          publishedTitle: existing.publishedTitle ?? null,
          publishedSummary: existing.publishedSummary ?? null,
          publishedContentJson: existing.publishedContentJson ?? null,
          publishedContentText: existing.publishedContentText ?? null,
          updatedAt: now(),
        },
        tags,
      );
    },
    async publish(noteId: string, input: ApiRequestFor<'POST /api/notes/:id/publish'> = {}) {
      const existing = await store.find(noteId);
      if (!existing) return null;

      if (input?.expectedUpdatedAt && existing.updatedAt !== input.expectedUpdatedAt) {
        throw new NoteDomainError(
          'STALE_REVISION_REJECTED',
          'Note has been modified since last viewed',
        );
      }

      if (existing.status === 'archived') {
        throw new NoteDomainError(
          'VALIDATION_ERROR',
          'Archived notes must be restored before publishing',
        );
      }

      if (!existing.title || !existing.title.trim()) {
        throw new NoteDomainError('VALIDATION_ERROR', 'Title is required for publishing');
      }
      if (!existing.slug || !existing.slug.trim()) {
        throw new NoteDomainError('VALIDATION_ERROR', 'Slug is required for publishing');
      }
      if (!existing.contentJson || !validDocumentJson(existing.contentJson)) {
        throw new NoteDomainError(
          'VALIDATION_ERROR',
          'Valid content document is required for publishing',
        );
      }

      const conflicting = await store.list({ slug: existing.slug });
      await validateImages(noteId, existing.contentJson);
      if (conflicting.items.some((item) => item.id !== noteId)) {
        throw new NoteDomainError('SLUG_CONFLICT', 'A note with this slug already exists');
      }

      const timestamp = now();
      const publishedNote: NoteRecord = {
        ...existing,
        publishedTitle: existing.title,
        publishedSummary: existing.summary,
        publishedContentJson: existing.contentJson,
        publishedContentText: existing.contentText,
        status: 'published',
        publishedAt: timestamp,
        updatedAt: timestamp,
      };

      return store.save(publishedNote);
    },
    async unpublish(noteId: string) {
      const existing = await store.find(noteId);
      if (!existing) return null;
      const timestamp = now();
      return store.save({
        ...existing,
        status: 'draft',
        updatedAt: timestamp,
      });
    },
    async archive(noteId: string) {
      const existing = await store.find(noteId);
      return existing ? store.save({ ...existing, status: 'archived', updatedAt: now() }) : null;
    },
    async restore(noteId: string) {
      const existing = await store.find(noteId);
      return existing ? store.save({ ...existing, status: 'draft', updatedAt: now() }) : null;
    },
    async restoreVersion(
      noteId: string,
      input: ApiRequestFor<'POST /api/notes/:id/restore-version'>,
    ) {
      if (
        !input ||
        typeof input !== 'object' ||
        typeof input.versionId !== 'string' ||
        !input.versionId.trim()
      ) {
        throw new NoteDomainError('VALIDATION_ERROR', 'Version ID is required');
      }

      const existing = await store.find(noteId);
      if (!existing) return null;

      let targetVersion: NoteVersionRecord | null;
      if (store.findVersion) {
        targetVersion = await store.findVersion(noteId, input.versionId);
      } else {
        const versions = await store.listVersions(noteId);
        targetVersion = versions.find((v) => v.id === input.versionId) ?? null;
      }

      if (!targetVersion) {
        throw new NoteDomainError('VERSION_NOT_FOUND', 'Target version not found');
      }
      await validateImages(noteId, targetVersion.contentJson);
      if (input.currentDraft) await validateImages(noteId, input.currentDraft.contentJson);

      let currentContentJson = existing.contentJson;
      let currentContentText = existing.contentText;

      if (input.currentDraft) {
        if (
          typeof input.currentDraft !== 'object' ||
          !validDocumentJson(input.currentDraft.contentJson)
        ) {
          throw new NoteDomainError('PRE_RESTORE_BACKUP_FAILED', 'Invalid current draft content');
        }
        currentContentJson = input.currentDraft.contentJson;
        currentContentText =
          input.currentDraft.contentText ?? contentTextFromTiptapJson(currentContentJson);
      }

      const timestamp = now();

      // 步骤 1：持久化当前编辑草稿
      try {
        if (input.currentDraft) {
          await store.save({
            ...existing,
            contentJson: currentContentJson,
            contentText: currentContentText,
            updatedAt: timestamp,
          });
        }
      } catch {
        throw new NoteDomainError(
          'PRE_RESTORE_BACKUP_FAILED',
          'Failed to persist current draft before restore',
        );
      }

      // 步骤 2：自动向 note_versions 插入前置保护快照
      try {
        const backupVersionId = id();
        await store.createVersion(
          {
            ...existing,
            contentJson: currentContentJson,
            contentText: currentContentText,
            updatedAt: timestamp,
          },
          backupVersionId,
        );
      } catch {
        throw new NoteDomainError(
          'PRE_RESTORE_BACKUP_FAILED',
          'Failed to create pre-restore backup snapshot',
        );
      }

      // 步骤 3：仅当备份成功后，才将目标版本的内容恢复到工作草稿 content_json, content_text。绝不触碰 published_* 快照。
      const restoreTimestamp = now();
      return store.save({
        ...existing,
        contentJson: targetVersion.contentJson,
        contentText: targetVersion.contentText,
        updatedAt: restoreTimestamp,
      });
    },
    async review(noteId: string) {
      const existing = await store.find(noteId);
      return existing
        ? store.save({
            ...existing,
            reviewCount: existing.reviewCount + 1,
            lastReviewedAt: now(),
            updatedAt: now(),
          })
        : null;
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

const noteColumns =
  'id,title,slug,summary,content_json,content_text,published_title,published_summary,published_content_json,published_content_text,category,status,is_pinned,is_featured,published_at,review_count,created_at,updated_at,last_reviewed_at';
const noteWrite = `INSERT INTO notes (${noteColumns}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,slug=excluded.slug,summary=excluded.summary,content_json=excluded.content_json,content_text=excluded.content_text,published_title=excluded.published_title,published_summary=excluded.published_summary,published_content_json=excluded.published_content_json,published_content_text=excluded.published_content_text,category=excluded.category,status=excluded.status,is_pinned=excluded.is_pinned,is_featured=excluded.is_featured,published_at=excluded.published_at,review_count=excluded.review_count,updated_at=excluded.updated_at,last_reviewed_at=excluded.last_reviewed_at`;

function mapNote(row: Record<string, unknown>): NoteRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    summary: String(row.summary),
    contentJson: String(row.content_json),
    contentText: String(row.content_text),
    publishedTitle:
      row.published_title !== undefined && row.published_title !== null
        ? String(row.published_title)
        : null,
    publishedSummary:
      row.published_summary !== undefined && row.published_summary !== null
        ? String(row.published_summary)
        : null,
    publishedContentJson:
      row.published_content_json !== undefined && row.published_content_json !== null
        ? String(row.published_content_json)
        : null,
    publishedContentText:
      row.published_content_text !== undefined && row.published_content_text !== null
        ? String(row.published_content_text)
        : null,
    category: String(row.category),
    status: row.status as NoteRecord['status'],
    isPinned: Number(row.is_pinned) === 1,
    isFeatured: Number(row.is_featured ?? 0) === 1,
    publishedAt: row.published_at ? String(row.published_at) : null,
    reviewCount: Number(row.review_count),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastReviewedAt: row.last_reviewed_at ? String(row.last_reviewed_at) : null,
  };
}

function bindNote(statement: D1PreparedStatement, note: NoteRecord) {
  return statement.bind(
    note.id,
    note.title,
    note.slug,
    note.summary,
    note.contentJson,
    note.contentText,
    note.publishedTitle ?? null,
    note.publishedSummary ?? null,
    note.publishedContentJson ?? null,
    note.publishedContentText ?? null,
    note.category,
    note.status,
    note.isPinned ? 1 : 0,
    note.isFeatured ? 1 : 0,
    note.publishedAt ?? null,
    note.reviewCount,
    note.createdAt,
    note.updatedAt,
    note.lastReviewedAt,
  );
}

export function createD1NoteStore(db: D1Database): NoteStore {
  return {
    async findImageAsset(assetId) {
      const row = await db
        .prepare('SELECT note_id,mime_type FROM assets WHERE id = ?')
        .bind(assetId)
        .first<{ note_id: string | null; mime_type: string }>();
      return row ? { noteId: row.note_id, mimeType: row.mime_type } : null;
    },
    async list(query) {
      const page = query.page ?? 1;
      const pageSize = Math.min(100, query.pageSize ?? 20);
      const where: string[] = [];
      const values: unknown[] = [];
      const isPublishedQuery = query.status === 'published';

      if (query.status) {
        where.push('notes.status = ?');
        values.push(query.status);
      }
      if (isPublishedQuery) {
        where.push('notes.published_content_json IS NOT NULL');
      }
      if (query.category) {
        where.push('notes.category = ?');
        values.push(query.category);
      }
      if (query.pinned !== undefined) {
        where.push('notes.is_pinned = ?');
        values.push(query.pinned ? 1 : 0);
      }
      if (query.featured !== undefined) {
        where.push('notes.is_featured = ?');
        values.push(query.featured ? 1 : 0);
      }
      if (query.slug) {
        where.push('notes.slug = ?');
        values.push(query.slug);
      }
      if (query.tag) {
        where.push(
          'EXISTS (SELECT 1 FROM note_tags nt JOIN tags t ON t.id=nt.tag_id WHERE nt.note_id=notes.id AND t.slug=?)',
        );
        values.push(query.tag);
      }
      const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';

      let orderBy: string;
      if (query.sort === 'published_desc') {
        orderBy = 'notes.published_at DESC NULLS LAST, notes.updated_at DESC';
      } else if (query.sort === 'title_asc') {
        orderBy = 'notes.title ASC';
      } else if (query.sort === 'updated_desc') {
        orderBy = 'notes.updated_at DESC';
      } else if (isPublishedQuery) {
        orderBy = 'notes.is_pinned DESC, notes.published_at DESC';
      } else {
        orderBy = 'notes.updated_at DESC';
      }

      const selectCols = isPublishedQuery
        ? `notes.id,
           COALESCE(notes.published_title, notes.title) AS title,
           notes.slug,
           COALESCE(notes.published_summary, notes.summary) AS summary,
           notes.published_content_json AS content_json,
           notes.published_content_text AS content_text,
           notes.published_title,
           notes.published_summary,
           notes.published_content_json,
           notes.published_content_text,
           notes.category,
           notes.status,
           notes.is_pinned,
           notes.is_featured,
           notes.published_at,
           notes.review_count,
           notes.created_at,
           notes.updated_at,
           notes.last_reviewed_at`
        : `notes.id,
           notes.title,
           notes.slug,
           notes.summary,
           notes.content_json,
           notes.content_text,
           notes.published_title,
           notes.published_summary,
           notes.published_content_json,
           notes.published_content_text,
           notes.category,
           notes.status,
           notes.is_pinned,
           notes.is_featured,
           notes.published_at,
           notes.review_count,
           notes.created_at,
           notes.updated_at,
           notes.last_reviewed_at`;

      const result = await db
        .prepare(`SELECT ${selectCols} FROM notes${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
        .bind(...values, pageSize, (page - 1) * pageSize)
        .all<Record<string, unknown>>();
      const count = await db
        .prepare(`SELECT COUNT(*) AS count FROM notes${clause}`)
        .bind(...values)
        .first<{ count: number }>();
      const totalItems = Number(count?.count ?? 0);
      return {
        items: result.results.map(mapNote),
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      };
    },
    async find(noteId) {
      const row = await db
        .prepare('SELECT * FROM notes WHERE id = ?')
        .bind(noteId)
        .first<Record<string, unknown>>();
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
            db
              .prepare(
                'INSERT INTO tags (id,name,slug) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET slug=excluded.slug',
              )
              .bind(crypto.randomUUID(), tag, slugify(tag)),
            db
              .prepare(
                'INSERT OR IGNORE INTO note_tags (note_id,tag_id) SELECT ?,id FROM tags WHERE name=?',
              )
              .bind(note.id, tag),
          );
        }
      }
      await db.batch(statements);
      return note;
    },
    async createVersion(note, versionId) {
      await db
        .prepare(
          'INSERT INTO note_versions (id,note_id,content_json,content_text,created_at) VALUES (?,?,?,?,?)',
        )
        .bind(versionId, note.id, note.contentJson, note.contentText, note.updatedAt)
        .run();
      return {
        id: versionId,
        contentJson: note.contentJson,
        contentText: note.contentText,
        createdAt: note.updatedAt,
      };
    },
    async listVersions(noteId) {
      const versions = await db
        .prepare(
          'SELECT id,content_json,content_text,created_at FROM note_versions WHERE note_id = ? ORDER BY created_at DESC',
        )
        .bind(noteId)
        .all<Record<string, unknown>>();
      return versions.results.map((row) => ({
        id: String(row.id),
        contentJson: String(row.content_json),
        contentText: String(row.content_text),
        createdAt: String(row.created_at),
      }));
    },
    async findVersion(noteId, versionId) {
      const row = await db
        .prepare(
          'SELECT id,content_json,content_text,created_at FROM note_versions WHERE note_id = ? AND id = ?',
        )
        .bind(noteId, versionId)
        .first<Record<string, unknown>>();
      return row
        ? {
            id: String(row.id),
            contentJson: String(row.content_json),
            contentText: String(row.content_text),
            createdAt: String(row.created_at),
          }
        : null;
    },
  };
}

export const maximumPage = 10_000;

export function parseNoteListQuery(request: Request): ApiRequestFor<'GET /api/notes'> {
  const params = new URL(request.url).searchParams;
  const result: {
    page?: number;
    pageSize?: number;
    status?: NoteRecord['status'];
    category?: string;
    tag?: string;
    pinned?: boolean;
    featured?: boolean;
    slug?: string;
    sort?: NoteSortOption;
  } = {};
  for (const key of ['page', 'pageSize'] as const) {
    if (!params.has(key)) continue;
    const value = Number(params.get(key));
    if (!Number.isSafeInteger(value) || value < 1 || (key === 'page' && value > maximumPage))
      throw new NoteDomainError('VALIDATION_ERROR', `Invalid ${key}`);
    result[key] = value;
  }
  const status = params.get('status');
  if (status !== null) {
    if (!['draft', 'published', 'archived'].includes(status))
      throw new NoteDomainError('VALIDATION_ERROR', 'Invalid status');
    result.status = status as NoteRecord['status'];
  }
  for (const key of ['category', 'tag'] as const) {
    const value = params.get(key);
    if (value !== null) result[key] = value;
  }
  if (params.has('pinned')) {
    const value = params.get('pinned');
    if (value !== 'true' && value !== 'false')
      throw new NoteDomainError('VALIDATION_ERROR', 'Invalid pinned');
    result.pinned = value === 'true';
  }
  if (params.has('featured')) {
    const value = params.get('featured');
    if (value !== 'true' && value !== 'false')
      throw new NoteDomainError('VALIDATION_ERROR', 'Invalid featured');
    result.featured = value === 'true';
  }
  if (params.has('slug')) {
    const value = params.get('slug');
    if (value) result.slug = value;
  }
  if (params.has('sort')) {
    const sort = params.get('sort');
    if (!sort || !noteSortOptions.includes(sort as NoteSortOption)) {
      throw new NoteDomainError('VALIDATION_ERROR', 'Invalid sort');
    }
    result.sort = sort as NoteSortOption;
  }
  return result;
}

function slugify(value: string) {
  return (
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .trim()
      .replace(/[\s-]+/gu, '-') || 'note'
  );
}
function validTags(value: unknown) {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((tag) => typeof tag === 'string' && tag.trim()))
  );
}
function validDocumentJson(value: unknown) {
  if (typeof value !== 'string') return false;
  try {
    parseTiptapDocument(value);
    return true;
  } catch {
    return false;
  }
}
function validateCreate(value: unknown): asserts value is ApiRequestFor<'POST /api/notes'> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload');
  const input = value as Record<string, unknown>;
  if (
    typeof input.title !== 'string' ||
    !input.title.trim() ||
    typeof input.summary !== 'string' ||
    !validDocumentJson(input.contentJson) ||
    typeof input.category !== 'string' ||
    !['draft', 'published', 'archived'].includes(String(input.status)) ||
    typeof input.isPinned !== 'boolean' ||
    !validTags(input.tags)
  )
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload');
  if (input.isFeatured !== undefined && typeof input.isFeatured !== 'boolean')
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload');
  if (
    input.publishedAt !== undefined &&
    input.publishedAt !== null &&
    (typeof input.publishedAt !== 'string' || Number.isNaN(Date.parse(input.publishedAt)))
  )
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload');
  if (input.slug !== undefined && (typeof input.slug !== 'string' || !input.slug.trim()))
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload');
  if (
    input.publishedTitle !== undefined &&
    input.publishedTitle !== null &&
    typeof input.publishedTitle !== 'string'
  )
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload');
  if (
    input.publishedSummary !== undefined &&
    input.publishedSummary !== null &&
    typeof input.publishedSummary !== 'string'
  )
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload');
  if (
    input.publishedContentJson !== undefined &&
    input.publishedContentJson !== null &&
    !validDocumentJson(input.publishedContentJson)
  )
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload');
  if (
    input.publishedContentText !== undefined &&
    input.publishedContentText !== null &&
    typeof input.publishedContentText !== 'string'
  )
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid note payload');
}
function validateUpdate(value: unknown): asserts value is ApiRequestFor<'PATCH /api/notes/:id'> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid update payload');
  const input = value as Record<string, unknown>;
  const allowed = [
    'title',
    'summary',
    'contentJson',
    'category',
    'status',
    'isPinned',
    'isFeatured',
    'publishedAt',
    'slug',
    'tags',
  ];
  if (
    !Object.keys(input).length ||
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    (input.title !== undefined && (typeof input.title !== 'string' || !input.title.trim())) ||
    (input.summary !== undefined && typeof input.summary !== 'string') ||
    (input.contentJson !== undefined && !validDocumentJson(input.contentJson)) ||
    (input.category !== undefined && typeof input.category !== 'string') ||
    (input.status !== undefined &&
      !['draft', 'published', 'archived'].includes(String(input.status))) ||
    (input.isPinned !== undefined && typeof input.isPinned !== 'boolean') ||
    (input.isFeatured !== undefined && typeof input.isFeatured !== 'boolean') ||
    (input.publishedAt !== undefined &&
      input.publishedAt !== null &&
      (typeof input.publishedAt !== 'string' || Number.isNaN(Date.parse(input.publishedAt)))) ||
    (input.slug !== undefined && (typeof input.slug !== 'string' || !input.slug.trim())) ||
    !validTags(input.tags)
  )
    throw new NoteDomainError('VALIDATION_ERROR', 'Invalid update payload');
}
