import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { extractHeadingsFromDocument, TiptapRenderer } from './TiptapRenderer';

describe('TiptapRenderer', () => {
  const sampleDoc = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '第一节：概述' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '加粗内容', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' 以及 ' },
          {
            type: 'text',
            text: '外部链接',
            marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
          },
        ],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                attrs: { align: 'center' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '标题栏' }] }],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: { align: 'center' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '单元格内容' }] }],
              },
            ],
          },
        ],
      },
      {
        type: 'codeBlock',
        attrs: { language: 'ts' },
        content: [{ type: 'text', text: 'const x: number = 42;' }],
      },
    ],
  };

  it('renders headings, paragraphs, marks, tables, and code blocks', () => {
    const { container } = render(<TiptapRenderer content={JSON.stringify(sampleDoc)} />);

    const h2 = screen.getByRole('heading', { level: 2, name: '第一节：概述' });
    expect(h2).toHaveAttribute('id');

    expect(screen.getByText('加粗内容').tagName).toBe('STRONG');

    const link = screen.getByRole('link', { name: '外部链接' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', 'noreferrer');

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('标题栏')).toBeInTheDocument();
    expect(screen.getByText('单元格内容')).toBeInTheDocument();

    const code = container.querySelector('code');
    expect(code).toBeInTheDocument();
    expect(code?.textContent).toContain('const x: number = 42;');
  });

  it('extracts table of contents headings matching slugBase ids', () => {
    const headings = extractHeadingsFromDocument(JSON.stringify(sampleDoc));
    expect(headings).toHaveLength(1);
    expect(headings[0]?.text).toBe('第一节：概述');
    expect(headings[0]?.level).toBe(2);
    expect(headings[0]?.id).toBeDefined();
  });
});
