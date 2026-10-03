import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';

type EditorNavigationGuardProps = {
  dirty: boolean;
  busy: boolean;
  onSave: () => Promise<boolean>;
  allowedPath?: string | (() => string | undefined) | undefined;
};

export function EditorNavigationGuard({
  dirty,
  busy,
  onSave,
  allowedPath,
}: EditorNavigationGuardProps) {
  const blocker = useBlocker(({ currentLocation, nextLocation, historyAction }) => {
    if (
      historyAction === 'REPLACE' &&
      currentLocation.pathname === nextLocation.pathname &&
      currentLocation.search === nextLocation.search &&
      currentLocation.hash === nextLocation.hash
    ) {
      return false;
    }
    const destination = typeof allowedPath === 'function' ? allowedPath() : allowedPath;
    if (destination && nextLocation.pathname === destination && nextLocation.state?.editorHandoff) {
      return false;
    }
    return dirty || busy;
  });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const saveLock = useRef(false);
  const blocked = blocker.state === 'blocked';

  useEffect(() => {
    if (!blocked) return;
    setFailed(false);
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [blocked]);

  async function saveAndLeave() {
    if (busy || saveLock.current || blocker.state !== 'blocked') return;
    saveLock.current = true;
    setSaving(true);
    setFailed(false);
    try {
      if (await onSave()) blocker.proceed();
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  if (!blocked) return null;
  const waiting = busy || saving;

  return (
    <div className="knowledge-dialog-backdrop">
      <section
        ref={dialogRef}
        className="knowledge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-navigation-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) blocker.reset();
          if (event.key !== 'Tab') return;
          const buttons =
            dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
          if (!buttons?.length) return;
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (!first || !last) return;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 id="editor-navigation-title">当前有未保存的修改</h2>
        <p>
          {waiting
            ? '正在处理保存或发布，请等待完成后再离开。'
            : '离开前可以保存修改，或放弃尚未保存的修改。'}
        </p>
        {failed && <p role="alert">保存失败，修改仍保留在编辑器中，请重试。</p>}
        <div className="knowledge-dialog__actions">
          <button type="button" disabled={saving} onClick={() => blocker.reset()}>
            继续编辑
          </button>
          <button type="button" disabled={waiting} onClick={() => void saveAndLeave()}>
            保存并离开
          </button>
          <button type="button" disabled={waiting} onClick={() => blocker.proceed()}>
            放弃修改并离开
          </button>
        </div>
      </section>
    </div>
  );
}
