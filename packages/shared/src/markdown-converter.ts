import { type MarkdownImportWarning, type TiptapDocument, type TiptapNode } from './knowledge';

export type ConvertedMetadata = {
  title: string;
  summary: string;
  category: string;
  tags: string[];
  publishedAt: string | null;
  isFeatured: boolean;
  slug: string;
};

export type MarkdownConversionResult = {
  metadata: ConvertedMetadata;
  document: TiptapDocument;
  documentJson: string;
  contentText: string;
  warnings: MarkdownImportWarning[];
};

function projectDocumentText(document: TiptapDocument): string {
  const inline = (nodes: readonly TiptapNode[] = []): string =>
    nodes
      .map((node) =>
        node.type === 'text' ? (node.text ?? '') : node.type === 'hardBreak' ? '\n' : '',
      )
      .join('');
  const block = (node: TiptapNode): string => {
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock') {
      return inline(node.content);
    }
    if (
      node.type === 'bulletList' ||
      node.type === 'orderedList' ||
      node.type === 'blockquote' ||
      node.type === 'listItem'
    ) {
      return (node.content ?? []).map(block).filter(Boolean).join('\n');
    }
    if (
      node.type === 'table' ||
      node.type === 'tableRow' ||
      node.type === 'tableHeader' ||
      node.type === 'tableCell'
    ) {
      return (node.content ?? []).map(block).filter(Boolean).join(' ');
    }
    return '';
  };
  return document.content.map(block).filter(Boolean).join('\n\n');
}

function slugify(value: string): string {
  return (
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .trim()
      .replace(/[\s-]+/gu, '-') || 'note'
  );
}

function stripBom(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

function parseFrontMatter(raw: string): {
  frontMatter: Record<string, unknown>;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) {
    return { frontMatter: {}, body: raw };
  }

  const yamlContent = match[1] ?? '';
  const body = raw.slice(match[0].length);
  const frontMatter: Record<string, unknown> = {};

  const lines = yamlContent.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Array item under currentKey
    if (trimmed.startsWith('- ') && currentKey) {
      const val = trimmed
        .slice(2)
        .trim()
        .replace(/^['"](.*)['"]$/, '$1');
      currentArray ??= [];
      currentArray.push(val);
      frontMatter[currentKey] = currentArray;
      continue;
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      const val = trimmed.slice(colonIndex + 1).trim();

      currentKey = key;
      currentArray = null;

      if (!val) {
        // May be an array or object on subsequent lines
        continue;
      }

      if (val.startsWith('[') && val.endsWith(']')) {
        const items = val
          .slice(1, -1)
          .split(',')
          .map((item) => item.trim().replace(/^['"](.*)['"]$/, '$1'))
          .filter(Boolean);
        frontMatter[key] = items;
      } else if (val === 'true' || val === 'false') {
        frontMatter[key] = val === 'true';
      } else {
        frontMatter[key] = val.replace(/^['"](.*)['"]$/, '$1');
      }
    }
  }

  return { frontMatter, body };
}

function parseInline(
  text: string,
  lineNumber: number,
  warnings: MarkdownImportWarning[],
): TiptapNode[] {
  if (!text) return [];

  // Check for image references ![alt](url)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let sanitized = text.replace(imageRegex, (_m, alt, src) => {
    warnings.push({
      type: 'image',
      line: lineNumber,
      message: `图片引用暂未包含: "${alt || src}"。已转为纯文本，可在导入后通过编辑器附件面板上传并重新插入。`,
      raw: src,
    });
    return `[图片: ${alt || '未命名图片'}]`;
  });

  // Check for math $...$ or $$...$$
  const mathRegex = /\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g;
  sanitized = sanitized.replace(mathRegex, (_m, display, inline) => {
    const math = display || inline;
    warnings.push({
      type: 'math',
      line: lineNumber,
      message: `数学公式已保留为代码形式: "${math}"。`,
      raw: math,
    });
    return `\`${math}\``;
  });

  // Check for raw HTML tags (e.g. <script>, <style>, <iframe)
  const dangerousHtml =
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi;
  if (dangerousHtml.test(sanitized)) {
    warnings.push({
      type: 'html',
      line: lineNumber,
      message: '检测到脚本或框架 HTML 标签，已安全过滤。',
    });
    sanitized = sanitized.replace(dangerousHtml, '');
  }

  // Check for general HTML tags
  const htmlTagRegex = /<\/?[a-zA-Z][a-zA-Z0-9:-]*\b[^>]*>/g;
  if (htmlTagRegex.test(sanitized)) {
    warnings.push({
      type: 'html',
      line: lineNumber,
      message: '检测到原生 HTML 标签，已自动剥离标签并保留文本内容。',
    });
    sanitized = sanitized.replace(htmlTagRegex, '');
  }

  // Tokenize Markdown inline formatting
  // Supports: [link](url), **bold**, *italic*, ~~strike~~, `code`
  const tokens: TiptapNode[] = [];
  let remaining = sanitized;

  while (remaining.length > 0) {
    // 1. Link: [text](href)
    const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/.exec(remaining);
    if (linkMatch) {
      const linkText = linkMatch[1] ?? '';
      const href = (linkMatch[2] ?? '').trim();
      const safeHref = /^(?:javascript|vbscript|data):/i.test(href) ? '#' : href;
      if (safeHref === '#') {
        warnings.push({
          type: 'syntax',
          line: lineNumber,
          message: `链接使用了不安全的协议: "${href}"，已替换为空链接。`,
          raw: href,
        });
      }
      tokens.push({
        type: 'text',
        text: linkText,
        marks: [{ type: 'link', attrs: { href: safeHref } }],
      });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 2. Bold: **text** or __text__
    const boldMatch = /^(?:\*\*([^*]+)\*\*|__([^_]+)__)/.exec(remaining);
    if (boldMatch) {
      const boldText = boldMatch[1] ?? boldMatch[2] ?? '';
      tokens.push({
        type: 'text',
        text: boldText,
        marks: [{ type: 'bold' }],
      });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 3. Inline code: `code`
    const codeMatch = /^`([^`]+)`/.exec(remaining);
    if (codeMatch) {
      const codeText = codeMatch[1] ?? '';
      tokens.push({
        type: 'text',
        text: codeText,
        marks: [{ type: 'code' }],
      });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 4. Strikethrough: ~~text~~
    const strikeMatch = /^~~([^~]+)~~/.exec(remaining);
    if (strikeMatch) {
      const strikeText = strikeMatch[1] ?? '';
      tokens.push({
        type: 'text',
        text: strikeText,
        marks: [{ type: 'strike' }],
      });
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // 5. Italic: *text* or _text_
    const italicMatch = /^(?:\*([^*]+)\*|_([^_]+)_)/.exec(remaining);
    if (italicMatch) {
      const italicText = italicMatch[1] ?? italicMatch[2] ?? '';
      tokens.push({
        type: 'text',
        text: italicText,
        marks: [{ type: 'italic' }],
      });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Next plain text character chunk up to next special char [ * _ ~ `
    const nextSpecialIndex = remaining.search(/[[*_~`]/);
    if (nextSpecialIndex === -1) {
      tokens.push({ type: 'text', text: remaining });
      break;
    } else if (nextSpecialIndex === 0) {
      // Literal special char that didn't match a rule
      tokens.push({ type: 'text', text: remaining[0]! });
      remaining = remaining.slice(1);
    } else {
      tokens.push({ type: 'text', text: remaining.slice(0, nextSpecialIndex) });
      remaining = remaining.slice(nextSpecialIndex);
    }
  }

  return tokens.filter((t) => (t.text ?? '').length > 0);
}

function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inCode = false;
  let escaped = false;
  const trimmed = line.trim();
  let str = trimmed;
  if (str.startsWith('|')) str = str.slice(1);
  if (str.endsWith('|') && !str.endsWith('\\|')) str = str.slice(0, -1);

  for (let j = 0; j < str.length; j++) {
    const char = str[j]!;
    if (escaped) {
      if (char === '|') {
        current += '|';
      } else {
        current += '\\' + char;
      }
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '`') {
      inCode = !inCode;
      current += char;
      continue;
    }
    if (char === '|' && !inCode) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (escaped) current += '\\';
  cells.push(current.trim());
  return cells;
}

function parseTable(
  lines: string[],
  startLine: number,
  warnings: MarkdownImportWarning[],
): { tableNode: TiptapNode; consumedLines: number } | null {
  if (lines.length < 2) return null;

  const headerLine = lines[0] ?? '';
  const delimiterLine = lines[1] ?? '';

  if (!headerLine.includes('|') || !delimiterLine.includes('|')) return null;

  const delimiterCols = splitTableRow(delimiterLine);
  const isDelimiter = delimiterCols.length > 0 && delimiterCols.every((c) => /^:?-+:?$/.test(c));
  if (!isDelimiter) return null;

  // Alignments: left, center, right
  const alignments: Array<'left' | 'center' | 'right' | null> = delimiterCols.map((c) => {
    const leftColon = c.startsWith(':');
    const rightColon = c.endsWith(':');
    if (leftColon && rightColon) return 'center';
    if (rightColon) return 'right';
    if (leftColon) return 'left';
    return null;
  });

  const headerCells = splitTableRow(headerLine);
  const headerRow: TiptapNode = {
    type: 'tableRow',
    content: headerCells.map((cellText, colIndex) => {
      const inlines = parseInline(cellText, startLine, warnings);
      const align = alignments[colIndex] ?? undefined;
      return {
        type: 'tableHeader',
        attrs: {
          colspan: 1,
          rowspan: 1,
          colwidth: null,
          ...(align ? { align } : {}),
        },
        content: [
          {
            type: 'paragraph',
            content: inlines.length > 0 ? inlines : [{ type: 'text', text: cellText || ' ' }],
          },
        ],
      };
    }),
  };

  const bodyRows: TiptapNode[] = [];
  let consumed = 2;

  for (let i = 2; i < lines.length; i++) {
    const rowLine = lines[i] ?? '';
    if (!rowLine.trim() || !rowLine.includes('|')) break;

    const rowCells = splitTableRow(rowLine);
    if (rowCells.length > headerCells.length) {
      warnings.push({
        type: 'syntax',
        line: startLine + i,
        message: `表格第 ${i + 1} 行单元格超出表头列数，多余单元格已合并至最后一列。`,
      });
    }

    bodyRows.push({
      type: 'tableRow',
      content: headerCells.map((_, colIndex) => {
        let cellText = rowCells[colIndex] ?? '';
        if (colIndex === headerCells.length - 1 && rowCells.length > headerCells.length) {
          cellText = rowCells.slice(headerCells.length - 1).join(' | ');
        }
        const inlines = parseInline(cellText, startLine + i, warnings);
        const align = alignments[colIndex] ?? undefined;
        return {
          type: 'tableCell',
          attrs: {
            colspan: 1,
            rowspan: 1,
            colwidth: null,
            ...(align ? { align } : {}),
          },
          content: [
            {
              type: 'paragraph',
              content: inlines.length > 0 ? inlines : [{ type: 'text', text: cellText || ' ' }],
            },
          ],
        };
      }),
    });
    consumed++;
  }

  return {
    tableNode: {
      type: 'table',
      content: [headerRow, ...bodyRows],
    },
    consumedLines: consumed,
  };
}

type ParsedListItem = {
  indent: number;
  isOrdered: boolean;
  orderNumber?: number | undefined;
  textLines: string[];
  lineNumber: number;
  children: ParsedListItem[];
};

function countIndent(line: string): number {
  let count = 0;
  for (let j = 0; j < line.length; j++) {
    if (line[j] === ' ') count += 1;
    else if (line[j] === '\t') count += 2;
    else break;
  }
  return count;
}

function parseListItemLine(line: string): {
  indent: number;
  isOrdered: boolean;
  orderNumber?: number | undefined;
  text: string;
} | null {
  const match = /^(\s*)([-*+]|(\d+)\.)\s+(.*)$/.exec(line);
  if (!match) return null;
  const indent = countIndent(match[1] ?? '');
  const bullet = match[2] ?? '';
  const isOrdered = /^\d+\.$/.test(bullet);
  const orderNumber = isOrdered ? parseInt(bullet, 10) : undefined;
  const text = match[4] ?? '';
  return { indent, isOrdered, orderNumber, text };
}

function convertListItemsToNodes(
  items: ParsedListItem[],
  warnings: MarkdownImportWarning[],
): TiptapNode[] {
  if (items.length === 0) return [];

  const nodes: TiptapNode[] = [];
  let currentGroup: ParsedListItem[] = [];
  let currentIsOrdered: boolean | null = null;

  const flushGroup = () => {
    if (currentGroup.length === 0 || currentIsOrdered === null) return;
    const isOrdered = currentIsOrdered;
    const startNum =
      isOrdered && currentGroup[0]?.orderNumber && currentGroup[0].orderNumber > 0
        ? currentGroup[0].orderNumber
        : 1;

    const listItems: TiptapNode[] = currentGroup.map((item) => {
      const fullText = item.textLines.join(' ');
      const inlines = parseInline(fullText, item.lineNumber, warnings);
      const paragraphNode: TiptapNode = {
        type: 'paragraph',
        content: inlines.length > 0 ? inlines : [{ type: 'text', text: fullText || ' ' }],
      };

      const childListNodes = convertListItemsToNodes(item.children, warnings);

      return {
        type: 'listItem',
        content: [paragraphNode, ...childListNodes],
      };
    });

    nodes.push({
      type: isOrdered ? 'orderedList' : 'bulletList',
      ...(isOrdered ? { attrs: { start: startNum } } : {}),
      content: listItems,
    });

    currentGroup = [];
    currentIsOrdered = null;
  };

  for (const item of items) {
    if (currentIsOrdered !== null && currentIsOrdered !== item.isOrdered) {
      flushGroup();
    }
    currentIsOrdered = item.isOrdered;
    currentGroup.push(item);
  }
  flushGroup();

  return nodes;
}

function parseListBlock(
  lines: string[],
  startIndex: number,
  warnings: MarkdownImportWarning[],
): { listNodes: TiptapNode[]; consumedLines: number } {
  const rootItems: ParsedListItem[] = [];
  const stack: ParsedListItem[] = [];
  let idx = startIndex;

  while (idx < lines.length) {
    const line = lines[idx] ?? '';
    const itemMatch = parseListItemLine(line);

    if (itemMatch) {
      const newItem: ParsedListItem = {
        indent: itemMatch.indent,
        isOrdered: itemMatch.isOrdered,
        orderNumber: itemMatch.orderNumber,
        textLines: [itemMatch.text],
        lineNumber: idx + 1,
        children: [],
      };

      while (stack.length > 0 && stack[stack.length - 1]!.indent >= newItem.indent) {
        stack.pop();
      }

      if (stack.length > 0) {
        stack[stack.length - 1]!.children.push(newItem);
      } else {
        rootItems.push(newItem);
      }
      stack.push(newItem);
      idx++;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      let lookahead = idx + 1;
      while (lookahead < lines.length && !lines[lookahead]!.trim()) {
        lookahead++;
      }
      if (lookahead < lines.length) {
        const nextLine = lines[lookahead]!;
        const nextMatch = parseListItemLine(nextLine);
        const nextIndent = countIndent(nextLine);
        if (nextMatch || nextIndent >= 2) {
          idx++;
          continue;
        }
      }
      break;
    }

    if (
      trimmed.startsWith('#') ||
      trimmed.startsWith('```') ||
      trimmed.startsWith('>') ||
      trimmed.startsWith('|') ||
      /^(?:---|\*\*\*|___)\s*$/.test(trimmed)
    ) {
      break;
    }

    const lineIndent = countIndent(line);
    if (stack.length > 0 && lineIndent >= 2) {
      stack[stack.length - 1]!.textLines.push(trimmed);
      idx++;
      continue;
    }

    break;
  }

  const listNodes = convertListItemsToNodes(rootItems, warnings);
  return {
    listNodes,
    consumedLines: Math.max(1, idx - startIndex),
  };
}

export function parseMarkdownToTiptap(rawContent: string, filename = ''): MarkdownConversionResult {
  const content = stripBom(rawContent);
  const { frontMatter, body } = parseFrontMatter(content);
  const warnings: MarkdownImportWarning[] = [];

  const lines = body.split(/\r?\n/);
  const nodes: TiptapNode[] = [];

  let firstH1Title: string | null = null;
  let firstH1Index = -1;
  let firstParagraphText: string | null = null;

  // Scan first H1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const h1Match = /^#\s+(.+)$/.exec(line.trim());
    if (h1Match && firstH1Title === null) {
      firstH1Title = h1Match[1]?.trim() ?? '';
      firstH1Index = i;
      break;
    }
  }

  // Determine Title: Front matter title -> First H1 -> Filename -> Fallback
  const lastSep = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
  const cleanName = lastSep >= 0 ? filename.slice(lastSep + 1) : filename;
  const baseFilenameTitle = cleanName.replace(/\.(?:md|markdown|txt)$/i, '').trim();

  const title =
    (typeof frontMatter.title === 'string' && frontMatter.title.trim()) ||
    firstH1Title ||
    baseFilenameTitle ||
    '无标题笔记';

  // If first H1 matches the identified title, omit it so title isn't duplicated
  const omitFirstH1 = firstH1Title !== null && firstH1Title === title;

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Skip the duplicate first H1 if needed
    if (i === firstH1Index && omitFirstH1) {
      i++;
      continue;
    }

    // 1. Fenced Code Block: ```lang
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // Skip closing ```
      const codeContent = codeLines.join('\n');
      nodes.push({
        type: 'codeBlock',
        attrs: { language: lang || null },
        content: codeContent ? [{ type: 'text', text: codeContent }] : [],
      });
      continue;
    }

    // 2. Table
    if (
      trimmed.startsWith('|') ||
      (trimmed.includes('|') && i + 1 < lines.length && lines[i + 1]!.includes('|'))
    ) {
      const tableRes = parseTable(lines.slice(i), i + 1, warnings);
      if (tableRes) {
        nodes.push(tableRes.tableNode);
        i += tableRes.consumedLines;
        continue;
      }
    }

    // 3. Headings: # to ######
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const headingText = headingMatch[2]!.trim();
      const inlines = parseInline(headingText, i + 1, warnings);
      nodes.push({
        type: 'heading',
        attrs: { level },
        content: inlines.length > 0 ? inlines : [{ type: 'text', text: headingText }],
      });
      i++;
      continue;
    }

    // 4. Horizontal Rule: ---, ***, ___
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      nodes.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    // 5. Blockquote: > line
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i]!.trim().startsWith('>') || (lines[i]!.trim() && quoteLines.length > 0))
      ) {
        if (!lines[i]!.trim()) break;
        quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ''));
        i++;
      }
      const quoteText = quoteLines.join(' ');
      const inlines = parseInline(quoteText, i, warnings);
      nodes.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: inlines.length > 0 ? inlines : [{ type: 'text', text: quoteText }],
          },
        ],
      });
      continue;
    }

    // 6. Lists
    if (parseListItemLine(rawLine)) {
      const listRes = parseListBlock(lines, i, warnings);
      nodes.push(...listRes.listNodes);
      i += listRes.consumedLines;
      continue;
    }

    // 7. Regular Paragraph
    const paraLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i] ?? '';
      const pTrim = pLine.trim();
      if (!pTrim) break;
      if (
        pTrim.startsWith('```') ||
        pTrim.startsWith('#') ||
        pTrim.startsWith('>') ||
        pTrim.startsWith('|') ||
        parseListItemLine(pLine) !== null ||
        /^(?:---|\*\*\*|___)\s*$/.test(pTrim)
      ) {
        break;
      }
      paraLines.push(pTrim);
      i++;
    }

    if (paraLines.length > 0) {
      const paraText = paraLines.join(' ');
      if (firstParagraphText === null) {
        firstParagraphText = paraText;
      }
      const inlines = parseInline(paraText, i, warnings);
      nodes.push({
        type: 'paragraph',
        content: inlines.length > 0 ? inlines : [{ type: 'text', text: paraText }],
      });
    }
  }

  // Fallback for empty document
  if (nodes.length === 0) {
    nodes.push({ type: 'paragraph', content: [{ type: 'text', text: '空笔记内容' }] });
  }

  const rawDocument: TiptapDocument = {
    type: 'doc',
    content: nodes,
  };

  const documentJson = JSON.stringify(rawDocument);
  const contentText = projectDocumentText(rawDocument);

  // Summary: Front matter -> first paragraph (truncated to 140 chars) -> fallback
  let summary = '';
  if (typeof frontMatter.summary === 'string' && frontMatter.summary.trim()) {
    summary = frontMatter.summary.trim();
  } else if (firstParagraphText) {
    summary =
      firstParagraphText.length > 140 ? `${firstParagraphText.slice(0, 137)}…` : firstParagraphText;
  }

  // Category: Front matter -> default
  const category =
    typeof frontMatter.category === 'string' && frontMatter.category.trim()
      ? frontMatter.category.trim()
      : '通用';

  // Tags: Front matter -> empty
  let tags: string[] = [];
  if (Array.isArray(frontMatter.tags)) {
    tags = frontMatter.tags
      .map(String)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // PublishedAt & Featured
  const publishedAt =
    typeof frontMatter.publishedAt === 'string' && frontMatter.publishedAt
      ? frontMatter.publishedAt
      : null;
  const isFeatured = Boolean(frontMatter.selected ?? frontMatter.isFeatured ?? false);

  const slug =
    typeof frontMatter.slug === 'string' && frontMatter.slug.trim()
      ? slugify(frontMatter.slug)
      : slugify(title);

  return {
    metadata: {
      title,
      summary,
      category,
      tags,
      publishedAt,
      isFeatured,
      slug,
    },
    document: rawDocument,
    documentJson,
    contentText,
    warnings,
  };
}
