import { Link, useLocation } from 'react-router-dom';

import { toTaxonomySlug, type PostSummary } from '../../content/contentQueries';
import { saveScrollPosition } from '../../hooks/useScrollToTop';

export function PostIndexRow({ post, number }: { post: PostSummary; number: number }) {
  const location = useLocation();
  const titleId = `post-${post.slug}`;
  const date = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(post.publishedAt));

  return (
    <article className="post-index-row" aria-labelledby={titleId}>
      <span className="post-index-row__number" aria-hidden="true">
        {String(number).padStart(2, '0')}
      </span>
      <div className="post-index-row__main">
        <h2 id={titleId}>
          <Link
            className="post-index-row__title-link"
            to={`/posts/${post.slug}`}
            state={{ kind: 'post_list', fromPath: `${location.pathname}${location.search}`, fromLabel: '← 返回文章列表' }}
            onClick={() => {
              // Capture at activation so a long list returns to the same reading position.
              saveScrollPosition(location.pathname, location.search, window.scrollY);
            }}
          >
            {post.title.split(/([A-Za-z0-9]+(?:[+./-][A-Za-z0-9]+)*)/).map((part, index) =>
              index % 2 ? <span className="post-index-row__term" key={index}>{part}</span> : part,
            )}
          </Link>
        </h2>
        <p className="post-index-row__summary">{post.summary}</p>
        {post.tags.length ? (
          <ul className="post-index-row__tags" aria-label="标签">
            {post.tags.map((tag) => (
              <li key={tag}><Link to={`/tags/${encodeURIComponent(toTaxonomySlug(tag))}`}>{tag}</Link></li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="post-index-row__meta">
        <time dateTime={post.publishedAt}>{date}</time>
        <Link className="post-index-row__category" to={`/categories/${encodeURIComponent(toTaxonomySlug(post.category))}`}>
          {post.category}
        </Link>
        <span>{post.readingTime} 分钟阅读</span>
      </div>
      <span className="post-index-row__arrow" aria-hidden="true">↗</span>
    </article>
  );
}
