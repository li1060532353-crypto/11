import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { extractHeadings, MarkdownRenderer } from './MarkdownRenderer';
import { TableOfContents } from './TableOfContents';

describe('TableOfContents', () => {
  it('marks the current heading link for an active-section treatment', () => {
    window.history.replaceState(null, '', '#details');

    render(
      <TableOfContents
        headings={[
          { id: 'overview', level: 2, text: 'Overview' },
          { id: 'details', level: 3, text: 'Details' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    window.history.replaceState(null, '', '/');
  });

  it('links extracted h2 and h3 headings to matching stable IDs', () => {
    const headings = extractHeadings(`
# 页面标题

## 第一节

### 细节

\`\`\`md
## 代码块里的标题
\`\`\`

## 第一节
`);

    render(<TableOfContents headings={headings} />);

    expect(screen.getByRole('navigation', { name: '文章目录' })).toBeInTheDocument();
    expect(screen.getByText('目录').closest('details')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '第一节' })[0]).toHaveAttribute('href', '#第一节');
    expect(screen.getByRole('link', { name: '细节' })).toHaveAttribute('href', '#细节');
    expect(screen.getAllByRole('link', { name: '第一节' })[1]).toHaveAttribute('href', '#第一节-2');
    expect(screen.queryByRole('link', { name: '代码块里的标题' })).toBeNull();
  });

  it('derives TOC links and rendered IDs from the same Markdown AST', () => {
    const source = `\`\`\`bad\`info
## Invalid-info heading

- list item
---

Setext section
---

### ATX section

\`\`\`\`md
\`\`\`
## fenced heading
\`\`\`\`

## Actual section`;
    const headings = extractHeadings(source);

    const { container } = render(
      <>
        <TableOfContents headings={headings} />
        <section aria-label="Rendered Markdown">
          <MarkdownRenderer source={source} />
        </section>
      </>,
    );

    const renderedRegion = screen.getByRole('region', { name: 'Rendered Markdown' });
    const renderedHeadings = within(renderedRegion).getAllByRole('heading', { level: 2 });
    const renderedSubheadings = within(renderedRegion).getAllByRole('heading', { level: 3 });
    const renderedIds = [...renderedHeadings, ...renderedSubheadings].map((heading) => heading.id);
    const tocLinks = within(screen.getByRole('navigation', { name: '文章目录' })).getAllByRole(
      'link',
    );
    const tocIds = tocLinks.map((link) => link.getAttribute('href')?.slice(1));

    expect(headings.map((heading) => heading.text)).toEqual([
      'Invalid-info heading',
      'Setext section',
      'ATX section',
      'Actual section',
    ]);
    expect(renderedIds.sort()).toEqual(tocIds.sort());
    expect(container.querySelectorAll('h2, h3')).toHaveLength(tocLinks.length);
    expect(screen.queryByRole('link', { name: 'fenced heading' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'list item' })).toBeNull();
  });

  it('normalizes INPUT to a deterministic lowercase ID', () => {
    expect(extractHeadings('## INPUT')).toEqual([{ id: 'input', level: 2, text: 'INPUT' }]);
  });
});
