import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FallbackNotice } from '../../components/content/FallbackNotice';
import { Container } from '../../components/ui/Container';
import { groupPostsByArchive } from '../../content/contentGateway';
import { useContentQuery } from '../../content/useContentQuery';
import { PageIntro } from '../PageIntro';
export function ArchivesPage() {
  const load = useMemo(() => () => groupPostsByArchive(), []);
  const query = useContentQuery(load, [load]);

  return (
    <>
      <PageIntro title="归档" description="按时间回顾持续积累的内容。" />
      <Container className="discovery-page archive-list">
        {query.state === 'loading' ? <p role="status">正在加载归档…</p> : null}
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        {(query.result?.data ?? []).map((group) => (
          <section key={`${group.year}-${group.month}`}>
            <h2>
              {group.year} 年 {group.month} 月
            </h2>
            <ul>
              {group.posts.map((post) => (
                <li key={post.slug}>
                  <Link to={`/posts?year=${group.year}&month=${group.month}`}>{post.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Container>
    </>
  );
}
