import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';

describe('Input', () => {
  it('associates its visible label and validation message with the native input', () => {
    render(<Input error="A title is required" id="article-title" label="Article title" />);

    const input = screen.getByRole('textbox', { name: 'Article title' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('A title is required');
  });

  it('keeps validation semantics authoritative when callers pass conflicting ARIA props', () => {
    render(
      <Input
        aria-describedby="untrusted-description"
        aria-invalid={false}
        error="A title is required"
        id="article-title"
        label="Article title"
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Article title' });
    expect(input).toHaveAttribute('aria-describedby', 'article-title-message');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
