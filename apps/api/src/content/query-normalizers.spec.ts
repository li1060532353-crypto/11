import {
  normalizeArchiveMonth,
  normalizePagination,
  normalizeSearch,
  normalizeSlug,
} from './query-normalizers';

describe('query normalizers', () => {
  describe('normalizePagination', () => {
    it('falls back to page 1 when the page is invalid', () => {
      expect(normalizePagination({ page: '0', pageSize: '6' })).toEqual({ page: 1, pageSize: 6 });
      expect(normalizePagination({ page: '-2', pageSize: '6' })).toEqual({ page: 1, pageSize: 6 });
      expect(normalizePagination({ page: 'later', pageSize: '6' })).toEqual({
        page: 1,
        pageSize: 6,
      });
    });

    it('uses the default page size for invalid or empty page sizes', () => {
      expect(normalizePagination({ page: '2', pageSize: '0' })).toEqual({ page: 2, pageSize: 6 });
      expect(normalizePagination({ page: '2', pageSize: 'wide' })).toEqual({
        page: 2,
        pageSize: 6,
      });
    });

    it('caps excessive page sizes at the maximum page size', () => {
      expect(normalizePagination({ page: '1', pageSize: '99' })).toEqual({ page: 1, pageSize: 24 });
    });
  });

  describe('normalizeSearch', () => {
    it('returns an empty string for missing, empty, or whitespace-only search values', () => {
      expect(normalizeSearch(undefined)).toBe('');
      expect(normalizeSearch('')).toBe('');
      expect(normalizeSearch('   ')).toBe('');
    });

    it('trims search values without changing their case', () => {
      expect(normalizeSearch('  Prisma Workflow  ')).toBe('Prisma Workflow');
    });
  });

  describe('normalizeSlug', () => {
    it('trims and lower-cases slug values', () => {
      expect(normalizeSlug('  Engineering  ')).toBe('engineering');
    });

    it('returns an empty string for non-string slugs', () => {
      expect(normalizeSlug(42)).toBe('');
    });
  });

  describe('normalizeArchiveMonth', () => {
    it('accepts archive strings shaped as YYYY-MM', () => {
      expect(normalizeArchiveMonth('2026-02')).toBe('2026-02');
    });

    it('rejects archive strings that are not shaped as YYYY-MM', () => {
      expect(normalizeArchiveMonth('2026-2')).toBe('');
      expect(normalizeArchiveMonth('February 2026')).toBe('');
      expect(normalizeArchiveMonth('2026-13')).toBe('');
    });
  });
});
