import { Link } from 'react-router-dom';

import { toTaxonomySlug, type PostSummary } from '../../content/contentQueries';

export function PostMeta({ post }: { post: PostSummary }) {
  const date = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(
    new Date(post.publishedAt),
  );

  return (
    <div className="post-meta">
      <div className="post-meta__kicker">
        <Link
          className="post-meta__category"
          to={`/categories/${encodeURIComponent(toTaxonomySlug(post.category))}`}
        >
          {post.category}
        </Link>
        <span className="post-meta__sep" aria-hidden="true">·</span>
        <span aria-label={`预计阅读 ${post.readingTime} 分钟`}>{post.readingTime} 分钟阅读</span>
        {post.tags.length > 0 ? (
          <span className="post-meta__tags" aria-label="标签">
            {post.tags.map((tag) => (
              <Link key={tag} to={`/tags/${encodeURIComponent(toTaxonomySlug(tag))}`}>
                {tag}
              </Link>
            ))}
          </span>
        ) : null}
      </div>
      <time className="post-meta__date" dateTime={post.publishedAt}>{date}</time>
    </div>
  );
}
