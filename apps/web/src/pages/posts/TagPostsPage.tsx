import { useMemo } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { FallbackNotice } from '../../components/content/FallbackNotice';
import { Pagination } from '../../components/content/Pagination';
import { PostCard } from '../../components/content/PostCard';
import { Container } from '../../components/ui/Container';
import { toTaxonomySlug } from '../../content/contentQueries';
import { listPosts, listTags } from '../../content/contentGateway';
import { parsePostQuery } from '../../content/queryParams';
import { useContentQuery } from '../../content/useContentQuery';
import { PageIntro } from '../PageIntro';
import { NotFoundPage } from '../NotFoundPage';
export function TagPostsPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const query = parsePostQuery(params.toString());
  const normalizedSlug = toTaxonomySlug(slug);
  const loadTags = useMemo(() => () => listTags(), []);
  const tagsQuery = useContentQuery(loadTags, [loadTags]);
  const tag = tagsQuery.result?.data.find((item) => item.slug === normalizedSlug);
  const loadPosts = useMemo(
    () => () => listPosts({ ...query, tag: normalizedSlug }),
    [params, normalizedSlug],
  );
  const postsQuery = useContentQuery(loadPosts, [loadPosts]);
  const results = postsQuery.result?.data;

  if (tagsQuery.state === 'ready' && !tag) return <NotFoundPage resource="tag" />;

  return (
    <>
      <PageIntro title={tag?.name ?? '标签'} description={`浏览“${tag?.name ?? slug}”下的文章。`} />
      <Container className="discovery-page">
        {tagsQuery.state === 'loading' || postsQuery.state === 'loading' ? (
          <p role="status">正在加载文章…</p>
        ) : null}
        {tagsQuery.result?.source === 'fallback' ? (
          <FallbackNotice error={tagsQuery.result.error} />
        ) : null}
        {postsQuery.result?.source === 'fallback' ? (
          <FallbackNotice error={postsQuery.result.error} />
        ) : null}
        {results ? (
          <>
            <div className="post-grid">
              {results.items.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
            <Pagination
              page={results.page}
              totalPages={results.totalPages}
              pathname={location.pathname}
              search={location.search}
              excludedKeys={['tag']}
            />
          </>
        ) : null}
      </Container>
    </>
  );
}
