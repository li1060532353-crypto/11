import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FallbackNotice } from '../../components/content/FallbackNotice';
import { Container } from '../../components/ui/Container';
import { listTags } from '../../content/contentGateway';
import { useContentQuery } from '../../content/useContentQuery';
import { PageIntro } from '../PageIntro';
export function TagIndexPage() {
  const load = useMemo(() => () => listTags(), []);
  const query = useContentQuery(load, [load]);

  return (
    <>
      <PageIntro title="标签" description="从标签发现相关的学习记录。" />
      <Container className="discovery-page">
        {query.state === 'loading' ? <p role="status">正在加载标签…</p> : null}
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        <ul className="taxonomy-list">
          {(query.result?.data ?? []).map((item) => (
            <li key={item.slug}>
              <Link to={`/tags/${encodeURIComponent(item.slug)}`}>
                {item.name} <span>{item.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
