export type PostQuery = {
  page: number;
  category?: string;
  tag?: string;
  year?: number;
  month?: number;
  q?: string;
};

function optionalText(value: string | null, lowercase = false): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return lowercase ? normalized.toLocaleLowerCase() : normalized;
}

function positiveInteger(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parsePostQuery(search: string): PostQuery {
  const params = new URLSearchParams(search);
  const page = positiveInteger(params.get('page')) ?? 1;
  const year = positiveInteger(params.get('year'));
  const month = positiveInteger(params.get('month'));
  const category = optionalText(params.get('category'), true);
  const tag = optionalText(params.get('tag'), true);
  const q = optionalText(params.get('q'));
  const query: PostQuery = { page };

  if (category) query.category = category;
  if (tag) query.tag = tag;
  if (year) query.year = year;
  if (month && month <= 12) query.month = month;
  if (q) query.q = q;

  return query;
}

export function buildPostQuery(query: PostQuery): string {
  const params = new URLSearchParams();
  if (query.page > 1 && Number.isSafeInteger(query.page)) params.set('page', String(query.page));

  const category = optionalText(query.category ?? null, true);
  const tag = optionalText(query.tag ?? null, true);
  const q = optionalText(query.q ?? null);
  if (category) params.set('category', category);
  if (tag) params.set('tag', tag);
  if (query.year && Number.isSafeInteger(query.year) && query.year > 0) {
    params.set('year', String(query.year));
  }
  if (query.month && Number.isSafeInteger(query.month) && query.month >= 1 && query.month <= 12) {
    params.set('month', String(query.month));
  }
  if (q) params.set('q', q);

  const value = params.toString();
  return value ? `?${value}` : '';
}
