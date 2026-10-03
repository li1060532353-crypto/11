import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authRequest } from '../auth/auth-api';
import { DraftingGridBackdrop } from '../components/ui/DraftingGridBackdrop';

type KnowledgeShellProps = { title: string; children: ReactNode };
export function KnowledgeShell({ title, children }: KnowledgeShellProps) {
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState(false);
  async function logout() { try { await authRequest('logout'); navigate('/login'); } catch { setLogoutError(true); } }
  return <section className="knowledge-workspace page-canvas" aria-label={title}>
    <DraftingGridBackdrop />
    <div className="knowledge-workspace__context"><Link to="/knowledge">内容工作台</Link><span aria-hidden="true">/</span><span>{title}</span><button type="button" className="knowledge-button knowledge-button--quiet knowledge-button--small" onClick={logout} style={{marginLeft: 'auto'}}>退出登录</button></div>{logoutError && <p role="alert">退出失败，请稍后重试。</p>}
    <div className="knowledge-workspace__content">{children}</div>
  </section>;
}
