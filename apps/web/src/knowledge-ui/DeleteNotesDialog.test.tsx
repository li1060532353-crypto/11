import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeleteNotesDialog } from './DeleteNotesDialog';

describe('DeleteNotesDialog', () => {
  it('defaults to cancel, traps focus, and allows Escape without deleting', () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    render(
      <DeleteNotesDialog titles={['文章甲', '文章乙']} onConfirm={confirm} onCancel={cancel} />,
    );
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('删除 2 篇文章？');
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: '移入回收站' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });
  it('blocks duplicate submission and dismissal until the request resolves', async () => {
    let resolve!: () => void;
    const confirm = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const cancel = vi.fn();
    render(<DeleteNotesDialog titles={['文章甲']} onConfirm={confirm} onCancel={cancel} />);
    const button = screen.getByRole('button', { name: '移入回收站' });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '正在移入回收站…' })).toBeDisabled();
    await act(async () => resolve());
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('shows a failure and retains confirmation for retry', async () => {
    const cancel = vi.fn();
    render(
      <DeleteNotesDialog
        titles={['文章甲']}
        onConfirm={vi.fn().mockRejectedValue(new Error())}
        onCancel={cancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '移入回收站' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('删除失败'));
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '移入回收站' })).toBeEnabled();
  });
});
