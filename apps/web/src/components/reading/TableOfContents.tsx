import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMobileViewport } from '../../hooks/useMobileViewport';

import type { ArticleHeading } from './headingExtractor';

function currentHeadingId(): string {
  const hash = window.location.hash.slice(1);
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

export function TableOfContents({ headings }: { headings: readonly ArticleHeading[] }) {
  const [activeId, setActiveId] = useState(currentHeadingId);
  const mobile = useMobileViewport();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const selectedHeading = useRef<HTMLElement | null>(null);
  const drawerId = useId();
  const headingKey = headings.map((heading) => heading.id).join('|');

  useEffect(() => {
    setOpen(false);
  }, [mobile, headingKey]);

  useEffect(() => {
    if (!open || !mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== backdropRef.current,
      )
      .map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => {
      element.inert = true;
    });
    drawerRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== 'Tab') return;
      const elements = drawerRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) return;
      if (
        event.shiftKey &&
        (document.activeElement === first || !drawerRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !drawerRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      document.removeEventListener('keydown', onKeyDown);
      const target = selectedHeading.current;
      selectedHeading.current = null;
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ block: 'start', behavior: 'instant' });
      } else {
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
  }, [open, mobile]);

  useEffect(() => {
    let hashFrame = 0;
    const syncActiveId = () => {
      const id = currentHeadingId();
      setActiveId(id);
      if (!mobile) return;
      cancelAnimationFrame(hashFrame);
      hashFrame = requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
      });
    };
    window.addEventListener('hashchange', syncActiveId);

    if (!headings.length) {
      return () => {
        window.removeEventListener('hashchange', syncActiveId);
        cancelAnimationFrame(hashFrame);
      };
    }

    const headingIds = headings.map((h) => h.id);
    let ticking = false;
    let frame = 0;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      frame = requestAnimationFrame(() => {
        ticking = false;
        const headingElements = headingIds
          .map((id) => document.getElementById(id))
          .filter((el): el is HTMLElement => el !== null);

        const firstHeading = headingElements[0];
        if (!firstHeading) return;

        const offset = (parseFloat(getComputedStyle(firstHeading).scrollMarginTop) || 140) + 1;
        let current = firstHeading.id;
        for (const el of headingElements) {
          const top = el.getBoundingClientRect().top;
          if (top <= offset) {
            current = el.id;
          } else {
            break;
          }
        }
        setActiveId(current);
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('hashchange', syncActiveId);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(hashFrame);
    };
  }, [headings, mobile]);

  const contents = (
    <nav className="table-of-contents" aria-label="文章目录">
      {headings.length ? (
        <ol>
          {headings.map((heading) => (
            <li key={heading.id} className={`table-of-contents__level-${heading.level}`}>
              <a
                href={`#${heading.id}`}
                aria-current={activeId === heading.id ? 'location' : undefined}
                onClick={(event) => {
                  if (!mobile || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
                    return;
                  const target = document.getElementById(heading.id);
                  if (!target) return;
                  event.preventDefault();
                  // Preserve the router entry key so a chapter jump does not reset page scrolling.
                  window.history.pushState(
                    window.history.state,
                    '',
                    `#${encodeURIComponent(heading.id)}`,
                  );
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                  setActiveId(heading.id);
                  selectedHeading.current = target;
                  setOpen(false);
                }}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p>本文没有分节。</p>
      )}
    </nav>
  );

  if (!mobile)
    return (
      <>
        <p className="table-of-contents__title">目录</p>
        {contents}
      </>
    );
  if (!headings.length) return null;
  return (
    <>
      <button
        ref={triggerRef}
        className="mobile-toc-trigger"
        type="button"
        aria-label="打开文章目录"
        aria-expanded={open}
        aria-controls={drawerId}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        目录
      </button>
      {open &&
        createPortal(
          <div
            ref={backdropRef}
            className="mobile-toc-backdrop"
            data-testid="mobile-toc-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <div
              ref={drawerRef}
              id={drawerId}
              className="mobile-toc-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${drawerId}-title`}
            >
              <header className="mobile-toc-drawer__header">
                <h2 id={`${drawerId}-title`}>文章目录</h2>
                <button type="button" aria-label="关闭文章目录" onClick={() => setOpen(false)}>
                  收起
                </button>
              </header>
              <p className="mobile-toc-drawer__hint">选择章节，继续阅读</p>
              {contents}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
