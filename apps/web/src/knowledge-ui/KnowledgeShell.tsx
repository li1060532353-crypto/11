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
          <p className="knowledge-workspace__label">Knowledge</p>
          <button
            type="button"
            className="knowledge-workspace__toggle"
            aria-expanded={navigationOpen}
            aria-controls="knowledge-workspace-navigation"
            aria-label={navigationOpen ? 'Close knowledge navigation' : 'Open knowledge navigation'}
            onClick={() => setNavigationOpen((open) => !open)}
          >
            {navigationOpen ? 'Close knowledge navigation' : 'Open knowledge navigation'}
          </button>
        </div>
        <nav
          id="knowledge-workspace-navigation"
          className="knowledge-workspace__navigation"
          aria-label="Knowledge navigation"
        >
          <Link
            to="/knowledge"
            aria-current={pathname === '/knowledge' ? 'page' : undefined}
            onClick={closeNavigation}
          >
            Overview
          </Link>
          <Link
            to="/knowledge/notes"
            aria-current={pathname.startsWith('/knowledge/notes') ? 'page' : undefined}
            onClick={closeNavigation}
          >
            Articles
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
          <span aria-disabled="true">Settings</span>
        </nav>
      </aside>
      <div className="knowledge-workspace__content">{children}</div>
    </section>
  );
}
