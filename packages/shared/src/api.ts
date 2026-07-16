export const API_PREFIX = 'api/v1' as const;

export interface ApiSuccess<T> {
  data: T;
}

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { data };
}
