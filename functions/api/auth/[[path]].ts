import type { KnowledgeBaseEnv } from '../../env';
import { isLocalDevelopmentRequest } from '../../lib/auth';
import { handleAuthRequest } from '../../lib/session-auth';
export const onRequest = async (context: {request:Request;env:KnowledgeBaseEnv;params:{path?:string[]}}) => {
  try {
    const parts=context.params.path ?? [];
    if(parts.length!==1) return Response.json({success:false,error:{code:'NOT_FOUND',message:'Not found'}},{status:404,headers:{'Cache-Control':'no-store'}});
    if(parts[0] === 'session' && context.request.method === 'GET' && isLocalDevelopmentRequest(context.request) && context.env.LOCAL_AUTH_BYPASS === 'true') return Response.json({success:true,data:{authenticated:true}},{headers:{'Cache-Control':'no-store'}});
    return await handleAuthRequest(context.request,context.env,parts[0]!);
  } catch { return Response.json({success:false,error:{code:'AUTH_SERVICE_UNAVAILABLE',message:'Unable to authenticate'}},{status:503,headers:{'Cache-Control':'no-store'}}); }
};
