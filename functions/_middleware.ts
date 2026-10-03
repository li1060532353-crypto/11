import { isLocalDevelopmentRequest } from './lib/auth';
import { getSession, sameOrigin } from './lib/session-auth';
import type { KnowledgeBaseEnv } from './env';
import { jsonError } from './lib/http';

export const onRequest = async (context: {request:Request;env:KnowledgeBaseEnv;next:()=>Promise<Response>}): Promise<Response> => {
  const {request,env}=context;
  const pathname=new URL(request.url).pathname;
  if(!pathname.startsWith('/api/')) return context.next();
  if(pathname.startsWith('/api/public/') || pathname.startsWith('/api/auth/')) return context.next();
  const local=isLocalDevelopmentRequest(request) && env.LOCAL_AUTH_BYPASS==='true';
  let response:Response;
  try {
    if(!local && !(await getSession(request,env))) response=jsonError('AUTH_REQUIRED','Please sign in to your knowledge workspace',401);
    else if(!local && !['GET','HEAD','OPTIONS'].includes(request.method) && !sameOrigin(request)) response=jsonError('ORIGIN_DENIED','Cross-site requests are not allowed',403);
    else response=await context.next();
  } catch { response=jsonError('AUTH_SERVICE_UNAVAILABLE','Unable to authenticate',503); }
  response.headers.set('Cache-Control','no-store');
  return response;
};
