import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  it('renders children inside a pre element', () => {
    render(
      <CodeBlock>
        <code>console.log("test")</code>
      </CodeBlock>,
    );
    expect(screen.getByText('console.log("test")')).toBeInTheDocument();
  });

  it('shows a copy button with accessible label', () => {
    render(
      <CodeBlock>
        <code>hello</code>
      </CodeBlock>,
    );
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument();
  });

  it('copies text content and shows "Copied!" feedback', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(
      <CodeBlock>
        <code>const x = 42;</code>
      </CodeBlock>,
    );

    await user.click(screen.getByRole('button', { name: '复制代码' }));

    expect(writeText).toHaveBeenCalledWith('const x = 42;');
    expect(screen.getByRole('button', { name: '已复制' })).toBeInTheDocument();
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('recovers from clipboard API failure gracefully', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
      configurable: true,
    });

    render(
      <CodeBlock>
        <code>code</code>
      </CodeBlock>,
    );

    await user.click(screen.getByRole('button', { name: '复制代码' }));

    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
