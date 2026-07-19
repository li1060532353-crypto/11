import { apiSuccess } from '../../../packages/shared/src/api';
import type { KnowledgeBaseEnv } from '../../env';
import { jsonError } from '../../lib/http';
import { AssetDomainError, createAssetService, createD1AssetStore, type AssetBucket } from '../../lib/assets';

type Context = { request: Request; env: KnowledgeBaseEnv; params: { path?: string[] } };

const errorResponse = (error: unknown) => error instanceof AssetDomainError
  ? jsonError(error.code, error.message, error.status)
  : jsonError('ASSET_STORAGE_READ_FAILED', 'Unable to process asset request', 500);

export const onRequest = async (context: Context): Promise<Response> => {
  const bucket: AssetBucket = {
    put: async (key, bytes, options) => { await context.env.KB_ASSETS.put(key, bytes as unknown as ArrayBuffer, options); },
    get: async (key) => { const object = await context.env.KB_ASSETS.get(key); return object ? { body: object.body, size: object.size } : null; },
    delete: async (key) => { await context.env.KB_ASSETS.delete(key); },
  };
  const service = createAssetService(createD1AssetStore(context.env.DB), bucket);
  const [id, extra] = context.params.path ?? [];
  try {
    if (context.request.method === 'POST' && !id) return Response.json(apiSuccess(await service.upload(context.request)), { status: 201 });
    if (!id || extra || !/^[A-Za-z0-9-]+$/u.test(id)) return jsonError('ASSET_VALIDATION_ERROR', 'Invalid asset id', 400);
    if (context.request.method === 'GET') { const result = await service.download(id); return new Response(result.body, { headers: result.headers }); }
    if (context.request.method === 'DELETE') return Response.json(apiSuccess(await service.remove(id)));
    return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
  } catch (error) { return errorResponse(error); }
};
