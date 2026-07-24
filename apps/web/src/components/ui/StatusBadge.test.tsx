import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders a readable status label instead of relying on color alone', () => {
    render(<StatusBadge status="success">Published</StatusBadge>);

    expect(screen.getByText('Published')).toHaveClass('ui-status-badge--success');
  });
});
