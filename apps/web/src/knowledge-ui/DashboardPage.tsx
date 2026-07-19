import type { DashboardViewModel } from './fixtures';
import { Link } from 'react-router-dom';
import './knowledge.css';

type DashboardPageProps = {
  model: DashboardViewModel;
};

export function DashboardPage({ model }: DashboardPageProps) {
  return (
    <section className="knowledge-shell" aria-labelledby="knowledge-dashboard-title">
      <header className="knowledge-shell__heading">
        <p className="knowledge-shell__eyebrow">Private workspace</p>
        <h1 id="knowledge-dashboard-title">Knowledge dashboard</h1>
        <p className="knowledge-shell__subtle">{model.updatedLabel}</p>
        <nav className="knowledge-page-actions" aria-label="知识库操作">
          <Link className="knowledge-button knowledge-button--primary" to="/knowledge/notes/new">新建笔记</Link>
          <Link className="knowledge-button knowledge-button--quiet" to="/knowledge/notes">查看全部笔记</Link>
        </nav>
      </header>
      <div className="knowledge-dashboard-grid" aria-label="Knowledge statistics">
        {model.statistics.map((statistic) => (
          <article className="knowledge-stat-card" key={statistic.label}>
            <p className="knowledge-stat-card__label">{statistic.label}</p>
            <strong className="knowledge-stat-card__value">{statistic.value}</strong>
            <p className="knowledge-stat-card__detail">{statistic.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
