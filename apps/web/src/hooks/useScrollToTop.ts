import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const SCROLL_SESSION_PREFIX = 'scroll_pos:';

function getSessionKey(pathname: string, search: string): string {
  return `${SCROLL_SESSION_PREFIX}${pathname}${search}`;
}

export function saveScrollPosition(pathname: string, search: string, scrollY: number): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(
      getSessionKey(pathname, search),
      String(Math.max(0, Math.round(scrollY))),
    );
  } catch {
    // Ignore storage quota or cross-origin restrictions
  }
}

export function getSavedScrollPosition(pathname: string, search: string): number | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(getSessionKey(pathname, search));
    if (raw !== null) {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

function safeScrollTo(top: number): void {
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    try {
      window.scrollTo({ top, behavior: 'auto' });
    } catch {
      // jsdom or unsupported option fallback
      try {
        (window.scrollTo as (x: number, y: number) => void)(0, top);
      } catch {
        // Ignore
      }
    }
  }
}

export function useScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Listen to scroll events on current page and persist to sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        saveScrollPosition(location.pathname, location.search, window.scrollY);
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
      saveScrollPosition(location.pathname, location.search, window.scrollY);
    };
  }, [location.pathname, location.search]);

  // Handle route transition: scroll restoration vs push to top with focus
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const state = location.state as {
      restoreScroll?: boolean;
      scrollY?: number;
      rootSource?: { scrollY?: number };
    } | null;

    const isBackOrRestore =
      navigationType === 'POP' || Boolean(state?.restoreScroll);

    if (isBackOrRestore) {
      const targetY =
        (typeof state?.scrollY === 'number' ? state.scrollY : undefined) ??
        (typeof state?.rootSource?.scrollY === 'number' ? state.rootSource.scrollY : undefined) ??
        getSavedScrollPosition(location.pathname, location.search);

      if (typeof targetY === 'number' && targetY > 0) {
        // Immediate restoration attempt
        safeScrollTo(targetY);

        let attempts = 0;
        const maxAttempts = 15;
        let rafId: number | null = null;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const attemptRestore = () => {
          safeScrollTo(targetY);

          // If content is still loading or document height has not grown to targetY, retry
          const docHeight =
            document.documentElement.scrollHeight || document.body.scrollHeight || 0;
          if (attempts < maxAttempts && docHeight < targetY + 50) {
            attempts++;
            if (typeof requestAnimationFrame === 'function') {
              rafId = requestAnimationFrame(attemptRestore);
            } else {
              timeoutId = setTimeout(attemptRestore, 16);
            }
          }
        };

        if (typeof requestAnimationFrame === 'function') {
          rafId = requestAnimationFrame(attemptRestore);
        }

        return () => {
          if (rafId !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(rafId);
          }
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }
        };
      }
    }

    // Default push to new page: scroll to top and focus content
    safeScrollTo(0);

    const focusContent = () => {
      const focusTarget =
        document.querySelector<HTMLElement>('#article-content') ??
        document.querySelector<HTMLElement>('h1') ??
        document.querySelector<HTMLElement>('#main-content');

      if (focusTarget) {
        if (!focusTarget.hasAttribute('tabindex')) {
          focusTarget.setAttribute('tabindex', '-1');
        }
        focusTarget.focus({ preventScroll: true });
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(focusContent);
    } else {
      setTimeout(focusContent, 0);
    }
  }, [location.pathname, location.search, location.key]);
}
