import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('renders GFM, code, math, and links without rendering raw HTML elements', () => {
    const source = `# 标题

| 项目 | 状态 |
| --- | --- |
| 阅读器 | 安全 |

\`\`\`ts
const safe = true;
\`\`\`

行内公式 $E = mc^2$ 与 [站内文章](/posts/matrix-rank)、[外部资料](https://example.com)。

<script>alert('unsafe')</script>

<iframe src="https://example.com"></iframe>`;

    render(<MarkdownRenderer source={source} />);

    expect(screen.getByRole('heading', { level: 1, name: '标题' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('阅读器')).toBeInTheDocument();
    expect(document.querySelector('pre code')).toHaveTextContent('const safe = true;');
    expect(document.querySelector('.katex')).not.toBeNull();
    expect(screen.getByRole('link', { name: '站内文章' })).toHaveAttribute(
      'href',
      '/posts/matrix-rank',
    );
    expect(screen.getByRole('link', { name: '站内文章' })).not.toHaveAttribute('rel');
    expect(screen.getByRole('link', { name: '外部资料' })).toHaveAttribute('rel', 'noreferrer');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('uses the same deterministic IDs as extracted h2 and h3 headings', () => {
    render(
      <MarkdownRenderer
        source={'# 文档\n\n## 安全 Markdown\n\n### Link & Math\n\n## 安全 Markdown'}
      />,
    );

    expect(screen.getAllByRole('heading', { level: 2, name: '安全 Markdown' })[0]).toHaveAttribute(
      'id',
      '安全-markdown',
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Link & Math' })).toHaveAttribute(
      'id',
      'link-math',
    );
    expect(screen.getAllByRole('heading', { level: 2, name: '安全 Markdown' })[1]).toHaveAttribute(
      'id',
      '安全-markdown-2',
    );
  });
});
