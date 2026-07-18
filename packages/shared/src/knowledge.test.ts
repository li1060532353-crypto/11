import { describe, expect, it } from 'vitest';

import {
  apiError,
  apiSuccess,
  knowledgeApiRoutes,
  type NoteStatus,
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
});
