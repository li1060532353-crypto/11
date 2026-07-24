import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

type KnowledgeShellProps = {
  title: string;
  children: ReactNode;
};

export function KnowledgeShell({ title, children }: KnowledgeShellProps) {
  const { pathname } = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const closeNavigation = () => setNavigationOpen(false);

  return (
    <section className="knowledge-workspace" aria-label={title}>
      <aside className="knowledge-workspace__sidebar" data-open={navigationOpen}>
        <div className="knowledge-workspace__sidebar-header">
          <p className="knowledge-workspace__label">Knowledge</p>
          <button type="button" className="knowledge-workspace__toggle" aria-expanded={navigationOpen} aria-controls="knowledge-workspace-navigation" onClick={() => setNavigationOpen((open) => !open)}>
            {navigationOpen ? 'Close knowledge navigation' : 'Open knowledge navigation'}
          </button>
        </div>
        <nav id="knowledge-workspace-navigation" className="knowledge-workspace__navigation" aria-label="Knowledge navigation">
          <Link to="/knowledge" aria-current={pathname === '/knowledge' ? 'page' : undefined} onClick={closeNavigation}>Overview</Link>
          <Link to="/knowledge/notes" aria-current={pathname.startsWith('/knowledge/notes') ? 'page' : undefined} onClick={closeNavigation}>Articles</Link>
          <span aria-disabled="true">Settings</span>
        </nav>
      </aside>
      <div className="knowledge-workspace__content">{children}</div>
    </section>
  );
}
