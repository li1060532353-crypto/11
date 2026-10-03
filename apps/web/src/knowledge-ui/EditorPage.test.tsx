import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AssetPanel } from './AssetPanel';
import { EditorPage, stateLabels } from './EditorPage';
import { editorFixture } from './editor-fixtures';

describe('EditorPage presentation', () => {
  it('allows long titles to wrap while preserving a single-line title value', () => {
    const onTitleChange = vi.fn();
    render(<EditorPage model={editorFixture} onTitleChange={onTitleChange} />);
    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(title.tagName).toBe('TEXTAREA');
    fireEvent.change(title, { target: { value: 'Long title\ncontinued' } });
    expect(onTitleChange).toHaveBeenCalledWith('Long title continued');
  });
  it('focuses the title and shows an honest initial state for a new document', () => {
    render(<EditorPage model={{ ...editorFixture, id: undefined, title: '' }} isNew onTitleChange={() => {}} />);
    expect(screen.getByLabelText('Title')).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('尚未创建草稿');
  });
  it('does not create a nested main landmark inside the application route shell', () => {
    render(<EditorPage model={editorFixture} />);

    expect(screen.queryAllByRole('main')).toHaveLength(0);
  });

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

    expect(screen.getByRole('heading', { name: '编辑文章' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue(editorFixture.title);
    expect(screen.getByTestId('document-slot')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Document' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed title' } });
    expect(onTitleChange).toHaveBeenCalledWith('Changed title');

    const { rerender } = render(
      <EditorPage model={editorFixture} onContentChange={onContentChange} />,
    );
    fireEvent.input(screen.getByRole('textbox', { name: 'Document' }), {
      target: { value: '{"type":"doc"}' },
    });
    expect(onContentChange).toHaveBeenCalledWith('{"type":"doc"}');
    rerender(<EditorPage model={editorFixture} />);
  });

  it('exposes all semantic highlight actions and the selected action', () => {
    const onHighlight = vi.fn();
    const onRemoveHighlight = vi.fn();

    render(
      <EditorPage
        model={editorFixture}
        selectedHighlight="mastered"
        onHighlight={onHighlight}
        onRemoveHighlight={onRemoveHighlight}
      />,
    );

    for (const kind of ['Core', 'Mistake', 'Mastered', 'Method', 'Investigate']) {
      expect(screen.getByRole('button', { name: kind })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Mastered' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Core' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove highlight' }));
    expect(onHighlight).toHaveBeenCalledWith('core');
    expect(onRemoveHighlight).toHaveBeenCalledTimes(1);
  });

  it.each(['unchanged', 'unsaved', 'saving', 'saved', 'failed'] as const)(
    'shows the %s save state in standard Chinese',
    (state) => {
      render(<EditorPage model={editorFixture} state={state} />);
      const role = state === 'failed' ? 'alert' : 'status';
      expect(screen.getByRole(role)).toHaveTextContent(stateLabels[state]);
    },
  );

  it('keeps manual save and Save Version as separate injected callbacks', () => {
    const onSave = vi.fn();
    const onSaveVersion = vi.fn();
    render(
      <EditorPage
        model={editorFixture}
        state="saved"
        onSave={onSave}
        onSaveVersion={onSaveVersion}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Version' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSaveVersion).toHaveBeenCalledTimes(1);
  });

  it('keeps version feedback in the editor actions and labels attachments clearly', () => {
    render(<EditorPage model={editorFixture} state="saved" versionState="saved" />);

    expect(screen.getByText('快照已保存')).toBeInTheDocument();
    expect(
      screen.getByText(
        '上传的资源附件供当前文章管理与正文引用使用。支持 PNG, JPG, WebP, GIF, PDF (≤15MB)。',
      ),
    ).toBeInTheDocument();
  });

  it('renders publish and unpublish buttons according to article status', () => {
    const onPublish = vi.fn();
    const onUnpublish = vi.fn();

    // Draft note -> "发布文章"
    const { rerender } = render(
      <EditorPage
        model={{ ...editorFixture, status: 'draft' }}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
      />,
    );
    expect(screen.getByRole('button', { name: '发布文章' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '撤回为草稿' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '发布文章' }));
    expect(onPublish).toHaveBeenCalledTimes(1);

    // Published note -> "更新发布" and "撤回为草稿"
    rerender(
      <EditorPage
        model={{ ...editorFixture, status: 'published' }}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
      />,
    );
    expect(screen.getByRole('button', { name: '更新发布' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '撤回为草稿' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '撤回为草稿' }));
    expect(onUnpublish).toHaveBeenCalledTimes(1);
  });

  it('supports toggling settings drawer and keyboard Escape closing', () => {
    render(<EditorPage model={editorFixture} />);

    const settingsToggle = screen.getByRole('button', { name: '文章设置' });
    expect(settingsToggle).toHaveAttribute('aria-expanded', 'false');

    // Click to open
    fireEvent.click(settingsToggle);
    expect(settingsToggle).toHaveAttribute('aria-expanded', 'true');

    // Press Escape to close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(settingsToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('provides retry button when save state is failed', () => {
    const onSave = vi.fn();
    render(<EditorPage model={editorFixture} state="failed" onSave={onSave} />);

    const retryBtn = screen.getByRole('button', { name: '重试保存' });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('moves focus on Enter key in title input', () => {
    const focusFn = vi.fn();
    const mockEditor = {
      commands: { focus: focusFn },
      chain: () => ({ focus: () => ({ setParagraph: () => ({ run: vi.fn() }) }) }),
      isActive: () => false,
      can: () => ({ undo: () => true, redo: () => true }),
    };

    render(<EditorPage model={editorFixture} editor={mockEditor as never} />);
    const titleInput = screen.getByLabelText('Title');
    fireEvent.keyDown(titleInput, { key: 'Enter' });
    expect(focusFn).toHaveBeenCalledWith('start');
  });
});

describe('AssetPanel presentation', () => {
  it('renders an empty attachment state and controlled upload input', () => {
    const onUpload = vi.fn();
    render(<AssetPanel assets={[]} onUpload={onUpload} />);

    expect(screen.getByText('暂无附件')).toBeInTheDocument();
    const input = screen.getByLabelText('附件上传');
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
          {
            id: 'uploading',
            name: 'draft.pdf',
            sizeLabel: '1 KB',
            state: 'uploading',
            progress: 45,
          },
          { id: 'ready', name: 'reference.pdf', sizeLabel: '2 KB', state: 'ready' },
          {
            id: 'failed',
            name: 'broken.pdf',
            sizeLabel: '3 KB',
            state: 'error',
            errorMessage: 'Upload failed',
          },
        ]}
        onDownload={onDownload}
      />,
    );

    expect(screen.getByRole('progressbar', { name: '正在上传 draft.pdf' })).toHaveValue(45);
    expect(screen.getByText('就绪')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed');
    fireEvent.click(screen.getByRole('button', { name: '下载 reference.pdf' }));
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

    fireEvent.click(screen.getByRole('button', { name: '删除 reference.pdf' }));
    expect(screen.getByRole('dialog', { name: '删除附件 reference.pdf' })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '删除 reference.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    expect(onDelete).toHaveBeenCalledWith('ready');
  });

  it('moves focus into the delete dialog, supports Escape, and restores the trigger focus', () => {
    render(
      <AssetPanel
        assets={[{ id: 'ready', name: 'reference.pdf', sizeLabel: '2 KB', state: 'ready' }]}
        onDelete={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('button', { name: '删除 reference.pdf' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: '取消' }), {
      key: 'Tab',
      shiftKey: true,
    });
    expect(screen.getByRole('button', { name: '确认删除' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: '确认删除' }), { key: 'Tab' });
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
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
    screen.getByRole('button', { name: '下载 reference.pdf' }).focus();
    fireEvent.click(screen.getByRole('button', { name: '下载 reference.pdf' }));
    expect(onDownload).toHaveBeenCalledWith('ready');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('/api/');
    fetchSpy.mockRestore();
  });

  it('supports retrying a failed upload when file is attached', () => {
    const onUpload = vi.fn();
    const testFile = new File(['data'], 'failed.png', { type: 'image/png' });
    render(
      <AssetPanel
        assets={[
          {
            id: 'upload-err',
            name: 'failed.png',
            sizeLabel: '2 KB',
            state: 'error',
            errorMessage: '网络连接超时',
            file: testFile,
          },
        ]}
        onUpload={onUpload}
      />,
    );

    const retryBtn = screen.getByRole('button', { name: '重试上传 failed.png' });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onUpload).toHaveBeenCalledWith(testFile);
  });
});
