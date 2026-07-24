import { useEffect, useState } from 'react';

import type { ArticleHeading } from './MarkdownRenderer';

function currentHeadingId(): string {
  const hash = window.location.hash.slice(1);
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

export function TableOfContents({ headings }: { headings: readonly ArticleHeading[] }) {
  const [activeId, setActiveId] = useState(currentHeadingId);

  useEffect(() => {
    const syncActiveId = () => setActiveId(currentHeadingId());
    window.addEventListener('hashchange', syncActiveId);
    return () => window.removeEventListener('hashchange', syncActiveId);
  }, []);

  return (
    <nav className="table-of-contents" aria-label="文章目录">
      <details open>
        <summary>目录</summary>
        {headings.length ? (
          <ol>
            {headings.map((heading) => (
              <li key={heading.id} className={`table-of-contents__level-${heading.level}`}>
                <a
                  href={`#${heading.id}`}
                  aria-current={activeId === heading.id ? 'location' : undefined}
                >
                  {heading.text}
                </a>
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
