import { apiError } from '../../packages/shared/src/api';

export function jsonError(code: string, message: string, status = 400): Response {
  return Response.json(apiError(code, message), { status });
}
