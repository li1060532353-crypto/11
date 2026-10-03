import { describe, expect, it } from 'vitest';
import type { TiptapDocument } from '@namdw/shared';

import {
  extractHeadings,
  extractHeadingsFromDocument,
  slugBase,
} from './headingExtractor';

describe('headingExtractor', () => {
  describe('slugBase', () => {
    it('normalizes text and strips punctuation', () => {
      expect(slugBase('Hello, World!')).toBe('hello-world');
      expect(slugBase('  系统架构 101  ')).toBe('系统架构-101');
      expect(slugBase('!@#$%^&*()')).toBe('section');
    });
  });

  describe('extractHeadings (Markdown AST)', () => {
    it('extracts h2 and h3 while ignoring h1, h4, and other blocks', () => {
      const markdown = `
# Title (ignored)
Paragraph text.

## Section One
Some content.

### Subsection 1.1
Details.

#### Sub-sub section (ignored)
Ignore this.

## Section One
Duplicate section.

### Subsection 1.1
Duplicate subsection.
`;
      const headings = extractHeadings(markdown);
      expect(headings).toEqual([
        { id: 'section-one', level: 2, text: 'Section One' },
        { id: 'subsection-11', level: 3, text: 'Subsection 1.1' },
        { id: 'section-one-2', level: 2, text: 'Section One' },
        { id: 'subsection-11-2', level: 3, text: 'Subsection 1.1' },
      ]);
    });

    it('handles math formulas inside heading text via AST parser', () => {
      const markdown = '## 公式 $E = mc^2$ 的推导';
      const headings = extractHeadings(markdown);
      expect(headings).toHaveLength(1);
      expect(headings[0]?.level).toBe(2);
      expect(headings[0]?.text).toContain('E = mc^2');
    });
  });

  describe('extractHeadingsFromDocument (Tiptap AST)', () => {
    it('extracts level 2 and 3 headings from document object and JSON string', () => {
      const doc: TiptapDocument = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Document Title' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Overview' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Paragraph' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Details' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Overview' }],
          },
        ],
      };

      const fromObject = extractHeadingsFromDocument(doc);
      const fromJson = extractHeadingsFromDocument(JSON.stringify(doc));

      const expected = [
        { id: 'overview', level: 2, text: 'Overview' },
        { id: 'details', level: 3, text: 'Details' },
        { id: 'overview-2', level: 2, text: 'Overview' },
      ];

      expect(fromObject).toEqual(expected);
      expect(fromJson).toEqual(expected);
    });

    it('returns empty array on invalid JSON or non-doc structure', () => {
      expect(extractHeadingsFromDocument('invalid json{')).toEqual([]);
      expect(extractHeadingsFromDocument('' as never)).toEqual([]);
      expect(extractHeadingsFromDocument({ type: 'doc' } as never)).toEqual([]);
    });
  });
});
