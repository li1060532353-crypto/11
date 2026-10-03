import {useState,type FormEvent} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {authRequest} from './auth-api';
import './login.css';
export function safeReturnTo(value:string|null) {
  if(!value || !/^\/knowledge(?:\/|\?|$)/.test(value) || /[\\\r\n]/.test(value)) return '/knowledge';
  return value;
}
export function LoginPage() {
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const [username,setUsername]=useState('admin');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function submit(event:FormEvent) {
    event.preventDefault(); setBusy(true);setMessage('');
    try {await authRequest('login',{username,password});navigate(safeReturnTo(params.get('returnTo')),{replace:true});}
    catch(error) {const code=error instanceof Error?error.message:'';setMessage(code==='INVALID_CREDENTIALS'?'用户名或密码不正确':code==='LOGIN_RATE_LIMITED'?'尝试次数过多，请 15 分钟后再试':'暂时无法登录，请稍后重试');}
    finally {setBusy(false);}
  }
  return <section className="owner-login"><div className="owner-login__card"><p className="owner-login__eyebrow">KNOWLEDGE WORKSPACE</p><h1>登录知识库</h1><p>登录后管理文章、导入笔记与上传附件。</p><form onSubmit={submit}>
    <label htmlFor="owner-username">用户名</label><input id="owner-username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required maxLength={80}/>
    <label htmlFor="owner-password">密码</label><input id="owner-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={512}/>
    {message && <p role="alert">{message}</p>}<button type="submit" disabled={busy}>{busy?'正在登录…':'登录'}</button>
  </form><Link to="/posts">返回文章阅读</Link></div></section>;
}
