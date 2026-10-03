import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseMarkdownToTiptap } from './markdown-converter';
import { parseTiptapDocument } from '../../../functions/lib/notes';

describe('parseMarkdownToTiptap', () => {
  it('preserves private images as validated block nodes and leaves fenced examples as code', () => {
    const source =
      'Before\n![shot](/api/assets/asset-1?inline=1)\nAfter\n\n```md\n![example](/api/assets/asset-2?inline=1)\n```';
    const result = parseMarkdownToTiptap(source, 'images.md', { preserveFirstHeading: true });
    const doc = parseTiptapDocument(result.documentJson);
    expect(doc.content![1]).toEqual({ type: 'image', attrs: { assetId: 'asset-1', alt: 'shot' } });
    expect(doc.content![3]!.type).toBe('codeBlock');
  });
  it('successfully converts the sample english reading training plan into a valid Tiptap document', () => {
    const filePath = resolve(
      process.cwd(),
      '../../content/posts/english-reading-training-plan/index.md',
    );
    const content = readFileSync(filePath, 'utf8');

    const result = parseMarkdownToTiptap(content, 'index.md');

    // Metadata checks
    expect(result.metadata.title).toBe('考研英语阅读四周强化训练计划');
    expect(result.metadata.category).toBe('英语学习');
    expect(result.metadata.tags).toEqual(['考研英语', '阅读理解', '学习计划', '错题复盘']);
    expect(result.metadata.isFeatured).toBe(true);
    expect(result.metadata.publishedAt).toBe('2026-07-17T09:00:00.000Z');
    expect(result.metadata.summary).toContain('四周英语阅读训练方案');

    // Document structure checks
    expect(result.document.type).toBe('doc');
    const tableNodes = result.document.content.filter((n) => n.type === 'table');
    expect(tableNodes.length).toBeGreaterThanOrEqual(3);

    // Headings checks: first H1 matching title was omitted, H2s remain
    const h1Nodes = result.document.content.filter(
      (n) => n.type === 'heading' && n.attrs?.level === 1,
    );
    expect(h1Nodes).toHaveLength(0);

    const h2Nodes = result.document.content.filter(
      (n) => n.type === 'heading' && n.attrs?.level === 2,
    );
    expect(h2Nodes.length).toBeGreaterThanOrEqual(4);

    // Verify it passes strict authoritative Tiptap validation
    expect(() => parseTiptapDocument(result.documentJson)).not.toThrow();

    // Verify text projection includes table text
    expect(result.contentText).toContain('核心任务');
    expect(result.contentText).toContain('基线测试');
  });

  it('handles UTF-8 BOM, table column alignment, and inline formatting', () => {
    const raw =
      '\uFEFF| 左对齐 | 居中 | 右对齐 |\n|:---|:---:|---:|\n| **加粗** | [链接](https://example.com) | `代码` |';
    const result = parseMarkdownToTiptap(raw, 'test-doc.md');

    expect(result.metadata.title).toBe('test-doc');
    const table = result.document.content.find((n) => n.type === 'table');
    expect(table).toBeDefined();

    const headerRow = table?.content?.[0];
    expect(headerRow?.content?.[0]?.attrs?.align).toBe('left');
    expect(headerRow?.content?.[1]?.attrs?.align).toBe('center');
    expect(headerRow?.content?.[2]?.attrs?.align).toBe('right');

    const bodyRow = table?.content?.[1];
    const boldText = bodyRow?.content?.[0]?.content?.[0]?.content?.[0];
    expect(boldText?.marks).toEqual([{ type: 'bold' }]);

    const linkText = bodyRow?.content?.[1]?.content?.[0]?.content?.[0];
    expect(linkText?.marks).toEqual([{ type: 'link', attrs: { href: 'https://example.com' } }]);
  });

  it('preserves first H1 if it differs from Front Matter title', () => {
    const raw = '---\ntitle: 元数据标题\n---\n\n# 正文不同的H1标题\n\n正文段落。';
    const result = parseMarkdownToTiptap(raw, 'note.md');

    expect(result.metadata.title).toBe('元数据标题');
    const h1 = result.document.content.find((n) => n.type === 'heading' && n.attrs?.level === 1);
    expect(h1).toBeDefined();
  });

  it('detects images and math formulas, generating compatibility warnings without failing', () => {
    const raw = '段落含图片 ![架构图](./images/arch.png) 与公式 $E=mc^2$。';
    const result = parseMarkdownToTiptap(raw, 'doc.md');

    expect(result.warnings.some((w) => w.type === 'image')).toBe(true);
    expect(result.warnings.some((w) => w.type === 'math')).toBe(true);
    expect(() => parseTiptapDocument(result.documentJson)).not.toThrow();
  });

  it('preserves indented continuation lines in lists without dropping content', () => {
    const raw = `
- 列表第一项
  这是第一项的缩进续行，必须被保留而不能丢弃
- 列表第二项
  这是第二项的补充说明
`;
    const result = parseMarkdownToTiptap(raw, 'list-continuation.md');
    expect(() => parseTiptapDocument(result.documentJson)).not.toThrow();
    expect(result.contentText).toContain('缩进续行，必须被保留而不能丢弃');
    expect(result.contentText).toContain('这是第二项的补充说明');
  });

  it('preserves nested lists hierarchically instead of flattening them', () => {
    const raw = `
- 一级项目 1
  - 二级子项目 1.1
  - 二级子项目 1.2
- 一级项目 2
`;
    const result = parseMarkdownToTiptap(raw, 'nested-list.md');
    expect(() => parseTiptapDocument(result.documentJson)).not.toThrow();

    const rootList = result.document.content.find((n) => n.type === 'bulletList');
    expect(rootList).toBeDefined();
    expect(rootList?.content).toHaveLength(2);

    const firstItem = rootList?.content?.[0];
    expect(firstItem?.type).toBe('listItem');
    // First item should have paragraph and nested bulletList
    const childList = firstItem?.content?.find((n) => n.type === 'bulletList');
    expect(childList).toBeDefined();
    expect(childList?.content).toHaveLength(2);
    expect(result.contentText).toContain('二级子项目 1.1');
    expect(result.contentText).toContain('二级子项目 1.2');
  });

  it('correctly handles table cells with escaped pipes without column shifting or content loss', () => {
    const raw = `
| 编号 | 表达式 | 描述 |
|---|---|---|
| 1 | a \\| b | 包含转义竖线的单元格 |
| 2 | c | 普通单元格 |
`;
    const result = parseMarkdownToTiptap(raw, 'escaped-pipe-table.md');
    expect(() => parseTiptapDocument(result.documentJson)).not.toThrow();

    const table = result.document.content.find((n) => n.type === 'table');
    expect(table).toBeDefined();

    const bodyRow1 = table?.content?.[1];
    expect(bodyRow1?.content).toHaveLength(3);
    const middleCell = bodyRow1?.content?.[1];
    const middleText = middleCell?.content?.[0]?.content?.[0]?.text;
    expect(middleText).toContain('|');
    const lastCell = bodyRow1?.content?.[2];
    const lastText = lastCell?.content?.[0]?.content?.[0]?.text;
    expect(lastText).toBe('包含转义竖线的单元格');
    expect(result.contentText).toContain('包含转义竖线的单元格');
  });

  it('preserves custom start number for ordered lists starting at e.g. 5.', () => {
    const raw = `
5. 第五步推导
6. 第六步推导
`;
    const result = parseMarkdownToTiptap(raw, 'ordered-start.md');
    expect(() => parseTiptapDocument(result.documentJson)).not.toThrow();

    const orderedList = result.document.content.find((n) => n.type === 'orderedList');
    expect(orderedList).toBeDefined();
    expect(orderedList?.attrs?.start).toBe(5);
    expect(orderedList?.content).toHaveLength(2);
  });

  it('generates warnings for HTML tags and retains readable text', () => {
    const raw = '这是一段包含 <span>强调文本</span> 和 <div class="box">容器文本</div> 的内容。';
    const result = parseMarkdownToTiptap(raw, 'html-warning.md');
    expect(() => parseTiptapDocument(result.documentJson)).not.toThrow();

    expect(result.warnings.some((w) => w.type === 'html')).toBe(true);
    expect(result.contentText).toContain('强调文本');
    expect(result.contentText).toContain('容器文本');
  });

  it('never hangs or loops infinitely on lines with pipe characters or malformed tables', () => {
    const malformed = `
| 仅仅是一行以竖线开头的文字
| 另一行文字 | 没有第二行分隔线
一些普通段落文字 | 包含竖线

| 表头1 | 表头2 |
普通文字打断了表格
`;
    const result = parseMarkdownToTiptap(malformed, 'pipe-test.md');
    expect(result.document.content.length).toBeGreaterThan(0);
    expect(() => parseTiptapDocument(result.documentJson)).not.toThrow();
  });

  it('preserves multi-line and single-line block math formula blocks intact', () => {
    const markdown = `
# 数学章节

单行公式块：
$$E = mc^2$$

多行公式块：
$$
(f * g)[n] = \\sum_{k=-\\infty}^{\\infty} f[k] g[n - k]
$$

正文包含行内公式 $x[n]$ 和说明。
`;
    const result = parseMarkdownToTiptap(markdown, 'math-doc.md');
    expect(() => parseTiptapDocument(result.documentJson)).not.toThrow();
    expect(result.warnings.filter((w) => w.type === 'math').length).toBeGreaterThanOrEqual(3);
    expect(result.contentText).toContain('E = mc^2');
    expect(result.contentText).toContain('\\sum_{k=-\\infty}^{\\infty}');
    expect(result.contentText).toContain('$x[n]$');
  });
});
