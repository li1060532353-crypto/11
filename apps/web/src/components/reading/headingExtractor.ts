import type { TiptapDocument, TiptapNode } from '@namdw/shared';
import { toString } from 'mdast-util-to-string';
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

export function slugBase(value: string): string {
  return (
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .trim()
      .replace(/[\s-]+/g, '-') || 'section'
  );
}

export function assignHeadingIds(
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

export function getNodeText(node: TiptapNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(getNodeText).join('');
}

export function extractHeadingsFromDocument(
  docOrJson: TiptapDocument | string,
): readonly ArticleHeading[] {
  let doc: TiptapDocument;
  try {
    doc = typeof docOrJson === 'string' ? (JSON.parse(docOrJson) as TiptapDocument) : docOrJson;
  } catch {
    return [];
  }

  if (!doc || !Array.isArray(doc.content)) return [];

  const counts = new Map<string, number>();
  const headings: ArticleHeading[] = [];

  for (const node of doc.content) {
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level ?? 1);
      if (level === 2 || level === 3) {
        const text = getNodeText(node).trim();
        const base = slugBase(text);
        const count = (counts.get(base) ?? 0) + 1;
        const id = count === 1 ? base : `${base}-${count}`;
        counts.set(base, count);
        headings.push({ id, level, text });
      }
    }
  }

  return headings;
}
