import { describe, expect, it } from 'vitest';

import { buildPostQuery, parsePostQuery } from './queryParams';

describe('post query parameters', () => {
  it('normalizes taxonomy values and falls back to the first page', () => {
    expect(parsePostQuery('?page=abc&category=Signals&year=2025')).toEqual({
      page: 1,
      category: 'signals',
      year: 2025,
    });
  });

  it('keeps only valid positive pagination and date values', () => {
    expect(parsePostQuery('?page=2&tag=Embedded%20Systems&year=0&month=13&q=%20PWM%20')).toEqual({
      page: 2,
      tag: 'embedded systems',
      q: 'PWM',
    });
  });

  it('omits defaults when building a query string', () => {
    expect(buildPostQuery({ page: 1 })).toBe('');
    expect(
      buildPostQuery({
        page: 2,
        category: 'Signals',
        tag: 'Embedded Systems',
        year: 2025,
        month: 3,
        q: 'PWM',
      }),
    ).toBe('?page=2&category=signals&tag=embedded+systems&year=2025&month=3&q=PWM');
  });
});
