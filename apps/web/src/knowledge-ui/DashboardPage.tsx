import type { DashboardViewModel } from './fixtures';
import { Link } from 'react-router-dom';
import { KnowledgeShell } from './KnowledgeShell';
import './knowledge.css';

type DashboardPageProps = {
  model?: DashboardViewModel;
  state?: 'loading' | 'ready' | 'error';
};

export function DashboardPage({ model, state = 'ready' }: DashboardPageProps) {
  return (
    <KnowledgeShell title="Knowledge workspace">
    <section className="knowledge-shell" aria-labelledby="knowledge-dashboard-title">
      <header className="knowledge-shell__heading">
        <p className="knowledge-shell__eyebrow">Private workspace</p>
        <h1 id="knowledge-dashboard-title">Knowledge dashboard</h1>
        {model ? <p className="knowledge-shell__subtle">{model.updatedLabel}</p> : null}
        <nav className="knowledge-page-actions" aria-label="知识库操作">
          <Link className="knowledge-button knowledge-button--primary" to="/knowledge/notes/new">新建笔记</Link>
          <Link className="knowledge-button knowledge-button--quiet" to="/knowledge/notes">查看全部笔记</Link>
        </nav>
      </header>
      {state === 'loading' ? <p className="knowledge-message" role="status">Loading dashboard</p> : null}
      {state === 'error' ? <p className="knowledge-message knowledge-message--error" role="alert">Knowledge dashboard could not be loaded</p> : null}
      {state === 'ready' && model ? <div className="knowledge-dashboard-grid" aria-label="Knowledge statistics">
        {model.statistics.map((statistic) => (
          <article className="knowledge-stat-card" key={statistic.label}>
            <p className="knowledge-stat-card__label">{statistic.label}</p>
            <strong className="knowledge-stat-card__value">{statistic.value}</strong>
            <p className="knowledge-stat-card__detail">{statistic.detail}</p>
          </article>
        ))}
      </div> : null}
    </section>
    </KnowledgeShell>
  );
}
