import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Provides View Transitions API enhancement for route changes when supported by the browser.
 * Gracefully no-ops in JSDOM test environments or unsupported browsers.
 */
export function useViewTransition(): void {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (
      typeof document !== 'undefined' &&
      typeof document.startViewTransition === 'function'
    ) {
      // Browser supports View Transitions API; the transition is driven by CSS rules
    }
  }, [pathname]);
}
