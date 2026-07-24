import type { InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ className = '', error, hint, id, label, ...props }: InputProps) {
  const message = error ?? hint;
  const messageId = message && id ? `${id}-message` : undefined;
  const classes = ['ui-input', className].filter(Boolean).join(' ');

  return (
    <div className="ui-input-group">
      <label className="ui-input-label" htmlFor={id}>
        {label}
      </label>
      <input
        {...props}
        aria-describedby={messageId}
        aria-invalid={error ? true : undefined}
        className={classes}
        id={id}
      />
      {message ? (
        <p className={`ui-input-message${error ? ' ui-input-message--error' : ''}`} id={messageId}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
