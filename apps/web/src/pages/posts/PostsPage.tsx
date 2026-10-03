import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FallbackNotice } from '../../components/content/FallbackNotice';
import { FilterBar } from '../../components/content/FilterBar';
import { Pagination } from '../../components/content/Pagination';
import { PostIndexRow } from '../../components/content/PostIndexRow';
import { ReturnButton } from '../../components/navigation/ReturnButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { listCategories, listPosts, listTags } from '../../content/contentGateway';
import { buildPostQuery, parsePostQuery } from '../../content/queryParams';
import { useContentQuery } from '../../content/useContentQuery';
import { Container } from '../../components/ui/Container';
import { DraftingGridBackdrop } from '../../components/ui/DraftingGridBackdrop';
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
    <div className="page-canvas posts-index-page">
      <DraftingGridBackdrop />
      <PageIntro
        title="文章"
        description="学习、推导与实践，按时间串起每一次记录。"
        action={
          <ReturnButton
            target={{ path: '/', label: '← 返回主页', kind: 'direct', hopCount: 0, scrollY: 0 }}
            className="ui-button ui-button--secondary"
            testId="posts-home-return"
            ariaLabel="返回主页"
          />
        }
      />
      <section className="posts-index-band" aria-label="文章索引">
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
          <>
            <div className="post-index-heading">
              <h2>文章索引</h2>
              <p>共 {results.totalItems} 篇 <span aria-hidden="true">/</span> 最新在前</p>
            </div>
            <div className="post-index-columns" aria-hidden="true">
              <span>标题 / 摘要</span><span>日期 / 分类</span>
            </div>
            <div className="post-index-list">
              {results.items.map((post, index) => (
                <PostIndexRow key={post.slug} post={post} number={(results.page - 1) * results.pageSize + index + 1} />
              ))}
            </div>
          </>
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
      </section>
    </div>
  );
}
