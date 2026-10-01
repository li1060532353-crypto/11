import { useCallback, useRef, useState, type HTMLAttributes } from 'react';

type CopyState = 'idle' | 'copied' | 'error';

function CopyButton({ getText }: { getText: () => string }) {
  const [state, setState] = useState<CopyState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleCopy = useCallback(async () => {
    try {
      const text = getText();
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setState('copied');
    } catch {
      setState('error');
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setState('idle'), 1800);
  }, [getText]);

  return (
    <button
      type="button"
      className={`code-copy-btn code-copy-btn--${state}`}
      aria-label={state === 'copied' ? '已复制' : '复制代码'}
      onClick={handleCopy}
    >
      {state === 'copied' ? (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function CodeBlock({ children, ...props }: HTMLAttributes<HTMLPreElement>) {
  const preRef = useRef<HTMLPreElement>(null);

  const getText = useCallback(() => {
    const code = preRef.current?.querySelector('code');
    return code?.textContent ?? preRef.current?.textContent ?? '';
  }, []);

  return (
    <div className="code-block-container">
      <pre ref={preRef} {...props}>
        {children}
      </pre>
      <CopyButton getText={getText} />
    </div>
  );
}
