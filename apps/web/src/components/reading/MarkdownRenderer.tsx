import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { CodeBlock } from './CodeBlock';
import { assignHeadingIds } from './headingExtractor';

export type { ArticleHeading } from './headingExtractor';
export { extractHeadings } from './headingExtractor';

function remarkHeadingIds() {
  return (tree: Parameters<typeof assignHeadingIds>[0]) => {
    assignHeadingIds(tree);
  };
}

function isExternalLink(href: string | undefined): boolean {
  return Boolean(href && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href));
}

function formatHeadingContent(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') {
    const match = children.match(/^(\d+(?:\.\d+)?)\s*(?:[/—–-]\s*)?(.*)$/);
    if (match && match[2]?.trim()) {
      return (
        <>
          <span className="heading-prefix">{match[1]}</span>
          <span className="heading-sep">/</span>
          <span className="heading-text">{match[2].trim()}</span>
        </>
      );
    }
  }
  return children;
}

export function MarkdownRenderer({ source }: { source: string }) {
  const components: Components = {
    a({ children, href }) {
      return (
        <a href={href} rel={isExternalLink(href) ? 'noreferrer' : undefined}>
          {children}
        </a>
      );
    },
    img({ src, alt, ...props }) {
      return (
        <img
          src={src}
          alt={alt ?? ''}
          loading="lazy"
          decoding="async"
          style={{ maxWidth: '100%', height: 'auto' }}
          {...props}
        />
      );
    },
    h2({ children, id, ...props }) {
      return (
        <h2 id={id} {...props}>
          {formatHeadingContent(children)}
        </h2>
      );
    },
    h3({ children, id, ...props }) {
      return (
        <h3 id={id} {...props}>
          {formatHeadingContent(children)}
        </h3>
      );
    },
    pre({ children, ...props }) {
      return <CodeBlock {...props}>{children}</CodeBlock>;
    },
  };

  return (
    <ReactMarkdown
      components={components}
      remarkPlugins={[remarkGfm, remarkMath, remarkHeadingIds]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
    >
      {source}
    </ReactMarkdown>
  );
}
