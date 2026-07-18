import { describe, expect, it } from 'vitest';

import {
  apiError,
  apiSuccess,
  knowledgeApiRoutes,
  type NoteStatus,
  type ApiRequestFor,
  type ApiResponseFor,
  type CreateNoteRequest,
  type Paginated,
  type NoteRecord,
} from './index';

describe('knowledge-base API contracts', () => {
  it('uses the mandatory success and error response envelopes', () => {
    expect(apiSuccess({ id: 'note-1' })).toEqual({ success: true, data: { id: 'note-1' } });
    expect(apiError('ACCESS_DENIED', 'Access assertion is required')).toEqual({
      success: false,
      error: { code: 'ACCESS_DENIED', message: 'Access assertion is required' },
    });
  });

  it('lists every required knowledge-base route', () => {
    expect(knowledgeApiRoutes).toEqual(
      expect.arrayContaining([
        { method: 'GET', path: '/api/notes' },
        { method: 'POST', path: '/api/notes/:id/restore' },
        { method: 'GET', path: '/api/search' },
        { method: 'POST', path: '/api/assets' },
        { method: 'POST', path: '/api/roadmaps/:id/reorder' },
      ]),
    );
  });

  it('keeps note state constrained to the supported values', () => {
    const statuses: readonly NoteStatus[] = ['draft', 'published', 'archived'];

    expect(statuses).toHaveLength(3);
  });

  it('associates each endpoint key with concrete request and response types', () => {
    const create: ApiRequestFor<'POST /api/notes'> = {
      title: 'Test', summary: '', contentJson: '{}', category: '', status: 'draft', isPinned: false,
    } satisfies CreateNoteRequest;
    const list: ApiResponseFor<'GET /api/notes'> = {
      items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0,
    } satisfies Paginated<NoteRecord>;

    expect(create.title).toBe('Test');
    expect(list.totalItems).toBe(0);
  });
});
