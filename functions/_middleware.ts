import { authorizeApiRequest, isLocalDevelopmentRequest, type AccessEnvironment } from './lib/auth';
import { jsonError } from './lib/http';

type MiddlewareContext = {
  request: Request;
  env: AccessEnvironment;
  next: () => Promise<Response>;
};

export const onRequest = async (context: MiddlewareContext): Promise<Response> => {
  if (!new URL(context.request.url).pathname.startsWith('/api/')) {
    return context.next();
  }

  const decision = await authorizeApiRequest(
    context.request,
    context.env,
    isLocalDevelopmentRequest(context.request),
  );

  return decision.allowed
    ? context.next()
    : jsonError(decision.code, 'Cloudflare Access authorization is required', 403);
};
