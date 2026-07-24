import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('requires and exposes an accessible name for icon-only actions', () => {
    render(
      <IconButton aria-label="Close panel">
        <svg aria-hidden="true" />
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Close panel' })).toHaveClass('ui-icon-button');
  });
});
