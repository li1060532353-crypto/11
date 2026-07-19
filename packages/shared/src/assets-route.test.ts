import { describe, expect, it, vi } from 'vitest';

import { createAssetService, type AssetBucket, type AssetDomainError, type AssetStore } from '../../../functions/lib/assets';
import { onRequest as assetRoute } from '../../../functions/api/assets/[[path]]';

const mib = 1024 * 1024;
const signatures = {
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
  webp: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
  gif: new TextEncoder().encode('GIF89a'),
  pdf: new TextEncoder().encode('%PDF-1.7'),
};
const files = [
  ['safe.png', 'image/png', signatures.png], ['safe.jpg', 'image/jpeg', signatures.jpeg], ['safe.webp', 'image/webp', signatures.webp],
  ['safe.gif', 'image/gif', signatures.gif], ['safe.pdf', 'application/pdf', signatures.pdf],
] as const;

function request(name = 'safe.png', type = 'image/png', bytes = signatures.png, noteId?: string) {
  const form = new FormData();
  form.append('file', new File([bytes], name, { type }));
  if (noteId) form.append('noteId', noteId);
  return new Request('http://x/api/assets', { method: 'POST', body: form });
}

function store(overrides: Partial<AssetStore> = {}) {
  const records = new Map<string, ReturnType<AssetStore['find']> extends Promise<infer T> ? NonNullable<T> : never>();
  return {
    noteExists: vi.fn(async (id: string) => id === 'note-1'),
    find: vi.fn(async (id: string) => records.get(id) ?? null),
    insert: vi.fn(async (record) => { records.set(record.id, record); }),
    remove: vi.fn(async (id: string) => { const value = records.get(id) ?? null; if (!value) return null; records.delete(id); return value; }),
    restore: vi.fn(async (record) => { records.set(record.id, record); }),
    ...overrides,
  } satisfies AssetStore;
}

function bucket(overrides: Partial<AssetBucket> = {}) {
  const objects = new Map<string, Uint8Array>();
  return {
    put: vi.fn(async (key: string, bytes: Uint8Array) => { objects.set(key, bytes); }),
    get: vi.fn(async (key: string) => { const bytes = objects.get(key); return bytes ? { body: new Blob([bytes]).stream(), size: bytes.byteLength } : null; }),
    delete: vi.fn(async (key: string) => { objects.delete(key); }),
    ...overrides,
  } satisfies AssetBucket;
}

async function code(promise: Promise<unknown>) { try { await promise; return null; } catch (error) { return (error as AssetDomainError).code; } }

function routeDb() {
  const assets = new Map<string, Record<string, unknown>>();
  const prepare = (sql: string) => ({ bind: (...values: unknown[]) => ({
    async first() {
      if (sql.includes('FROM notes')) return values[0] === 'note-1' ? { id: 'note-1' } : null;
      if (sql.includes('FROM assets')) return assets.get(String(values[0])) ?? null;
      return null;
    },
    async run() {
      if (sql.startsWith('INSERT INTO assets')) assets.set(String(values[0]), { id: values[0], note_id: values[1], r2_key: values[2], original_name: values[3], mime_type: values[4], size_bytes: values[5], created_at: values[6] });
      if (sql.startsWith('DELETE FROM assets')) assets.delete(String(values[0]));
      return { success: true };
    },
  }) });
  return { db: { prepare } as unknown as D1Database, assets };
}
function routeContext(request: Request, db: D1Database, bucket: R2Bucket, path?: string[]) { return { request, env: { DB: db, KB_ASSETS: bucket } as never, params: { path } }; }

describe('private asset service', () => {
  it('returns route envelopes for mutations and a binary response for downloads', async () => {
    const state = routeDb(); const objects = new Map<string, Uint8Array>();
    const r2 = {
      put: vi.fn(async (key: string, bytes: ArrayBuffer) => { objects.set(key, new Uint8Array(bytes)); }),
      get: vi.fn(async (key: string) => { const bytes = objects.get(key); return bytes ? { body: new Blob([bytes]).stream(), size: bytes.byteLength } : null; }),
      delete: vi.fn(async (key: string) => { objects.delete(key); }),
    } as unknown as R2Bucket;
    const invalid = await assetRoute(routeContext(new Request('http://x/api/assets', { method: 'POST', body: new FormData() }), state.db, r2));
    expect(invalid.status).toBe(400); expect(await invalid.json()).toEqual({ success: false, error: { code: 'ASSET_VALIDATION_ERROR', message: 'Invalid asset upload' } });
    const created = await assetRoute(routeContext(request('safe.png', 'image/png', signatures.png, 'note-1'), state.db, r2));
    const createdBody = await created.json() as { data?: { asset: { id: string } }; error?: unknown };
    expect(created.status, JSON.stringify(createdBody)).toBe(201); expect(JSON.stringify(createdBody)).not.toContain('r2_key');
    const assetId = createdBody.data!.asset.id;
    const downloaded = await assetRoute(routeContext(new Request(`http://x/api/assets/${assetId}`), state.db, r2, [assetId]));
    expect(downloaded.headers.get('Content-Type')).toBe('image/png'); expect(await downloaded.arrayBuffer()).toEqual(signatures.png.buffer);
    const deleted = await assetRoute(routeContext(new Request(`http://x/api/assets/${assetId}`, { method: 'DELETE' }), state.db, r2, [assetId]));
    expect(deleted.status).toBe(200); expect((await deleted.json()).success).toBe(true);
  });

  it('accepts each approved signature and derives private metadata', async () => {
    const db = store(); const r2 = bucket(); const service = createAssetService(db, r2, (() => { let n = 0; return () => `uuid-${++n}`; })());
    for (const [name, mime, bytes] of files) {
      const result = await service.upload(request(name, mime, bytes, 'note-1'));
      expect(result.asset).toMatchObject({ noteId: 'note-1', mimeType: mime, sizeBytes: bytes.byteLength });
    }
    expect(r2.put).toHaveBeenCalledTimes(5);
    expect(r2.put.mock.calls.every(([key]) => String(key).startsWith('kb-assets/uuid-'))).toBe(true);
    expect(JSON.stringify(await service.upload(request()))).not.toContain('r2Key');
  });

  it('rejects invalid multipart forms, note references, size limits, and signatures before storage', async () => {
    const db = store(); const r2 = bucket(); const service = createAssetService(db, r2, () => 'uuid');
    const missing = new Request('http://x/api/assets', { method: 'POST', body: new FormData() });
    const multiple = new FormData(); multiple.append('file', new File([signatures.png], 'a.png', { type: 'image/png' })); multiple.append('file', new File([signatures.png], 'b.png', { type: 'image/png' }));
    const nonFile = new FormData(); nonFile.append('file', 'not-a-file');
    const tooLargeHeader = new Request('http://x/api/assets', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': String(15 * mib + 1) }, body: '--x--' });
    const malformed = new Request('http://x/api/assets', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=x' }, body: 'not-a-multipart-body' });
    const oversized = request('large.png', 'image/png', new Uint8Array(15 * mib + 1));
    expect(await code(service.upload(missing))).toBe('ASSET_VALIDATION_ERROR');
    expect(await code(service.upload(new Request('http://x/api/assets', { method: 'POST', body: multiple })))).toBe('ASSET_VALIDATION_ERROR');
    expect(await code(service.upload(new Request('http://x/api/assets', { method: 'POST', body: nonFile })))).toBe('ASSET_VALIDATION_ERROR');
    expect(await code(service.upload(new Request('http://x/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })))).toBe('ASSET_VALIDATION_ERROR');
    expect(await code(service.upload(malformed))).toBe('ASSET_VALIDATION_ERROR');
    expect(await code(service.upload(tooLargeHeader))).toBe('ASSET_TOO_LARGE');
    expect(await code(service.upload(oversized))).toBe('ASSET_TOO_LARGE');
    expect(await code(service.upload(request('safe.png', 'image/png', signatures.png, 'missing')))).toBe('ASSET_NOTE_NOT_FOUND');
    expect(await code(service.upload(request('safe.png', 'application/pdf', signatures.png)))).toBe('ASSET_TYPE_NOT_ALLOWED');
    expect(await code(service.upload(request('safe.png', 'image/png', signatures.pdf)))).toBe('ASSET_TYPE_NOT_ALLOWED');
    expect(await code(service.upload(request('safe.txt', 'image/png', signatures.png)))).toBe('ASSET_TYPE_NOT_ALLOWED');
    expect(await code(service.upload(request('safe.png', 'image/png', new Uint8Array([0x89]))))).toBe('ASSET_TYPE_NOT_ALLOWED');
    expect(r2.put).not.toHaveBeenCalled();
  });

  it('normalizes unsafe filenames without splitting multibyte UTF-8', async () => {
    const db = store(); const r2 = bucket(); const service = createAssetService(db, r2, () => 'uuid');
    const normalized = await service.upload(request('../Ｃ:\\Users\\name\\\u0000秘密'.replace('\\u0000', '\0') + '.png', 'image/png', signatures.png));
    const fallback = await service.upload(request('\0.png', 'image/png', signatures.png));
    const long = await service.upload(request(`${'你'.repeat(100)}.png`, 'image/png', signatures.png));
    expect(normalized.asset.originalName).toBe('秘密.png');
    expect(fallback.asset.originalName).toBe('upload.png');
    expect(new TextEncoder().encode(long.asset.originalName).byteLength).toBeLessThanOrEqual(120);
    expect(long.asset.originalName.endsWith('.png')).toBe(true);
  });

  it('compensates upload metadata failures without leaking provider errors', async () => {
    const writeFailure = createAssetService(store(), bucket({ put: vi.fn(async () => { throw new Error('r2 secret'); }) }), () => 'uuid');
    expect(await code(writeFailure.upload(request()))).toBe('ASSET_STORAGE_WRITE_FAILED');
    const cleaned = bucket(); const metadataFailure = createAssetService(store({ insert: vi.fn(async () => { throw new Error('db secret'); }) }), cleaned, () => 'uuid');
    expect(await code(metadataFailure.upload(request()))).toBe('ASSET_METADATA_WRITE_FAILED');
    expect(cleaned.delete).toHaveBeenCalledTimes(1);
    const uncompensated = createAssetService(store({ insert: vi.fn(async () => { throw new Error('db secret'); }) }), bucket({ delete: vi.fn(async () => { throw new Error('cleanup secret'); }) }), () => 'uuid');
    expect(await code(uncompensated.upload(request()))).toBe('ASSET_COMPENSATION_FAILED');
  });

  it('keeps provider failures inside stable route envelopes', async () => {
    const state = routeDb(); const r2 = { put: vi.fn(async () => { throw new Error('provider secret'); }), get: vi.fn(), delete: vi.fn() } as unknown as R2Bucket;
    const response = await assetRoute(routeContext(request('safe.png', 'image/png', signatures.png, 'note-1'), state.db, r2));
    const body = await response.json();
    expect(response.status).toBe(500); expect(body).toEqual({ success: false, error: { code: 'ASSET_STORAGE_WRITE_FAILED', message: 'Unable to store asset' } });
    expect(JSON.stringify(body)).not.toContain('provider secret');
  });

  it('proxies binary downloads with safe headers and stable failures', async () => {
    const record = { id: 'asset-1', noteId: null, r2Key: 'private-key', originalName: '秘密.pdf', mimeType: 'application/pdf', sizeBytes: signatures.pdf.byteLength, createdAt: '2026-07-19T00:00:00.000Z' };
    const service = createAssetService(store({ find: vi.fn(async () => record) }), bucket({ get: vi.fn(async () => ({ body: new Blob([signatures.pdf]).stream(), size: signatures.pdf.byteLength })) }), () => 'uuid');
    const download = await service.download('asset-1');
    expect(await new Response(download.body).arrayBuffer()).toEqual(signatures.pdf.buffer);
    expect(download.headers).toMatchObject({ 'Content-Type': 'application/pdf', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Length': String(signatures.pdf.byteLength) });
    expect(download.headers['Content-Disposition']).toContain('attachment;');
    expect(JSON.stringify(download)).not.toContain('private-key');
    expect(await code(createAssetService(store(), bucket(), () => 'uuid').download('missing'))).toBe('ASSET_NOT_FOUND');
    expect(await code(createAssetService(store({ find: vi.fn(async () => record) }), bucket(), () => 'uuid').download('asset-1'))).toBe('ASSET_OBJECT_MISSING');
    expect(await code(createAssetService(store({ find: vi.fn(async () => record) }), bucket({ get: vi.fn(async () => { throw new Error('r2 secret'); }) }), () => 'uuid').download('asset-1'))).toBe('ASSET_STORAGE_READ_FAILED');
  });

  it('uses D1-first deletion with restoration compensation and no bucket listing', async () => {
    const record = { id: 'asset-1', noteId: null, r2Key: 'private-key', originalName: 'safe.png', mimeType: 'image/png', sizeBytes: 1, createdAt: '2026-07-19T00:00:00.000Z' };
    const removed = store({ find: vi.fn(async () => record), remove: vi.fn(async () => record) }); const r2 = bucket();
    await expect(createAssetService(removed, r2, () => 'uuid').remove('asset-1')).resolves.toEqual(expect.objectContaining({ id: 'asset-1' }));
    expect(r2.delete).toHaveBeenCalledWith('private-key');
    expect(await code(createAssetService(store(), bucket(), () => 'uuid').remove('missing'))).toBe('ASSET_NOT_FOUND');
    const lookupFailure = createAssetService(store({ find: vi.fn(async () => { throw new Error('read'); }) }), bucket(), () => 'uuid');
    expect(await code(lookupFailure.remove('asset-1'))).toBe('ASSET_METADATA_READ_FAILED');
    const deleteFailure = createAssetService(store({ find: vi.fn(async () => record), remove: vi.fn(async () => { throw new Error('write'); }) }), bucket(), () => 'uuid');
    expect(await code(deleteFailure.remove('asset-1'))).toBe('ASSET_METADATA_WRITE_FAILED');
    const restored = store({ find: vi.fn(async () => record), remove: vi.fn(async () => record) });
    expect(await code(createAssetService(restored, bucket({ delete: vi.fn(async () => { throw new Error('r2'); }) }), () => 'uuid').remove('asset-1'))).toBe('ASSET_STORAGE_DELETE_FAILED');
    expect(restored.restore).toHaveBeenCalledWith(record);
    expect(await code(createAssetService(store({ find: vi.fn(async () => record), remove: vi.fn(async () => record), restore: vi.fn(async () => { throw new Error('restore'); }) }), bucket({ delete: vi.fn(async () => { throw new Error('r2'); }) }), () => 'uuid').remove('asset-1'))).toBe('ASSET_COMPENSATION_FAILED');
  });
});
