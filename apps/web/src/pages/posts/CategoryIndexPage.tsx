import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FallbackNotice } from '../../components/content/FallbackNotice';
import { Container } from '../../components/ui/Container';
import { listCategories } from '../../content/contentGateway';
import { useContentQuery } from '../../content/useContentQuery';
import { PageIntro } from '../PageIntro';

export function CategoryIndexPage() {
  const load = useMemo(() => () => listCategories(), []);
  const query = useContentQuery(load, [load]);

  return (
    <>
      <PageIntro title="分类" description="按主题探索技术笔记。" />
      <Container className="discovery-page">
        {query.state === 'loading' ? <p role="status">正在加载分类…</p> : null}
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        <ul className="taxonomy-list">
          {(query.result?.data ?? []).map((item) => (
            <li key={item.slug}>
              <Link to={`/categories/${encodeURIComponent(item.slug)}`}>
                {item.name} <span>{item.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
