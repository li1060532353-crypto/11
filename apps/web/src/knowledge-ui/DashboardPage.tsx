import type { DashboardViewModel, NoteCardViewModel } from './fixtures';
import { Link } from 'react-router-dom';
import { KnowledgeShell } from './KnowledgeShell';
import './knowledge.css';

export type ExtendedDashboardViewModel = DashboardViewModel & {
  recentDrafts?: readonly NoteCardViewModel[];
};

type DashboardPageProps = {
  model?: ExtendedDashboardViewModel;
  state?: 'loading' | 'ready' | 'error';
};

function getStatHref(label: string, customHref?: string): string {
  if (customHref) return customHref;
  const l = label.toLowerCase();
  if (l.includes('draft') || l.includes('草稿') || l.includes('in progress')) {
    return '/knowledge/notes?tab=draft';
  }
  if (l.includes('published') || l.includes('已发布')) {
    return '/knowledge/notes?tab=published';
  }
  if (l.includes('archived') || l.includes('已归档')) {
    return '/knowledge/notes?tab=archived';
  }
  if (l.includes('pinned') || l.includes('置顶')) {
    return '/knowledge/notes?pinned=true';
  }
  return '/knowledge/notes?tab=all';
}

export function DashboardPage({ model, state = 'ready' }: DashboardPageProps) {
  const drafts =
    model?.recentDrafts ?? model?.recentArticles?.filter((a) => a.status === 'draft') ?? [];

  return (
    <KnowledgeShell title="知识库工作区">
      <section className="knowledge-shell" aria-labelledby="knowledge-dashboard-title">
        <header className="knowledge-shell__heading">
          <div className="knowledge-shell__meta">
            <span className="knowledge-shell__kicker">WORKSPACE // 0x04</span>
            <span className="knowledge-shell__sep" aria-hidden="true">
              ·
            </span>
            <span>知识库概览</span>
          </div>
          <h1 id="knowledge-dashboard-title">欢迎回来</h1>
          <p className="knowledge-overview__intro">
            记录推导与实践，整理可复用的知识。沉淀可验证的工程笔记。
          </p>
          {model ? <p className="knowledge-shell__subtle">{model.updatedLabel}</p> : null}
          <nav className="knowledge-page-actions" aria-label="知识库快捷操作">
            <Link className="knowledge-button knowledge-button--primary" to="/knowledge/create">
              新建文档
            </Link>
            <Link className="knowledge-button knowledge-button--quiet" to="/knowledge/notes">
              查看全部笔记
            </Link>
          </nav>
        </header>
        {state === 'loading' ? (
          <p className="knowledge-message" role="status">
            正在加载仪表盘…
          </p>
        ) : null}
        {state === 'error' ? (
          <p className="knowledge-message knowledge-message--error" role="alert">
            仪表盘加载失败
          </p>
        ) : null}
        {state === 'ready' && model ? (
          <>
            <section
              className="knowledge-overview__section"
              aria-labelledby="knowledge-statistics-title"
            >
              <div className="knowledge-overview__section-heading">
                <h2 id="knowledge-statistics-title">知识概览 · 统计汇总</h2>
                <p>点击卡片快速筛选</p>
              </div>
              <div className="knowledge-overview__statistics" role="list">
                {model.statistics.map((statistic) => {
                  const href = getStatHref(statistic.label, (statistic as { href?: string }).href);
                  return (
                    <div key={statistic.label} className="knowledge-stat-card-item" role="listitem">
                      <Link
                        to={href}
                        className="knowledge-stat-card-link"
                        aria-label={`${statistic.label}: ${statistic.value}`}
                      >
                        <span className="knowledge-stat-card-link__label">{statistic.label}</span>
                        <span className="knowledge-stat-card-link__value">{statistic.value}</span>
                        <span className="knowledge-stat-card-link__detail">{statistic.detail}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              className="knowledge-overview__section"
              aria-labelledby="knowledge-continue-drafts-title"
            >
              <div className="knowledge-overview__section-heading">
                <h2 id="knowledge-continue-drafts-title">继续编辑</h2>
                <Link to="/knowledge/notes?tab=draft">查看草稿箱 →</Link>
              </div>
              {drafts.length > 0 ? (
                <ol className="knowledge-overview__recent-list">
                  {drafts.map((draft) => (
                    <li key={draft.id}>
                      <Link
                        to={`/knowledge/notes/${draft.id}`}
                        aria-label={`继续编辑 ${draft.title}`}
                      >
                        <span>
                          <strong>{draft.title}</strong>
                          <small>{draft.category}</small>
                        </span>
                        <div className="knowledge-overview__draft-action">
                          <time>{draft.updatedLabel}</time>
                          <span className="knowledge-button knowledge-button--small">
                            继续编辑 →
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="knowledge-shell__subtle">暂无待继续编辑的草稿。</p>
              )}
            </section>

            <section
              className="knowledge-overview__section"
              aria-labelledby="knowledge-recent-title"
            >
              <div className="knowledge-overview__section-heading">
                <h2 id="knowledge-recent-title">近期编辑文章</h2>
                <Link to="/knowledge/notes">查看全部文章</Link>
              </div>
              {model.recentArticles?.length ? (
                <ol className="knowledge-overview__recent-list">
                  {model.recentArticles.map((article) => (
                    <li key={article.id}>
                      <Link to={`/knowledge/notes/${article.id}`} aria-label={article.title}>
                        <span>
                          <strong>{article.title}</strong>
                          <small>{article.category}</small>
                        </span>
                        <time>{article.updatedLabel}</time>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="knowledge-shell__subtle">暂无文章编辑记录。</p>
              )}
            </section>
          </>
        ) : null}
      </section>
    </KnowledgeShell>
  );
}
