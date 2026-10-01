import { useMemo } from 'react';
import { FallbackNotice } from '../content/FallbackNotice';
import { listFeaturedContent } from '../../content/contentGateway';
import { useContentQuery } from '../../content/useContentQuery';
import { Container } from '../ui/Container';

export function FeaturedContent() {
  const load = useMemo(() => () => listFeaturedContent(), []);
  const query = useContentQuery(load, [load]);
  const featuredContent = query.result?.data ?? [];
  const articles = featuredContent.filter((item) => item.kind === '文章');
  const projects = featuredContent.filter((item) => item.kind === '项目');

  return (
    <section className="content-section" aria-labelledby="featured-title">
      <Container>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Selected work</p>
            <h2 id="featured-title">正在构建，也持续记录。</h2>
          </div>
        </div>
        {query.state === 'loading' ? <p role="status">正在加载精选内容…</p> : null}
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        {query.state === 'ready' ? (
          <div className="feature-groups">
            {articles.length ? (
              <section className="feature-group" aria-labelledby="featured-articles-title">
                <div className="feature-group__heading">
                  <div className="feature-group__title-group">
                    <span className="feature-group__kicker">RECENT ENGINEERING ARTICLES</span>
                    <h3 id="featured-articles-title">近期文章</h3>
                  </div>
                  <a href="/posts" className="feature-group__more-link">
                    浏览文章
                    <span className="link-cta__chevron" aria-hidden="true">
                      ›
                    </span>
                  </a>
                </div>
                <div className="article-table" role="table" aria-label="近期文章列表">
                  <div className="article-table__header" role="row" aria-hidden="true">
                    <span className="article-table__th article-table__th--title">Title</span>
                    <span className="article-table__th article-table__th--date">Date</span>
                  </div>
                  <div className="article-table__body">
                    {articles.map((item) => (
                      <a className="article-row" href={item.href} key={item.href}>
                        <div className="article-row__main">
                          <h4 className="article-row__title">{item.title}</h4>
                          {item.summary ? (
                            <p className="article-row__summary">{item.summary}</p>
                          ) : null}
                        </div>
                        <div className="article-row__meta-wrap">
                          <time className="article-row__meta">{item.meta}</time>
                          <span className="article-row__chevron" aria-hidden="true">
                            ›
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}
            {projects.length ? (
              <section className="feature-group" aria-labelledby="featured-projects-title">
                <div className="feature-group__heading">
                  <div className="feature-group__title-group">
                    <span className="feature-group__kicker">SELECTED PROJECTS</span>
                    <h3 id="featured-projects-title">精选项目</h3>
                  </div>
                  <a href="/projects" className="feature-group__more-link">
                    查看项目
                    <span className="link-cta__chevron" aria-hidden="true">
                      ›
                    </span>
                  </a>
                </div>
                <div className="article-table" role="table" aria-label="精选项目列表">
                  <div className="article-table__header" role="row" aria-hidden="true">
                    <span className="article-table__th article-table__th--title">Title</span>
                    <span className="article-table__th article-table__th--date">Date / Spec</span>
                  </div>
                  <div className="article-table__body">
                    {projects.map((item) => (
                      <a className="article-row" href={item.href} key={item.href}>
                        <div className="article-row__main">
                          <h4 className="article-row__title">{item.title}</h4>
                          {item.summary ? (
                            <p className="article-row__summary">{item.summary}</p>
                          ) : null}
                        </div>
                        <div className="article-row__meta-wrap">
                          <time className="article-row__meta">{item.meta}</time>
                          <span className="article-row__chevron" aria-hidden="true">
                            ›
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
