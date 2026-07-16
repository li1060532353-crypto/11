import { toString } from 'mdast-util-to-string';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export type ArticleHeading = {
  id: string;
  level: 2 | 3;
  text: string;
};

const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

function slugBase(value: string): string {
  return (
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .trim()
      .replace(/[\s-]+/g, '-') || 'section'
  );
}

function assignHeadingIds(
  tree: ReturnType<typeof markdownParser.parse>,
): readonly ArticleHeading[] {
  const counts = new Map<string, number>();
  const headings: ArticleHeading[] = [];

  visit(tree, 'heading', (node) => {
    if (node.depth !== 2 && node.depth !== 3) return;

    const text = toString(node).trim();
    const base = slugBase(text);
    const count = (counts.get(base) ?? 0) + 1;
    const id = count === 1 ? base : `${base}-${count}`;
    counts.set(base, count);
    node.data ??= {};
    node.data.hProperties = { ...node.data.hProperties, id };
    headings.push({ id, level: node.depth, text });
  });

  return headings;
}

export function extractHeadings(source: string): readonly ArticleHeading[] {
  return assignHeadingIds(markdownParser.parse(source));
}

function remarkHeadingIds() {
  return (tree: ReturnType<typeof markdownParser.parse>) => {
    assignHeadingIds(tree);
  };
}

function isExternalLink(href: string | undefined): boolean {
  return Boolean(href && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href));
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
