import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { MarkdownDraft } from './MarkdownDraft';
import { isMarkdownPaste } from './markdown-paste';

describe('Markdown drafting', () => {
  it.each([
    [0, 1],
    [1, 0],
  ])('keeps both images pasted over selected text (completion order %s,%s)', (first, second) => {
    const insertions: Array<(asset: { id: string; originalName: string }) => void> = [];
    render(
      <MarkdownDraft
        onChange={vi.fn()}
        onUpload={(_file, insert) => {
          insertions.push(insert!);
        }}
      />,
    );
    const input = screen.getByLabelText('Markdown 正文') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Before selected After' } });
    input.setSelectionRange(7, 15);
    fireEvent.paste(input, {
      clipboardData: {
        files: [
          new File(['a'], 'a.png', { type: 'image/png' }),
          new File(['b'], 'b.png', { type: 'image/png' }),
        ],
        items: [],
      },
    });
    act(() => insertions[first!]!({ id: `asset-${first}`, originalName: `${first}.png` }));
    act(() => insertions[second!]!({ id: `asset-${second}`, originalName: `${second}.png` }));
    expect(input.value).toContain('/api/assets/asset-0?inline=1');
    expect(input.value).toContain('/api/assets/asset-1?inline=1');
    expect(input.value).not.toContain('selected');
    expect(input.value).toContain('Before ');
    expect(input.value).toContain(' After');
  });
  it('preserves edits made before the insertion point while an upload is pending', () => {
    let insert!: (asset: { id: string; originalName: string }) => void;
    const onUpload = vi.fn((_file: File, callback?: typeof insert) => {
      insert = callback!;
    });
    render(<MarkdownDraft onChange={vi.fn()} onUpload={onUpload} />);
    const input = screen.getByLabelText('Markdown 正文') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'BeforeAfter' } });
    input.setSelectionRange(6, 6);
    fireEvent.paste(input, {
      clipboardData: { files: [new File(['png'], 'shot.png', { type: 'image/png' })], items: [] },
    });
    fireEvent.change(input, { target: { value: 'New BeforeAfter' } });
    fireEvent.change(input, { target: { value: 'New BeforeAfter more' } });
    act(() => insert({ id: 'asset-1', originalName: 'shot.png' }));
    expect(input.value).toBe(
      'New Before\n\n![shot.png](/api/assets/asset-1?inline=1)\n\nAfter more',
    );
  });
  it('uploads a pasted image and inserts its private reference at the cursor', async () => {
    const onChange = vi.fn();
    const onUpload = vi.fn(
      async (_file: File, insert?: (asset: { id: string; originalName: string }) => void) =>
        insert?.({ id: 'asset-1', originalName: 'shot.png' }),
    );
    render(<MarkdownDraft onChange={onChange} onUpload={onUpload} />);
    const input = screen.getByLabelText('Markdown 正文') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'BeforeAfter' } });
    input.setSelectionRange(6, 6);
    const file = new File(['png'], 'shot.png', { type: 'image/png' });
    fireEvent.paste(input, { clipboardData: { files: [file], items: [] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(input.value).toBe('Before\n\n![shot.png](/api/assets/asset-1?inline=1)\n\nAfter');
    expect(JSON.parse(onChange.mock.calls.at(-1)![0]).content).toContainEqual({
      type: 'image',
      attrs: { assetId: 'asset-1', alt: 'shot.png' },
    });
    expect(screen.getByRole('img', { name: 'shot.png' })).toHaveAttribute(
      'src',
      '/api/assets/asset-1?inline=1',
    );
  });
  it('converts pasted source to canonical document and previews headings, lists and math', () => {
    const onChange = vi.fn();
    render(<MarkdownDraft onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Markdown 正文'), {
      target: { value: '# 标题\n\n- 条目\n\n$$x^2$$' },
    });
    expect(screen.getByRole('heading', { name: '标题' })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('条目');
    expect(document.querySelector('.katex')).not.toBeNull();
    expect(JSON.parse(onChange.mock.calls.at(-1)![0]).content[0].type).toBe('heading');
  });
  it('keeps inline LaTeX subscripts together instead of treating them as italic marks', () => {
    render(<MarkdownDraft onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Markdown 正文'), {
      target: { value: '公式 $a_i + b_j$' },
    });
    expect(document.querySelector('.katex')).not.toBeNull();
    expect(document.querySelector('em')).toBeNull();
  });
  it('recognizes markdown without changing ordinary text or code', () => {
    expect(isMarkdownPaste('# Heading\n\n**bold**')).toBe(true);
    expect(isMarkdownPaste('formula $x^2$')).toBe(true);
    expect(isMarkdownPaste('ordinary text')).toBe(false);
  });
});
