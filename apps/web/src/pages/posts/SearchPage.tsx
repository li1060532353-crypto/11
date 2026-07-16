import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FallbackNotice } from '../../components/content/FallbackNotice';
import { Pagination } from '../../components/content/Pagination';
import { PostCard } from '../../components/content/PostCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Container } from '../../components/ui/Container';
import { searchPosts } from '../../content/contentGateway';
import { parsePostQuery } from '../../content/queryParams';
import { useContentQuery } from '../../content/useContentQuery';
import { PageIntro } from '../PageIntro';
export function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const query = parsePostQuery(params.toString());
  const [value, setValue] = useState(query.q ?? '');
  const load = useMemo(() => () => searchPosts(query.q ?? '', { page: query.page }), [params]);
  const contentQuery = useContentQuery(load, [load]);
  const results = contentQuery.result?.data;
  useEffect(() => setValue(query.q ?? ''), [query.q]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (value.trim()) next.set('q', value.trim());
    else next.delete('q');
    next.delete('page');
    const search = next.toString();
    navigate(`/search${search ? `?${search}` : ''}`);
  };
  return (
    <>
      <PageIntro title="搜索" description="搜索文章中的知识与实践记录。" />
      <Container className="discovery-page">
        <form className="search-form" role="search" aria-label="文章搜索" onSubmit={submit}>
          <label htmlFor="post-search">搜索文章</label>
          <input
            id="post-search"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button type="submit">搜索</button>
        </form>
        {contentQuery.state === 'loading' ? <p role="status">正在加载搜索结果…</p> : null}
        {contentQuery.result?.source === 'fallback' && contentQuery.result.error ? (
          <FallbackNotice error={contentQuery.result.error} />
        ) : null}
        {query.q ? (
          results?.items.length ? (
            <div className="post-grid">
              {results.items.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          ) : contentQuery.state === 'ready' ? (
            <EmptyState
              title="没有搜索结果"
              description="换一个关键词再试试。"
              href="/search"
              linkLabel="清除搜索"
            />
          ) : null
        ) : (
          <EmptyState
            title="输入关键词开始搜索"
            description="可搜索文章标题、摘要和正文。"
            href="/posts"
            linkLabel="浏览全部文章"
          />
        )}
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
