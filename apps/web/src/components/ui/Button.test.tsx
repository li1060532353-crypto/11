import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('uses a native button and preserves its accessible name and disabled state', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick} variant="primary">
        Save article
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save article' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('ui-button--primary');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
