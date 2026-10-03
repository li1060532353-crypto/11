import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';

export interface InputDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}

export function InputDialog({
  isOpen,
  title,
  description,
  label,
  placeholder,
  defaultValue = '',
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const id = useId();
  const titleId = `input-dialog-title-${id}`;
  const descId = `input-dialog-desc-${id}`;
  const inputId = `input-dialog-field-${id}`;

  // Reset input state when dialog opens or defaultValue changes
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue ?? '');
      setIsSubmitting(false);
    }
  }, [isOpen, defaultValue]);

  // Accessible modal focus management and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;

    // Auto-focus input on open
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes dialog
      if (e.key === 'Escape') {
        if (!isSubmittingRef.current) {
          e.preventDefault();
          onCancelRef.current();
        }
        return;
      }

      // Tab focus trap
      if (e.key === 'Tab') {
        const dialogNode = dialogRef.current;
        if (!dialogNode) return;

        const focusableElements = Array.from(
          dialogNode.querySelectorAll<HTMLElement>('*'),
        ).filter((el): el is HTMLElement => {
          if (el.matches('button, input, textarea, select, a[href], [tabindex]')) {
            const formEl = el as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            if (formEl.disabled) return false;
            if (el.getAttribute('tabindex') === '-1') return false;
            return true;
          }
          return false;
        });
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (!firstElement || !lastElement) {
          e.preventDefault();
          return;
        }

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !dialogNode.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !dialogNode.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      const result = onConfirm(value);
      if (result && typeof (result as Promise<void>).then === 'function') {
        setIsSubmitting(true);
        await result;
      }
    } catch (err) {
      console.error('InputDialog onConfirm failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    // Only close if click is directly on the backdrop container, not child elements
    if (e.target === e.currentTarget && !isSubmitting) {
      onCancel();
    }
  };

  return (
    <div
      className="ui-dialog-backdrop knowledge-dialog-backdrop"
      onClick={handleBackdropClick}
      data-testid="input-dialog-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="ui-dialog knowledge-dialog"
        data-testid="input-dialog"
      >
        <div className="ui-dialog__header knowledge-dialog__header">
          <h2 id={titleId} className="ui-dialog__title knowledge-dialog__title">
            {title}
          </h2>
          <button
            type="button"
            className="ui-dialog__close knowledge-dialog__close"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="ui-dialog__form knowledge-dialog__form">
          <div className="ui-dialog__body knowledge-dialog__body">
            {description ? (
              <p id={descId} className="ui-dialog__description knowledge-dialog__description">
                {description}
              </p>
            ) : null}

            <div className="ui-dialog__field knowledge-dialog__field">
              {label ? (
                <label htmlFor={inputId} className="ui-dialog__label knowledge-dialog__label">
                  {label}
                </label>
              ) : null}
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                className="ui-input ui-dialog__input knowledge-dialog__input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                disabled={isSubmitting}
                aria-label={label ? undefined : title}
                aria-describedby={description ? descId : undefined}
              />
            </div>
          </div>

          <div className="ui-dialog__footer knowledge-dialog__footer">
            <button
              type="button"
              className="ui-button ui-button--secondary knowledge-button knowledge-button--secondary"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {cancelText}
            </button>
            <button
              type="submit"
              className="ui-button ui-button--primary knowledge-button knowledge-button--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? '保存中...' : confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InputDialog;
