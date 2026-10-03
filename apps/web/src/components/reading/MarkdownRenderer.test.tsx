import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { extractHeadings, MarkdownRenderer } from './MarkdownRenderer';

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

  it('renders markdown images with their alt text, source path, and lazy/async loading attributes', () => {
    render(<MarkdownRenderer source={'![System diagram](/content-media/hello-static-blog/diagram.png)'} />);

    const img = screen.getByRole('img', { name: 'System diagram' });
    expect(img).toHaveAttribute(
      'src',
      '/content-media/hello-static-blog/diagram.png',
    );
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveStyle({ maxWidth: '100%', height: 'auto' });
  });

  it('re-exports extractHeadings preserving backward compatibility', () => {
    const headings = extractHeadings('## 第一节\n### 小节 A\n## 第一节');
    expect(headings).toEqual([
      { id: '第一节', level: 2, text: '第一节' },
      { id: '小节-a', level: 3, text: '小节 A' },
      { id: '第一节-2', level: 2, text: '第一节' },
    ]);
  });
});
