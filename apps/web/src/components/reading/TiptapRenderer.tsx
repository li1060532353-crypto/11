import { type ReactNode } from 'react';
import type { TiptapDocument, TiptapNode } from '@namdw/shared';
import katex from 'katex';
import { CodeBlock } from './CodeBlock';
import { extractHeadingsFromDocument, getNodeText, slugBase } from './headingExtractor';

export { extractHeadingsFromDocument } from './headingExtractor';

const MATH_REGEX = /\$\$([\s\S]+?)\$\$|\$([^$\s](?:[^$\n]*?[^$\s])?)\$/g;

function renderMathToString(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
    });
  } catch {
    return formula;
  }
}

function renderTextWithMath(text: string, keyPrefix: string): ReactNode[] {
  if (!text.includes('$')) {
    return [text];
  }

  const elements: ReactNode[] = [];
  let lastIndex = 0;
  MATH_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MATH_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    const isDisplay = Boolean(match[1]);
    const formula = match[1] ?? match[2] ?? '';
    const html = renderMathToString(formula, isDisplay);

    if (isDisplay) {
      elements.push(
        <span
          key={`${keyPrefix}-math-${match.index}`}
          className="katex-display"
          dangerouslySetInnerHTML={{ __html: html }}
        />,
      );
    } else {
      elements.push(
        <span
          key={`${keyPrefix}-math-${match.index}`}
          className="katex"
          dangerouslySetInnerHTML={{ __html: html }}
        />,
      );
    }

    lastIndex = MATH_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
}

function isExternalLink(href: string | undefined): boolean {
  return Boolean(href && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href));
}

export function TiptapRenderer({ content }: { content: TiptapDocument | string }) {
  let doc: TiptapDocument;
  try {
    doc = typeof content === 'string' ? (JSON.parse(content) as TiptapDocument) : content;
  } catch {
    return <p className="knowledge-message knowledge-message--error">无法解析文章内容格式。</p>;
  }

  if (!doc || !Array.isArray(doc.content)) {
    return null;
  }

  const headingCounts = new Map<string, number>();

  const renderInline = (nodes: readonly TiptapNode[] = []): ReactNode[] => {
    return nodes.map((inlineNode, idx) => {
      if (inlineNode.type === 'hardBreak') {
        return <br key={`br-${idx}`} />;
      }

      if (inlineNode.type === 'text') {
        const text = inlineNode.text ?? '';
        const hasCodeMark = Boolean(inlineNode.marks?.some((m) => m.type === 'code'));

        let isCodeMath = false;
        let mathFormula = '';
        let isDisplayMath = false;
        if (hasCodeMark) {
          if (text.startsWith('$$') && text.endsWith('$$') && text.length > 4) {
            isCodeMath = true;
            isDisplayMath = true;
            mathFormula = text.slice(2, -2).trim();
          } else if (text.startsWith('$') && text.endsWith('$') && text.length > 2) {
            isCodeMath = true;
            isDisplayMath = false;
            mathFormula = text.slice(1, -1).trim();
          }
        }

        let wrapped: ReactNode = isCodeMath ? (
          <span
            key={`math-${idx}`}
            className={isDisplayMath ? 'katex-display' : 'katex'}
            dangerouslySetInnerHTML={{ __html: renderMathToString(mathFormula, isDisplayMath) }}
          />
        ) : hasCodeMark ? (
          text
        ) : (
          renderTextWithMath(text, `text-${idx}`)
        );

        if (inlineNode.marks && Array.isArray(inlineNode.marks)) {
          for (const mark of inlineNode.marks) {
            if (mark.type === 'bold') {
              wrapped = <strong>{wrapped}</strong>;
            } else if (mark.type === 'italic') {
              wrapped = <em>{wrapped}</em>;
            } else if (mark.type === 'strike') {
              wrapped = <s>{wrapped}</s>;
            } else if (mark.type === 'code') {
              if (!isCodeMath) {
                wrapped = <code>{wrapped}</code>;
              }
            } else if (mark.type === 'link') {
              const href = (mark.attrs?.href as string) ?? '#';
              const target = mark.attrs?.target as string | undefined;
              wrapped = (
                <a
                  href={href}
                  target={target}
                  rel={isExternalLink(href) ? 'noreferrer' : undefined}
                >
                  {wrapped}
                </a>
              );
            } else if (mark.type === 'highlight') {
              const kind = (mark.attrs?.kind as string) ?? 'core';
              wrapped = <mark data-highlight-kind={kind}>{wrapped}</mark>;
            }
          }
        }

        return <span key={`text-${idx}`}>{wrapped}</span>;
      }

      return null;
    });
  };

  const renderBlock = (node: TiptapNode, index: number): ReactNode => {
    switch (node.type) {
      case 'image': {
        const id = node.attrs?.assetId;
        if (typeof id !== 'string' || !/^[A-Za-z0-9-]+$/.test(id)) return null;
        return (
          <img
            key={`image-${index}`}
            src={`/api/assets/${encodeURIComponent(id)}?inline=1`}
            alt={typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''}
            loading="lazy"
            decoding="async"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        );
      }
      case 'heading': {
        const level = Number(node.attrs?.level ?? 1);
        const text = getNodeText(node).trim();
        const base = slugBase(text);
        const count = (headingCounts.get(base) ?? 0) + 1;
        const id = count === 1 ? base : `${base}-${count}`;
        headingCounts.set(base, count);

        const inlines = renderInline(node.content);
        if (level === 1)
          return (
            <h1 key={`h1-${index}`} id={id}>
              {inlines}
            </h1>
          );
        if (level === 2)
          return (
            <h2 key={`h2-${index}`} id={id}>
              {inlines}
            </h2>
          );
        if (level === 3)
          return (
            <h3 key={`h3-${index}`} id={id}>
              {inlines}
            </h3>
          );
        if (level === 4)
          return (
            <h4 key={`h4-${index}`} id={id}>
              {inlines}
            </h4>
          );
        if (level === 5)
          return (
            <h5 key={`h5-${index}`} id={id}>
              {inlines}
            </h5>
          );
        return (
          <h6 key={`h6-${index}`} id={id}>
            {inlines}
          </h6>
        );
      }
      case 'paragraph':
        return <p key={`p-${index}`}>{renderInline(node.content)}</p>;
      case 'bulletList':
        return (
          <ul key={`ul-${index}`}>
            {node.content?.map((item, itemIdx) => renderBlock(item, itemIdx))}
          </ul>
        );
      case 'orderedList': {
        const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1;
        return (
          <ol key={`ol-${index}`} start={start}>
            {node.content?.map((item, itemIdx) => renderBlock(item, itemIdx))}
          </ol>
        );
      }
      case 'listItem':
        return (
          <li key={`li-${index}`}>
            {node.content?.map((child, childIdx) => {
              if (child.type === 'paragraph') {
                return <span key={`li-p-${childIdx}`}>{renderInline(child.content)}</span>;
              }
              return renderBlock(child, childIdx);
            })}
          </li>
        );
      case 'blockquote':
        return (
          <blockquote key={`quote-${index}`}>
            {node.content?.map((child, childIdx) => renderBlock(child, childIdx))}
          </blockquote>
        );
      case 'mathBlock': {
        const mathText =
          (node.attrs?.latex as string) ??
          (node.content ?? []).map((c) => c.text ?? '').join('');
        return (
          <div
            key={`math-${index}`}
            className="katex-display"
            dangerouslySetInnerHTML={{
              __html: renderMathToString(mathText, true),
            }}
          />
        );
      }
      case 'codeBlock': {
        const codeText = (node.content ?? []).map((c) => c.text ?? '').join('');
        const language = ((node.attrs?.language as string) || '').toLowerCase();
        if (language === 'math' || language === 'latex') {
          return (
            <div
              key={`code-${index}`}
              className="katex-display"
              dangerouslySetInnerHTML={{
                __html: renderMathToString(codeText, true),
              }}
            />
          );
        }
        return (
          <CodeBlock key={`code-${index}`}>
            <code className={language ? `language-${language}` : undefined}>{codeText}</code>
          </CodeBlock>
        );
      }
      case 'horizontalRule':
        return <hr key={`hr-${index}`} />;
      case 'table': {
        const rows = node.content ?? [];
        const isHeaderRow = (r: TiptapNode) =>
          Boolean(r.content?.length && r.content.every((c) => c.type === 'tableHeader'));

        const headerRows = rows.filter(isHeaderRow);
        const bodyRows = rows.filter((r) => !isHeaderRow(r));

        const renderCell = (cell: TiptapNode, cellIdx: number) => {
          const Tag = cell.type === 'tableHeader' ? 'th' : 'td';
          const align = (cell.attrs?.align as 'left' | 'center' | 'right' | undefined) ?? undefined;
          const colSpan = typeof cell.attrs?.colspan === 'number' ? cell.attrs.colspan : undefined;
          const rowSpan = typeof cell.attrs?.rowspan === 'number' ? cell.attrs.rowspan : undefined;

          return (
            <Tag
              key={`cell-${cellIdx}`}
              style={align ? { textAlign: align } : undefined}
              colSpan={colSpan}
              rowSpan={rowSpan}
            >
              {cell.content?.map((child, childIdx) => renderBlock(child, childIdx))}
            </Tag>
          );
        };

        const renderRow = (row: TiptapNode, rowIdx: number) => (
          <tr key={`tr-${rowIdx}`}>{row.content?.map(renderCell)}</tr>
        );

        return (
          <div
            key={`table-${index}`}
            className="table-responsive-wrapper"
            style={{ overflowX: 'auto', maxWidth: '100%' }}
          >
            <table>
              {headerRows.length > 0 && <thead>{headerRows.map(renderRow)}</thead>}
              <tbody>{bodyRows.map(renderRow)}</tbody>
            </table>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return <>{doc.content.map(renderBlock)}</>;
}
