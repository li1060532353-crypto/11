import { Link } from 'react-router-dom';

import type { PostSummary } from '../../content/contentQueries';
import { PostMeta } from './PostMeta';

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="post-card" aria-labelledby={`post-${post.slug}`}>
      <div
        className={`post-card__visual post-card__visual--${post.cover.tone}`}
        aria-hidden="true"
      />
      <div className="post-card__body">
        <PostMeta post={post} />
        <h2 id={`post-${post.slug}`}>
          <Link to={`/posts/${post.slug}`}>{post.title}</Link>
        </h2>
        <p>{post.summary}</p>
      </div>
    </article>
  );
}
