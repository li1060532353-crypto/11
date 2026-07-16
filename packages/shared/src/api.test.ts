import { describe, expect, it } from 'vitest';

import { API_PREFIX, apiSuccess } from './api';

describe('API contracts', () => {
  it('uses the approved versioned prefix', () => {
    expect(API_PREFIX).toBe('api/v1');
  });

  it('wraps successful payloads without changing them', () => {
    const data = { status: 'ok' as const };

    expect(apiSuccess(data)).toEqual({ data });
  });
});
