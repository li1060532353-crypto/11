import type { PaginationOptions } from './content.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 24;
const ARCHIVE_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function normalizePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

export function normalizePagination(input: PaginationOptions): { page: number; pageSize: number } {
  const page = normalizePositiveInteger(input.page) ?? DEFAULT_PAGE;
  const requestedPageSize = normalizePositiveInteger(input.pageSize) ?? DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return { page, pageSize };
}

export function normalizeSearch(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeSlug(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeArchiveMonth(value: unknown): string {
  const archiveMonth = normalizeSearch(value);

  return ARCHIVE_MONTH_PATTERN.test(archiveMonth) ? archiveMonth : '';
}
