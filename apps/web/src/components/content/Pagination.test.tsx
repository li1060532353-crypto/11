import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('preserves query keys and omits taxonomy keys represented by a route', () => {
    render(
      <MemoryRouter>
        <Pagination
          page={2}
          totalPages={3}
          pathname="/categories/embedded"
          search="?category=embedded&tag=STM32&year=2026&page=2"
          excludedKeys={['category']}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '上一页' })).toHaveAttribute(
      'href',
      '/categories/embedded?tag=STM32&year=2026',
    );
    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute(
      'href',
      '/categories/embedded?tag=STM32&year=2026&page=3',
    );
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute('aria-current', 'page');
  });
});
