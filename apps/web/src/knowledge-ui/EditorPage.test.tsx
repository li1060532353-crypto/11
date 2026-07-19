import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AssetPanel } from './AssetPanel';
import { EditorPage } from './EditorPage';
import { editorFixture } from './editor-fixtures';

describe('EditorPage presentation', () => {
  it('renders accessible title and document controls from props', () => {
    const onTitleChange = vi.fn();
    const onContentChange = vi.fn();

    render(
      <EditorPage
        model={editorFixture}
        state="unsaved"
        onTitleChange={onTitleChange}
        onContentChange={onContentChange}
        documentSlot={<div data-testid="document-slot">Document preview slot</div>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit knowledge note' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue(editorFixture.title);
    expect(screen.getByTestId('document-slot')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Document' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed title' } });
    expect(onTitleChange).toHaveBeenCalledWith('Changed title');

    const { rerender } = render(<EditorPage model={editorFixture} onContentChange={onContentChange} />);
    fireEvent.input(screen.getByRole('textbox', { name: 'Document' }), { target: { value: '{"type":"doc"}' } });
    expect(onContentChange).toHaveBeenCalledWith('{"type":"doc"}');
    rerender(<EditorPage model={editorFixture} />);
  });

  it('exposes all semantic highlight actions and the selected action', () => {
    const onHighlight = vi.fn();
    const onRemoveHighlight = vi.fn();

    render(<EditorPage model={editorFixture} selectedHighlight="mastered" onHighlight={onHighlight} onRemoveHighlight={onRemoveHighlight} />);

    for (const kind of ['Core', 'Mistake', 'Mastered', 'Method', 'Investigate']) {
      expect(screen.getByRole('button', { name: kind })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Mastered' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Core' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove highlight' }));
    expect(onHighlight).toHaveBeenCalledWith('core');
    expect(onRemoveHighlight).toHaveBeenCalledTimes(1);
  });

  it.each(['unchanged', 'unsaved', 'saving', 'saved', 'failed'] as const)('shows the %s save state', (state) => {
    render(<EditorPage model={editorFixture} state={state} />);
    expect(screen.getByRole('status')).toHaveTextContent({ unchanged: 'No changes', unsaved: 'Unsaved changes', saving: 'Saving', saved: 'Saved', failed: 'Save failed' }[state]);
  });

  it('keeps manual save and Save Version as separate injected callbacks', () => {
    const onSave = vi.fn();
    const onSaveVersion = vi.fn();
    render(<EditorPage model={editorFixture} state="saved" onSave={onSave} onSaveVersion={onSaveVersion} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Version' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSaveVersion).toHaveBeenCalledTimes(1);
  });
});

describe('AssetPanel presentation', () => {
  it('renders an empty attachment state and controlled upload input', () => {
    const onUpload = vi.fn();
    render(<AssetPanel assets={[]} onUpload={onUpload} />);

    expect(screen.getByText('No attachments yet')).toBeInTheDocument();
    const input = screen.getByLabelText('Upload attachment');
    expect(input).toHaveAttribute('type', 'file');
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('renders uploading, success, error, and download states', () => {
    const onDownload = vi.fn();
    render(
      <AssetPanel
        assets={[
          { id: 'uploading', name: 'draft.pdf', sizeLabel: '1 KB', state: 'uploading', progress: 45 },
          { id: 'ready', name: 'reference.pdf', sizeLabel: '2 KB', state: 'ready' },
          { id: 'failed', name: 'broken.pdf', sizeLabel: '3 KB', state: 'error', errorMessage: 'Upload failed' },
        ]}
        onDownload={onDownload}
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'Uploading draft.pdf' })).toHaveValue(45);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed');
    fireEvent.click(screen.getByRole('button', { name: 'Download reference.pdf' }));
    expect(onDownload).toHaveBeenCalledWith('ready');
  });

  it('requires confirmation and supports cancel and confirm callbacks', () => {
    const onDelete = vi.fn();
    render(
      <AssetPanel
        assets={[{ id: 'ready', name: 'reference.pdf', sizeLabel: '2 KB', state: 'ready' }]}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete reference.pdf' }));
    expect(screen.getByRole('dialog', { name: 'Delete reference.pdf' })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete reference.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(onDelete).toHaveBeenCalledWith('ready');
  });

  it('moves focus into the delete dialog, supports Escape, and restores the trigger focus', () => {
    render(<AssetPanel assets={[{ id: 'ready', name: 'reference.pdf', sizeLabel: '2 KB', state: 'ready' }]} onDelete={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Delete reference.pdf' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Confirm delete' }), { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps controls keyboard accessible and makes no network calls', () => {
    const onDelete = vi.fn();
    const onDownload = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <AssetPanel
        assets={[{ id: 'ready', name: 'reference.pdf', sizeLabel: '2 KB', state: 'ready' }]}
        onDelete={onDelete}
        onDownload={onDownload}
      />,
    );
    screen.getByRole('button', { name: 'Download reference.pdf' }).focus();
    fireEvent.click(screen.getByRole('button', { name: 'Download reference.pdf' }));
    expect(onDownload).toHaveBeenCalledWith('ready');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('/api/');
    fetchSpy.mockRestore();
  });
});
