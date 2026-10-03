import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function DeleteNotesDialog({
  titles,
  onConfirm,
  onCancel,
}: {
  titles: readonly string[];
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const cancelAction = useRef(onCancel);
  cancelAction.current = onCancel;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const siblings = Array.from(document.body.children).filter((el) => !el.contains(panel.current));
    const inert = siblings.map((el) => el.hasAttribute('inert'));
    siblings.forEach((el) => el.setAttribute('inert', ''));
    cancel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busy.current) cancelAction.current();
      }
      if (event.key === 'Tab') {
        const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        event.preventDefault();
        if (!buttons?.length) {
          panel.current?.focus();
          return;
        }
        const index = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      siblings.forEach((el, i) => {
        if (!inert[i]) el.removeAttribute('inert');
      });
      previous?.focus();
    };
  }, []);
  const submit = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await onConfirm();
      onCancel();
    } catch {
      setError('删除失败，请稍后重试。');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return createPortal(
    <div
      className="ui-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy.current) onCancel();
      }}
    >
      <div
        className="ui-dialog knowledge-delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        aria-busy={pending}
        ref={panel}
        tabIndex={-1}
      >
        <span className="knowledge-delete-dialog__eyebrow">CONTENT / RECYCLE BIN</span>
        <h2 className="ui-dialog__title" id={`${id}-title`}>
          删除 {titles.length} 篇文章？
        </h2>
        <p id={`${id}-description`}>文章将移入回收站，可恢复为草稿。已发布文章会从公开列表移除。</p>
        <ul className="knowledge-delete-dialog__list">
          {titles.map((title, index) => (
            <li key={index}>{title}</li>
          ))}
        </ul>
        {error ? <p role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button
            ref={cancel}
            type="button"
            className="knowledge-button knowledge-button--quiet"
            disabled={pending}
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="knowledge-button knowledge-button--danger"
            disabled={pending}
            onClick={() => void submit()}
          >
            {pending ? '正在移入回收站…' : '移入回收站'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
