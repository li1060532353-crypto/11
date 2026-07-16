import { useMemo } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { FallbackNotice } from '../../components/content/FallbackNotice';
import { Pagination } from '../../components/content/Pagination';
import { PostCard } from '../../components/content/PostCard';
import { Container } from '../../components/ui/Container';
import { toTaxonomySlug } from '../../content/contentQueries';
import { listCategories, listPosts } from '../../content/contentGateway';
import { parsePostQuery } from '../../content/queryParams';
import { useContentQuery } from '../../content/useContentQuery';
import { PageIntro } from '../PageIntro';
import { NotFoundPage } from '../NotFoundPage';

export function CategoryPostsPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const query = parsePostQuery(params.toString());
  const normalizedSlug = toTaxonomySlug(slug);
  const loadCategories = useMemo(() => () => listCategories(), []);
  const categoriesQuery = useContentQuery(loadCategories, [loadCategories]);
  const category = categoriesQuery.result?.data.find((item) => item.slug === normalizedSlug);
  const loadPosts = useMemo(
    () => () => listPosts({ ...query, category: normalizedSlug }),
    [params, normalizedSlug],
  );
  const postsQuery = useContentQuery(loadPosts, [loadPosts]);
  const results = postsQuery.result?.data;

  if (categoriesQuery.state === 'ready' && !category) return <NotFoundPage resource="category" />;

  return (
    <>
      <PageIntro
        title={category?.name ?? '分类'}
        description={`浏览“${category?.name ?? slug}”下的文章。`}
      />
      <Container className="discovery-page">
        {categoriesQuery.state === 'loading' || postsQuery.state === 'loading' ? (
          <p role="status">正在加载文章…</p>
        ) : null}
        {categoriesQuery.result?.source === 'fallback' ? (
          <FallbackNotice error={categoriesQuery.result.error} />
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
              excludedKeys={['category']}
            />
          </>
        ) : null}
      </Container>
    </>
  );
}
