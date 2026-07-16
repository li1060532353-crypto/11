import type { ArticleHeading } from './MarkdownRenderer';

export function TableOfContents({ headings }: { headings: readonly ArticleHeading[] }) {
  return (
    <nav className="table-of-contents" aria-label="文章目录">
      <details open>
        <summary>目录</summary>
        {headings.length ? (
          <ol>
            {headings.map((heading) => (
              <li key={heading.id} className={`table-of-contents__level-${heading.level}`}>
                <a href={`#${heading.id}`}>{heading.text}</a>
              </li>
            ))}
          </ol>
        ) : (
          <p>本文没有分节。</p>
        )}
      </details>
    </nav>
  );
}
