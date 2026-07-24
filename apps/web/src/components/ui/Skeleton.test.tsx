import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('announces loading while hiding the decorative placeholder', () => {
    render(<Skeleton aria-label="Loading article" />);

    expect(screen.getByRole('status', { name: 'Loading article' })).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-shape')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps status semantics authoritative when callers pass conflicting props', () => {
    render(<Skeleton aria-label="Loading article" aria-live="off" role="presentation" />);

    expect(screen.getByRole('status', { name: 'Loading article' })).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });
});
