import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WorkbenchSchematic } from './WorkbenchSchematic';

describe('workbench drawing controls', () => {
  it('lets keyboard users collapse and restore the structure without navigating', async () => {
    const user = userEvent.setup();
    render(<WorkbenchSchematic />);
    const toggle = screen.getByRole('button', { name: '分层展开' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: '芯片分层结构图' })).toBeInTheDocument();
    await user.tab();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveFocus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
