import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteKnowledgeAsset, downloadKnowledgeAsset, filenameFromDisposition, uploadKnowledgeAsset } from './knowledge-api';

const asset = { id: 'asset-1', noteId: 'note-1', originalName: 'fallback.png', mimeType: 'image/png', sizeBytes: 3, createdAt: '2026-07-19T00:00:00.000Z' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.restoreAllMocks());

describe('knowledge asset client', () => {
  it('uses FormData without a multipart Content-Type and validates the returned asset', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { asset } }, 201));
    await expect(uploadKnowledgeAsset(new File(['png'], 'safe.png', { type: 'image/png' }), 'note-1')).resolves.toEqual({ asset });
    const [, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(options).toMatchObject({ method: 'POST', headers: { Accept: 'application/json' } });
    expect((options as RequestInit).body).toBeInstanceOf(FormData);
  });

  it('rejects malformed returned asset metadata before it can be rendered', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: { asset: { ...asset, originalName: '../private-key.png' } } }, 201));
    await expect(uploadKnowledgeAsset(new File(['png'], 'safe.png', { type: 'image/png' }), 'note-1')).rejects.toEqual({ kind: 'malformed' });
  });

  it('downloads binary data, uses a safe filename fallback, and revokes its temporary object URL', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:temporary'); const revoke = vi.spyOn(URL, 'revokeObjectURL');
    vi.mocked(fetch).mockResolvedValueOnce(new Response(new Blob(['png']), { headers: { 'Content-Disposition': "attachment; filename*=UTF-8''safe%20name.png" } }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await downloadKnowledgeAsset(asset);
    expect(create).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith('blob:temporary'); expect(click).toHaveBeenCalledOnce();
    expect(filenameFromDisposition("attachment; filename*=UTF-8''..%2Fsecret.png", asset.originalName)).toBe(asset.originalName);
  });

  it('parses failed binary responses as failure envelopes without exposing their message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: false, error: { code: 'ASSET_STORAGE_READ_FAILED', message: 'provider detail' } }, 500));
    await expect(downloadKnowledgeAsset(asset)).rejects.toEqual({ kind: 'repository' });
  });

  it('deletes an existing asset through the protected delete contract', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true, data: asset }));
    await expect(deleteKnowledgeAsset('asset-1')).resolves.toEqual(asset);
    expect(vi.mocked(fetch)).toHaveBeenLastCalledWith('/api/assets/asset-1', expect.objectContaining({ method: 'DELETE' }));
  });
});
