import { apiSuccess } from '../../packages/shared/src/api';
import type { KnowledgeBaseEnv } from '../env';
import { jsonError } from '../lib/http';
import { createD1SearchStore } from '../lib/search';

type Context = { request: Request; env: KnowledgeBaseEnv };

export const onRequest = async (context: Context): Promise<Response> => {
  try {
    if (context.request.method !== 'GET') return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    return Response.json(apiSuccess(await createD1SearchStore(context.env.DB).stats()));
  } catch {
    return jsonError('NOTE_REPOSITORY_FAILURE', 'Unable to load statistics', 500);
  }
};
