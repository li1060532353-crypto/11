import {useEffect,useState,type ReactNode} from 'react';
import {Navigate,useLocation} from 'react-router-dom';
import {authRequest} from './auth-api';
export function RequireOwner({children}:{children:ReactNode}) {
  const location=useLocation();
  const [status,setStatus]=useState<'loading'|'authenticated'|'anonymous'|'error'>('loading');
  useEffect(()=>{let active=true;authRequest('session').then(data=>{if(active)setStatus(data.authenticated?'authenticated':'anonymous');}).catch(()=>{if(active)setStatus('error');});return()=>{active=false;};},[location.pathname]);
  if(status==='loading')return <p className="knowledge-message" role="status">正在确认登录状态…</p>;
  if(status==='error')return <p className="knowledge-message" role="alert">无法确认登录状态，请刷新重试。</p>;
  if(status==='anonymous')return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname+location.search)}`} replace/>;
  return children;
}
