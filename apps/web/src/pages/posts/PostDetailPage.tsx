import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { FallbackNotice } from '../../components/content/FallbackNotice';
import { PostMeta } from '../../components/content/PostMeta';
import { extractHeadings, MarkdownRenderer } from '../../components/reading/MarkdownRenderer';
import { ReadingProgress } from '../../components/reading/ReadingProgress';
import { TableOfContents } from '../../components/reading/TableOfContents';
import { Container } from '../../components/ui/Container';
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
  const headings = extractHeadings(source);
  const { previousPost, nextPost } = navigationPosts(query.result);

  return (
    <>
      <ReadingProgress key={post.slug} />
      <Container>
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        <article id="article-content" className="post-detail" tabIndex={-1}>
          <header className="post-detail__header">
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
              <MarkdownRenderer source={source} />
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
    </>
  );
}
