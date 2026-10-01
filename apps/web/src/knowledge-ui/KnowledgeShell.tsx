import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DraftingGridBackdrop } from '../components/ui/DraftingGridBackdrop';

type KnowledgeShellProps = {
  title: string;
  children: ReactNode;
};

export function KnowledgeShell({ title, children }: KnowledgeShellProps) {
  const { pathname } = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const closeNavigation = () => setNavigationOpen(false);

  return (
    <section className="knowledge-workspace page-canvas" aria-label={title}>
      <DraftingGridBackdrop />
      <aside className="knowledge-workspace__sidebar" data-open={navigationOpen}>
        <div className="knowledge-workspace__sidebar-header">
          <p className="knowledge-workspace__label">知识库工作区</p>
          <button
            type="button"
            className="knowledge-workspace__toggle"
            aria-expanded={navigationOpen}
            aria-controls="knowledge-workspace-navigation"
            aria-label={navigationOpen ? '关闭知识库导航' : '打开知识库导航'}
            onClick={() => setNavigationOpen((open) => !open)}
          >
            {navigationOpen ? '关闭知识库导航' : '打开知识库导航'}
          </button>
        </div>
        <nav
          id="knowledge-workspace-navigation"
          className="knowledge-workspace__navigation"
          aria-label="知识库导航"
        >
          <Link
            to="/knowledge"
            aria-current={pathname === '/knowledge' ? 'page' : undefined}
            onClick={closeNavigation}
          >
            知识库概览
          </Link>
          <Link
            to="/knowledge/notes"
            aria-current={
              pathname === '/knowledge/notes' ||
              (pathname.startsWith('/knowledge/notes/') && pathname !== '/knowledge/notes/new')
                ? 'page'
                : undefined
            }
            onClick={closeNavigation}
          >
            文章管理
          </Link>
          <Link
            to="/knowledge/import"
            aria-current={pathname === '/knowledge/import' ? 'page' : undefined}
            onClick={closeNavigation}
          >
            导入 Markdown
          </Link>
          <Link
            to="/knowledge/notes/new"
            aria-current={pathname === '/knowledge/notes/new' ? 'page' : undefined}
            onClick={closeNavigation}
          >
            新建文章
          </Link>
        </nav>
      </aside>
      <div className="knowledge-workspace__content">{children}</div>
    </section>
  );
}

