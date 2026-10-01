import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { FallbackNotice } from '../../components/content/FallbackNotice';
import { PostMeta } from '../../components/content/PostMeta';
import { extractHeadings, MarkdownRenderer } from '../../components/reading/MarkdownRenderer';
import { extractHeadingsFromDocument, TiptapRenderer } from '../../components/reading/TiptapRenderer';
import { ReadingProgress } from '../../components/reading/ReadingProgress';
import { TableOfContents } from '../../components/reading/TableOfContents';
import { Container } from '../../components/ui/Container';
import { DraftingGridBackdrop } from '../../components/ui/DraftingGridBackdrop';
import { getPostNeighbors } from '../../content/contentQueries';
import { getPostBySlug } from '../../content/contentGateway';
import { siteContent } from '../../content/site';
import type { ContentResult, Post, PostSummary } from '../../content/types';
import { useContentQuery } from '../../content/useContentQuery';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { NotFoundPage } from '../NotFoundPage';

function articleBody(body: string): string {
  return body.replace(/^\s*#\s+.+?(?:\r?\n){2,}/, '');
}

function navigationPosts(result: ContentResult<Post | undefined> | undefined): {
  previousPost: PostSummary | undefined;
  nextPost: PostSummary | undefined;
} {
  const post = result?.data;
  if (!post) return { previousPost: undefined, nextPost: undefined };

  if (post.relatedPosts?.length) {
    return {
      previousPost: post.relatedPosts[0],
      nextPost: post.relatedPosts[1],
    };
  }

  if (result.source === 'fallback') {
    const { previous, next } = getPostNeighbors(post.slug);
    return { previousPost: previous, nextPost: next };
  }

  return { previousPost: undefined, nextPost: undefined };
}

export function PostDetailPage() {
  const { slug = '' } = useParams();
  const load = useMemo(() => () => getPostBySlug(slug), [slug]);
  const query = useContentQuery(load, [load]);
  const post = query.result?.data;
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
  const { previousPost, nextPost } = navigationPosts(query.result);

  return (
    <div className="page-canvas post-detail-canvas">
      <DraftingGridBackdrop />
      <ReadingProgress key={post.slug} />
      <Container>
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        <article id="article-content" className="post-detail" tabIndex={-1}>
          <header className="post-detail__header">
            <div className="post-detail__backdrop" aria-hidden="true">
              <svg
                className="post-detail__backdrop-svg"
                viewBox="0 0 1440 260"
                preserveAspectRatio="xMidYMin slice"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Subtle horizontal bus trace */}
                <g stroke="var(--color-accent, #0071e3)" fill="none">
                  <path
                    d="M 1400,60 L 1050,60 L 1020,95 L 420,95 L 390,130 L 40,130"
                    strokeWidth="0.75"
                    strokeDasharray="4 6"
                    strokeOpacity="0.14"
                  />
                  <circle cx="1020" cy="95" r="2" fill="var(--color-accent, #0071e3)" fillOpacity="0.25" />
                  <circle cx="390" cy="130" r="2" fill="var(--color-accent, #0071e3)" fillOpacity="0.25" />
                </g>
                {/* Corner Fiducials & CAD Reference */}
                <g
                  fill="currentColor"
                  fontFamily="var(--font-mono, monospace)"
                  fontSize="9"
                  letterSpacing="0.08em"
                  opacity="0.35"
                >
                  <path
                    d="M 40,16 L 40,24 L 32,24 M 40,24 L 48,24 M 40,24 L 40,32"
                    stroke="currentColor"
                    strokeWidth="1"
                    fill="none"
                  />
                  <text x="54" y="24" dominantBaseline="auto">
                    CAD_REF: 0x00 // TECHNICAL_MEMO
                  </text>
                  <text x="1400" y="24" textAnchor="end" dominantBaseline="auto">
                    DOC_SPEC · PEER_REVIEWED
                  </text>
                  <line
                    x1="40"
                    y1="259"
                    x2="1400"
                    y2="259"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    strokeOpacity="0.15"
                  />
                </g>
              </svg>
            </div>
            {post.cover.image ? (
              <img className="post-detail__cover-image" src={post.cover.image} alt={post.cover.alt} />
            ) : (
              <div
                className={`post-detail__cover post-card__visual post-card__visual--${post.cover.tone}`}
                role="img"
                aria-label={post.cover.alt}
              />
            )}
            <div className="post-detail__intro">
              <p className="eyebrow">Article</p>
              <h1>{post.title}</h1>
              <p className="post-detail__summary">{post.summary}</p>
              <PostMeta post={post} />
            </div>
          </header>

          <div className="post-detail__layout">
            <aside className="post-detail__toc">
              <TableOfContents headings={headings} />
            </aside>
            <div className="markdown-body">
              {post.contentJson ? (
                <TiptapRenderer content={post.contentJson as never} />
              ) : (
                <MarkdownRenderer source={source} />
              )}
            </div>
          </div>

          <nav className="article-navigation" aria-label="相邻文章">
            {previousPost ? (
              <Link to={`/posts/${previousPost.slug}`}>
                <span>上一篇</span>
                {previousPost.title}
              </Link>
            ) : (
              <span />
            )}
            {nextPost ? (
              <Link to={`/posts/${nextPost.slug}`}>
                <span>下一篇</span>
                {nextPost.title}
              </Link>
            ) : null}
          </nav>
        </article>
      </Container>
    </div>
  );
}
