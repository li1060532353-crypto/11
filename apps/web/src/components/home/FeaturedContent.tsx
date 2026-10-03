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
    <section id="home-records" className="content-section home-records" aria-labelledby="featured-title">
      <Container>
        <div className="section-heading">
          <div>
            <h2 id="featured-title">近期记录</h2>
          </div>
          <span className="home-records__reference" aria-hidden="true">FIELD NOTES / INDEX</span>
        </div>
        {query.state === 'loading' ? <p role="status">正在加载精选内容…</p> : null}
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        {query.state === 'ready' ? (
          <div className="feature-groups">
            {articles.length ? (
              <section className="feature-group" aria-labelledby="featured-articles-title">
                <div className="feature-group__heading">
                  <div className="feature-group__title-group">
                    <h3 id="featured-articles-title">近期文章</h3>
                  </div>
                  <a href="/posts" className="feature-group__more-link">
                    浏览文章
                    <span className="link-cta__chevron" aria-hidden="true">
                      ›
                    </span>
                  </a>
                </div>
                <div className="article-table">
                  <div className="article-table__header" aria-hidden="true">
                    <span className="article-table__th article-table__th--title">TITLE &amp; ABSTRACT</span>
                    <span className="article-table__th article-table__th--date">分类 / 阅读</span>
                  </div>
                  <ul className="article-table__body" aria-label="近期文章列表">
                    {articles.map((item, index) => (
                      <li key={item.href}><a className="article-row" href={item.href}>
                        <span className="article-row__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                        <div className="article-row__main">
                          <h4 className="article-row__title">{item.title}</h4>
                          {item.summary ? (
                            <p className="article-row__summary">{item.summary}</p>
                          ) : null}
                        </div>
                        <div className="article-row__meta-wrap">
                          <span className="article-row__meta">{item.meta}</span>
                          <span className="article-row__chevron" aria-hidden="true">
                            ↗
                          </span>
                        </div>
                      </a></li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}
            {projects.length ? (
              <section className="feature-group" aria-labelledby="featured-projects-title">
                <div className="feature-group__heading">
                  <div className="feature-group__title-group">
                    <h3 id="featured-projects-title">精选项目</h3>
                  </div>
                  <a href="/projects" className="feature-group__more-link">
                    查看项目
                    <span className="link-cta__chevron" aria-hidden="true">
                      ›
                    </span>
                  </a>
                </div>
                <div className="article-table">
                  <div className="article-table__header" aria-hidden="true">
                    <span className="article-table__th article-table__th--title">PROJECT &amp; PRACTICE</span>
                    <span className="article-table__th article-table__th--date">技术栈</span>
                  </div>
                  <ul className="article-table__body" aria-label="精选项目列表">
                    {projects.map((item, index) => (
                      <li key={item.href}><a className="article-row" href={item.href}>
                        <span className="article-row__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                        <div className="article-row__main">
                          <h4 className="article-row__title">{item.title}</h4>
                          {item.summary ? (
                            <p className="article-row__summary">{item.summary}</p>
                          ) : null}
                        </div>
                        <div className="article-row__meta-wrap">
                          <span className="article-row__meta">{item.meta}</span>
                          <span className="article-row__chevron" aria-hidden="true">
                            ↗
                          </span>
                        </div>
                      </a></li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
