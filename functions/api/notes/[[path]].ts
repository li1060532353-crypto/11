import { apiSuccess } from '../../../packages/shared/src/api';
import type { KnowledgeBaseEnv } from '../../env';
import { jsonError } from '../../lib/http';
import { createD1NoteStore, createNoteService, NoteDomainError, parseNoteListQuery } from '../../lib/notes';

type Context = { request: Request; env: KnowledgeBaseEnv; params: { path?: string[] } };

async function body(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new NoteDomainError('VALIDATION_ERROR', 'Request body must be valid JSON'); }
}

function notFound() { return jsonError('NOTE_NOT_FOUND', 'Note not found', 404); }

export const onRequest = async (context: Context): Promise<Response> => {
  const service = createNoteService(createD1NoteStore(context.env.DB));
  const [id, action, extra] = context.params.path ?? [];
  try {
    if (context.request.method === 'GET' && !id) return Response.json(apiSuccess(await service.list(parseNoteListQuery(context.request))));
    if (context.request.method === 'POST' && !id) return Response.json(apiSuccess(await service.create(await body(context.request) as never)), { status: 201 });
    if (!id || extra || !/^[A-Za-z0-9-]+$/.test(id)) return jsonError('VALIDATION_ERROR', 'Invalid note id', 400);
    if (!action && context.request.method === 'GET') { const note = await service.get(id); return note ? Response.json(apiSuccess(note)) : notFound(); }
    if (!action && context.request.method === 'PATCH') { const note = await service.update(id, await body(context.request) as never); return note ? Response.json(apiSuccess(note)) : notFound(); }
    if (!action && context.request.method === 'DELETE') { const note = await service.archive(id); return note ? Response.json(apiSuccess(note)) : notFound(); }
    if (action === 'restore' && context.request.method === 'POST') { const note = await service.restore(id); return note ? Response.json(apiSuccess(note)) : notFound(); }
    if (action === 'review' && context.request.method === 'POST') { const note = await service.review(id); return note ? Response.json(apiSuccess(note)) : notFound(); }
    if (action === 'versions' && context.request.method === 'POST') { const version = await service.saveVersion(id); return version ? Response.json(apiSuccess(version), { status: 201 }) : notFound(); }
    if (action === 'versions' && context.request.method === 'GET') { const versions = await service.versions(id); return versions ? Response.json(apiSuccess(versions)) : notFound(); }
    return jsonError('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
  } catch (error) {
    if (error instanceof NoteDomainError) return jsonError(error.code, error.message, 400);
    return jsonError('NOTE_REPOSITORY_FAILURE', 'Unable to process note request', 500);
  }
};
