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
                  <h3 id="featured-articles-title">近期文章</h3>
                  <a href="/posts">浏览文章</a>
                </div>
                <div className="feature-grid">
                  {articles.map((item) => (
                    <a className="feature-card" href={item.href} key={item.href}>
                      <div className="feature-card__visual" aria-hidden="true" />
                      <div className="feature-card__body">
                        <p className="feature-card__meta">{item.meta}</p>
                        <h4>{item.title}</h4>
                        <p className="feature-card__summary">{item.summary}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}
            {projects.length ? (
              <section className="feature-group" aria-labelledby="featured-projects-title">
                <div className="feature-group__heading">
                  <h3 id="featured-projects-title">精选项目</h3>
                  <a href="/projects">查看项目</a>
                </div>
                <div className="feature-grid">
                  {projects.map((item) => (
                    <a className="feature-card" href={item.href} key={item.href}>
                      <div className="feature-card__visual" aria-hidden="true" />
                      <div className="feature-card__body">
                        <p className="feature-card__meta">{item.meta}</p>
                        <h4>{item.title}</h4>
                        <p className="feature-card__summary">{item.summary}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
