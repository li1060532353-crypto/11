import { apiSuccess } from '../../packages/shared/src/api';
import type { KnowledgeBaseEnv } from '../env';
import { jsonError } from '../lib/http';
import { NoteDomainError } from '../lib/notes';
import { createD1SearchStore, parseSearchQuery } from '../lib/search';

type Context = { request: Request; env: KnowledgeBaseEnv };

export const onRequest = async (context: Context): Promise<Response> => {
  try {
    if (context.request.method !== 'GET') return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    const data = await createD1SearchStore(context.env.DB).search(parseSearchQuery(context.request));
    return Response.json(apiSuccess(data));
  } catch (error) {
    if (error instanceof NoteDomainError) return jsonError(error.code, error.message, 400);
    return jsonError('NOTE_REPOSITORY_FAILURE', 'Unable to process search request', 500);
  }
};
