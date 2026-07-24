import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('connects its heading to the empty-state region and retains an actionable link', () => {
    render(
      <MemoryRouter>
        <EmptyState
          description="Try a different query."
          href="/posts"
          linkLabel="Browse articles"
          title="No articles found"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: 'No articles found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse articles' })).toHaveAttribute('href', '/posts');
  });
});
