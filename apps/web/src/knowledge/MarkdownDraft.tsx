import { useState } from 'react';
import { parseMarkdownToTiptap } from '@namdw/shared';
import { TiptapRenderer } from '../components/reading/TiptapRenderer';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { clipboardImages, type ImageUpload, type UploadedImage } from './clipboard-images';

export type MarkdownDraftHandle = { insertAsset: (asset: UploadedImage) => void };
export function MarkdownDraft({
  onChange,
  onUpload,
  ref,
}: {
  onChange: (contentJson: string) => void;
  onUpload?: ImageUpload;
  ref?: Ref<MarkdownDraftHandle>;
}) {
  const [source, setSource] = useState('');
  const latestSource = useRef('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const anchors = useRef(new Set<{ from: number; to: number }>());
  const update = (value: string) => {
    const previous = latestSource.current;
    let start = 0;
    while (start < previous.length && start < value.length && previous[start] === value[start])
      start++;
    let end = previous.length;
    let nextEnd = value.length;
    while (end > start && nextEnd > start && previous[end - 1] === value[nextEnd - 1]) {
      end--;
      nextEnd--;
    }
    const map = (position: number) =>
      position <= start ? position : position >= end ? position + nextEnd - end : nextEnd;
    for (const anchor of anchors.current) {
      anchor.from = map(anchor.from);
      anchor.to = map(anchor.to);
    }
    latestSource.current = value;
    setSource(value);
    onChange(
      parseMarkdownToTiptap(value, 'document.md', { preserveFirstHeading: true }).documentJson,
    );
  };
  const prepareInsertion = () => {
    const anchor = {
      from: textarea.current?.selectionStart ?? latestSource.current.length,
      to: textarea.current?.selectionEnd ?? latestSource.current.length,
    };
    anchors.current.add(anchor);
    const insert = (asset: UploadedImage) => {
      anchors.current.delete(anchor);
      const alt = asset.originalName.replace(/[[\]\\\r\n]/g, '');
      const image = !asset.mimeType || asset.mimeType.startsWith('image/');
      const reference = `\n\n${image ? '!' : ''}[${alt}](/api/assets/${encodeURIComponent(asset.id)}${image ? '?inline=1' : ''})\n\n`;
      const current = latestSource.current;
      const siblings = [...anchors.current].filter(
        (other) => other.from >= anchor.from && other.to <= anchor.to,
      );
      update(current.slice(0, anchor.from) + reference + current.slice(anchor.to));
      for (const other of siblings) other.from = other.to = anchor.from + reference.length;
    };
    return Object.assign(insert, {
      cancel: () => {
        anchors.current.delete(anchor);
      },
    });
  };
  useImperativeHandle(ref, () => ({ insertAsset: (asset) => prepareInsertion()(asset) }));
  const [preview, setPreview] = useState(false);
  const parsed = parseMarkdownToTiptap(source, 'document.md', { preserveFirstHeading: true });
  return (
    <section className="markdown-draft" aria-label="Markdown 编辑与预览">
      <div className="markdown-draft__tabs" role="group" aria-label="正文显示方式">
        <button
          type="button"
          className="knowledge-button"
          aria-pressed={!preview}
          onClick={() => setPreview(false)}
        >
          编辑 Markdown
        </button>
        <button
          type="button"
          className="knowledge-button"
          aria-pressed={preview}
          onClick={() => setPreview(true)}
        >
          实时预览
        </button>
      </div>
      <div className="markdown-draft__panes" data-preview={preview}>
        <label className="markdown-draft__source">
          Markdown 正文
          <textarea
            ref={textarea}
            aria-label="Markdown 正文"
            value={source}
            spellCheck={false}
            placeholder="输入或粘贴 Markdown，也可直接粘贴图片…"
            onChange={(event) => update(event.target.value)}
            onPaste={(event) => {
              const files = clipboardImages(event.clipboardData);
              if (!files.length || !onUpload) return;
              event.preventDefault();
              for (const file of files) onUpload(file, prepareInsertion());
            }}
          />
        </label>
        <div className="markdown-draft__preview">
          <TiptapRenderer content={parsed.documentJson} />
        </div>
      </div>
    </section>
  );
}
