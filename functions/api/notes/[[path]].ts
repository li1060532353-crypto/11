import { apiSuccess } from '../../../packages/shared/src/api';
import { jsonError } from '../../lib/http';
import { createD1NoteStore, createNoteService, NoteDomainError } from '../../lib/notes';
import type { KnowledgeBaseEnv } from '../../env';

type Context = { request: Request; env: KnowledgeBaseEnv; params: { path?: string[] } };
async function body(request: Request): Promise<unknown> { try { return await request.json(); } catch { throw new NoteDomainError('VALIDATION_ERROR', 'Request body must be valid JSON'); } }
function listQuery(request: Request) { const q=new URL(request.url).searchParams; const result: Record<string,unknown>={}; for(const key of ['page','pageSize'] as const){if(q.has(key)){const value=Number(q.get(key));if(!Number.isInteger(value)||value<1)throw new NoteDomainError('VALIDATION_ERROR',`Invalid ${key}`);result[key]=value;}} const status=q.get('status');if(status!==null){if(!['draft','published','archived'].includes(status))throw new NoteDomainError('VALIDATION_ERROR','Invalid status');result.status=status;} for(const key of ['category','tag'] as const){const value=q.get(key);if(value!==null)result[key]=value;} if(q.has('pinned')){const value=q.get('pinned');if(value!=='true'&&value!=='false')throw new NoteDomainError('VALIDATION_ERROR','Invalid pinned');result.pinned=value==='true';} return result as never; }
export const onRequest = async (context: Context): Promise<Response> => {
  const service = createNoteService(createD1NoteStore(context.env.DB)); const id = context.params.path?.[0];
  try {
    if (context.request.method === 'GET' && !id) return Response.json(apiSuccess(await service.list(listQuery(context.request))));
    if (context.request.method === 'POST' && !id) return Response.json(apiSuccess(await service.create(await body(context.request) as never)) , { status: 201 });
    if (!id || context.params.path?.length!==1 || !/^[A-Za-z0-9-]+$/.test(id)) return jsonError('VALIDATION_ERROR', 'Invalid note id', 400);
    if (context.request.method === 'GET') { const note = await service.get(id); return note ? Response.json(apiSuccess(note)) : jsonError('NOTE_NOT_FOUND', 'Note not found', 404); }
    if (context.request.method === 'PATCH') { const note = await service.update(id, await body(context.request) as never); return note ? Response.json(apiSuccess(note)) : jsonError('NOTE_NOT_FOUND', 'Note not found', 404); }
    if (context.request.method === 'DELETE') { const note = await service.archive(id); return note ? Response.json(apiSuccess(note)) : jsonError('NOTE_NOT_FOUND', 'Note not found', 404); }
    return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
  } catch (error) { if (error instanceof NoteDomainError) return jsonError(error.code, error.message, 400); return jsonError('NOTE_REPOSITORY_FAILURE', 'Unable to process note request', 500); }
};
