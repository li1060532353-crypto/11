import { useMemo } from 'react';
import { FallbackNotice } from '../content/FallbackNotice';
import { listFeaturedContent } from '../../content/contentGateway';
import { useContentQuery } from '../../content/useContentQuery';
import { Container } from '../ui/Container';

export function FeaturedContent() {
  const load = useMemo(() => () => listFeaturedContent(), []);
  const query = useContentQuery(load, [load]);
  const featuredContent = query.result?.data ?? [];

  return (
    <section className="content-section" aria-labelledby="featured-title">
      <Container>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Selected work</p>
            <h2 id="featured-title">正在构建，也持续记录。</h2>
          </div>
          <a className="button-link" href="/posts">
            查看全部
          </a>
        </div>
        {query.state === 'loading' ? <p role="status">正在加载精选内容…</p> : null}
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        {query.state === 'ready' ? (
          <div className="feature-grid">
            {featuredContent.map((item) => (
              <a className="feature-card" href={item.href} key={item.href}>
                <div className="feature-card__visual" aria-hidden="true" />
                <div className="feature-card__body">
                  <p className="feature-card__meta">
                    {item.kind} · {item.meta}
                  </p>
                  <h3>{item.title}</h3>
                  <p className="feature-card__summary">{item.summary}</p>
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
