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
        <p className="knowledge-shell__eyebrow">Knowledge workspace</p>
        <h1 id="knowledge-dashboard-title">Welcome back</h1>
        <p className="knowledge-overview__intro">Capture what you are learning and return to the work that matters.</p>
        {model ? <p className="knowledge-shell__subtle">{model.updatedLabel}</p> : null}
        <nav className="knowledge-page-actions" aria-label="知识库操作">
          <Link className="knowledge-button knowledge-button--primary" to="/knowledge/notes/new">新建笔记</Link>
          <Link className="knowledge-button knowledge-button--quiet" to="/knowledge/notes">查看全部笔记</Link>
        </nav>
      </header>
      {state === 'loading' ? <p className="knowledge-message" role="status">Loading dashboard</p> : null}
      {state === 'error' ? <p className="knowledge-message knowledge-message--error" role="alert">Knowledge dashboard could not be loaded</p> : null}
      {state === 'ready' && model ? <>
        <section className="knowledge-overview__section" aria-labelledby="knowledge-statistics-title">
          <div className="knowledge-overview__section-heading"><h2 id="knowledge-statistics-title">Knowledge at a glance</h2><p>Current totals from your workspace.</p></div>
          <dl className="knowledge-overview__statistics">
            {model.statistics.map((statistic) => <div key={statistic.label}><dt>{statistic.label}</dt><dd>{statistic.value}</dd><p>{statistic.detail}</p></div>)}
          </dl>
        </section>
        <section className="knowledge-overview__section" aria-labelledby="knowledge-recent-title">
          <div className="knowledge-overview__section-heading"><h2 id="knowledge-recent-title">Recently edited articles</h2><Link to="/knowledge/notes">Browse articles</Link></div>
          {model.recentArticles?.length ? <ol className="knowledge-overview__recent-list">{model.recentArticles.map((article) => <li key={article.id}><Link to={`/knowledge/notes/${article.id}`} aria-label={article.title}><span><strong>{article.title}</strong><small>{article.category}</small></span><time>{article.updatedLabel}</time></Link></li>)}</ol> : <p className="knowledge-shell__subtle">No articles have been edited yet.</p>}
        </section>
      </> : null}
    </section>
    </KnowledgeShell>
  );
}
