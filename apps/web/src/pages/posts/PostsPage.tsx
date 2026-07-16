import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FallbackNotice } from '../../components/content/FallbackNotice';
import { FilterBar } from '../../components/content/FilterBar';
import { Pagination } from '../../components/content/Pagination';
import { PostCard } from '../../components/content/PostCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { listCategories, listPosts, listTags } from '../../content/contentGateway';
import { buildPostQuery, parsePostQuery } from '../../content/queryParams';
import { useContentQuery } from '../../content/useContentQuery';
import { Container } from '../../components/ui/Container';
import { PageIntro } from '../PageIntro';

export function PostsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const query = parsePostQuery(params.toString());
  const loadPosts = useMemo(() => () => listPosts(query), [params]);
  const loadCategories = useMemo(() => () => listCategories(), []);
  const loadTags = useMemo(() => () => listTags(), []);
  const postsQuery = useContentQuery(loadPosts, [loadPosts]);
  const categoriesQuery = useContentQuery(loadCategories, [loadCategories]);
  const tagsQuery = useContentQuery(loadTags, [loadTags]);
  const results = postsQuery.result?.data;
  const change = (key: 'category' | 'tag' | 'year', value: string) => {
    const next = {
      ...query,
      page: 1,
      [key]: key === 'year' && value ? Number(value) : value || undefined,
    };
    navigate(`/posts${buildPostQuery(next)}`);
  };
  return (
    <>
      <PageIntro title="文章" description="按时间浏览全部技术文章。" />
      <Container className="discovery-page">
        <FilterBar
          query={query}
          categories={categoriesQuery.result?.data ?? []}
          tags={tagsQuery.result?.data ?? []}
          onChange={change}
          clearTo="/posts"
        />
        {postsQuery.state === 'loading' ? <p role="status">正在加载文章…</p> : null}
        {postsQuery.result?.source === 'fallback' ? (
          <FallbackNotice error={postsQuery.result.error} />
        ) : null}
        {results?.items.length ? (
          <div className="post-grid">
            {results.items.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : postsQuery.state === 'ready' ? (
          <EmptyState
            title="没有匹配的文章"
            description="尝试调整筛选条件。"
            href="/posts"
            linkLabel="浏览全部文章"
          />
        ) : null}
        {results ? (
          <Pagination
            page={results.page}
            totalPages={results.totalPages}
            pathname={location.pathname}
            search={location.search}
          />
        ) : null}
      </Container>
    </>
  );
}
