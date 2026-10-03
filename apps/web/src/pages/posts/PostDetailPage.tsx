import { lazy, Suspense, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { FallbackNotice } from '../../components/content/FallbackNotice';
import { PostMeta } from '../../components/content/PostMeta';
import {
  extractHeadings,
  extractHeadingsFromDocument,
} from '../../components/reading/headingExtractor';
import { ReadingProgress } from '../../components/reading/ReadingProgress';
import { TableOfContents } from '../../components/reading/TableOfContents';
import { Container } from '../../components/ui/Container';
import { DraftingGridBackdrop } from '../../components/ui/DraftingGridBackdrop';
import {
  buildAdjacentPostState,
  getSafeReturnTarget,
} from '../../components/navigation/navigationSource';
import { BottomReturnBar, TopReturnBar, FloatingReturnButton } from '../../components/navigation/ReturnButton';
import { getPostBySlug, getPostNeighbors } from '../../content/contentGateway';
import { siteContent } from '../../content/site';
import { useContentQuery } from '../../content/useContentQuery';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { NotFoundPage } from '../NotFoundPage';

const MarkdownRenderer = lazy(() =>
  import('../../components/reading/MarkdownRenderer').then((m) => ({ default: m.MarkdownRenderer })),
);
const TiptapRenderer = lazy(() =>
  import('../../components/reading/TiptapRenderer').then((m) => ({ default: m.TiptapRenderer })),
);

function articleBody(body: string): string {
  return body.replace(/^\s*#\s+.+?(?:\r?\n){2,}/, '');
}

export function PostDetailPage() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const returnTarget = useMemo(
    () => getSafeReturnTarget(location.state, '/posts', '← 返回文章列表'),
    [location.state],
  );

  const load = useMemo(() => () => getPostBySlug(slug), [slug]);
  const query = useContentQuery(load, [load], false);
  const post = query.result?.data;
  const loadNeighbors = useMemo(() => () => post
    ? getPostNeighbors(slug)
    : Promise.resolve({ source: 'api' as const, data: { previous: undefined, next: undefined } }), [slug, post]);
  const neighborsQuery = useContentQuery(loadNeighbors, [loadNeighbors], false);
  useDocumentMeta(
    query.state === 'loading'
      ? {
          title: `正在加载文章 | ${siteContent.name}`,
          description: '正在加载文章内容。',
        }
      : post
        ? {
            title: `${post.seoTitle ?? post.title} | ${siteContent.name}`,
            description: post.seoDescription ?? post.summary,
          }
        : {
            title: `未找到文章 | ${siteContent.name}`,
            description: '这篇文章不存在，或许已经被移动。',
          },
  );

  if (query.state === 'loading') {
    return (
      <Container>
        <p role="status">正在加载文章…</p>
      </Container>
    );
  }

  if (!post) return <NotFoundPage resource="article" />;

  const source = articleBody(post.body);
  const headings = post.contentJson
    ? extractHeadingsFromDocument(post.contentJson as never)
    : extractHeadings(source);
  const previousPost = neighborsQuery.result?.data.previous;
  const nextPost = neighborsQuery.result?.data.next;

  return (
    <div className="page-canvas post-detail-canvas">
      <DraftingGridBackdrop />
      <ReadingProgress key={post.slug} />
      <FloatingReturnButton target={returnTarget} />
      <Container>
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        <article id="article-content" className="post-detail" tabIndex={-1}>
          <TopReturnBar target={returnTarget} />
          <header className="post-detail__header">
            {post.cover.image ? (
              <img
                className="post-detail__cover-image"
                src={post.cover.image}
                alt={post.cover.alt}
                loading="eager"
                decoding="async"
              />
            ) : null}
            <div className="post-detail__intro">
              <div className="post-detail__eyebrow-row">
                <p className="eyebrow post-detail__eyebrow">
                  <span className="post-detail__eyebrow-pip" aria-hidden="true" />
                  ARTICLE / {(post.category || 'NOTE').toUpperCase()}
                </p>
                <div className="post-detail__doc-meta" aria-label="技术文档参考编号">
                  <span>DOC_REF {post.slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || '01'}</span>
                  <span className="post-detail__doc-meta-sep" aria-hidden="true">/</span>
                  <span>REV {post.publishedAt ? post.publishedAt.slice(0, 7).replace('-', '.') : '2026.10'}</span>
                </div>
              </div>
              <h1>{post.title}</h1>
              <p className="post-detail__summary">{post.summary}</p>
              <PostMeta post={post} />
            </div>
            <div className="post-detail__header-accent-tick" aria-hidden="true" />
          </header>

          <div className="post-detail__layout">
            <aside className="post-detail__toc">
              <TableOfContents headings={headings} />
            </aside>
            <div className="markdown-body">
              <Suspense
                fallback={
                  <div className="article-renderer-skeleton" role="status">
                    正在加载正文…
                  </div>
                }
              >
                {post.contentJson ? (
                  <TiptapRenderer content={post.contentJson as never} />
                ) : (
                  <MarkdownRenderer source={source} />
                )}
              </Suspense>
            </div>
          </div>

          {previousPost || nextPost ? <nav className="article-navigation" aria-label="相邻文章">
            {previousPost ? (
              <Link
                className="article-navigation__previous"
                rel="prev"
                to={`/posts/${previousPost.slug}`}
                state={buildAdjacentPostState(returnTarget)}
              >
                <span>← 上一篇</span>
                {previousPost.title}
              </Link>
            ) : null}
            {nextPost ? (
              <Link
                className="article-navigation__next"
                rel="next"
                to={`/posts/${nextPost.slug}`}
                state={buildAdjacentPostState(returnTarget)}
              >
                <span>下一篇 →</span>
                {nextPost.title}
              </Link>
            ) : null}
          </nav> : null}
          <BottomReturnBar target={returnTarget} />
        </article>
      </Container>
    </div>
  );
}
