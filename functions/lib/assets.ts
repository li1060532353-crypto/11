import type { AssetRecord, AssetUploadResult } from '../../packages/shared/src';

const maximumBytes = 15 * 1024 * 1024;
const fileTypes = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
} as const;
type AllowedExtension = keyof typeof fileTypes;
type AssetMetadata = AssetRecord & { r2Key: string };

export type AssetStore = {
  noteExists(noteId: string): Promise<boolean>;
  find(assetId: string): Promise<AssetMetadata | null>;
  insert(asset: AssetMetadata): Promise<void>;
  remove(assetId: string): Promise<AssetMetadata | null>;
  restore(asset: AssetMetadata): Promise<void>;
};
export type AssetBucket = {
  put(key: string, bytes: Uint8Array, options: { httpMetadata: { contentType: string } }): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size?: number } | null>;
  delete(key: string): Promise<void>;
};
export type AssetDownloadResponse = { body: ReadableStream<Uint8Array>; headers: Record<string, string> };

export class AssetDomainError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) { super(message); }
}

const failure = (code: string, status: number, message: string) => new AssetDomainError(code, status, message);
const validation = () => failure('ASSET_VALIDATION_ERROR', 400, 'Invalid asset upload');
const types = () => failure('ASSET_TYPE_NOT_ALLOWED', 415, 'Unsupported asset type');

export function createAssetService(store: AssetStore, bucket: AssetBucket, id = () => crypto.randomUUID(), now = () => new Date().toISOString()) {
  return {
    async upload(request: Request): Promise<AssetUploadResult> {
      const upload = await parseAssetUpload(request);
      if (upload.noteId) {
        try { if (!await store.noteExists(upload.noteId)) throw failure('ASSET_NOTE_NOT_FOUND', 404, 'Note not found'); }
        catch (error) { if (error instanceof AssetDomainError) throw error; throw failure('ASSET_METADATA_READ_FAILED', 500, 'Unable to read asset metadata'); }
      }
      const assetId = id(); const key = `kb-assets/${assetId}/${id()}${upload.extension}`;
      const asset: AssetMetadata = { id: assetId, noteId: upload.noteId ?? null, r2Key: key, originalName: upload.originalName, mimeType: upload.mimeType, sizeBytes: upload.bytes.byteLength, createdAt: now() };
      try { await bucket.put(key, upload.bytes, { httpMetadata: { contentType: upload.mimeType } }); }
      catch { throw failure('ASSET_STORAGE_WRITE_FAILED', 500, 'Unable to store asset'); }
      try { await store.insert(asset); }
      catch {
        try { await bucket.delete(key); }
        catch { throw failure('ASSET_COMPENSATION_FAILED', 500, 'Unable to complete asset upload'); }
        throw failure('ASSET_METADATA_WRITE_FAILED', 500, 'Unable to store asset metadata');
      }
      return { asset: publicAsset(asset) };
    },
    async download(assetId: string): Promise<AssetDownloadResponse> {
      const asset = await find(store, assetId);
      let object: { body: ReadableStream<Uint8Array>; size?: number } | null;
      try { object = await bucket.get(asset.r2Key); }
      catch { throw failure('ASSET_STORAGE_READ_FAILED', 500, 'Unable to read asset'); }
      if (!object) throw failure('ASSET_OBJECT_MISSING', 409, 'Asset object is missing');
      const headers: Record<string, string> = {
        'Content-Type': asset.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Cross-Origin-Resource-Policy': 'same-origin',
      };
      if (typeof object.size === 'number' && Number.isSafeInteger(object.size) && object.size >= 0) headers['Content-Length'] = String(object.size);
      return { body: object.body, headers };
    },
    async remove(assetId: string): Promise<AssetRecord> {
      const known = await find(store, assetId);
      let asset: AssetMetadata | null;
      try { asset = await store.remove(assetId); }
      catch { throw failure('ASSET_METADATA_WRITE_FAILED', 500, 'Unable to delete asset metadata'); }
      if (!asset) throw failure('ASSET_NOT_FOUND', 404, 'Asset not found');
      try { await bucket.delete(asset.r2Key); }
      catch {
        try { await store.restore(asset); }
        catch { throw failure('ASSET_COMPENSATION_FAILED', 500, 'Unable to complete asset deletion'); }
        throw failure('ASSET_STORAGE_DELETE_FAILED', 500, 'Unable to delete asset');
      }
      return publicAsset(known);
    },
  };
}

export function createD1AssetStore(db: D1Database): AssetStore {
  const columns = 'id,note_id,r2_key,original_name,mime_type,size_bytes,created_at';
  const map = (row: Record<string, unknown>): AssetMetadata => ({ id: String(row.id), noteId: row.note_id ? String(row.note_id) : null, r2Key: String(row.r2_key), originalName: String(row.original_name), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes), createdAt: String(row.created_at) });
  const bind = (statement: D1PreparedStatement, asset: AssetMetadata) => statement.bind(asset.id, asset.noteId, asset.r2Key, asset.originalName, asset.mimeType, asset.sizeBytes, asset.createdAt);
  return {
    async noteExists(noteId) { return !!await db.prepare('SELECT id FROM notes WHERE id = ?').bind(noteId).first(); },
    async find(assetId) { const row = await db.prepare('SELECT * FROM assets WHERE id = ?').bind(assetId).first<Record<string, unknown>>(); return row ? map(row) : null; },
    async insert(asset) { await bind(db.prepare(`INSERT INTO assets (${columns}) VALUES (?,?,?,?,?,?,?)`), asset).run(); },
    async remove(assetId) { const asset = await this.find(assetId); if (!asset) return null; await db.prepare('DELETE FROM assets WHERE id = ?').bind(assetId).run(); return asset; },
    async restore(asset) { await bind(db.prepare(`INSERT INTO assets (${columns}) VALUES (?,?,?,?,?,?,?)`), asset).run(); },
  };
}

async function find(store: AssetStore, assetId: string) {
  try { const asset = await store.find(assetId); if (!asset) throw failure('ASSET_NOT_FOUND', 404, 'Asset not found'); return asset; }
  catch (error) { if (error instanceof AssetDomainError) throw error; throw failure('ASSET_METADATA_READ_FAILED', 500, 'Unable to read asset metadata'); }
}

async function parseAssetUpload(request: Request) {
  const length = request.headers.get('Content-Length');
  if (length !== null && /^\d+$/u.test(length) && Number(length) > maximumBytes) throw failure('ASSET_TOO_LARGE', 413, 'Asset exceeds maximum size');
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('multipart/form-data')) throw validation();
  let form: FormData;
  try { form = await request.formData(); } catch { throw validation(); }
  const fileFields = form.getAll('file');
  if (fileFields.length !== 1 || !(fileFields[0] instanceof File)) throw validation();
  const noteValues = form.getAll('noteId');
  if (noteValues.length > 1 || (noteValues.length === 1 && (typeof noteValues[0] !== 'string' || !noteValues[0]))) throw validation();
  const noteId = noteValues[0] as string | undefined;
  if (noteId && !/^[A-Za-z0-9-]+$/u.test(noteId)) throw validation();
  const file = fileFields[0]; const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > maximumBytes) throw failure('ASSET_TOO_LARGE', 413, 'Asset exceeds maximum size');
  const name = normalizeFilename(file.name); const extension = extensionOf(name);
  if (!extension || file.type !== fileTypes[extension] || !matchesSignature(extension, bytes)) throw types();
  return { noteId, bytes, extension, originalName: name, mimeType: fileTypes[extension] };
}

function normalizeFilename(value: string) {
  const normalized = [...value.normalize('NFKC')].filter((char) => { const point = char.codePointAt(0) ?? 0; return point >= 0x20 && point !== 0x7f; }).join('').replace(/\\/gu, '/').split('/').at(-1)?.trim() ?? '';
  const extension = extensionOf(normalized);
  const safeExtension = extension && extension in fileTypes ? extension : '';
  const base = (safeExtension ? normalized.slice(0, -safeExtension.length) : normalized).replace(/[^\p{Letter}\p{Number} ._-]/gu, '');
  return truncateUtf8(base || 'upload', 120 - new TextEncoder().encode(safeExtension).byteLength) + safeExtension;
}
function truncateUtf8(value: string, maximum: number) { let result = ''; let size = 0; for (const char of value) { const next = new TextEncoder().encode(char).byteLength; if (size + next > maximum) break; result += char; size += next; } return result; }
function extensionOf(name: string): AllowedExtension | null { const match = /\.[A-Za-z0-9]+$/u.exec(name); const extension = match?.[0].toLowerCase() as AllowedExtension | undefined; return extension && extension in fileTypes ? extension : null; }
function matchesSignature(extension: AllowedExtension, bytes: Uint8Array) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (extension === '.png') return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (extension === '.jpg' || extension === '.jpeg') return starts(0xff, 0xd8, 0xff);
  if (extension === '.gif') return starts(0x47, 0x49, 0x46, 0x38) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;
  if (extension === '.pdf') return starts(0x25, 0x50, 0x44, 0x46, 0x2d);
  return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}
function publicAsset(asset: AssetMetadata): AssetRecord { return { id: asset.id, noteId: asset.noteId, originalName: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, createdAt: asset.createdAt }; }
